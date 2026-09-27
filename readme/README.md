# {{package.name}}

Library and CLI for remote disk unlock during server startup.

<!-- deno-fmt-ignore-start -->
<!-- hj:readme jsr-package:badges d656b1327b62219112d1f9aae71fbd85e417c94f6e4f8de91520618d5a2e2ac2 -->

[![JSR Version](https://jsr.io/badges/{{package.name}})](https://jsr.io/{{package.name}}) [![JSR Score](https://jsr.io/badges/{{package.name}}/score)](https://jsr.io/{{package.name}}) <!-- /hj:readme --> <!-- hj:readme github-ci:badge 41714f2a4ea4f2b32acb9e6473b3dcfc679f8a3b05876bae215dd749f953d07f --> [![CI](https://github.com/hugojosefson/dropbear-auto-unlock/actions/workflows/hj-ci.yaml/badge.svg)](https://github.com/hugojosefson/dropbear-auto-unlock/actions/workflows/hj-ci.yaml) <!-- /hj:readme -->
<!-- deno-fmt-ignore-end -->

## Overview

When a server with encrypted disks starts up, it often requires a passphrase to
unlock the disks before completing the boot process. If a minimal SSH server is
installed on the server that prompts for the passphrase, you can use this tool
to automatically unlock the disks without manual intervention.

This tool connects to the server running a minimal SSH server such as
[Dropbear](https://matt.ucc.asn.au/dropbear/dropbear.html), which is typically
available in the early stages of the boot process. It then provides the
necessary passphrase to unlock the encrypted disks, allowing the server to
continue booting automatically.

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

- Encrypted disks with a passphrase
- Dropbear installed and running on the server, accepting SSH connections from
  the secure computer using key-based authentication. When authenticated, the
  server will prompt for the passphrase.

<!-- hj:readme deno-lib:api 0658b56ce02a546cc6dd47883610712ed67cdfbe7ccc1cf8da02baebb1edfccb -->

## API

See the API documentation on
[jsr.io/{{package.name}}](https://jsr.io/{{package.name}}).

<!-- /hj:readme -->

### Library actors

`createUnlockActor(options)` returns an actor for one server. It starts no SSH
process until you use `actor.start()`. Each alternative address belongs to the
same server. Use one actor for each server.

```ts
@@include(./example-usage.ts)
```

The caller supplies the passphrase as a string or a function. The function gets
an `AbortSignal` and can return a promise. The actor calls it when it detects
the [ZFS password request](../src/is-zfs-unlock-prompt.ts) in the SSH output.
Connection cleanup cancels the signal. The library does not read stdin or
install signal handlers.

Use `stopUnlockActor(actor)` to stop a started actor and wait for SSH cleanup.
The returned promise rejects if SSH cleanup fails. A cleanup error stops the
actor without another connection attempt. The snapshot keeps the error in
`context.cleanupError`.

`actor.stop()` starts cleanup but does not wait for it. If the snapshot status
is `stopped`, `stopUnlockActor(actor)` rejects. Without a cleanup error, the
actor stays active across server restarts until you stop it.

`UnlockActor`, `UnlockSnapshot`, `UnlockInput`, and `UnlockEvent` derive their
types from `unlockMachine`. Snapshots have typed states, for example
`{ session: "readingOutput" }`, `sleeping`, and `exit`. A command prompt
indicates a shell. The machine does not independently check ZFS status.

The options include `retryDelayMs`, `promptTimeoutMs`, and a status `logger`.
The default values for `retryDelayMs` and `promptTimeoutMs` are 5000 ms. The
library is silent by default. The `connect` option accepts an `SshConnector` for
custom transports and tests. SSH uses the `port` value from each destination.
The default SSH connector requires `--allow-run=ssh`.

The machine modules use XState type inference. JSR publication uses
`--allow-slow-types` to keep the inferred state and event types. TypeScript
checks the full API. JSR documentation and npm type declarations do not always
include these types. See the
[JSR limits for slow types](https://jsr.io/docs/about-slow-types).

<!-- hj:readme jsr-package:installation 8934ac03941d62ea909807c61fb88dc52401f08c0197caaa189cd429b1a914ce -->

## Installation

Add the package as a dependency:

```sh
@@include(./install.sh)
```

<!-- /hj:readme -->

<!-- hj:readme deno-cli:installation 117b541a92b10cfcdf0918af8a461601177fd8700614f84f7454d8ca220b3ddf -->

To install the command:

```sh
@@include(./install-cli.sh)
```

<!-- /hj:readme -->

## Example usage

Basic usage with a single destination:

```sh
@@include(./example-usage-simple.sh)
```

You can specify multiple alternative addresses for the same server, for example
in case the dropbear has a different IP and/or hostname than the unlocked and
fully booted server:

```sh
@@include(./example-usage-alternatives.sh)
```

You can also unlock multiple separate servers simultaneously:

```sh
@@include(./example-usage-multiple.sh)
```

## License

[MIT](../LICENSE)
