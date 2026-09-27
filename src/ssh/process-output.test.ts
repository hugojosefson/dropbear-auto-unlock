import { assertEquals } from "@std/assert";
import { processOutput } from "./process-output.ts";

Deno.test("process output decodes UTF-8 across byte chunks", async () => {
  const text = "åäö 🌍\x1b[31mred\x1b[0m";
  const bytes = new TextEncoder().encode(text);
  const output = processOutput(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const byte of bytes) {
          controller.enqueue(new Uint8Array([byte]));
        }
        controller.close();
      },
    }),
  );
  const chunks: string[] = [];
  for await (const chunk of output.stream) {
    chunks.push(chunk);
  }
  await output.cancel();
  assertEquals(chunks.join(""), text);
});
