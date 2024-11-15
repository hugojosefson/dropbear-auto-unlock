# dropbear-auto-unlock

CLI tool to automate remote unlocking of encrypted disks on servers during boot.

[![JSR Score](https://jsr.io/badges/@hugojosefson/dropbear-auto-unlock/score)](https://jsr.io/@hugojosefson/dropbear-auto-unlock)
[![CI](https://github.com/hugojosefson/dropbear-auto-unlock/actions/workflows/deno.yaml/badge.svg)](https://github.com/hugojosefson/dropbear-auto-unlock/actions/workflows/deno.yaml)

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

- `/bin/sh`
- `unzip`
- `curl`
- `ssh` with key-based authentication configured
- A way of providing the passphrase on the command line, such as a password
  manager or a file containing the passphrase.

### On the server

- Encrypted disks with a passphrase
- Dropbear installed and running on the server, accepting SSH connections from
  the secure computer using key-based authentication. When authenticated, the
  server will prompt for the passphrase.

## Installation

```sh
"@@include(./install.sh)";
```

## Example usage

Basic usage with a single destination:

```sh
"@@include(./example-usage-simple.sh)";
```

You can specify multiple alternative addresses for the same server, for example
in case the dropbear has a different IP and/or hostname than the unlocked and
fully booted server:

```sh
"@@include(./example-usage-alternatives.sh)";
```

You can also unlock multiple separate servers simultaneously:

```sh
"@@include(./example-usage-multiple.sh)";
```
