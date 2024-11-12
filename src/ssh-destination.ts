import { run } from "@hugojosefson/run-simple";
import { s } from "@hugojosefson/fns/string/s";

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
  port: Port;
};

export const SSH_DESTINATION_REGEXP =
  /^((?<user>[^@]+)@)?(?<host>[^:]+)(:(?<port>\d+))?$/;

export async function parseSshDestination(
  sshDestinationString: SshDestinationString | unknown,
  defaultValues: Partial<SshDestination> = {},
): Promise<SshDestination> {
  if (typeof sshDestinationString !== "string") {
    throw new Error(`Invalid ssh destination: ${s(sshDestinationString)}`);
  }
  const { groups } = SSH_DESTINATION_REGEXP.exec(sshDestinationString) ?? {};
  if (!groups) {
    throw new Error(`Invalid ssh destination: ${s(sshDestinationString)}`);
  }
  return {
    user: groups.user ?? defaultValues.user ?? await run("id -un"),
    host: groups.host ?? defaultValues.host,
    port: groups.port ? parseInt(groups.port, 10) : 22,
  };
}
