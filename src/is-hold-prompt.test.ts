import { assert } from "@std/assert";
import { isHoldPrompt } from "./is-hold-prompt.ts";

Deno.test("isHoldPrompt", () => {
  assert(isHoldPrompt("sleeping for you, please hold"));
  assert(isHoldPrompt("sleeping for you, please hold\n"));
  assert(isHoldPrompt("sleeping for you, please hold\r\n"));
  assert(!isHoldPrompt("sleeping for you"));
  assert(!isHoldPrompt("please hold sleeping for you"));
  assert(!isHoldPrompt("# "));
});
