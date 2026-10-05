import type { SshDestination } from "../ssh-destination.ts";

export function sshArguments(destination: SshDestination): string[] {
  return [
    ...(destination.pty === false ? [] : ["-tt"]),
    "-o",
    "ConnectTimeout=5",
    ...(destination.port === undefined ? [] : ["-p", String(destination.port)]),
    "--",
    `${destination.user}@${destination.host}`,
    "sh",
  ];
}
