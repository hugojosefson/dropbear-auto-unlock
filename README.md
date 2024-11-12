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

Implement :)

### Example that works in bash

```bash
pass show disk-encryption-passphrase | timeout 5 sshpass -d 0 ssh -tt root@server-dropbear >/dev/null
```
