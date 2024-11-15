#!/usr/bin/env bash
pass show zfs_disk_passphrase | dropbear-auto-unlock --destination.1=root@pve-01 --destination.1=root@pve-01-dropbear

# or, more concisely:
pass show zfs_disk_passphrase | dropbear-auto-unlock --destination.1=root@pve-01{,-dropbear}
