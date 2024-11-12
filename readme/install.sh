#!/usr/bin/env bash
# create and enter a directory for the script
mkdir -p "dropbear-auto-unlock"
cd       "dropbear-auto-unlock"

# download+extract the script, into current directory
curl -fsSL "https://github.com/hugojosefson/dropbear-auto-unlock/tarball/main" \
  | tar -xzv --strip-components=1
