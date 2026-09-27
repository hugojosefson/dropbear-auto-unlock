import { assertEquals, assertRejects } from "@std/assert";
import { readFirstLine } from "./read-first-line.ts";

Deno.test("readFirstLine returns one line and cancels its input", async () => {
  const canceled = Promise.withResolvers<void>();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(
        new TextEncoder().encode("\x1b[31mdummy-value\x1b[0m\nsecond\n"),
      );
    },
    cancel() {
      canceled.resolve();
    },
  });
  assertEquals(await readFirstLine(stream), "dummy-value");
  await canceled.promise;
});

Deno.test("readFirstLine rejects an empty stream", async () => {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.close();
    },
  });
  await assertRejects(() => readFirstLine(stream), Error, "No first line");
});
