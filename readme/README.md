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

- [x] Instead of checking first line of ssh server, spawn `ssh` and get a proper
      line stream.
- [x] Check if the prompt is an unlock prompt. If so, unlock.
- [x] ~~Check if we can run `zfsunlock`. If so, unlock.~~
- [x] If we're in the server booted, `sleep infinity`, then wait for broken
      connection indicating next boot.
- [x] Add timeout arguments/options to `ssh` command.
- [ ] Support secondary destination for same server.
