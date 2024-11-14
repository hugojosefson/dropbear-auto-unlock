/** WritableStream<string>  that automatically appends a newline to each written string. */
export class NewlineSuffixerStream extends TransformStream<string, string> {
  constructor() {
    super({
      transform(chunk, controller) {
        controller.enqueue(chunk + "\n");
      },
    });
  }
}
