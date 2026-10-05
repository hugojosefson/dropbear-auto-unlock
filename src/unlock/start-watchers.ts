import { parseSshDestination } from "../ssh-destination.ts";
import { connectSsh } from "../ssh/connect.ts";
import { connectionScope } from "./connection-scope.ts";
import { createUnlockActor } from "./create-actor.ts";
import { runActors } from "./run-actors.ts";
import type { UnlockWatchers, UnlockWatchersOptions } from "./watchers.ts";

/**
 * Validate every destination, then start one watcher per server group.
 * String addresses default to root. Omitted ports use SSH configuration.
 * Watchers keep running after unlocking a server, until stop() or a fatal error.
 * The default connector requires --allow-run=ssh. No signal handlers are added.
 */
export async function startUnlockWatchers(
  options: UnlockWatchersOptions,
): Promise<UnlockWatchers> {
  if (options.destinationGroups.length === 0) {
    throw new TypeError("At least one server group is required.");
  }
  const groups = await Promise.all(
    options.destinationGroups.map((group) =>
      Promise.all(
        group.map((destination) =>
          typeof destination === "string"
            ? parseSshDestination(destination, { user: "root" })
            : { ...destination }
        ),
      )
    ),
  );
  const connections = connectionScope(options.connect ?? connectSsh);
  const actors = groups.map((destinationAlternatives) => {
    const logger = options.logger;
    return createUnlockActor({
      ...options,
      destinationAlternatives,
      connect: connections.connect,
      logger: logger
        ? {
          log: (message) =>
            logger.log(`[${destinationAlternatives[0]?.host}] ${message}`),
        }
        : undefined,
    });
  });
  const done = runActors(actors).then(
    () => connections.close(),
    async (error: unknown) => {
      await connections.close().catch(() => {});
      throw error;
    },
  );
  // A caller can await stop() later instead of immediately observing done.
  void done.catch(() => {});
  return {
    done,
    stop() {
      for (const actor of actors) {
        actor.send({ type: "exit" });
      }
      return done;
    },
    snapshot() {
      return actors.map((actor) => actor.getSnapshot());
    },
  };
}
