import type { SshConnection } from "./connection.ts";
import { processOutput } from "./process-output.ts";
import { stopProcess } from "./stop-process.ts";

export function processConnection(process: Deno.ChildProcess): SshConnection {
  const writer = process.stdin.getWriter();
  const encoder = new TextEncoder();
  const output = processOutput(process.stdout);
  const errors = process.stderr.getReader();
  const drainErrors = (async () => {
    try {
      while (!(await errors.read()).done) {
        // The process can echo secrets. Discard stderr without logging it.
      }
    } finally {
      errors.releaseLock();
    }
  })();
  const closed = process.status.then(() => {});
  let closing: Promise<void> | undefined;
  writer.closed.catch(() => {});
  drainErrors.catch(() => {});
  closed.catch(() => {});

  return {
    output: output.stream,
    closed,
    write(text) {
      return writer.write(encoder.encode(`${text}\n`));
    },
    close() {
      closing ??= (async () => {
        const results = await Promise.allSettled([
          stopProcess(process),
          output.cancel(),
          writer.abort(),
          errors.cancel().catch(() => {}),
          drainErrors,
        ]);
        writer.releaseLock();
        const stopped = results[0];
        if (stopped.status === "rejected") {
          throw stopped.reason;
        }
      })();
      return closing;
    },
  };
}
