#!/usr/bin/env bash
deno install --global --reload --force --allow-run=ssh \
  --name {{package.command}} jsr:{{package.name}}/cli
