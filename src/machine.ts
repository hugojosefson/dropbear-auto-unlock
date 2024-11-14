import { setup } from "xstate";

export type Context = {
  passphrase: string;
  sshCommand: Deno.Command;
  sshProcess?: Deno.ChildProcess;
  writer: WritableStreamDefaultWriter<string>;
};

export const machine = setup({
  types: {
    context: {} as Context,
    events: {} as {
      type:
        | "start"
        | "exit"
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
  context: {},
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
    connecting: {
      on: {
        connectionSuccess: {
          target: "readingOutput",
        },
      },
      description: "Attempting to establish an SSH connection to the server.",
    },
    readingOutput: {
      on: {
        zfsUnlockPromptDetected: {
          target: "enteringPassphrase",
        },
        commandPromptDetected: {
          target: "checkingZfsStatus",
        },
      },
      description:
        "Reading from the SSH client process stdout to determine the next steps.",
    },
    sleeping: {
      after: {
        "5000": {
          target: "connecting",
        },
      },
      description:
        "The SSH connection attempt failed. The program is sleeping before retrying.",
    },
    enteringPassphrase: {
      on: {
        passphraseEntered: {
          target: "readingOutput",
        },
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
        zfsLocked: {
          target: "callingZfsUnlock",
        },
        zfsUnlocked: {
          target: "runningSleepInfinity",
        },
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
        zfsUnlockCalled: {
          target: "readingOutput",
        },
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
        await context.sshProcess?.stdin?.write([0x03, 0x03, 0x04]);
        context.sshProcess?.stderr?.close();
        context.sshProcess?.stdout?.close();
        context.sshProcess?.kill();
      },
    },
  },
});
