import { openConnection } from "./open-connection.ts";
import { readPrompts } from "./read-prompts.ts";
import type {
  ConnectionCommand,
  ConnectionEvent,
  ConnectionInput,
} from "./types.ts";

export function runConnection(
  input: ConnectionInput,
  send: (event: ConnectionEvent) => void,
): { receive: (event: ConnectionCommand) => void; dispose: () => void } {
  const opened = openConnection(input, send);
  if (!opened) {
    return { receive: () => {}, dispose: () => {} };
  }
  const { connection, reader } = opened;
  const aborter = new AbortController();
  let closing: Promise<void> | undefined;
  const close = (error?: unknown): Promise<void> => {
    if (closing) {
      return closing;
    }
    aborter.abort();
    closing = Promise.allSettled([
      Promise.resolve().then(() => connection.close()),
      reader.cancel(),
    ]).then(
      (results) => {
        reader.releaseLock();
        const failure = results[0];
        send({
          type: "connectionClosed",
          error,
          cleanupError: failure.status === "rejected"
            ? failure.reason
            : undefined,
        });
      },
    );
    return closing;
  };
  let writes = Promise.resolve();
  send({ type: "connectionOpened" });
  void readPrompts(reader, send, aborter.signal).then(() => close(), close);
  void connection.closed.then(() => close(), close);
  return {
    receive: (event) => {
      if (event.type === "close") {
        void close();
        return;
      }
      writes = writes.then(async () => {
        if (aborter.signal.aborted) {
          return;
        }
        const text = event.type === "enterPassphrase"
          ? await input.passphrase(aborter.signal)
          : "sleep infinity";
        if (!aborter.signal.aborted) {
          await connection.write(text);
        }
      }).catch(close);
    },
    dispose: () => {
      void close();
    },
  };
}
