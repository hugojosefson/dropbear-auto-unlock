import type { SshConnection } from "../src/lib/mod.ts";

export function fakeConnection(closeGate: Promise<void> = Promise.resolve()) {
  const exited = Promise.withResolvers<void>();
  const cancelled = Promise.withResolvers<void>();
  const written = Promise.withResolvers<void>();
  const writes: string[] = [];
  const outputController = Promise.withResolvers<
    ReadableStreamDefaultController<string>
  >();
  let closeCount = 0;
  const connection: SshConnection = {
    output: new ReadableStream<string>({
      start(controller) {
        outputController.resolve(controller);
      },
      cancel() {
        cancelled.resolve();
      },
    }),
    closed: exited.promise,
    write(text) {
      writes.push(text);
      written.resolve();
      return Promise.resolve();
    },
    async close() {
      closeCount++;
      await closeGate;
      exited.resolve();
    },
  };
  return {
    connection,
    writes,
    written: written.promise,
    cancelled: cancelled.promise,
    get closeCount() {
      return closeCount;
    },
    async emit(text: string) {
      (await outputController.promise).enqueue(text);
    },
    exit: exited.resolve,
  };
}
