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
"@@include(./install.sh)";
```

## Example usage

```sh
"@@include(./example-usage.sh)";
```

## TODO

Implement :)

### Example that works in bash

```bash
pass show disk-encryption-passphrase | timeout 5 sshpass -d 0 ssh -tt root@server-dropbear >/dev/null
```
