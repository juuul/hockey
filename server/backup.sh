#!/usr/bin/env bash
# Nachtelijke back-up van de hockey-server (PocketBase): data.db veilig kopiëren (sqlite .backup, klopt ook terwijl
# de server draait), gecomprimeerd naar ~/backups/hockey en daarna naar Google Drive (map hockey-backup).
# Het logboek (auxiliary.db) gaat niet mee. Alles wordt bewaard (~100 KB per dag); rclone copy verwijdert nooit iets.
# Drive-koppeling: de rclone-config van thuishub (remote "gdrive"), buiten de repo.
# Terugzetten: zie CLAUDE.md (Server).
set -euo pipefail
BRON="$(cd "$(dirname "$0")" && pwd)/pb_data/data.db"
DEST="${HOCKEY_BACKUP_DIR:-$HOME/backups/hockey}"
RCLONE_CONF_DIR="${HOCKEY_RCLONE_DIR:-$HOME/.config/thuishub/rclone}"
umask 077
mkdir -p "$DEST"
chmod 700 "$DEST"
stamp=$(date +%Y%m%d-%H%M%S)
doel="$DEST/hockey-$stamp.db"

sqlite3 -readonly "$BRON" ".backup '$doel'"
[ "$(sqlite3 "$doel" 'pragma integrity_check')" = "ok" ] || { echo "$(date '+%F %T') FOUT: kopie niet in orde"; exit 1; }
gzip -9 "$doel"

docker run --rm --cap-drop ALL --security-opt no-new-privileges:true --user "$(id -u):$(id -g)" \
  -v "$RCLONE_CONF_DIR":/config/rclone -v "$DEST":/backup:ro \
  rclone/rclone:latest copy /backup gdrive:hockey-backup --include "hockey-*.db.gz" --log-level NOTICE

echo "$(date '+%F %T') back-up klaar: hockey-$stamp.db.gz"
