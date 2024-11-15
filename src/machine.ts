import { setup } from "xstate";
import { isCommandPrompt } from "./is-command-prompt.ts";
import { isZfsUnlockPrompt } from "./is-zfs-unlock-prompt.ts";
import { kill } from "./kill.ts";
import { SshDestination } from "./ssh-destination.ts";
import { wrapProcess } from "./wrap-stdio.ts";

export type Context = {
  passphrase: string;
  destination: SshDestination;
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
        console.log(`${context?.destination?.host}: setupContext`);
        if (event.type === "setContext") {
          console.log(
            `${context?.destination?.host}: setting context.${event.key}`,
          );
          context[event.key] = event.value;
        }
        if (context.sshCommand && context.passphrase && context.destination) {
          console.log(`${context?.destination?.host}: context complete`);
          self.send({ type: "contextComplete" });
        } else {
          console.log(`${context?.destination?.host}: context incomplete`);
        }
      },
      description: "Set up the context.",
    },
    cleanup: {
      entry: async ({ context, self }) => {
        console.log(`${context?.destination?.host}: Cleaning up...`);
        const cleanedUp = Promise.allSettled([
          context.stdin.close(),
          context.stdout.cancel(),
          context.stderr.cancel(),
          context.sshProcess.status,
        ]);
        await kill(context.sshProcess, [["SIGINT", 1000], ["SIGTERM", 1000]]);
        await cleanedUp;
        console.log(`${context?.destination?.host}: Cleaned up.`);
        self.send({ type: "cleanedUp" });
      },
      on: {
        cleanedUp: { target: "connecting" },
      },
    },
    connecting: {
      entry: ({ context, self }) => {
        console.log(`${context?.destination?.host}: Connecting...`);
        context.sshProcess = context.sshCommand.spawn();
        Object.assign(context, wrapProcess(context.sshProcess));
        console.log(`${context?.destination?.host}: Connected.`);
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
        console.log(`${context?.destination?.host}: Reading output...`);
        for await (const burst of context.stdout) {
          console.log({ burst });
          if (isZfsUnlockPrompt(burst)) {
            console.log(
              `${context?.destination?.host}: Got zfs unlock prompt.`,
            );
            self.send({ type: "zfsUnlockPromptDetected" });
            break;
          }
          if (isCommandPrompt(burst)) {
            console.log(`${context?.destination?.host}: Got command prompt.`);
            self.send({ type: "commandPromptDetected" });
            break;
          }
          console.log(`${context?.destination?.host}: Got other output.`);
        }
        console.log(`${context?.destination?.host}: Done reading output.`);
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
        console.log(`${context?.destination?.host}: Entering passphrase...`);
        await context.stdin.write(context.passphrase);
        console.log(`${context?.destination?.host}: Entered passphrase.`);
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
        console.log(`${context?.destination?.host}: Checking ZFS status...`);
        await context.stdin.write(
          "zfs get -H -o name,property,value keylocation,keystatus",
        );
        console.log(`${context?.destination?.host}: Sent zfs get command.`);
        const reader: ReadableStreamDefaultReader<string> = context.stdout
          .getReader();
        let value: string;
        let triples: string[][];
        try {
          const result = await reader.read();
          const done = result.done;
          console.log(
            `${context?.destination?.host}: Attempted to read output from zfs get command.`,
          );
          if (done) {
            console.log(
              `${context?.destination?.host}: Got no output from zfs get command (already done).`,
            );
            self.send({
              type: "error",
              data: "Got no output from zfs get command.",
            });
            return;
          }
          value = result.value;
          console.log(
            `${context?.destination?.host}: Got output from zfs get command.`,
          );
          console.log(value);
          triples = value.split("\n")
            .filter((line: string) => line.length > 0)
            .map((line: string) => line.split(/\s+/))
            .filter((words: string[]) => words.length === 3) as [
              string,
              string,
              string,
            ][];
          console.dir({ triples });
        } finally {
          reader.releaseLock();
        }

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
          console.log(
            `${context?.destination?.host}: Got no zfs properties.`,
          );
          self.send({ type: "error", data: "Got no zfs properties." });
          return;
        }
        if (
          fsValues.some(({ keylocation, keystatus }) =>
            keylocation === "prompt" && keystatus === "unavailable"
          )
        ) {
          console.log(
            `${context?.destination?.host}: ZFS filesystem is locked.`,
          );
          self.send({ type: "zfsLocked" });
        } else {
          console.log(
            `${context?.destination?.host}: ZFS filesystem is unlocked.`,
          );
          self.send({ type: "zfsUnlocked" });
        }
        console.log(
          `${context?.destination?.host}: Done checking ZFS status.`,
        );
      },
      description:
        "Detected a normal command prompt. Checking if the ZFS filesystem is unlocked.",
    },
    callingZfsUnlock: {
      on: {
        zfsUnlockCalled: { target: "readingOutput" },
      },
      entry: async ({ context, self }) => {
        console.log(`${context?.destination?.host}: Calling zfsunlock...`);
        await context.stdin.write("zfsunlock\n");
        console.log(`${context?.destination?.host}: Called zfsunlock.`);
        self.send({ type: "zfsUnlockCalled" });
      },
      description:
        "The ZFS filesystem is locked. Attempting to call zfsunlock.",
    },
    runningSleepInfinity: {
      entry: async ({ context }) => {
        console.log(`${context?.destination?.host}: Running sleep infinity...`);
        await context.stdin.write("sleep infinity\n");
        console.log(`${context?.destination?.host}: Ran sleep infinity.`);
      },
      description:
        "The ZFS filesystem is already unlocked. Running sleep infinity to wait for server reboot.",
    },
    exit: {
      type: "final",
      entry: async ({ context }) => {
        console.log(
          `${context?.destination?.host}: Exiting with final state...`,
        );
        console.log(`${context?.destination?.host}: Releasing stdin lock...`);
        context.stdin.releaseLock();
        console.log(`${context?.destination?.host}: Released stdin lock.`);
        console.log(
          `${context?.destination?.host}: Pressing Ctrl-C, Ctrl-C, Ctrl-D...`,
        );
        const rawStdin: WritableStreamDefaultWriter<Uint8Array> = context
          .sshProcess.stdin.getWriter();
        await rawStdin.write(new Uint8Array([0x03, 0x03, 0x04]));
        console.log(
          `${context?.destination?.host}: Pressed Ctrl-C, Ctrl-C, Ctrl-D.`,
        );
        console.log(`${context?.destination?.host}: Closing stdin...`);
        await rawStdin.close();
        console.log(`${context?.destination?.host}: Closed stdin.`);

        console.log(`${context?.destination?.host}: Cancelling stdout...`);
        await context.stdout.cancel();
        console.log(`${context?.destination?.host}: Cancelled stdout.`);
        console.log(`${context?.destination?.host}: Cancelling stderr...`);
        await context.stderr.cancel();
        console.log(`${context?.destination?.host}: Cancelled stderr.`);

        console.log(`${context?.destination?.host}: Killing ssh process...`);
        context.sshProcess.kill();
        console.log(`${context?.destination?.host}: Killed ssh process.`);
        console.log(
          `${context?.destination?.host}: Waiting for ssh process to exit...`,
        );
        const status = await context.sshProcess.status;
        console.log(`Ssh process exited with status code ${status.code}.`);
      },
    },
  },
});
