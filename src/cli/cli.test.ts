import { assert, assertEquals } from "@std/assert";
import { runCli } from "./cli.ts";

async function captureOutput(
  args: readonly string[],
): Promise<{ status: number; messages: unknown[][] }> {
  const messages: unknown[][] = [];
  const { log, error } = console;
  const record = (...values: unknown[]): void => {
    messages.push(values);
  };
  console.log = record;
  console.error = record;
  try {
    return { status: await runCli(args), messages };
  } finally {
    console.log = log;
    console.error = error;
  }
}

Deno.test("CLI help has the unlock syntax", async () => {
  const { status, messages } = await captureOutput(["--help"]);
  assertEquals(status, 0);
  assert(
    messages.flat().some((value) => String(value).includes("--destination.1")),
  );
});

Deno.test("CLI rejects an unknown command", async () => {
  assertEquals((await captureOutput(["unknown-command"])).status, 1);
});

Deno.test("CLI checks destinations before it reads stdin", async () => {
  assertEquals((await captureOutput(["unlock"])).status, 2);
  assertEquals((await captureOutput(["--destination.1="])).status, 2);
});
