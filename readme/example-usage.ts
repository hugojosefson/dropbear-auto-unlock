import {
  type PassphraseProvider,
  startUnlockWatchers,
  type UnlockWatchers,
} from "@hugojosefson/dropbear-auto-unlock";

/** The application supplies its own passphrase source. */
export function watchServers(
  passphrase: string | PassphraseProvider,
): Promise<UnlockWatchers> {
  return startUnlockWatchers({
    destinationGroups: [
      ["server-a", "server-a-dropbear:2222"],
      ["root@server-b"],
    ],
    passphrase,
  });
}
