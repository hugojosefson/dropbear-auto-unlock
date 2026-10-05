import { assign, setup } from "xstate";
import type { UnlockOptions } from "../unlock/options.ts";
import { connectionLogic } from "./connection.ts";
import type { MachineContext, MachineEvent } from "./types.ts";

export const sshSetup = setup({
  types: {
    context: {} as MachineContext,
    input: {} as UnlockOptions,
    events: {} as MachineEvent,
  },
  actors: { connection: connectionLogic },
  guards: {
    cleanupFailed: ({ event }) =>
      event.type === "connectionClosed" && event.cleanupError !== undefined,
  },
  delays: {
    retryDelay: ({ context }) => context.retryDelayMs,
    promptTimeout: ({ context }) => context.promptTimeoutMs,
  },
  actions: {
    nextDestination: assign({
      alternativeIndex: ({ context }) =>
        (context.alternativeIndex + 1) % context.destinationAlternatives.length,
    }),
    recordError: assign({
      lastError: ({ event }) =>
        event.type === "connectionClosed"
          ? event.error ?? event.cleanupError
          : undefined,
      cleanupError: ({ event }) =>
        event.type === "connectionClosed" ? event.cleanupError : undefined,
    }),
    logConnectionError: ({ context, event }) => {
      if (event.type === "connectionClosed" && event.error !== undefined) {
        context.logger.log(`Connection closed: ${String(event.error)}.`);
      }
    },
    logRetrying: ({ context }) => {
      context.logger.log("Retrying.");
    },
  },
});
