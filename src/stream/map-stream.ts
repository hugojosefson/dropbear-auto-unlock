import { toTransformStream } from "@std/streams";

/**
 * Creates a {@linkcode TransformStream} that calls a mapper function on each chunk.
 * @param mapper The mapper function to call on each chunk.
 */
export function mapStream<T, U>(
  mapper: (chunk: T) => U,
): TransformStream<T, U> {
  return toTransformStream(async function* (src) {
    for await (const chunk of src) {
      yield mapper(chunk);
    }
  });
}
