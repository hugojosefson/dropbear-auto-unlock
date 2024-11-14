import { setup } from "xstate";
import { isCommandPrompt } from "./is-command-prompt.ts";
import { isZfsUnlockPrompt } from "./is-zfs-unlock-prompt.ts";
import { kill } from "./kill.ts";
import { wrapProcess } from "./wrap-stdio.ts";

export type Context = {
  passphrase: string;
  sshCommand: Deno.Command;
  sshProcess: Deno.ChildProcess;
  stdin: WritableStreamDefaultWriter<string>;
  stdout: ReadableStream<string>;
  stderr: ReadableStream<string>;
};

export const machine = setup({
  types: {
    context: {} as Context,
    events: {} as
      | {
        type:
          | "cleanedUp"
          | "exit"
          | "connecting"
          | "connectionSuccess"
          | "connectionFailure"
          | "zfsUnlockPromptDetected"
          | "commandPromptDetected"
          | "passphraseEntered"
          | "zfsLocked"
          | "zfsUnlocked"
          | "zfsUnlockCalled"
          | "serverRebootDetected";
      }
      | {
        type: "error";
        data: string;
      },
  },
}).createMachine({
  context: {} as Context,
  id: "sshMachine",
  initial: "connecting",
  on: {
    connectionFailure: {
      target: "#sshMachine.sleeping",
      reenter: true,
    },
    exit: {
      target: "#sshMachine.exit",
      reenter: true,
    },
  },
  states: {
    cleanup: {
      entry: async ({ context, self }) => {
        const cleanedUp = Promise.allSettled([
          context.stdin.close(),
          context.stdout.cancel(),
          context.stderr.cancel(),
          context.sshProcess.status,
        ]);
        await kill(context.sshProcess, [["SIGINT", 1000], ["SIGTERM", 1000]]);
        await cleanedUp;
        self.send({ type: "cleanedUp" });
      },
      on: {
        cleanedUp: { target: "connecting" },
      },
    },
    connecting: {
      entry: ({ context, self }) => {
        context.sshProcess = context.sshCommand.spawn();
        Object.assign(context, wrapProcess(context.sshProcess));
        self.send({ type: "connectionSuccess" });
      },
      on: {
        connectionSuccess: { target: "readingOutput" },
      },
      description: "Attempting to establish an SSH connection to the server.",
    },
    readingOutput: {
      after: {
        5000: { target: "cleanup" },
      },
      entry: async ({ context, self }) => {
        for await (const burst of context.stdout) {
          console.log(burst);
          if (isZfsUnlockPrompt(burst)) {
            self.send({ type: "zfsUnlockPromptDetected" });
            break;
          }
          if (isCommandPrompt(burst)) {
            self.send({ type: "commandPromptDetected" });
            break;
          }
        }
      },
      on: {
        zfsUnlockPromptDetected: { target: "enteringPassphrase" },
        commandPromptDetected: { target: "checkingZfsStatus" },
      },
      description:
        "Reading from the SSH client process stdout to determine the next steps.",
    },
    sleeping: {
      after: { "5000": { target: "connecting" } },
      description:
        "The SSH connection attempt failed. The program is sleeping before retrying.",
    },
    enteringPassphrase: {
      on: {
        passphraseEntered: { target: "readingOutput" },
      },
      entry: async ({ context, self }) => {
        await context.stdin.write(context.passphrase + "\n");
        self.send({ type: "passphraseEntered" });
      },
      description:
        "Detected a ZFS unlock prompt. Entering the decryption passphrase.",
    },
    checkingZfsStatus: {
      on: {
        zfsLocked: { target: "callingZfsUnlock" },
        zfsUnlocked: { target: "runningSleepInfinity" },
        error: { target: "cleanup" },
      },
      entry: async ({ context, self }) => {
        await context.stdin.write(
          "zfs get -H -o name,property,value keylocation,keystatus\n",
        );
        const reader: ReadableStreamDefaultReader<string> = context.stdout
          .getReader();
        const { value, done } = await reader.read();
        if (done) {
          self.send({
            type: "error",
            data: "Got no output from zfs get command.",
          });
          return;
        }
        const triples = value.split("\n")
          .filter((line: string) => line.length > 0)
          .map((line: string) => line.split(/\s+/))
          .filter((words: string[]) => words.length === 3) as [
            string,
            string,
            string,
          ][];

        const fss = triples.reduce((acc, [fs, property, value]) => {
          const fsObject = acc[fs];
          if (!fsObject) {
            acc[fs] = {};
          }
          acc[fs][property] = value;
          return acc;
        }, {} as Record<string, Record<string, string>>);

        const fsValues = Object.values(fss);
        if (fsValues.length === 0) {
          self.send({ type: "error", data: "Got no zfs properties." });
          return;
        }
        if (
          fsValues.some(({ keylocation, keystatus }) =>
            keylocation === "prompt" && keystatus === "unavailable"
          )
        ) {
          self.send({ type: "zfsLocked" });
        } else {
          self.send({ type: "zfsUnlocked" });
        }
      },
      description:
        "Detected a normal command prompt. Checking if the ZFS filesystem is unlocked.",
    },
    callingZfsUnlock: {
      on: {
        zfsUnlockCalled: { target: "readingOutput" },
      },
      entry: ({ context, self }) => {
        context.stdin.write("zfsunlock\n");
        self.send({ type: "zfsUnlockCalled" });
      },
      description:
        "The ZFS filesystem is locked. Attempting to call zfsunlock.",
    },
    runningSleepInfinity: {
      entry: ({ context }) => {
        context.stdin.write("sleep infinity\n");
      },
      description:
        "The ZFS filesystem is already unlocked. Running sleep infinity to wait for server reboot.",
    },
    exit: {
      type: "final",
      entry: async ({ context }) => {
        context.stdin.releaseLock();
        const rawStdin: WritableStreamDefaultWriter<Uint8Array> = context
          .sshProcess.stdin.getWriter();
        await rawStdin.write(new Uint8Array([0x03, 0x03, 0x04]));
        await rawStdin.close();

        await context.stdout.cancel();
        await context.stderr.cancel();

        context.sshProcess.kill();
        await context.sshProcess.status;
      },
    },
  },
});
