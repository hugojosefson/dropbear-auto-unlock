import type { SshDestination } from "../ssh-destination.ts";

/** One SSH connection with text input and output. */
export type SshConnection = {
  /** Decoded output from the SSH process. Can include ANSI codes. */
  readonly output: ReadableStream<string>;
  /** Resolves when the SSH process exits. */
  readonly closed: Promise<void>;
  /** Writes one line to the SSH process. */
  write(text: string): Promise<void>;
  /** Stops the process and closes its streams. Can be called again. */
  close(): Promise<void>;
};

/** Starts one SSH connection. */
export type SshConnector = (destination: SshDestination) => SshConnection;
