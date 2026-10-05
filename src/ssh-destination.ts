export type Host = Hostname | IpAddress;
export type Hostname = string;
export type IpAddress = IPv4Address | IPv6Address;
export type IPv4Address = `${number}.${number}.${number}.${number}`;
export type IPv6Address = `${string}:${string}:${string}`;
export type Username = string;
export type Port = number;

export type SshDestinationString =
  | `${Username}@${Host}:${Port}`
  | `${Username}@${Host}`
  | `${Host}:${Port}`
  | `${Host}`;

export type SshDestination = {
  user: Username;
  host: Host;
  /** Omit the port to use SSH configuration and defaults. */
  port?: Port;
  /**
   * Request a pty with `ssh -tt`. Omitted or `true` requests a pty.
   * `false` opens the session without a pty.
   */
  pty?: boolean;
};

export const SSH_DESTINATION_REGEXP =
  /^((?<user>[^\s@:]+)@)?(?<host>[^\s@:]+)(:(?<port>\d+))?$/;

/**
 * Parse an SSH address. Without a user in the address or `defaultValues.user`,
 * this function gets the local username through `id -un`.
 * This command requires `--allow-run=id`.
 */
export async function parseSshDestination(
  sshDestinationString: unknown,
  defaultValues: Partial<SshDestination> = {},
): Promise<SshDestination> {
  if (typeof sshDestinationString !== "string") {
    throw new TypeError("Use an SSH destination string.");
  }
  const { groups } = SSH_DESTINATION_REGEXP.exec(sshDestinationString) ?? {};
  if (!groups) {
    throw new TypeError("Use a correct SSH destination.");
  }
  const port = groups.port ? Number(groups.port) : defaultValues.port;
  if (
    port !== undefined &&
    (!Number.isInteger(port) || port < 1 || port > 65535)
  ) {
    throw new RangeError("Use an SSH port from 1 to 65535.");
  }
  return {
    user: groups.user ?? defaultValues.user ?? await defaultUsername(),
    host: groups.host,
    port,
  };
}

async function defaultUsername(): Promise<string> {
  const { success, stdout } = await new Deno.Command("id", {
    args: ["-un"],
  }).output();
  const username = new TextDecoder().decode(stdout).trim();
  if (!success || username.length === 0) {
    throw new Error("Cannot get the default SSH user.");
  }
  return username;
}
