import { readFirstLine } from "../read-first-line.ts";
import { parseDestinations } from "./parse-destinations.ts";
import { runUnlock } from "./run-unlock.ts";

export async function main(cliArgs: readonly string[]): Promise<number> {
  const destinations = await parseDestinations(cliArgs).catch(
    (error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      return undefined;
    },
  );
  if (!destinations) {
    return 2;
  }
  if (Deno.stdin.isTerminal()) {
    console.error("Write the passphrase to stdin. Push the Enter key.");
  }
  try {
    const passphrase = await readFirstLine(Deno.stdin.readable);
    await runUnlock(destinations, passphrase);
    return 0;
  } catch (error) {
    console.error("Unlock error:", error);
    return 1;
  }
}
