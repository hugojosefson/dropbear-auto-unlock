import { connectSsh } from "../ssh/connect.ts";
import type { MachineContext } from "../machine/types.ts";
import type { UnlockOptions } from "./options.ts";

export function resolveOptions(options: UnlockOptions): MachineContext {
  if (options.destinationAlternatives.length === 0) {
    throw new TypeError("At least one SSH destination is necessary.");
  }
  const retryDelayMs = options.retryDelayMs ?? 5000;
  const promptTimeoutMs = options.promptTimeoutMs ?? 5000;
  for (const value of [retryDelayMs, promptTimeoutMs]) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new TypeError("Timeouts must be finite and greater than zero.");
    }
  }
  const destinationAlternatives = options.destinationAlternatives.map(
    (destination) => {
      if (
        !destination.host || !destination.user ||
        (destination.port !== undefined &&
          (!Number.isInteger(destination.port) || destination.port < 1 ||
            destination.port > 65535))
      ) {
        throw new TypeError("The SSH destination is not valid.");
      }
      return { ...destination };
    },
  );
  const passphrase = options.passphrase;
  return {
    destinationAlternatives,
    alternativeIndex: 0,
    connect: options.connect ?? connectSsh,
    passphrase: typeof passphrase === "string" ? () => passphrase : passphrase,
    logger: options.logger ?? { log: () => {} },
    retryDelayMs,
    promptTimeoutMs,
    lastError: undefined,
    cleanupError: undefined,
  };
}
