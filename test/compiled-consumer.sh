#!/usr/bin/env bash
set -euo pipefail

mkdir -p /tmp/agents
test_dir=$(mktemp -d /tmp/agents/unlock-consumer.XXXXXX)
trap 'rm -rf -- "${test_dir}"' EXIT
mkdir "${test_dir}/bin"
cp test/fixtures/fake-ssh.sh "${test_dir}/bin/ssh"
chmod +x "${test_dir}/bin/ssh"

deno compile --allow-run=ssh --output "${test_dir}/consumer" \
  test/fixtures/compiled-consumer.ts
PATH="${test_dir}/bin:${PATH}" FAKE_SSH_EVENTS="${test_dir}/events" \
  "${test_dir}/consumer" </dev/null
test "$(cat "${test_dir}/events")" = $'unlocked\nunlocked'
