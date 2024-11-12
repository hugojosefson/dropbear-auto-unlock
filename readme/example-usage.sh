#!/usr/bin/env bash
pass show zfs_disk_passphrase | dropbear-auto-unlock root@pve-01
