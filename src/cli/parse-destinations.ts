import { parseArgs } from "@std/cli";
import {
  parseSshDestination,
  type SshDestination,
} from "@hugojosefson/dropbear-auto-unlock";

export async function parseDestinations(
  cliArgs: readonly string[],
): Promise<SshDestination[][]> {
  const destinationArg = parseArgs(cliArgs).destination;
  if (typeof destinationArg !== "object" || destinationArg === null) {
    throw new Error("Use a destination: --destination.1=host");
  }
  const groups = Object.keys(destinationArg);
  if (groups.length === 0 || groups.some((group) => !/^\d+$/.test(group))) {
    throw new Error("Use a number for each destination group.");
  }
  const flags = groups.map((group) => `destination.${group}`);
  const args = parseArgs(cliArgs, { collect: flags, string: flags });
  const values: unknown = args.destination;
  if (typeof values !== "object" || values === null) {
    throw new Error("Use a destination: --destination.1=host");
  }
  return await Promise.all(groups.map(async (group) => {
    const alternatives: unknown = Reflect.get(values, group);
    if (
      !Array.isArray(alternatives) || alternatives.length === 0 ||
      alternatives.some((value) =>
        typeof value !== "string" || value.length === 0
      )
    ) {
      throw new Error("Use a host for each destination.");
    }
    return await Promise.all(
      alternatives.map((value) => parseSshDestination(value, { user: "root" })),
    );
  }));
}
