import { assertEquals, assertRejects } from "@std/assert";
import { parseDestinations } from "./parse-destinations.ts";

Deno.test("parseDestinations keeps alternatives in each server group", async () => {
  assertEquals(
    await parseDestinations([
      "--destination.1=alice@primary:2222",
      "--destination.1",
      "backup",
      "--destination.2=second",
    ]),
    [
      [
        { user: "alice", host: "primary", port: 2222 },
        { user: "root", host: "backup", port: undefined },
      ],
      [{ user: "root", host: "second", port: undefined }],
    ],
  );
});

Deno.test("parseDestinations keeps numeric host names as strings", async () => {
  assertEquals(await parseDestinations(["--destination.1=123"]), [
    [{ user: "root", host: "123", port: undefined }],
  ]);
});

Deno.test("parseDestinations rejects missing or invalid destinations", async () => {
  for (
    const args of [
      [],
      ["--destination=host"],
      ["--destination.name=host"],
      ["--destination.1"],
      ["--destination.1="],
      ["--destination.1.host=host"],
      ["--destination.1=host:22:33"],
    ]
  ) {
    await assertRejects(() => parseDestinations(args));
  }
});
