import { readFirstLine } from "./read-first-line.ts";
import type { SshDestination } from "./ssh-destination.ts";

export async function connectAndGetFirstLine(
  sshDestination: SshDestination,
): Promise<string> {
  const { host, port } = sshDestination;
  using connection: Deno.TcpConn = await Deno.connect({ hostname: host, port });
  return await readFirstLine(connection.readable);
}
