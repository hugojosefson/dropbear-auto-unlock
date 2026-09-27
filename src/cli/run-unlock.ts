import { createUnlockActor } from "../lib/mod.ts";
import { Logger } from "../logger.ts";
import type { SshDestination } from "../ssh-destination.ts";
import { runActors } from "./run-actors.ts";

export async function runUnlock(
  destinations: readonly (readonly SshDestination[])[],
  passphrase: string,
): Promise<void> {
  const actors = destinations.map((destinationAlternatives) =>
    createUnlockActor({
      destinationAlternatives,
      passphrase,
      logger: new Logger([...destinationAlternatives]),
    })
  );
  await runActors(actors);
}
