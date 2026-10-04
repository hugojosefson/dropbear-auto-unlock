import { resolveOptions } from "./unlock/resolve-options.ts";
import type { UnlockMachine } from "./unlock/machine-type.ts";
import { sshSetup } from "./machine/setup.ts";
import {
  closing,
  connecting,
  enteringPassphrase,
  readingOutput,
  runningSleepInfinity,
  stopping,
} from "./machine/session-states.ts";

export const machine: UnlockMachine = sshSetup.createMachine({
  id: "sshMachine",
  context: ({ input }) => resolveOptions(input),
  initial: "session",
  states: {
    session: {
      invoke: {
        id: "connection",
        src: "connection",
        input: ({ context }) => ({
          destination:
            context.destinationAlternatives[context.alternativeIndex],
          connect: context.connect,
          passphrase: context.passphrase,
        }),
      },
      initial: "connecting",
      states: {
        connecting,
        readingOutput,
        enteringPassphrase,
        runningSleepInfinity,
        closing,
        stopping,
      },
      on: {
        connectionClosed: [
          { guard: "cleanupFailed", target: "exit", actions: "recordError" },
          { target: "sleeping", actions: "recordError" },
        ],
        exit: ".stopping",
      },
    },
    sleeping: {
      entry: "nextDestination",
      after: { retryDelay: "session" },
      on: { exit: "exit" },
    },
    exit: { type: "final" },
  },
});
