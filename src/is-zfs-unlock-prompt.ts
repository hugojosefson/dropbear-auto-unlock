const ZFS_UNLOCK_PROMPT_REGEXP =
  /Unlocking encrypted ZFS filesystems\.*\s*Enter the password or press Ctrl-C to exit\.[^A-Za-z0-9]*(Encrypted ZFS password for [^:]+:\s*\(press TAB for no echo\))?\s*$/;

export function isZfsUnlockPrompt(burst: string): boolean {
  return ZFS_UNLOCK_PROMPT_REGEXP.test(burst);
}
