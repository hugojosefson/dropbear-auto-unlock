import type {
  ActorRefFrom,
  CallbackActorLogic,
  EventObject,
  MetaObject,
  NonReducibleUnknown,
  StateMachine,
} from "xstate";
import type {
  ConnectionCommand,
  ConnectionInput,
  MachineContext,
  MachineEvent,
} from "../machine/types.ts";
import type { UnlockOptions } from "./options.ts";

type ConnectionLogic = CallbackActorLogic<ConnectionCommand, ConnectionInput>;
type SessionState =
  | "connecting"
  | "readingOutput"
  | "enteringPassphrase"
  | "runningSleepInfinity"
  | "closing"
  | "stopping";

/** The server's connection state or the interval between connections. */
export type UnlockStateValue = { session: SessionState } | "sleeping" | "exit";

/** An XState machine with explicit public state, event, and context types. */
export type UnlockMachine = StateMachine<
  MachineContext,
  MachineEvent,
  Record<string, ActorRefFrom<ConnectionLogic> | undefined>,
  { src: "connection"; logic: ConnectionLogic; id: string | undefined },
  | { type: "nextDestination"; params: NonReducibleUnknown }
  | { type: "recordError"; params: NonReducibleUnknown },
  { type: "cleanupFailed"; params: unknown },
  "retryDelay" | "promptTimeout",
  UnlockStateValue,
  string,
  UnlockOptions,
  NonReducibleUnknown,
  EventObject,
  MetaObject,
  {
    id: "sshMachine";
    states: {
      session: { states: { [State in SessionState]: Record<never, never> } };
      sleeping: Record<never, never>;
      exit: Record<never, never>;
    };
  }
>;
