import {
  createUnlockActor,
  type PassphraseProvider,
  type SshDestination,
  type UnlockActor,
} from "@hugojosefson/dropbear-auto-unlock";

/** Start one server watcher with a passphrase source from the caller. */
export function watchServer(
  destinationAlternatives: readonly SshDestination[],
  passphrase: PassphraseProvider,
): UnlockActor {
  const actor = createUnlockActor({ destinationAlternatives, passphrase });
  actor.subscribe((snapshot) => console.log(snapshot.value));
  actor.start();
  return actor;
}
