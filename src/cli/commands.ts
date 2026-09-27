import metadata from "./package-metadata.json" with { type: "json" };
import type { CliCommand } from "./command.ts";

const helpCommand: CliCommand = {
  name: "help",
  description: "Show available commands.",
  run: () =>
    metadata.name + "\n\nUsage: " + metadata.command + " <command>\n\n" +
    commands.map((command) => command.name + "  " + command.description).join(
      "\n",
    ),
};

/** Generated command registry. Feature composition rewrites this file. */
export const commands: readonly CliCommand[] = [helpCommand];
