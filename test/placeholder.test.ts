import { assertEquals } from "@std/assert";
import { placeholder } from "../mod.ts";

Deno.test("placeholder", async (t) => {
  await t.step("should not throw", placeholder);

  await t.step("should return undefined", () => {
    assertEquals(placeholder(), undefined);
  });
});
