export type SshServerType = "dropbear" | "openssh" | "other" | undefined;

export function determineSshServerType(
  firstLine?: string,
): SshServerType {
  if (firstLine === undefined) {
    return undefined;
  }
  if (firstLine.startsWith("SSH-2.0-dropbear")) {
    return "dropbear";
  }
  if (firstLine.includes("SSH-2.0-OpenSSH")) {
    return "openssh";
  }
  if (firstLine.includes("SSH-2.0")) {
    return "other";
  }
  return undefined;
}
