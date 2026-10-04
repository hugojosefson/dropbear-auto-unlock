import { toPromise } from "xstate";
import { stopUnlockActor } from "./stop-actor.ts";
import type { UnlockActor } from "./types.ts";

export async function runActors(actors: readonly UnlockActor[]): Promise<void> {
  const results = Promise.all(actors.map(async (actor) => {
    await toPromise(actor);
    const error = actor.getSnapshot().context.cleanupError;
    if (error !== undefined) {
      throw error;
    }
  })).then(
    () => ({ ok: true as const }),
    (error: unknown) => ({ ok: false as const, error }),
  );
  const started = new Set<UnlockActor>();
  const run = async () => {
    for (const actor of actors) {
      started.add(actor);
      actor.start();
    }
    return await results;
  };
  const result = await run().catch((error: unknown) => ({
    ok: false as const,
    error,
  }));
  const stopped = await Promise.allSettled(actors.map(async (actor) => {
    if (!started.has(actor)) {
      actor.stop();
      return;
    }
    await stopUnlockActor(actor);
  }));
  if (!result.ok) {
    throw result.error;
  }
  const failure = stopped.find((result) => result.status === "rejected");
  if (failure) {
    throw failure.reason;
  }
}
