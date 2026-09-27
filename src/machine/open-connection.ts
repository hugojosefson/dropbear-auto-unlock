import type { SshConnection } from "../ssh/connection.ts";
import type { ConnectionEvent, ConnectionInput } from "./types.ts";

type OpenConnection = {
  connection: SshConnection;
  reader: ReadableStreamDefaultReader<string>;
};

export function openConnection(
  input: ConnectionInput,
  send: (event: ConnectionEvent) => void,
): OpenConnection | undefined {
  try {
    const connection = input.connect(input.destination);
    try {
      return { connection, reader: connection.output.getReader() };
    } catch (error) {
      void Promise.resolve().then(() => connection.close()).then(
        () => send({ type: "connectionClosed", error }),
        (cleanupError) =>
          send({ type: "connectionClosed", error, cleanupError }),
      );
    }
  } catch (error) {
    send({ type: "connectionClosed", error });
  }
}
