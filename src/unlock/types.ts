import type { ActorRefFrom, SnapshotFrom } from "xstate";
import type { MachineEvent } from "../machine/types.ts";
import type { UnlockMachine } from "./machine-type.ts";
import type { UnlockOptions } from "./options.ts";

/** An actor for one server. Use start() to connect. */
export type UnlockActor = ActorRefFrom<UnlockMachine>;
/** A snapshot with the state names and context from the machine. */
export type UnlockSnapshot = SnapshotFrom<UnlockMachine>;
/** Events accepted by the machine. Send exit for graceful shutdown. */
export type UnlockEvent = MachineEvent;
/** Input accepted by the machine. */
export type UnlockInput = UnlockOptions;
