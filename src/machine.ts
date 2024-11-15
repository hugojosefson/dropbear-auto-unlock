import { setup } from "xstate";
import { isCommandPrompt } from "./is-command-prompt.ts";
import { isZfsUnlockPrompt } from "./is-zfs-unlock-prompt.ts";
import { kill } from "./kill.ts";
import type { SshDestination } from "./ssh-destination.ts";
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
        const stdout: ReadableStream<string> = context.stdout;
        const reader: ReadableStreamDefaultReader<string> = stdout.getReader();
        let done = false;
        try {
          while (!done) {
            const result = await reader.read();
            const burst = result.value;
            done = result.done;
            console.log(context.destination.host + ":", { done, burst });
            if (done || !burst) {
              console.log(
                `${context?.destination?.host}: Got no output (already done).`,
              );
              continue;
            }
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
        } finally {
          console.log(
            `${context?.destination?.host}: Releasing stdout reader lock.`,
          );
          reader.releaseLock();
          console.log(
            `${context?.destination?.host}: Released stdout reader lock.`,
          );
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
      after: {
        5000: { target: "cleanup" },
      },
      entry: async ({ context }) => {
        console.log(`${context?.destination?.host}: Entering passphrase...`);
        await context.stdin.write(context.passphrase);
        console.log(`${context?.destination?.host}: Entered passphrase.`);
      },
      description:
        "Detected a ZFS unlock prompt. Entering the decryption passphrase.",
    },
    checkingZfsStatus: {
      on: {
        zfsUnlocked: { target: "runningSleepInfinity" },
        error: { target: "cleanup" },
      },
      entry: ({ context, self }) => {
        console.log(`${context?.destination?.host}: Checking ZFS status...`);
        console.log(
          `${context?.destination?.host}: Lol jk. Assuming zfs is unlocked.`,
        );
        console.log(
          `${context?.destination?.host}: ZFS filesystem is unlocked.`,
        );
        self.send({ type: "zfsUnlocked" });
        console.log(
          `${context?.destination?.host}: Done checking ZFS status.`,
        );
      },
      description:
        "Detected a normal command prompt. Checking if the ZFS filesystem is unlocked.",
    },
    runningSleepInfinity: {
      entry: async ({ context, self }) => {
        console.log(`${context?.destination?.host}: Running sleep infinity...`);
        await context.stdin.write("sleep infinity\n");
        console.log(`${context?.destination?.host}: Ran sleep infinity.`);
        await context.sshProcess.status;
        self.send({ type: "serverRebootDetected" });
      },
      on: {
        serverRebootDetected: { target: "cleanup" },
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
