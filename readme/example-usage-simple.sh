#!/usr/bin/env bash
pass show zfs_disk_passphrase | dropbear-auto-unlock --destination.1=root@pve-01
