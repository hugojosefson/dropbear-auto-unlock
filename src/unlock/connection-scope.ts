import type { SshConnection, SshConnector } from "../ssh/connection.ts";

/** Keep cleanup observable even when an actor stops because an action throws. */
export function connectionScope(connect: SshConnector): {
  connect: SshConnector;
  close(): Promise<void>;
} {
  const active = new Set<SshConnection>();
  return {
    connect(destination) {
      const connection = connect(destination);
      let closing: Promise<void> | undefined;
      const tracked: SshConnection = {
        output: connection.output,
        closed: connection.closed,
        write: (text) => connection.write(text),
        close() {
          closing ??= Promise.resolve().then(() => connection.close()).then(
            () => {
              active.delete(tracked);
            },
          );
          return closing;
        },
      };
      active.add(tracked);
      return tracked;
    },
    async close() {
      const results = await Promise.allSettled(
        [...active].map((connection) => connection.close()),
      );
      const failure = results.find((result) => result.status === "rejected");
      if (failure) {
        throw failure.reason;
      }
    },
  };
}
