#!/bin/sh
case "$*" in
  *root@unreachable.invalid*) exit 1 ;;
esac
printf 'Unlocking encrypted ZFS filesystems...\nEnter the password or press Ctrl-C to exit.\nEncrypted ZFS password for rpool/ROOT: (press TAB for no echo) '
IFS= read -r passphrase
test "${passphrase}" = dummy || exit 2
printf 'unlocked\n' >> "${FAKE_SSH_EVENTS}"
printf 'root@server:~# '
IFS= read -r command
test "${command}" = 'sleep infinity' || exit 3
read -r unused
