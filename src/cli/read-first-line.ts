import { TextLineStream } from "@std/streams";
import { stripAnsiCode } from "@std/fmt/colors";

export async function readFirstLine(
  stream: ReadableStream<Uint8Array>,
): Promise<string> {
  const lineStream: ReadableStream<string> = stream
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(new TextLineStream());

  for await (const line of lineStream) {
    return stripAnsiCode(line);
  }
  throw new Error("No first line");
}
