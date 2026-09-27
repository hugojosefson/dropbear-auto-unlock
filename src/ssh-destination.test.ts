import { assertEquals, assertRejects } from "@std/assert";
import { parseSshDestination } from "./ssh-destination.ts";

Deno.test("parseSshDestination", async () => {
  const parse = parseSshDestination;
  assertEquals(await parse("user@host:22"), {
    user: "user",
    host: "host",
    port: 22,
  });
  assertEquals(await parse("user@host"), {
    user: "user",
    host: "host",
    port: 22,
  });
  assertEquals(await parse("host:22", { user: "default-user" }), {
    user: "default-user",
    host: "host",
    port: 22,
  });
  assertEquals(await parse("host", { user: "default-user" }), {
    user: "default-user",
    host: "host",
    port: 22,
  });
  await assertRejects(async () => await parse("user@host:22:33"));
  await assertRejects(async () => await parse("host:22:33"));
});

Deno.test("parseSshDestination uses the default port", async () => {
  const defaults = { user: "default-user", port: 2222 };
  assertEquals(await parseSshDestination("host", defaults), {
    user: "default-user",
    host: "host",
    port: 2222,
  });
  assertEquals(await parseSshDestination("user@host:2200", defaults), {
    user: "user",
    host: "host",
    port: 2200,
  });
});

Deno.test("parseSshDestination rejects incorrect destinations", async () => {
  for (
    const destination of [
      undefined,
      null,
      22,
      {},
      "",
      "user@@host",
      "host name",
    ]
  ) {
    await assertRejects(() => parseSshDestination(destination), TypeError);
  }
});

Deno.test("parseSshDestination rejects incorrect port values", async () => {
  for (const port of [0, 65536, Number.MAX_SAFE_INTEGER]) {
    await assertRejects(
      () => parseSshDestination(`user@host:${port}`),
      RangeError,
    );
  }
  for (const port of [-1, 1.5, NaN, Infinity]) {
    await assertRejects(
      () => parseSshDestination("user@host", { port }),
      RangeError,
    );
  }
});
