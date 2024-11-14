import { setup } from "xstate";
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
    events: {} as {
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
      entry: async ({ context }) => {
        for await (const line of context.stdout) {
          console.log(line);
          // TODO: should read all we can read until a timeout, then check the last line for the prompt
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
      entry: ({ context }) => {
        // Action to enter the passphrase
        console.log("Entering ZFS decryption passphrase.");
        context.sshProcess?.stdin?.getWriter().write(
          new TextEncoder().encode(context.passphrase + "\n"),
        );
      },
      description:
        "Detected a ZFS unlock prompt. Entering the decryption passphrase.",
    },
    checkingZfsStatus: {
      on: {
        zfsLocked: { target: "callingZfsUnlock" },
        zfsUnlocked: { target: "runningSleepInfinity" },
      },
      entry: ({ context }) => {
        // Action to check ZFS encryption lock status
        context.sshProcess?.stdin?.write(
          "zfs get -H -o name,value keylocation,keystatus\n",
        );
        // Note: You'll need to implement logic elsewhere to read the output
        // and send either zfsLocked or zfsUnlocked events based on the response
      },
      description:
        "Detected a normal command prompt. Checking if the ZFS filesystem is unlocked.",
    },
    callingZfsUnlock: {
      on: {
        zfsUnlockCalled: { target: "readingOutput" },
      },
      entry: ({ context }) => {
        // Action to call zfsunlock
        console.log("Calling zfsunlock.");
        context.sshProcess?.stdin?.write("zfsunlock\n");
      },
      description:
        "The ZFS filesystem is locked. Attempting to call zfsunlock.",
    },
    runningSleepInfinity: {
      entry: ({ context }) => {
        // Action to run sleep infinity
        console.log("Running sleep infinity to wait for server reboot.");
        context.sshProcess?.stdin?.write("sleep infinity\n");
      },
      description:
        "The ZFS filesystem is already unlocked. Running sleep infinity.",
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
