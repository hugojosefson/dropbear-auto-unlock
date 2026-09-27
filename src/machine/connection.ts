import { fromCallback } from "xstate";
import { runConnection } from "./run-connection.ts";
import type { ConnectionCommand, ConnectionInput } from "./types.ts";

export const connectionLogic = fromCallback<ConnectionCommand, ConnectionInput>(
  ({ input, receive, sendBack }) => {
    const session = runConnection(input, sendBack);
    receive(session.receive);
    return session.dispose;
  },
);
