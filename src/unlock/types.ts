import type {
  ActorRefFrom,
  EventFromLogic,
  InputFrom,
  SnapshotFrom,
} from "xstate";
import type { machine } from "../machine.ts";

/** An actor for one server. Use start() to connect. */
export type UnlockActor = ActorRefFrom<typeof machine>;
/** A snapshot with the state names and context from the machine. */
export type UnlockSnapshot = SnapshotFrom<typeof machine>;
/** Events accepted by the machine. Send exit for graceful shutdown. */
export type UnlockEvent = EventFromLogic<typeof machine>;
/** Input accepted by the machine. */
export type UnlockInput = InputFrom<typeof machine>;
