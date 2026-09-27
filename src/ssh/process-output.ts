export type ProcessOutput = {
  stream: ReadableStream<string>;
  cancel(): Promise<void>;
};

export function processOutput(
  bytes: ReadableStream<Uint8Array>,
): ProcessOutput {
  const reader = bytes.getReader();
  const decoder = new TextDecoder();
  let ended = false;
  let cancelled: Promise<void> | undefined;
  let controller: ReadableStreamDefaultController<string>;
  const stream = new ReadableStream<string>({
    start(output) {
      controller = output;
    },
    async pull() {
      try {
        const { value, done } = await reader.read();
        if (ended) {
          return;
        }
        if (done) {
          const tail = decoder.decode();
          if (tail) {
            controller.enqueue(tail);
          }
          ended = true;
          reader.releaseLock();
          controller.close();
          return;
        }
        controller.enqueue(decoder.decode(value, { stream: true }));
      } catch (error) {
        if (!ended) {
          ended = true;
          reader.releaseLock();
          controller.error(error);
        }
      }
    },
    cancel() {
      return cancel(false);
    },
  });
  function cancel(closeStream = true): Promise<void> {
    if (ended) {
      return cancelled ?? Promise.resolve();
    }
    ended = true;
    if (closeStream) {
      controller.close();
    }
    cancelled = reader.cancel().finally(() => reader.releaseLock());
    return cancelled;
  }
  return { stream, cancel };
}
