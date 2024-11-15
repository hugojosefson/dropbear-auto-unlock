#!/usr/bin/env bash
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
