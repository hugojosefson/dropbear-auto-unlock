import { pipeThroughFrom } from "@core/streamutil";
import { LineTimeoutStream } from "./stream/line-timeout-stream.ts";
import { NewlineSuffixerStream } from "./stream/newline-suffixer-stream.ts";

export function wrapStdin(
  uint8ArrayWritableStream: WritableStream<Uint8Array>,
): WritableStream<string> {
  const stringWritableStream = pipeThroughFrom(
    uint8ArrayWritableStream,
    new TextEncoderStream(),
  );
  return pipeThroughFrom(
    stringWritableStream,
    new NewlineSuffixerStream(),
  );
}

/**
 * {@linkcode ReadableStream}<string> that uses {@linkcode TextDecoderStream} to decode bytes to strings, then a
 * {@linkcode LineTimeoutStream} to output whole lines including newlines, and if there is silence for a while, emits
 * the string it has so far without the newline.
 */
export function wrapStdout(
  uint8ArrayReadableStream: ReadableStream<Uint8Array>,
  silenceTimeoutMs?: number,
): ReadableStream<string> {
  return uint8ArrayReadableStream
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(new LineTimeoutStream(silenceTimeoutMs));
}
