import type { SshDestination } from "../ssh-destination.ts";
import type { SshConnector } from "../ssh/connection.ts";

/** A passphrase source with a cancellation signal. */
export type PassphraseProvider = (
  signal: AbortSignal,
) => string | Promise<string>;

/** Receives status messages without SSH output or passphrases. */
export type UnlockLogger = {
  log(message: string): void;
};

/** Configuration for one server with one or more SSH addresses. */
export type UnlockOptions = {
  readonly destinationAlternatives: readonly SshDestination[];
  readonly passphrase: string | PassphraseProvider;
  readonly logger?: UnlockLogger;
  readonly connect?: SshConnector;
  readonly retryDelayMs?: number;
  readonly promptTimeoutMs?: number;
};
