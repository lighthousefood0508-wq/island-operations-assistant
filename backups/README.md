# Backups

This folder holds manually created local backup artifacts.

Allowed:

- SQLite copies
- Approved exports
- Configuration backups without secrets in filenames
- Git snapshots or troubleshooting bundles

Do not place:

- Product source files used as a second working copy
- Active runtime files, logs, credentials, or unreviewed destructive scripts

Backup artifacts are ignored by Git. This README is tracked so the folder's purpose is preserved in a fresh clone.
