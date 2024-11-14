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

export type SetContextEvent<K extends keyof Context = keyof Context> = {
  type: "setContext";
  key: K;
  value: Context[K];
};

export const machine = setup({
  types: {
    events: {} as
      | {
        type:
          | "setContext"
          | "contextComplete"
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
      }
      | SetContextEvent,
  },
}).createMachine({
  context: {} as Context,
  id: "sshMachine",
  initial: "setupContext",
  on: {
    connectionFailure: {
      target: "#sshMachine.sleeping",
      reenter: true,
    },
    exit: {
      target: "#sshMachine.exit",
      reenter: true,
    },
    setContext: {
      target: "#sshMachine.setupContext",
      reenter: true,
    },
  },
  states: {
    setupContext: {
      on: {
        contextComplete: {
          target: "connecting",
        },
      },
      entry: ({ context, event, self }) => {
        console.log("setupContext");
        if (event.type === "setContext") {
          console.log(`setting context.${event.key}`);
          context[event.key] = event.value;
        }
        if (context.sshCommand && context.passphrase) {
          console.log("context complete");
          self.send({ type: "contextComplete" });
        } else {
          console.log("context incomplete");
        }
      },
      description: "Set up the context.",
    },
    cleanup: {
      entry: async ({ context, self }) => {
        console.log("Cleaning up...");
        const cleanedUp = Promise.allSettled([
          context.stdin.close(),
          context.stdout.cancel(),
          context.stderr.cancel(),
          context.sshProcess.status,
        ]);
        await kill(context.sshProcess, [["SIGINT", 1000], ["SIGTERM", 1000]]);
        await cleanedUp;
        console.log("Cleaned up.");
        self.send({ type: "cleanedUp" });
      },
      on: {
        cleanedUp: { target: "connecting" },
      },
    },
    connecting: {
      entry: ({ context, self }) => {
        console.log("Connecting...");
        context.sshProcess = context.sshCommand.spawn();
        Object.assign(context, wrapProcess(context.sshProcess));
        console.log("Connected.");
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
        console.log("Reading output...");
        for await (const burst of context.stdout) {
          console.log({ burst });
          if (isZfsUnlockPrompt(burst)) {
            console.log("Got zfs unlock prompt.");
            self.send({ type: "zfsUnlockPromptDetected" });
            break;
          }
          if (isCommandPrompt(burst)) {
            console.log("Got command prompt.");
            self.send({ type: "commandPromptDetected" });
            break;
          }
          console.log("Got other output.");
        }
        console.log("Done reading output.");
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
        console.log("Entering passphrase...");
        await context.stdin.write(context.passphrase);
        console.log("Entered passphrase.");
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
        console.log("Checking ZFS status...");
        await context.stdin.write(
          "zfs get -H -o name,property,value keylocation,keystatus",
        );
        console.log("Sent zfs get command.");
        const reader: ReadableStreamDefaultReader<string> = context.stdout
          .getReader();
        const { value, done } = await reader.read();
        console.log("Attempted to read output from zfs get command.");
        if (done) {
          console.log("Got no output from zfs get command (already done).");
          self.send({
            type: "error",
            data: "Got no output from zfs get command.",
          });
          return;
        }
        console.log("Got output from zfs get command.");
        console.log(value);
        const triples = value.split("\n")
          .filter((line: string) => line.length > 0)
          .map((line: string) => line.split(/\s+/))
          .filter((words: string[]) => words.length === 3) as [
            string,
            string,
            string,
          ][];
        console.dir({ triples });

        const fss = triples.reduce((acc, [fs, property, value]) => {
          const fsObject = acc[fs];
          if (!fsObject) {
            acc[fs] = {};
          }
          acc[fs][property] = value;
          return acc;
        }, {} as Record<string, Record<string, string>>);
        console.dir({ fss });

        const fsValues = Object.values(fss);
        if (fsValues.length === 0) {
          console.log("Got no zfs properties.");
          self.send({ type: "error", data: "Got no zfs properties." });
          return;
        }
        if (
          fsValues.some(({ keylocation, keystatus }) =>
            keylocation === "prompt" && keystatus === "unavailable"
          )
        ) {
          console.log("ZFS filesystem is locked.");
          self.send({ type: "zfsLocked" });
        } else {
          console.log("ZFS filesystem is unlocked.");
          self.send({ type: "zfsUnlocked" });
        }
        console.log("Done checking ZFS status.");
      },
      description:
        "Detected a normal command prompt. Checking if the ZFS filesystem is unlocked.",
    },
    callingZfsUnlock: {
      on: {
        zfsUnlockCalled: { target: "readingOutput" },
      },
      entry: async ({ context, self }) => {
        console.log("Calling zfsunlock...");
        await context.stdin.write("zfsunlock\n");
        console.log("Called zfsunlock.");
        self.send({ type: "zfsUnlockCalled" });
      },
      description:
        "The ZFS filesystem is locked. Attempting to call zfsunlock.",
    },
    runningSleepInfinity: {
      entry: async ({ context }) => {
        console.log("Running sleep infinity...");
        await context.stdin.write("sleep infinity\n");
        console.log("Ran sleep infinity.");
      },
      description:
        "The ZFS filesystem is already unlocked. Running sleep infinity to wait for server reboot.",
    },
    exit: {
      type: "final",
      entry: async ({ context }) => {
        console.log("Exiting with final state...");
        console.log("Releasing stdin lock...");
        context.stdin.releaseLock();
        console.log("Released stdin lock.");
        console.log("Pressing Ctrl-C, Ctrl-C, Ctrl-D...");
        const rawStdin: WritableStreamDefaultWriter<Uint8Array> = context
          .sshProcess.stdin.getWriter();
        await rawStdin.write(new Uint8Array([0x03, 0x03, 0x04]));
        console.log("Pressed Ctrl-C, Ctrl-C, Ctrl-D.");
        console.log("Closing stdin...");
        await rawStdin.close();
        console.log("Closed stdin.");

        console.log("Cancelling stdout...");
        await context.stdout.cancel();
        console.log("Cancelled stdout.");
        console.log("Cancelling stderr...");
        await context.stderr.cancel();
        console.log("Cancelled stderr.");

        console.log("Killing ssh process...");
        context.sshProcess.kill();
        console.log("Killed ssh process.");
        console.log("Waiting for ssh process to exit...");
        const status = await context.sshProcess.status;
        console.log(`Ssh process exited with status code ${status.code}.`);
      },
    },
  },
});
