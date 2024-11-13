import { setup } from "xstate";

export const machine = setup({
  types: {
    context: {} as {},
    events: {} as
      | { type: "start" }
      | { type: "connectionSuccess" }
      | { type: "connectionFailure" }
      | { type: "zfsUnlockPromptDetected" }
      | { type: "commandPromptDetected" }
      | { type: "passphraseEntered" }
      | { type: "zfsLocked" }
      | { type: "zfsUnlocked" }
      | { type: "zfsUnlockCalled" }
      | { type: "serverRebootDetected" },
  },
}).createMachine({
  context: {},
  id: "sshMachine",
  initial: "idle",
  states: {
    idle: {
      on: {
        start: {
          target: "connecting",
        },
      },
      description:
        "The state machine is idle, waiting to initiate an SSH connection.",
    },
    connecting: {
      on: {
        connectionSuccess: {
          target: "readingOutput",
        },
        connectionFailure: {
          target: "sleeping",
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
      entry: ({ context, event }) => {
        // Action to enter the passphrase
        console.log("Entering ZFS decryption passphrase.");
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
      entry: ({ context, event }) => {
        // Action to check ZFS status
        console.log("Checking if ZFS filesystem is unlocked.");
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
      entry: ({ context, event }) => {
        // Action to call zfsunlock
        console.log("Calling zfsunlock.");
      },
      description:
        "The ZFS filesystem is locked. Attempting to call zfsunlock.",
    },
    runningSleepInfinity: {
      on: {
        serverRebootDetected: {
          target: "connecting",
        },
      },
      entry: ({ context, event }) => {
        // Action to run sleep infinity
        console.log("Running sleep infinity to wait for server reboot.");
      },
      description:
        "The ZFS filesystem is already unlocked. Running sleep infinity.",
    },
  },
});
