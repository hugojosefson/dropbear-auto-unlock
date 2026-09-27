import { assertEquals, assertStrictEquals } from "@std/assert";
import { processConnection } from "./process-connection.ts";
import { sshArguments } from "./ssh-arguments.ts";
import type { SshConnection } from "./connection.ts";

function shell(script: string): SshConnection {
  return processConnection(
    new Deno.Command("sh", {
      args: ["-c", script],
      stdin: "piped",
      stdout: "piped",
      stderr: "piped",
    }).spawn(),
  );
}

Deno.test("SSH arguments", () => {
  assertEquals(sshArguments({ user: "root", host: "host", port: 2222 }), [
    "-tt",
    "-o",
    "ConnectTimeout=5",
    "-p",
    "2222",
    "--",
    "root@host",
    "sh",
  ]);
});

Deno.test("process connection writes lines and decodes output", async () => {
  const connection = shell(
    'IFS= read -r line; printf "\\033[31m%s\\033[0m" "$line"',
  );
  try {
    const chunks: string[] = [];
    const read = (async () => {
      for await (const chunk of connection.output) {
        chunks.push(chunk);
      }
    })();
    await connection.write("dummy text åäö");
    await read;
    await connection.closed;
    assertEquals(chunks.join(""), "\x1b[31mdummy text åäö\x1b[0m");
  } finally {
    await connection.close();
  }
});

Deno.test("process connection closes while an output read waits", async () => {
  const connection = shell("read -r line");
  const reader = connection.output.getReader();
  try {
    const pending = reader.read();
    const first = connection.close();
    assertStrictEquals(connection.close(), first);
    await first;
    await connection.closed;
    assertEquals(await pending, { value: undefined, done: true });
  } finally {
    reader.releaseLock();
    await connection.close();
  }
});

Deno.test("process connection drains stderr", async () => {
  const connection = shell(
    'i=0; while [ "$i" -lt 10000 ]; do printf "dummy stderr output\\n" >&2; i=$((i + 1)); done; printf done',
  );
  try {
    const chunks: string[] = [];
    for await (const chunk of connection.output) {
      chunks.push(chunk);
    }
    await connection.closed;
    assertEquals(chunks.join(""), "done");
  } finally {
    await connection.close();
  }
});

Deno.test("process connection kills a process that ignores SIGTERM", async () => {
  const connection = shell("trap '' TERM; printf ready; while :; do :; done");
  const reader = connection.output.getReader();
  try {
    assertEquals((await reader.read()).value, "ready");
    await connection.close();
    await connection.closed;
  } finally {
    reader.releaseLock();
    await connection.close();
  }
});

Deno.test("process connection closes after output cancellation", async () => {
  const connection = shell("read -r line");
  await connection.output.cancel();
  await connection.close();
  await connection.closed;
});
