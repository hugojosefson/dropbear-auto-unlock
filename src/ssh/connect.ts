import type { SshDestination } from "../ssh-destination.ts";
import type { SshConnection } from "./connection.ts";
import { sshArguments } from "./ssh-arguments.ts";
import { processConnection } from "./process-connection.ts";

/** Starts an SSH process for one destination. Requires `--allow-run=ssh`. */
export function connectSsh(destination: SshDestination): SshConnection {
  return processConnection(
    new Deno.Command("ssh", {
      args: sshArguments(destination),
      stdin: "piped",
      stdout: "piped",
      stderr: "piped",
    }).spawn(),
  );
}
