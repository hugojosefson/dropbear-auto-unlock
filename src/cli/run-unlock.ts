import {
  type SshDestination,
  startUnlockWatchers,
} from "@hugojosefson/dropbear-auto-unlock";

export async function runUnlock(
  destinations: readonly (readonly SshDestination[])[],
  passphrase: string,
): Promise<void> {
  const watchers = await startUnlockWatchers({
    destinationGroups: destinations,
    passphrase,
    logger: { log: (message) => console.log(message) },
  });
  const stop = () => {
    void watchers.stop().catch(() => {});
  };
  const listeners: Deno.Signal[] = [];
  try {
    for (const signal of ["SIGINT", "SIGTERM"] as const) {
      Deno.addSignalListener(signal, stop);
      listeners.push(signal);
    }
    await watchers.done;
  } finally {
    for (const signal of listeners) {
      Deno.removeSignalListener(signal, stop);
    }
    await watchers.stop();
  }
}
