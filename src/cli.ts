#!/bin/sh
// 2>/dev/null;DENO_VERSION_RANGE="^2.0.6";DENO_RUN_ARGS="--allow-run=ssh,id --allow-net";set -e;V="$DENO_VERSION_RANGE";A="$DENO_RUN_ARGS";h(){ [ -x "$(command -v "$1" 2>&1)" ];};g(){ u="$([ "$(id -u)" != 0 ]&&echo sudo||:)";if h brew;then echo "brew install $1";elif h apt;then echo "($u apt update && $u DEBIAN_FRONTEND=noninteractive apt install -y $1)";elif h yum;then echo "$u yum install -y $1";elif h pacman;then echo "$u pacman -yS --noconfirm $1";elif h opkg-install;then echo "$u opkg-install $1";fi;};p(){ q="$(g "$1")";if [ -z "$q" ];then echo "Please install '$1' manually, then try again.">&2;exit 1;fi;eval "o=\"\$(set +o)\";set -x;$q;set +x;eval \"\$o\"">&2;};f(){ h "$1"||p "$1";};w(){ [ -n "$1" ] && "$1" -V >/dev/null 2>&1;};U="$(l=$(printf "%s" "$V"|wc -c);for i in $(seq 1 $l);do c=$(printf "%s" "$V"|cut -c $i);printf '%%%02X' "'$c";done)";D="$(w "$(command -v deno||:)"||:)";t(){ i="$(if h findmnt;then findmnt -Ononoexec,noro -ttmpfs -nboAVAIL,TARGET|sort -rn|while IFS=$'\n\t ' read -r a m;do [ "$a" -ge 150000000 ]&&[ -d "$m" ]&&printf %s "$m"&&break||:;done;fi)";printf %s "${i:-"${TMPDIR:-/tmp}"}";};s(){ deno eval "import{satisfies as e}from'https://deno.land/x/semver@v1.4.1/mod.ts';Deno.exit(e(Deno.version.deno,'$V')?0:1);">/dev/null 2>&1;};e(){ R="$(t)/deno-range-$V/bin";mkdir -p "$R";export PATH="$R:$PATH";s&&return;f curl;v="$(curl -sSfL "https://semver-version.deno.dev/api/github/denoland/deno/$U")";i="$(t)/deno-$v";ln -sf "$i/bin/deno" "$R/deno";s && return;f unzip;([ "${A#*-q}" != "$A" ]&&exec 2>/dev/null;curl -fsSL https://deno.land/install.sh|DENO_INSTALL="$i" sh -s $DENO_INSTALL_ARGS "$v"|grep -iv discord>&2);};e;exec deno run $A "$0" "$@"
import { parseArgs } from "@std/cli";
import { swallow } from "@hugojosefson/fns/fn/swallow";
import { connectAndGetFirstLine } from "./connect-and-get-first-line.ts";
import { readFirstLine } from "./read-first-line.ts";
import { parseSshDestination, type SshDestination } from "./ssh-destination.ts";
import { determineSshServerType } from "./ssh-server-type.ts";
import { run } from "@hugojosefson/run-simple";

const RETRY_INTERVAL_SECONDS = 5;

async function main() {
  const { _ } = parseArgs(Deno.args);
  const sshDestinationString = _[0];
  const sshDestination = await parseSshDestination(sshDestinationString, {
    user: "root",
  });
  const passphrase = await readFirstLine(Deno.stdin.readable);

  let done = false;
  Deno.addSignalListener("SIGINT", () => {
    console.log("SIGINT received. Exiting...");
    done = true;
  });

  while (!done) {
    console.log("\nConnecting...");
    const firstLine = await connectAndGetFirstLine(sshDestination).catch(
      swallow(Error, undefined),
    );
    const sshServerType = determineSshServerType(firstLine);
    if (sshServerType === "dropbear") {
      await dropbearAutoUnlock(sshDestination, passphrase);
    } else {
      if (!done) {
        console.error(
          `Unsupported ssh server type: ${sshServerType}. Will try again in ${RETRY_INTERVAL_SECONDS} seconds.`,
        );
        await sleep(RETRY_INTERVAL_SECONDS * 1000);
      }
    }
  }
}

export async function sleep(ms: number) {
  let timeoutHandle: number | undefined;
  let resolver: (value: void) => void;
  const promise = new Promise((resolve) => {
    resolver = resolve;
    timeoutHandle = setTimeout(resolver, ms);
  });
  const cancel = () => {
    clearTimeout(timeoutHandle);
    resolver();
  };
  Deno.addSignalListener("SIGINT", cancel);
  await promise;
  Deno.removeSignalListener("SIGINT", cancel);
}

async function dropbearAutoUnlock(
  destination: SshDestination,
  passphrase: string,
) {
  await run([
    "ssh",
    "-tt",
    destination.user + "@" + destination.host,
  ], {
    stdin: passphrase + "\n",
  });
}

if (import.meta.main) {
  await main();
}
