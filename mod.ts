import { main as cli } from "./src/cli.ts";
export default cli;

if (import.meta.main) {
  Deno.exit(await cli(Deno.args));
}
