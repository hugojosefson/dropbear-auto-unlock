import {
  createUnlockActor,
  startUnlockWatchers,
  type UnlockActor,
  type UnlockEvent,
  type UnlockInput,
  type UnlockMachine,
  unlockMachine,
  type UnlockSnapshot,
  type UnlockStateValue,
} from "../src/lib/mod.ts";

export function checkPublicTypes(
  actor: UnlockActor,
  snapshot: UnlockSnapshot,
  input: UnlockInput,
): void {
  const event: UnlockEvent = { type: "exit" };
  const state: UnlockStateValue = snapshot.value;
  const machine: UnlockMachine = unlockMachine.provide({
    actions: {
      nextDestination: ({ context }) => {
        const index: number = context.alternativeIndex;
        void index;
      },
    },
    guards: {
      cleanupFailed: ({ context }) => context.cleanupError !== undefined,
    },
    delays: { retryDelay: 100 },
  });
  void state;
  void machine;
  actor.send(event);
  snapshot.matches({ session: "readingOutput" });
  createUnlockActor(input);
  // @ts-expect-error The machine does not accept this event.
  actor.send({ type: "unknown-event" });
  // @ts-expect-error The snapshot has no state with this name.
  snapshot.matches("unknown-state");
  // @ts-expect-error The nested state name must agree with the machine.
  snapshot.matches({ session: "unknown-state" });
  // @ts-expect-error An actor needs destinations and a passphrase.
  createUnlockActor({ passphrase: "test-value" });
  // @ts-expect-error A passphrase must be a string or provider.
  const invalid: UnlockInput = { destinationAlternatives: [], passphrase: 42 };
  void invalid;
  startUnlockWatchers({ destinationGroups: [["server"]], passphrase: "dummy" });
  // @ts-expect-error A server group must contain addresses, not a single string.
  startUnlockWatchers({ destinationGroups: ["server"], passphrase: "dummy" });
}
