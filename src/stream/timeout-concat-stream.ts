export type Concatable<
  T extends string | unknown[] | Uint8Array = string | unknown[] | Uint8Array,
> = T;
export type EmptyConcatableGetter<T extends Concatable> = () => T;

export const getEmptyString: EmptyConcatableGetter<string> = () => "";
export const getEmptyUint8Array: EmptyConcatableGetter<Uint8Array> = () =>
  new Uint8Array(0);
export const getEmptyArray = <I>(): I => ([] as I);

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isUint8Array(value: unknown): value is Uint8Array {
  return value instanceof Uint8Array;
}

function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function concat<T extends Concatable>(
  getEmptyChunk: EmptyConcatableGetter<T>,
  ...chunks: T[]
): T {
  const emptyChunk: T = getEmptyChunk();
  if (chunks.length === 0) {
    return emptyChunk;
  }
  if (chunks.length === 1) {
    return chunks[0];
  }
  if (isString(emptyChunk)) {
    const strings = chunks as string[];
    return emptyChunk.concat(...strings) as T;
  }
  if (isUint8Array(emptyChunk)) {
    const uint8Arrays = chunks as Uint8Array[];
    const totalLength = uint8Arrays.reduce(
      (sum, uint8Array) => sum + uint8Array.length,
      0,
    );
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const uint8Array of uint8Arrays) {
      result.set(uint8Array, offset);
      offset += uint8Array.length;
    }
    return result as T;
  }
  if (isArray(emptyChunk)) {
    const arrays = chunks as unknown[][];
    return emptyChunk.concat(...arrays) as T;
  }
  throw new Error(`Unsupported type: ${emptyChunk}`);
}

/**
 * Concatenates chunks until there is silence for a while, then emits what it has collected.
 */
export class TimeoutConcatStream<T extends Concatable>
  extends TransformStream<T, T> {
  private savedChunks: T[] = [];
  private silenceTimeoutHandle: number | undefined;

  private clearTimeout() {
    if (this.silenceTimeoutHandle !== undefined) {
      clearTimeout(this.silenceTimeoutHandle);
      this.silenceTimeoutHandle = undefined;
    }
  }

  private flushSavedChunks(
    controller: TransformStreamDefaultController<T>,
  ): void {
    if (this.savedChunks.length > 0) {
      controller.enqueue(concat(this.getEmptyChunk, ...this.savedChunks));
      this.savedChunks = [];
    }
  }

  constructor(
    private readonly getEmptyChunk: EmptyConcatableGetter<T>,
    private readonly silenceTimeoutMs?: number,
  ) {
    super({
      transform: (
        chunk: T,
        controller: TransformStreamDefaultController<T>,
      ) => {
        this.clearTimeout();
        this.savedChunks.push(chunk);

        if (typeof this.silenceTimeoutMs === "number") {
          this.silenceTimeoutHandle = setTimeout(() => {
            this.clearTimeout();
            this.flushSavedChunks(controller);
          }, this.silenceTimeoutMs);
        }
      },
      flush: (controller: TransformStreamDefaultController<T>) => {
        this.clearTimeout();
        this.flushSavedChunks(controller);
      },
    });
  }
}
