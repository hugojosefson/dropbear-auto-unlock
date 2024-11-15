import { pipeThroughFrom } from "@core/streamutil";
import { mapStream } from "./stream/map-stream.ts";
import {
  getEmptyString,
  TimeoutConcatStream,
} from "./stream/timeout-concat-stream.ts";
import { NewlineSuffixerStream } from "./stream/newline-suffixer-stream.ts";
import stripAnsi from "strip-ansi";

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
 * {@linkcode TimeoutConcatStream} to output whole lines including newlines, and if there is silence for a while, emits
 * the string it has so far without the newline.
 */
export function wrapStdout(
  uint8ArrayReadableStream: ReadableStream<Uint8Array>,
  silenceTimeoutMs = 200,
): ReadableStream<string> {
  return uint8ArrayReadableStream
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(mapStream(stripAnsi))
    .pipeThrough(new TimeoutConcatStream(getEmptyString, silenceTimeoutMs));
}

export function wrapProcess(
  prc: Deno.ChildProcess,
): {
  stdin: WritableStreamDefaultWriter<string>;
  stdout: ReadableStream<string>;
  stderr: ReadableStream<string>;
} {
  return {
    stdin: wrapStdin(prc.stdin).getWriter(),
    stdout: wrapStdout(prc.stdout),
    stderr: wrapStdout(prc.stderr),
  };
}
