import { sshSetup } from "./setup.ts";

export const connecting = sshSetup.createStateConfig({
  entry: ({ context }) => context.logger.log("Connecting."),
  on: { connectionOpened: "readingOutput" },
});

export const readingOutput = sshSetup.createStateConfig({
  after: { promptTimeout: "closing" },
  on: {
    zfsUnlockPromptDetected: "enteringPassphrase",
    commandPromptDetected: "runningSleepInfinity",
  },
});

export const enteringPassphrase = sshSetup.createStateConfig({
  entry: [
    ({ context }) => context.logger.log("Entering the passphrase."),
    sshSetup.sendTo("connection", { type: "enterPassphrase" }),
  ],
  after: { promptTimeout: "closing" },
  on: { commandPromptDetected: "runningSleepInfinity" },
});

export const runningSleepInfinity = sshSetup.createStateConfig({
  entry: [
    ({ context }) => context.logger.log("Waiting for the server to restart."),
    sshSetup.sendTo("connection", { type: "keepAlive" }),
  ],
});

export const closing = sshSetup.createStateConfig({
  entry: sshSetup.sendTo("connection", { type: "close" }),
});

export const stopping = sshSetup.createStateConfig({
  entry: sshSetup.sendTo("connection", { type: "close" }),
  on: {
    connectionClosed: { target: "#sshMachine.exit", actions: "recordError" },
  },
});
