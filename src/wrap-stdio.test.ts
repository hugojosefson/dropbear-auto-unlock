import { assertEquals } from "@std/assert";
import { wrapStdin, wrapStdout } from "./wrap-stdio.ts";

/**
 * Writes two strings to the stream, and then closes the stream.
 * Expect to read the bytes of the strings, with a newline between them, and one additional newline at the end. Then the stream should close.
 */
Deno.test("wrapWritableStreamOfUintArrayToMakeAWritableStreamThatEncodesStringsToLines", async () => {
  const result: Uint8Array[] = [];
  const uint8ArrayWritableStream = new WritableStream<Uint8Array>({
    write(chunk) {
      result.push(chunk);
    },
  });
  const writableStreamOfStrings = wrapStdin(
    uint8ArrayWritableStream,
  );
  const writer = writableStreamOfStrings.getWriter();
  await writer.write("hello");
  await writer.write("world");
  await writer.close();
  assertEquals(result, [
    new Uint8Array([0x68, 0x65, 0x6c, 0x6c, 0x6f, 0x0a]),
    new Uint8Array([0x77, 0x6f, 0x72, 0x6c, 0x64, 0x0a]),
  ]);
});

Deno.test("with child process cat, expect newlines", async () => {
  const cmd = new Deno.Command("cat", {
    stdin: "piped",
    stdout: "piped",
  });
  await using childProcess = cmd.spawn();
  const wrapped: WritableStream<string> = wrapStdin(
    childProcess.stdin,
  );
  const writer: WritableStreamDefaultWriter<string> = wrapped.getWriter();
  await writer.write("hello");
  await writer.write("world");
  await writer.close();
  const commandOutput: Deno.CommandOutput = await childProcess.output();
  const output: string = new TextDecoder().decode(commandOutput.stdout);
  assertEquals(output, "hello\nworld\n");
});

Deno.test("wrapStdout", async () => {
  const result: string[] = [];
  const uint8ArrayReadableStream = new ReadableStream<Uint8Array>({
    pull(controller) {
      controller.enqueue(new Uint8Array([0x68, 0x65, 0x6c, 0x6c]));
      controller.enqueue(
        new Uint8Array([0x6f, 0x0a, 0x77, 0x6f, 0x72, 0x6c, 0x64, 0x0a]),
      );
      controller.close();
    },
  });
  const readableStreamOfStrings = wrapStdout(
    uint8ArrayReadableStream,
  );
  for await (const value of readableStreamOfStrings) {
    result.push(value);
  }
  assertEquals(result, ["hello\n", "world\n"]);
});

Deno.test("wrapStdout with empty stream", async () => {
  const result: string[] = [];
  const uint8ArrayReadableStream = new ReadableStream<Uint8Array>({
    pull(controller) {
      controller.close();
    },
  });
  const readableStreamOfStrings = wrapStdout(
    uint8ArrayReadableStream,
  );
  for await (const value of readableStreamOfStrings) {
    result.push(value);
  }
  assertEquals(result, []);
});

Deno.test("wrapStdout with two lines, and an unfinished line", async () => {
  const result: string[] = [];
  const uint8ArrayReadableStream = new ReadableStream<Uint8Array>({
    pull(controller) {
      controller.enqueue(new Uint8Array([0x68, 0x65, 0x6c, 0x6c, 0x6f, 0x0a]));
      controller.enqueue(new Uint8Array([0x77, 0x6f, 0x72, 0x6c, 0x64, 0x0a]));
      controller.enqueue(new Uint8Array([0x77, 0x6f, 0x72, 0x6c, 0x65]));
      controller.close();
    },
  });
  const readableStreamOfStrings = wrapStdout(
    uint8ArrayReadableStream,
  );
  for await (const value of readableStreamOfStrings) {
    result.push(value);
  }
  assertEquals(result, ["hello\n", "world\n", "worle"]);
});

Deno.test("wrapStdout with two lines, and an unfinished line, and not closing the stream but instead timing out after 200ms", async () => {
  const result: string[] = [];
  const uint8ArrayReadableStream = new ReadableStream<Uint8Array>(
    {
      start(controller) {
        controller.enqueue(
          new Uint8Array([0x68, 0x65, 0x6c, 0x6c, 0x6f, 0x0a]),
        );
        controller.enqueue(
          new Uint8Array([0x77, 0x6f, 0x72, 0x6c, 0x64, 0x0a]),
        );
        controller.enqueue(new Uint8Array([0x77, 0x6f, 0x72, 0x6c, 0x65]));
        setTimeout(() => {
          controller.enqueue(new Uint8Array([0x77, 0x6f, 0x72, 0x6c, 0x66]));
          controller.close();
        }, 300);
      },
    },
  );
  const readableStreamOfStrings = wrapStdout(
    uint8ArrayReadableStream,
    200,
  );
  for await (const value of readableStreamOfStrings) {
    result.push(value);
  }
  assertEquals(result, ["hello\n", "world\n", "worle", "worlf"]);
});
