import { createActor } from "xstate";
import { machine } from "../machine.ts";
import { resolveOptions } from "./resolve-options.ts";
import type { UnlockOptions } from "./options.ts";
import type { UnlockActor } from "./types.ts";

/** Return an actor without an SSH connection. */
export function createUnlockActor(options: UnlockOptions): UnlockActor {
  // Validate before XState converts input errors into actor errors.
  const input = resolveOptions(options);
  return createActor(machine, { input });
}
