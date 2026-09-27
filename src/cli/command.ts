export type CliCommand = {
  readonly name: string;
  readonly description: string;
  readonly run: (args: readonly string[]) => string | Promise<string>;
};
