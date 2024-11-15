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

Basic usage with a single destination:

```sh
pass show zfs_disk_passphrase | dropbear-auto-unlock --destination.1=root@pve-01
```

You can specify multiple alternative addresses for the same server, for example
in case the dropbear has a different IP and/or hostname than the unlocked and
fully booted server:

```sh
pass show zfs_disk_passphrase | dropbear-auto-unlock --destination.1=root@pve-01 --destination.1=root@pve-01-dropbear

# or, more concisely:
pass show zfs_disk_passphrase | dropbear-auto-unlock --destination.1=root@pve-01{,-dropbear}
```

You can also unlock multiple separate servers simultaneously:

```sh
pass show zfs_disk_passphrase | dropbear-auto-unlock \
  --destination.1=root@pve-01 \
  --destination.2=root@pve-02

# or, if you have 5 servers, whose dropbear is on the same hostname but with "-dropbear" appended:
pass show zfs_disk_passphrase | dropbear-auto-unlock \
  $(for i in {1..5}; do \
    for d in "" "-dropbear"; do \
      echo "--destination.${i}=root@pve-0${i}${d}"; \
    done; \
  done)
```
