import { stripAnsiCode } from "@std/fmt/colors";
import { isCommandPrompt } from "../is-command-prompt.ts";
import { isZfsUnlockPrompt } from "../is-zfs-unlock-prompt.ts";
import type { ConnectionEvent } from "./types.ts";

export async function readPrompts(
  reader: ReadableStreamDefaultReader<string>,
  send: (event: ConnectionEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  let buffer = "";
  while (!signal.aborted) {
    const { done, value } = await reader.read();
    if (done || signal.aborted) {
      return;
    }
    // Limit memory while a server sends output without a prompt.
    buffer = (buffer + value).slice(-8192);
    const text = stripAnsiCode(buffer);
    if (isZfsUnlockPrompt(text)) {
      send({ type: "zfsUnlockPromptDetected" });
      buffer = "";
    } else if (isCommandPrompt(text)) {
      send({ type: "commandPromptDetected" });
      buffer = "";
    }
  }
}
