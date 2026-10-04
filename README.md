# @hugojosefson/dropbear-auto-unlock

Library and CLI for remote ZFS unlock during server startup.

<!-- deno-fmt-ignore-start -->
<!-- hj:readme jsr-package:badges f6a389e932b52ac79b706e7b7443263b34d03542e9833c05da97aec2c0dae439 -->

[![JSR Version](https://jsr.io/badges/@hugojosefson/dropbear-auto-unlock)](https://jsr.io/@hugojosefson/dropbear-auto-unlock) [![JSR Score](https://jsr.io/badges/@hugojosefson/dropbear-auto-unlock/score)](https://jsr.io/@hugojosefson/dropbear-auto-unlock) <!-- /hj:readme --> <!-- hj:readme github-ci:badge e360c05f32393f5df21859035b9d607909e6f3436b58582e4757c7e5d1769658 --> [![CI](https://github.com/hugojosefson/dropbear-auto-unlock/actions/workflows/hj-release-publish-tag.yaml/badge.svg?branch=main)](https://github.com/hugojosefson/dropbear-auto-unlock/actions/workflows/hj-release-publish-tag.yaml?query=branch%3Amain) <!-- /hj:readme -->
<!-- deno-fmt-ignore-end -->

## Overview

This tool connects to an SSH server, such as
[Dropbear](https://matt.ucc.asn.au/dropbear/dropbear.html), during startup. It
sends a passphrase when it recognizes the supported ZFS password request.
Watchers remain active across server reboots.

### Supported password request

The startup environment must print this ZFS prompt:

```text
Unlocking encrypted ZFS filesystems...
Enter the password or press Ctrl-C to exit.
```

The prompt can include a dataset line, for example:

```text
Encrypted ZFS password for rpool/ROOT: (press TAB for no echo)
```

Other password prompts, including LUKS and cryptroot prompts, are not supported.

### Key features

- **Automated Unlocking**: Eliminates the need for manual passphrase entry on
  remote or headless servers.

- **Multiple Destinations**: Supports unlocking multiple servers simultaneously.

- **Alternative Addresses**: Allows specifying multiple addresses for a server,
  useful if the server's IP or hostname changes after booting.

- **Low resource usage**: When it finds a server is already unlocked, it waits
  for the next reboot without polling, before attempting to reconnect.

## Requirements

### On your secure computer

The computer must have:

- Deno 2.5.2 or a subsequent version.
- SSH with key authentication.
- A passphrase source, for example a password manager.

### On the server

- Encrypted ZFS datasets with a passphrase
- Dropbear installed and running on the server, accepting SSH connections from
  the secure computer using key-based authentication. After authentication, the
  server must print the supported ZFS password request.

<!-- hj:readme deno-lib:api cb3b21341ce0e6022c486c4c7d2e6515881edf3702ad889adad5c754a5a8a2e9 -->

## API

See the API documentation on
[jsr.io/@hugojosefson/dropbear-auto-unlock](https://jsr.io/@hugojosefson/dropbear-auto-unlock).

<!-- /hj:readme -->

### Watch groups of servers

`startUnlockWatchers(options)` starts one watcher per destination group. Each
group contains alternative SSH addresses for the same server. Separate groups
run concurrently. Addresses can be strings or `SshDestination` objects. String
addresses default to user `root`. Omitted ports use SSH configuration.

The function validates all groups before starting any SSH process. It returns a
promise for an `UnlockWatchers` handle:

- `stop()` stops every watcher and waits for SSH cleanup. Repeated calls return
  the same promise.
- `done` resolves after shutdown and cleanup, or rejects after a fatal actor or
  cleanup error. A fatal error stops the other watchers too.

Successful unlocking does not resolve `done`. The watchers stay active across
server reboots until the application calls `stop()`. Connection failures retry
the alternative addresses. This API does not claim that every disk is unlocked.

The library does not read stdin, install signal handlers, or print messages by
default. The CLI uses this same public API and owns its terminal and signal
handling. An optional `logger` receives status messages with a hostname prefix.

```ts
import {
  type PassphraseProvider,
  startUnlockWatchers,
  type UnlockWatchers,
} from "@hugojosefson/dropbear-auto-unlock";

/** The application supplies its own passphrase source. */
export function watchServers(
  passphrase: string | PassphraseProvider,
): Promise<UnlockWatchers> {
  return startUnlockWatchers({
    destinationGroups: [
      ["server-a", "server-a-dropbear:2222"],
      ["root@server-b"],
    ],
    passphrase,
  });
}

```

The calling application can await `watchers.done` to observe fatal failures and
call `await watchers.stop()` during its own shutdown. A passphrase provider
receives a cancellation signal for each connection. It can retrieve the
passphrase when needed without placing it in command arguments.

### Compile a consumer

After adding this package to your application, compile its entry point:

```sh
deno compile --allow-run=ssh --output unlock-service app.ts
```

The target computer must have `ssh` installed and configured for key
authentication. SSH reads its own configuration and opens network connections.
The default connector needs no Deno `--allow-net` permission. Your application's
passphrase provider can need additional permissions for its own work.

### Individual actors

`createUnlockActor(options)` returns an actor for one server. It starts no SSH
process until you use `actor.start()`. Each alternative address belongs to the
same server. Use one actor for each server.

The caller supplies the passphrase as a string or a function. The function gets
an `AbortSignal` and can return a promise. The actor calls it when it detects
the [ZFS password request](src/is-zfs-unlock-prompt.ts) in the SSH output.
Connection cleanup cancels the signal. The library does not read stdin or
install signal handlers.

Use `stopUnlockActor(actor)` to stop a started actor and wait for SSH cleanup.
The returned promise rejects if SSH cleanup fails. A cleanup error stops the
actor without another connection attempt. The snapshot keeps the error in
`context.cleanupError`.

`actor.stop()` starts cleanup but does not wait for it. If the snapshot status
is `stopped`, `stopUnlockActor(actor)` rejects. Without a cleanup error, the
actor stays active across server restarts until you stop it.

`UnlockMachine` describes the public XState machine type. `UnlockActor`,
`UnlockSnapshot`, `UnlockInput`, and `UnlockEvent` describe its actors,
snapshots, inputs, and events. `UnlockStateValue` describes its state values.
Snapshots have typed states, for example `{ session: "readingOutput" }`,
`sleeping`, and `exit`. A command prompt indicates a shell. The machine does not
independently check ZFS status.

The options include `retryDelayMs`, `promptTimeoutMs`, and a status `logger`.
The default values for `retryDelayMs` and `promptTimeoutMs` are 5000 ms. The
library is silent by default. The `connect` option accepts an `SshConnector` for
custom transports and tests. SSH uses an explicit `port` value from each
destination. Without a port value, SSH uses its configuration and defaults. The
default SSH connector requires `--allow-run=ssh`.

The public machine type is explicit, so JSR can generate API documentation and
type declarations. Publication uses strict type checks without
`--allow-slow-types`. Internal machine modules retain XState type inference.

<!-- hj:readme jsr-package:installation 7e2ebbd908ff40d82b72fb90ab5f4cb2f73f6b58e3a40700849e0fb670984299 -->

## Installation

Add the package as a dependency:

```sh
deno add jsr:@hugojosefson/dropbear-auto-unlock

```

<!-- /hj:readme -->

<!-- hj:readme deno-cli:installation 117b541a92b10cfcdf0918af8a461601177fd8700614f84f7454d8ca220b3ddf -->

To install the command:

```sh
deno install --global --reload --force --allow-run=ssh \
  --name dropbear-auto-unlock jsr:@hugojosefson/dropbear-auto-unlock/cli

```

<!-- /hj:readme -->

## Example usage

Basic usage with a single destination:

```sh
pass show zfs_disk_passphrase | dropbear-auto-unlock --destination.1=root@pve-01

```

You can specify multiple alternative addresses for the same server, for example
in case the dropbear has a different IP and/or hostname than the unlocked and
fully booted server:

```sh
pass show zfs_disk_passphrase | dropbear-auto-unlock --destination.1=root@pve-01 --destination.1=root@pve-01-dropbear

# Use Bash for a shorter command.
pass show zfs_disk_passphrase | dropbear-auto-unlock --destination.1=root@pve-01{,-dropbear}

```

You can also unlock multiple separate servers simultaneously:

```sh
pass show zfs_disk_passphrase | dropbear-auto-unlock \
  --destination.1=root@pve-01 \
  --destination.2=root@pve-02

# Use an array for the arguments.
destinations=()
for i in {1..5}; do
  for suffix in "" "-dropbear"; do
    destinations+=("--destination.${i}=root@pve-0${i}${suffix}")
  done
done
pass show zfs_disk_passphrase | dropbear-auto-unlock "${destinations[@]}"

```

## License

[MIT](./LICENSE)
