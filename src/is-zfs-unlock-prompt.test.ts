import { assert } from "@std/assert";
import { isZfsUnlockPrompt } from "./is-zfs-unlock-prompt.ts";

Deno.test("isZfsUnlockPrompt interactive -tt", () => {
  assert(isZfsUnlockPrompt(`
Unlocking encrypted ZFS filesystems...
Enter the password or press Ctrl-C to exit.

🔐 Encrypted ZFS password for rpool/ROOT: (press TAB for no echo) `));
});

Deno.test("isZfsUnlockPrompt non-interactive -T", () => {
  assert(isZfsUnlockPrompt(`
Unlocking encrypted ZFS filesystems...
Enter the password or press Ctrl-C to exit.

🔐 Encrypted ZFS password for rpool/ROOT: (press TAB for no echo)
`));
});

Deno.test("isZfsUnlockPrompt on bash → false", () => {
  assert(!isZfsUnlockPrompt(`root@host:~$ `));
  assert(!isZfsUnlockPrompt(`root@host:~# `));
});
