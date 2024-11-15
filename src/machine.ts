import { setup } from "xstate";
import { isCommandPrompt } from "./is-command-prompt.ts";
import { isZfsUnlockPrompt } from "./is-zfs-unlock-prompt.ts";
import { kill } from "./kill.ts";
import type { SshDestination } from "./ssh-destination.ts";
import { wrapProcess } from "./wrap-stdio.ts";

export type ContextInput = {
  passphrase: string;
  destinationAlternatives: SshDestination[];
  sshCommands: Deno.Command[];
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

function getHostLabel(context: Partial<Context>) {
  const host = context?.destinationAlternatives
    ?.[context?.alternativeIndex ?? 0]?.host;
  return `[${host ?? "unknown"}]`;
}

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
  context: ({ input }) => ({  // Use input to initialize context
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
        console.log(
          `${getHostLabel(context)}: Cleaning up...`,
        );
        const cleanedUp = Promise.allSettled([
          context.stdin.close(),
          context.stdout.cancel(),
          context.stderr.cancel(),
          context.sshProcess.status,
        ]);
        await kill(context.sshProcess, [["SIGINT", 1000], ["SIGTERM", 1000]]);
        await cleanedUp;
        console.log(
          `${getHostLabel(context)}: Cleaned up.`,
        );
        self.send({ type: "cleanedUp" });
      },
      on: {
        cleanedUp: { target: "connecting" },
      },
    },
    connecting: {
      entry: ({ context, self }) => {
        console.log(`${getHostLabel(context)}: Connecting...`);
        context.alternativeIndex = typeof context.alternativeIndex === "number"
          ? (context.alternativeIndex + 1) % context.sshCommands.length
          : 0;
        context.sshProcess = context.sshCommands[context.alternativeIndex]
          .spawn();
        Object.assign(context, wrapProcess(context.sshProcess));
        console.log(`${getHostLabel(context)}: Connected.`);
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
        console.log(`${getHostLabel(context)}: Reading output...`);
        const stdout: ReadableStream<string> = context.stdout;
        const reader: ReadableStreamDefaultReader<string> = stdout.getReader();
        let done = false;
        try {
          while (!done) {
            const result = await reader.read();
            const burst = result.value;
            done = result.done;
            console.log(getHostLabel(context) + ":", { done, burst });
            if (done || !burst) {
              console.log(
                `${getHostLabel(context)}: Got no output (already done).`,
              );
              continue;
            }
            if (isZfsUnlockPrompt(burst)) {
              console.log(`${getHostLabel(context)}: Got zfs unlock prompt.`);
              self.send({ type: "zfsUnlockPromptDetected" });
              break;
            }
            if (isCommandPrompt(burst)) {
              console.log(`${getHostLabel(context)}: Got command prompt.`);
              self.send({ type: "commandPromptDetected" });
              break;
            }
            console.log(`${getHostLabel(context)}: Got other output.`);
          }
        } finally {
          console.log(
            `${getHostLabel(context)}: Releasing stdout reader lock.`,
          );
          reader.releaseLock();
          console.log(`${getHostLabel(context)}: Released stdout reader lock.`);
        }
        console.log(`${getHostLabel(context)}: Done reading output.`);
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
        console.log(`${getHostLabel(context)}: Entering passphrase...`);
        await context.stdin.write(context.passphrase);
        console.log(`${getHostLabel(context)}: Entered passphrase.`);
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
        console.log(`${getHostLabel(context)}: Checking ZFS status...`);
        console.log(
          `${getHostLabel(context)}: Lol jk. Assuming zfs is unlocked.`,
        );
        console.log(`${getHostLabel(context)}: ZFS filesystem is unlocked.`);
        self.send({ type: "zfsUnlocked" });
        console.log(`${getHostLabel(context)}: Done checking ZFS status.`);
      },
      description:
        "Detected a normal command prompt. Checking if the ZFS filesystem is unlocked.",
    },
    runningSleepInfinity: {
      entry: async ({ context, self }) => {
        console.log(`${getHostLabel(context)}: Running sleep infinity...`);
        await context.stdin.write("sleep infinity\n");
        console.log(`${getHostLabel(context)}: Ran sleep infinity.`);
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
        console.log(`${getHostLabel(context)}: Exiting with final state...`);
        console.log(`${getHostLabel(context)}: Releasing stdin lock...`);
        context.stdin.releaseLock();
        console.log(`${getHostLabel(context)}: Released stdin lock.`);
        console.log(
          `${getHostLabel(context)}: Pressing Ctrl-C, Ctrl-C, Ctrl-D...`,
        );
        const rawStdin: WritableStreamDefaultWriter<Uint8Array> = context
          .sshProcess.stdin.getWriter();
        await rawStdin.write(new Uint8Array([0x03, 0x03, 0x04]));
        console.log(
          `${getHostLabel(context)}: Pressed Ctrl-C, Ctrl-C, Ctrl-D.`,
        );
        console.log(`${getHostLabel(context)}: Closing stdin...`);
        await rawStdin.close();
        console.log(`${getHostLabel(context)}: Closed stdin.`);

        console.log(`${getHostLabel(context)}: Cancelling stdout...`);
        await context.stdout.cancel();
        console.log(`${getHostLabel(context)}: Cancelled stdout.`);
        console.log(`${getHostLabel(context)}: Cancelling stderr...`);
        await context.stderr.cancel();
        console.log(`${getHostLabel(context)}: Cancelled stderr.`);

        console.log(`${getHostLabel(context)}: Killing ssh process...`);
        context.sshProcess.kill();
        console.log(`${getHostLabel(context)}: Killed ssh process.`);
        console.log(
          `${getHostLabel(context)}: Waiting for ssh process to exit...`,
        );
        const status = await context.sshProcess.status;
        console.log(
          `${
            getHostLabel(context)
          }: Ssh process exited with status code ${status.code}.`,
        );
      },
    },
  },
});
