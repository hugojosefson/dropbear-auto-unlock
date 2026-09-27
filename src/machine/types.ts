import type { SshDestination } from "../ssh-destination.ts";
import type { SshConnector } from "../ssh/connection.ts";
import type { PassphraseProvider, UnlockLogger } from "../unlock/options.ts";

export type ConnectionInput = {
  destination: SshDestination;
  connect: SshConnector;
  passphrase: PassphraseProvider;
};

export type ConnectionCommand =
  | { type: "enterPassphrase" }
  | { type: "keepAlive" }
  | { type: "close" };

export type ConnectionEvent =
  | { type: "connectionOpened" }
  | { type: "connectionClosed"; error?: unknown; cleanupError?: unknown }
  | { type: "zfsUnlockPromptDetected" }
  | { type: "commandPromptDetected" };

export type MachineEvent = ConnectionEvent | { type: "exit" };

export type MachineContext = {
  destinationAlternatives: readonly SshDestination[];
  alternativeIndex: number;
  connect: SshConnector;
  passphrase: PassphraseProvider;
  logger: UnlockLogger;
  retryDelayMs: number;
  promptTimeoutMs: number;
  lastError: unknown;
  cleanupError: unknown;
};
