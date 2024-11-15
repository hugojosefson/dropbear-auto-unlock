#!/bin/sh
// 2>/dev/null;DENO_VERSION_RANGE="^2.0.6";DENO_RUN_ARGS="--allow-run=ssh,id --allow-net";set -e;V="$DENO_VERSION_RANGE";A="$DENO_RUN_ARGS";h(){ [ -x "$(command -v "$1" 2>&1)" ];};g(){ u="$([ "$(id -u)" != 0 ]&&echo sudo||:)";if h brew;then echo "brew install $1";elif h apt;then echo "($u apt update && $u DEBIAN_FRONTEND=noninteractive apt install -y $1)";elif h yum;then echo "$u yum install -y $1";elif h pacman;then echo "$u pacman -yS --noconfirm $1";elif h opkg-install;then echo "$u opkg-install $1";fi;};p(){ q="$(g "$1")";if [ -z "$q" ];then echo "Please install '$1' manually, then try again.">&2;exit 1;fi;eval "o=\"\$(set +o)\";set -x;$q;set +x;eval \"\$o\"">&2;};f(){ h "$1"||p "$1";};w(){ [ -n "$1" ] && "$1" -V >/dev/null 2>&1;};U="$(l=$(printf "%s" "$V"|wc -c);for i in $(seq 1 $l);do c=$(printf "%s" "$V"|cut -c $i);printf '%%%02X' "'$c";done)";D="$(w "$(command -v deno||:)"||:)";t(){ i="$(if h findmnt;then findmnt -Ononoexec,noro -ttmpfs -nboAVAIL,TARGET|sort -rn|while IFS=$'\n\t ' read -r a m;do [ "$a" -ge 150000000 ]&&[ -d "$m" ]&&printf %s "$m"&&break||:;done;fi)";printf %s "${i:-"${TMPDIR:-/tmp}"}";};s(){ deno eval "import{satisfies as e}from'https://deno.land/x/semver@v1.4.1/mod.ts';Deno.exit(e(Deno.version.deno,'$V')?0:1);">/dev/null 2>&1;};e(){ R="$(t)/deno-range-$V/bin";mkdir -p "$R";export PATH="$R:$PATH";s&&return;f curl;v="$(curl -sSfL "https://semver-version.deno.dev/api/github/denoland/deno/$U")";i="$(t)/deno-$v";ln -sf "$i/bin/deno" "$R/deno";s && return;f unzip;([ "${A#*-q}" != "$A" ]&&exec 2>/dev/null;curl -fsSL https://deno.land/install.sh|DENO_INSTALL="$i" sh -s $DENO_INSTALL_ARGS "$v"|grep -iv discord>&2);};e;exec deno run $A "$0" "$@"
import { parseArgs } from "@std/cli";
import { createActor } from "xstate";
import { machine } from "./machine.ts";
import { readFirstLine } from "./read-first-line.ts";
import { parseSshDestination, type SshDestination } from "./ssh-destination.ts";
import { Logger } from "./logger.ts";

/**
 * The main function of the program. This runs the CLI.
 * @param cliArgs The command line arguments to parse.
 */
export async function main(cliArgs: string[]): Promise<void> {
  const destinationArg = parseArgs(cliArgs).destination;
  console.dir(destinationArg);
  if (typeof destinationArg !== "object" || destinationArg === null) {
    console.error(
      "Please provide at least one destination using syntax: --destination.1=host1",
    );
    Deno.exit(2);
  }
  const destinationArgNumbers = Object.keys(
    destinationArg,
  ) as `${number}`[];
  if (destinationArgNumbers.length === 0) {
    console.error(
      "Please provide at least one destination using syntax: --destination.1=host1",
    );
    Deno.exit(2);
  }
  const destinationArgNames = destinationArgNumbers.map((k) =>
    `destination.${k}`
  ) as `destination.${number}`[];

  const args = parseArgs(cliArgs, { collect: destinationArgNames });
  const destinationAlternativesStrings = Object.values(
    args.destination as Record<number, unknown[]>,
  ).map((destinationValues) =>
    destinationValues.map((destinationValue) =>
      `${destinationValue}`
    ) as string[]
  );

  if (Deno.stdin.isTerminal()) {
    console.error("Please provide a passphrase on stdin, and press Enter.");
  }
  const passphrase = await readFirstLine(Deno.stdin.readable);

  // In cli.ts, replace the actors section with:

  const actors = await Promise.all(
    destinationAlternativesStrings.map(
      async (destinationAlternativeStrings) => {
        const destinationAlternatives: SshDestination[] = await Promise.all(
          destinationAlternativeStrings.map((destinationAlternativeString) =>
            parseSshDestination(
              destinationAlternativeString,
              { user: "root" },
            )
          ),
        );

        console.dir({ destinationAlternatives });

        const sshCommands: Deno.Command[] = destinationAlternatives.map(
          (destination) =>
            new Deno.Command("ssh", {
              args: [
                "-tt",
                "-o",
                "ConnectTimeout=5",
                destination.user + "@" + destination.host,
                "bash",
              ],
              stdin: "piped",
              stdout: "piped",
              stderr: "piped",
            }),
        );

        // Create a new actor with its own isolated context
        const actor = createActor(machine, {
          input: {
            destinationAlternatives,
            sshCommands,
            passphrase,
            logger: new Logger(destinationAlternatives),
          },
        });

        actor.start();

        return { actor, destinationAlternatives };
      },
    ),
  );

  // Single signal handler for all actors
  Deno.addSignalListener("SIGINT", () => {
    console.log("SIGINT received. Exiting all connections...");
    actors.forEach(({ actor, destinationAlternatives }) => {
      const hosts = destinationAlternatives.map((d) => d.host).join();
      console.log(`Stopping connection to ${hosts}`);
      actor.send({ type: "exit" });
    });
  });

  // Wait for all actors to complete or error
  try {
    await Promise.all(
      actors.map(({ actor }) =>
        new Promise((resolve, reject) => {
          actor.subscribe((state) => {
            if (state.status === "done") resolve(state);
            if (state.status === "error") reject(state.error);
          });
        })
      ),
    );
  } catch (error) {
    console.error("One or more actors failed:", error);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  await main(Deno.args);
}
