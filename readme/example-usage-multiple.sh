#!/usr/bin/env bash
pass show zfs_disk_passphrase | dropbear-auto-unlock \
  --destination.1=root@pve-01 \
  --destination.2=root@pve-02

# Use an array for the arguments.
destinations=()
for i in {1..5}; do
  for suffix in "" "-dropbear"; do
    destinations+=("--destination.${i}=root@pve-0${i}${suffix}")
  done
done
pass show zfs_disk_passphrase | dropbear-auto-unlock "${destinations[@]}"
