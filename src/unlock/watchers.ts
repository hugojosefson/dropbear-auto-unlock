import type { SshDestination } from "../ssh-destination.ts";
import type { PassphraseProvider, UnlockLogger } from "./options.ts";
import type { SshConnector } from "../ssh/connection.ts";
import type { UnlockSnapshot } from "./types.ts";

/** An SSH address string or an already parsed destination. */
export type UnlockDestination = string | SshDestination;

/** Settings shared by a group of long-running server watchers. */
export type UnlockWatchersOptions = {
  /** One group per server. Addresses within a group are alternatives. */
  readonly destinationGroups: readonly (readonly UnlockDestination[])[];
  /** Supplied by the caller. The library never reads stdin. */
  readonly passphrase: string | PassphraseProvider;
  /** Optional status messages prefixed with the server's first hostname. */
  readonly logger?: UnlockLogger;
  readonly connect?: SshConnector;
  readonly retryDelayMs?: number;
  readonly promptTimeoutMs?: number;
};

/** Started watchers that remain active across server reboots. */
export type UnlockWatchers = {
  /** Resolves after stop and cleanup. Rejects on fatal actor or cleanup errors. */
  readonly done: Promise<void>;
  /** Stops all watchers and waits for cleanup. Safe to call more than once. */
  stop(): Promise<void>;
  /** The current snapshot of every server, in destination group order. */
  snapshot(): readonly UnlockSnapshot[];
};
