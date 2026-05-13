#!/usr/bin/env bash
# backup.sh — snapshot pb_data into a timestamped tarball.
#
# Run on the server (cron or manual). Defaults to /opt/goalops/backups, keeps
# the last 14 days. Set BACKUP_DIR / KEEP_DAYS / REMOTE_SCP_TARGET to override.
#
# Example crontab line (as root):
#   15 3 * * * /opt/goalops/scripts/backup.sh >> /var/log/goalops-backup.log 2>&1

set -euo pipefail

PB_DATA="${PB_DATA:-/opt/goalops/pocketbase/pb_data}"
BACKUP_DIR="${BACKUP_DIR:-/opt/goalops/backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
REMOTE_SCP_TARGET="${REMOTE_SCP_TARGET:-}"   # e.g. "backup@offsite:/srv/goalops/"

mkdir -p "$BACKUP_DIR"
ts="$(date -u +%Y%m%dT%H%M%SZ)"
out="$BACKUP_DIR/pb_data-$ts.tar.gz"

# PB writes through SQLite WAL. A live tar can still get a consistent snapshot
# because SQLite's atomic commit means files on disk are either pre- or
# post-transaction; the WAL replay on restore handles partial writes. If you
# want zero risk, stop pocketbase.service first.
echo "==> Archiving $PB_DATA -> $out"
tar czf "$out" -C "$(dirname "$PB_DATA")" "$(basename "$PB_DATA")"

# Optional off-box copy.
if [[ -n "$REMOTE_SCP_TARGET" ]]; then
	echo "==> scp -> $REMOTE_SCP_TARGET"
	scp "$out" "$REMOTE_SCP_TARGET"
fi

echo "==> Pruning backups older than $KEEP_DAYS days"
find "$BACKUP_DIR" -name 'pb_data-*.tar.gz' -mtime "+$KEEP_DAYS" -print -delete

echo "==> Done. Latest backups:"
ls -lh "$BACKUP_DIR" | tail -5
