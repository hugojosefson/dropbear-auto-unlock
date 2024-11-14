const COMMAND_PROMPT_REGEXP = /[$#]\s*$/;

export function isCommandPrompt(burst: string): boolean {
  return COMMAND_PROMPT_REGEXP.test(burst);
}
