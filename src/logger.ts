import type { SshDestination } from "./ssh-destination.ts";

const colors = [
  "\x1b[34m", // blue
  "\x1b[32m", // green
  "\x1b[35m", // magenta
  "\x1b[33m", // yellow
  "\x1b[31m", // red
] as const;
const reset = "\x1b[0m";

let colorIndex = 0;
export class Logger {
  private readonly color: string;

  constructor(private readonly destinations: SshDestination[]) {
    this.color = colors[colorIndex];
    colorIndex = (colorIndex + 1) % colors.length;
  }

  log(message: string) {
    const hosts = this.getHostLabel();
    console.log(`${this.color}${hosts}: ${message}${reset}`);
  }

  private getHostLabel() {
    return `[${this.destinations[0]?.host ?? "unknown"}]`;
  }
}
