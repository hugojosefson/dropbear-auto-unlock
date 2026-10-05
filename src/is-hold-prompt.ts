const HOLD_PROMPT_REGEXP = /sleeping for you, please hold\s*$/;

export function isHoldPrompt(burst: string): boolean {
  return HOLD_PROMPT_REGEXP.test(burst);
}
