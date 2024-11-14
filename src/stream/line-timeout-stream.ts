/**
 * Like {@linkcode _TextLineStream}, but if there is silence for a while, emits the string it has so far without the newline.
 * Whole lines are emitted including newlines.
 * This is useful for reading from the stdout of an ssh client process.
 */
export class LineTimeoutStream extends TransformStream<string, string> {
  private savedChunk: string = "";
  private silenceTimeoutHandle: number | undefined;

  /**
   * Create a LineTimeoutStream.
   * @param silenceTimeoutMs If silenceTimeoutMs is defined, the stream will wait for silenceTimeoutMs milliseconds before sending the string it has so far without the newline.
   */
  constructor(silenceTimeoutMs?: number) {
    super({
      transform(chunk, controller) {
        const myThis = this as LineTimeoutStream;

        if (myThis.savedChunk?.length > 0) {
          chunk = myThis.savedChunk + chunk;
          myThis.savedChunk = "";
        }

        if (myThis.silenceTimeoutHandle !== undefined) {
          clearTimeout(myThis.silenceTimeoutHandle);
          myThis.silenceTimeoutHandle = undefined;
        }

        if (typeof silenceTimeoutMs === "number") {
          myThis.silenceTimeoutHandle = setTimeout(() => {
            if (myThis.silenceTimeoutHandle !== undefined) {
              clearTimeout(myThis.silenceTimeoutHandle);
              myThis.silenceTimeoutHandle = undefined;
            }
            if (myThis.savedChunk?.length > 0) {
              controller.enqueue(myThis.savedChunk);
              myThis.savedChunk = "";
            }
          }, silenceTimeoutMs);
        }

        const lines = chunk.split("\n");
        if (chunk.endsWith("\n")) {
          lines.pop();
        } else {
          myThis.savedChunk = lines.pop() ?? "";
        }
        lines.forEach((line) => {
          controller.enqueue(line + "\n");
        });
      },
      flush(controller) {
        const myThis = this as LineTimeoutStream;
        if (myThis.silenceTimeoutHandle !== undefined) {
          clearTimeout(myThis.silenceTimeoutHandle);
          myThis.silenceTimeoutHandle = undefined;
        }
        if (myThis.savedChunk?.length > 0) {
          controller.enqueue(myThis.savedChunk);
        }
      },
    });
  }
}
