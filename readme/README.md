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
