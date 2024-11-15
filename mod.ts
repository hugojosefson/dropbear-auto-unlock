import { main as cli } from "./src/cli.ts";
export default cli;

if (import.meta.main) {
  await cli(Deno.args);
}
