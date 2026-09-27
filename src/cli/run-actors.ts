import { toPromise } from "xstate";
import { stopUnlockActor, type UnlockActor } from "../lib/mod.ts";

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
  const stop = () => {
    for (const actor of actors) {
      actor.send({ type: "exit" });
    }
  };
  const signals = ["SIGINT", "SIGTERM"] as const;
  const listeners: Deno.Signal[] = [];
  const run = async () => {
    for (const actor of actors) {
      started.add(actor);
      actor.start();
    }
    for (const signal of signals) {
      Deno.addSignalListener(signal, stop);
      listeners.push(signal);
    }
    return await results;
  };
  try {
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
  } finally {
    for (const signal of listeners) {
      Deno.removeSignalListener(signal, stop);
    }
  }
}
