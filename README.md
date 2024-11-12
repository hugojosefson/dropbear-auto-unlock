# dropbear-auto-unlock

[![JSR Score](https://jsr.io/badges/@hugojosefson/dropbear-auto-unlock/score)](https://jsr.io/@hugojosefson/dropbear-auto-unlock)
[![CI](https://github.com/hugojosefson/dropbear-auto-unlock/actions/workflows/deno.yaml/badge.svg)](https://github.com/hugojosefson/dropbear-auto-unlock/actions/workflows/deno.yaml)

## Requirements

- `/bin/sh`
- `unzip`
- `curl`
- `ssh`

## Installation

```sh
# create and enter a directory for the script
mkdir -p "dropbear-auto-unlock"
cd       "dropbear-auto-unlock"

# download+extract the script, into current directory
curl -fsSL "https://github.com/hugojosefson/dropbear-auto-unlock/tarball/main" \
  | tar -xzv --strip-components=1
```

## Example usage

```sh
pass show zfs_disk_passphrase | dropbear-auto-unlock root@pve-01
```

## TODO

- [ ] Instead of checking first line of ssh server, spawn `ssh` and get a proper
      line stream.
- [ ] Check if the prompt is an unlock prompt. If so, unlock.
- [ ] Check if we can run `zfsunlock`. If so, unlock.
- [ ] If we're in the server booted, `sleep infinity`, then wait for broken
      connection indicating next boot.
- [ ] Add timeout arguments/options to `ssh` command.
