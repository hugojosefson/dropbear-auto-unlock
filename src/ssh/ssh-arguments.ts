import type { SshDestination } from "../ssh-destination.ts";

export function sshArguments(destination: SshDestination): string[] {
  return [
    "-tt",
    "-o",
    "ConnectTimeout=5",
    "-p",
    String(destination.port),
    "--",
    `${destination.user}@${destination.host}`,
    "sh",
  ];
}
