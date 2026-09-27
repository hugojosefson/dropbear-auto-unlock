import { toPromise } from "xstate";
import type { UnlockActor } from "./types.ts";

/** Stop a started actor and wait for SSH cleanup. */
export async function stopUnlockActor(actor: UnlockActor): Promise<void> {
  if (actor.getSnapshot().status === "stopped") {
    throw new Error("Cannot wait for cleanup after actor.stop().");
  }
  const stopped = toPromise(actor);
  actor.send({ type: "exit" });
  await stopped;
  const error = actor.getSnapshot().context.cleanupError;
  if (error !== undefined) {
    throw error;
  }
}
