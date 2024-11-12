#!/usr/bin/env bash
# add as dependency to your project
deno add jsr:@hugojosefson/dropbear-auto-unlock

# ...or...

# create and enter a directory for the script
mkdir -p "dropbear-auto-unlock"
cd       "dropbear-auto-unlock"

# download+extract the script, into current directory
curl -fsSL "https://github.com/hugojosefson/dropbear-auto-unlock/tarball/main" \
  | tar -xzv --strip-components=1
