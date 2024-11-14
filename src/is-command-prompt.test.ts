import { assert } from "@std/assert";
import { isCommandPrompt } from "./is-command-prompt.ts";

Deno.test("isCommandPrompt", () => {
  assert(isCommandPrompt("$ "));
  assert(isCommandPrompt("# "));
  assert(isCommandPrompt("root@host:~$ "));
  assert(isCommandPrompt("root@host:~# "));
});
