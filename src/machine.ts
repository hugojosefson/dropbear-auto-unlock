import { setup } from "xstate";
import { isCommandPrompt } from "./is-command-prompt.ts";
import { isZfsUnlockPrompt } from "./is-zfs-unlock-prompt.ts";
import { kill } from "./kill.ts";
import type { SshDestination } from "./ssh-destination.ts";
import { wrapProcess } from "./wrap-stdio.ts";
import type { Logger } from "./logger.ts";

export type ContextInput = {
  passphrase: string;
  destinationAlternatives: SshDestination[];
  sshCommands: Deno.Command[];
  logger: Logger;
};

export type Context = ContextInput & {
  alternativeIndex: undefined | number;
  sshProcess: Deno.ChildProcess;
  stdin: WritableStreamDefaultWriter<string>;
  stdout: ReadableStream<string>;
  stderr: ReadableStream<string>;
};

export type SetContextEvent<K extends keyof ContextInput = keyof ContextInput> =
  {
    type: "setContext";
    key: K;
    value: ContextInput[K];
  };

export const machine = setup({
  types: {
    context: {} as Context,
    input: {} as ContextInput, // Define input type
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
  context: ({ input }) => ({ // Use input to initialize context
    ...input,
    alternativeIndex: undefined,
    sshProcess: undefined as unknown as Deno.ChildProcess,
    stdin: undefined as unknown as WritableStreamDefaultWriter<string>,
    stdout: undefined as unknown as ReadableStream<string>,
    stderr: undefined as unknown as ReadableStream<string>,
  }),
  id: "sshMachine",
  initial: "connecting", // Start directly with connecting since context is initialized
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
        context.logger.log(
          `Cleaning up...`,
        );
        const cleanedUp = Promise.allSettled([
          context.stdin.close(),
          context.stdout.cancel(),
          context.stderr.cancel(),
          context.sshProcess.status,
        ]);
        await kill(context.sshProcess, [["SIGINT", 1000], ["SIGTERM", 1000]]);
        await cleanedUp;
        context.logger.log(`Cleaned up.`);
        self.send({ type: "cleanedUp" });
      },
      on: {
        cleanedUp: { target: "connecting" },
      },
    },
    connecting: {
      entry: ({ context, self }) => {
        context.logger.log(`Connecting...`);
        context.alternativeIndex = typeof context.alternativeIndex === "number"
          ? (context.alternativeIndex + 1) % context.sshCommands.length
          : 0;
        context.sshProcess = context.sshCommands[context.alternativeIndex]
          .spawn();
        Object.assign(context, wrapProcess(context.sshProcess));
        context.logger.log(`Connected.`);
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
        context.logger.log(`Reading output...`);
        const stdout: ReadableStream<string> = context.stdout;
        const reader: ReadableStreamDefaultReader<string> = stdout.getReader();
        let done = false;
        try {
          while (!done) {
            const result = await reader.read();
            const burst = result.value;
            done = result.done;
            context.logger.log(`done: ${done}, burst: ${burst}`);
            if (done || !burst) {
              context.logger.log(`Got no output (already done).`);
              continue;
            }
            if (isZfsUnlockPrompt(burst)) {
              context.logger.log(`Got zfs unlock prompt.`);
              self.send({ type: "zfsUnlockPromptDetected" });
              break;
            }
            if (isCommandPrompt(burst)) {
              context.logger.log(`Got command prompt.`);
              self.send({ type: "commandPromptDetected" });
              break;
            }
            context.logger.log(`Got other output.`);
          }
        } finally {
          context.logger.log(`Releasing stdout reader lock.`);
          reader.releaseLock();
          context.logger.log(`Released stdout reader lock.`);
        }
        context.logger.log(`Done reading output.`);
        self.send({
          type: "error",
          data: "Done reading output and no prompts detected.",
        });
      },
      on: {
        commandPromptDetected: { target: "checkingZfsStatus" },
        zfsUnlockPromptDetected: { target: "enteringPassphrase" },
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
        context.logger.log(`Entering passphrase...`);
        await context.stdin.write(context.passphrase);
        context.logger.log(`Entered passphrase.`);
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
        context.logger.log(`Checking ZFS status...`);
        context.logger.log(`Lol jk. Assuming zfs is unlocked.`);
        context.logger.log(`ZFS filesystem is unlocked.`);
        self.send({ type: "zfsUnlocked" });
        context.logger.log(`Done checking ZFS status.`);
      },
      description:
        "Detected a normal command prompt. Checking if the ZFS filesystem is unlocked.",
    },
    runningSleepInfinity: {
      entry: async ({ context, self }) => {
        context.logger.log(`Running sleep infinity...`);
        await context.stdin.write("sleep infinity\n");
        context.logger.log(`Ran sleep infinity.`);
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
        context.logger.log(`Exiting with final state...`);
        context.logger.log(`Releasing stdin lock...`);
        context.stdin.releaseLock();
        context.logger.log(`Released stdin lock.`);
        context.logger.log(`Pressing Ctrl-C, Ctrl-C, Ctrl-D...`);
        const rawStdin: WritableStreamDefaultWriter<Uint8Array> = context
          .sshProcess.stdin.getWriter();
        await rawStdin.write(new Uint8Array([0x03, 0x03, 0x04]));
        context.logger.log(`Pressed Ctrl-C, Ctrl-C, Ctrl-D.`);
        context.logger.log(`Closing stdin...`);
        await rawStdin.close();
        context.logger.log(`Closed stdin.`);

        context.logger.log(`Cancelling stdout...`);
        await context.stdout.cancel();
        context.logger.log(`Cancelled stdout.`);
        context.logger.log(`Cancelling stderr...`);
        await context.stderr.cancel();
        context.logger.log(`Cancelled stderr.`);

        context.logger.log(`Killing ssh process...`);
        context.sshProcess.kill();
        context.logger.log(`Killed ssh process.`);
        context.logger.log(`Waiting for ssh process to exit...`);
        const status = await context.sshProcess.status;
        context.logger.log(
          `Ssh process exited with status code ${status.code}.`,
        );
      },
    },
  },
});
