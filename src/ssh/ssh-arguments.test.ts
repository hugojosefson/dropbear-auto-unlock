import { assertEquals } from "@std/assert";
import { parseSshDestination } from "../ssh-destination.ts";
import { sshArguments } from "./ssh-arguments.ts";

Deno.test("SSH uses configuration when the address omits the port", async () => {
  const destination = await parseSshDestination("root@host");
  assertEquals(sshArguments(destination), [
    "-tt",
    "-o",
    "ConnectTimeout=5",
    "--",
    "root@host",
    "sh",
  ]);
});

Deno.test("SSH uses explicit ports, including port 22", async () => {
  for (const port of [22, 2222]) {
    const destination = await parseSshDestination(`root@host:${port}`);
    assertEquals(sshArguments(destination), [
      "-tt",
      "-o",
      "ConnectTimeout=5",
      "-p",
      String(port),
      "--",
      "root@host",
      "sh",
    ]);
  }
});
