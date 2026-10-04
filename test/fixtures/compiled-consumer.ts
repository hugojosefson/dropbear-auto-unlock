import { startUnlockWatchers } from "@hugojosefson/dropbear-auto-unlock";

const ready = Promise.withResolvers<void>();
const requested: AbortSignal[] = [];
let shells = 0;
const watchers = await startUnlockWatchers({
  destinationGroups: [["unreachable.invalid", "first.invalid:2222"], [
    "second.invalid",
  ]],
  passphrase(signal) {
    requested.push(signal);
    return "dummy";
  },
  retryDelayMs: 5,
  logger: {
    log(message) {
      if (message.includes("Waiting for the server to restart.")) {
        shells++;
        if (shells === 2) {
          ready.resolve();
        }
      }
    },
  },
});
const timeout = setTimeout(
  () => ready.reject(new Error("Watchers timed out.")),
  5000,
);
try {
  await Promise.race([ready.promise, watchers.done]);
} finally {
  clearTimeout(timeout);
  await watchers.stop();
}
if (requested.length !== 2 || !requested.every((signal) => signal.aborted)) {
  throw new Error("Expected two unlocked connections and complete shutdown.");
}
await watchers.done;
console.log("Compiled consumer passed.");
