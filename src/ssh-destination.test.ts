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
  assertRejects(async () => await parse("user@host:22:33"));
  assertRejects(async () => await parse("host:22:33"));
});
