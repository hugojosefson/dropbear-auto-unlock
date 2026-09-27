import { commands } from "../src/cli/commands.ts";

Deno.test("generated CLI has help", () => {
  if (commands[0]?.name !== "help") {
    throw new Error("expected the generated help command");
  }
});
