import { TextLineStream } from "@std/streams";
import stripAnsi from "strip-ansi";
import { mapStream } from "./stream/map-stream.ts";

export async function readFirstLine(
  stream: ReadableStream<Uint8Array>,
): Promise<string> {
  const lineStream: ReadableStream<string> = stream
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(mapStream(stripAnsi))
    .pipeThrough(new TextLineStream());

  const firstLine = await lineStream.values().next();
  if (firstLine.done) {
    throw new Error("No first line");
  }
  return firstLine.value;
}
