#!/usr/bin/env bash
# ============================================================================
# backup.sh — Incremental Backup Orchestrator for SWU_OSR
#
# Uses PostgreSQL WAL archiving for true incremental database backups.
# Pushes to Google Drive via rclone (the central hub).
# VPS pulls from Google Drive separately — no SSH needed.
#
# Architecture:
#   Production ──rclone push──▶ Google Drive ◀──rclone pull── VPS
#
# Usage:
#   ./backup.sh base       # Weekly: create full base backup
#   ./backup.sh sync       # Daily: sync backups to Google Drive
#   ./backup.sh full       # Both: base backup + sync
#   ./backup.sh status     # Show backup status and disk usage
#   ./backup.sh verify     # Verify WAL archiving is working
#
# Crontab (add with: sudo crontab -e):
#   # Weekly full base backup — Minggu 02:00 WIB (Sabtu 19:00 UTC)
#   0 19 * * 6  /opt/swu_osr/backup/backup.sh base >> /var/log/swu_osr_backup.log 2>&1
#
#   # Daily sync to Google Drive — Setiap hari 03:00 WIB (20:00 UTC)
#   0 20 * * *  /opt/swu_osr/backup/backup.sh sync >> /var/log/swu_osr_backup.log 2>&1
# ============================================================================

set -euo pipefail
umask 077  # Harden: semua file/dir backup hanya bisa dibaca oleh pemiliknya (root)

# ── Resolve paths ─────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env"

# ── Load configuration ───────────────────────────────────────────────────────
if [ ! -f "$ENV_FILE" ]; then
    echo "[ERROR] Config not found: ${ENV_FILE}"
    echo "        Run: cp ${SCRIPT_DIR}/.env.example ${ENV_FILE}"
    exit 1
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

# ── Defaults ──────────────────────────────────────────────────────────────────
BACKUP_LOCAL_DIR="${BACKUP_LOCAL_DIR:-/backups}"
PROJECT_DIR="${PROJECT_DIR:-$(dirname "$SCRIPT_DIR")}"
PG_CONTAINER="${PG_CONTAINER:-swu_osr-postgres-1}"
PG_USER="${PG_USER:-postgres}"
PG_DB="${PG_DB:-swu_osr}"
RETAIN_FULL_COUNT="${RETAIN_FULL_COUNT:-2}"
RETAIN_WAL_DAYS="${RETAIN_WAL_DAYS:-14}"
RETAIN_UPLOADS_DAYS="${RETAIN_UPLOADS_DAYS:-14}"
GDRIVE_ENABLED="${GDRIVE_ENABLED:-false}"

# ── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# ── Logging ───────────────────────────────────────────────────────────────────
log_info()  { echo -e "[$(date -u +'%Y-%m-%dT%H:%M:%SZ')] ${GREEN}[INFO]${NC}  $*"; }
log_warn()  { echo -e "[$(date -u +'%Y-%m-%dT%H:%M:%SZ')] ${YELLOW}[WARN]${NC}  $*"; }
log_error() { echo -e "[$(date -u +'%Y-%m-%dT%H:%M:%SZ')] ${RED}[ERROR]${NC} $*"; }
log_step()  { echo -e "[$(date -u +'%Y-%m-%dT%H:%M:%SZ')] ${CYAN}[STEP]${NC}  $*"; }

# ── Ensure directories exist ─────────────────────────────────────────────────
ensure_dirs() {
    local dirs=("${BACKUP_LOCAL_DIR}/base" "${BACKUP_LOCAL_DIR}/wal" "${BACKUP_LOCAL_DIR}/uploads")
    for dir in "${dirs[@]}"; do
        if [ ! -d "$dir" ]; then
            mkdir -p "$dir"
            log_info "Created directory: $dir"
        fi
    done
}

# ══════════════════════════════════════════════════════════════════════════════
# COMMAND: base — Create a full base backup via pg_basebackup
# ══════════════════════════════════════════════════════════════════════════════
cmd_base() {
    log_step "Starting full base backup..."

    ensure_dirs

    local timestamp
    timestamp=$(date +'%Y-%m-%d_%H-%M-%S')
    local backup_path="${BACKUP_LOCAL_DIR}/base/${timestamp}"

    # Run pg_basebackup inside the PostgreSQL container
    # Gunakan zstd jika tersedia (jauh lebih cepat dari gzip), fallback ke gzip
    log_info "Running pg_basebackup (this may take a few minutes)..."
    local compress_flag="-z"  # default: gzip
    if docker exec "${PG_CONTAINER}" pg_basebackup --help 2>&1 | grep -q 'zstd'; then
        compress_flag="-Z zstd"
        log_info "Compression: zstd (fast multi-threaded)"
    else
        log_info "Compression: gzip (fallback, zstd tidak tersedia)"
    fi

    set +e
    docker exec "${PG_CONTAINER}" \
        pg_basebackup \
            -U "${PG_USER}" \
            -D "/backups/base/${timestamp}" \
            -Ft \
            ${compress_flag} \
            -Xs \
            -P \
            -v 2>&1 | while IFS= read -r line; do
                log_info "  pg_basebackup: $line"
            done
    local pg_status=${PIPESTATUS[0]}
    set -e

    if [ "$pg_status" -eq 0 ]; then
        local size
        size=$(du -sh "$backup_path" 2>/dev/null | cut -f1 || echo "unknown")
        log_info "Base backup completed: ${backup_path} (${size})"
    else
        log_error "Base backup FAILED!"
        return 1
    fi

    # ── Backup uploaded files (banners) ───────────────────────────────────
    log_step "Backing up uploaded files..."
    local uploads_archive="${BACKUP_LOCAL_DIR}/uploads/uploads_${timestamp}.tar.gz"

    # Get the Docker volume path for uploads
    local uploads_volume
    uploads_volume=$(docker volume inspect swu_osr_uploads --format '{{ .Mountpoint }}' 2>/dev/null || echo "")

    if [ -n "$uploads_volume" ] && [ -d "$uploads_volume" ]; then
        # Gunakan pigz (parallel gzip) jika tersedia untuk kompresi multi-core
        if command -v pigz &>/dev/null; then
            tar -I pigz -cf "$uploads_archive" -C "$uploads_volume" . 2>/dev/null || true
            log_info "Compression: pigz (multi-core)"
        else
            tar czf "$uploads_archive" -C "$uploads_volume" . 2>/dev/null || true
        fi
        local uploads_size
        uploads_size=$(du -sh "$uploads_archive" 2>/dev/null | cut -f1)
        log_info "Uploads backup: ${uploads_archive} (${uploads_size})"
    else
        # Fallback: copy from running container
        docker run --rm \
            -v swu_osr_uploads:/data:ro \
            -v "${BACKUP_LOCAL_DIR}/uploads:/backup" \
            alpine tar czf "/backup/uploads_${timestamp}.tar.gz" -C /data . 2>/dev/null || true
        log_info "Uploads backed up via container fallback."
    fi

    # ── Retention: prune old base backups ─────────────────────────────────
    log_step "Pruning old base backups (keeping ${RETAIN_FULL_COUNT})..."
    prune_base_backups

    # ── Retention: prune old WAL segments ─────────────────────────────────
    log_step "Pruning WAL segments older than ${RETAIN_WAL_DAYS} days..."
    prune_wal_segments

    # ── Retention: prune old upload snapshots ─────────────────────────────
    log_step "Pruning upload snapshots older than ${RETAIN_UPLOADS_DAYS} days..."
    find "${BACKUP_LOCAL_DIR}/uploads" -name "uploads_*.tar.gz" -mtime "+${RETAIN_UPLOADS_DAYS}" -delete 2>/dev/null || true

    log_info "Base backup complete."
}

# ══════════════════════════════════════════════════════════════════════════════
# COMMAND: sync — Push local backups to Google Drive
# ══════════════════════════════════════════════════════════════════════════════
cmd_sync() {
    log_step "Syncing backups to Google Drive..."

    if [ "$GDRIVE_ENABLED" != "true" ]; then
        log_warn "Google Drive sync disabled (GDRIVE_ENABLED=false)"
        log_warn "Enable it in backup/.env and run backup/setup-gdrive.sh first"
        return 0
    fi

    if ! command -v rclone &>/dev/null; then
        log_error "rclone not found! Run: backup/setup-gdrive.sh"
        return 1
    fi

    local rclone_opts=""
    if [ -n "${RCLONE_CONFIG:-}" ] && [ -f "${RCLONE_CONFIG}" ]; then
        rclone_opts="--config ${RCLONE_CONFIG}"
    fi

    # rclone sync only uploads new/changed files — bandwidth efficient!
    # --transfers=4: parallel uploads
    # --checkers=8: parallel checksum verification
    # --low-level-retries=3: retry on transient errors
    log_info "Pushing to ${GDRIVE_REMOTE}:${GDRIVE_PATH}/ ..."

    if rclone sync \
        ${rclone_opts} \
        --transfers=8 \
        --checkers=16 \
        --fast-list \
        --low-level-retries=3 \
        --stats-one-line \
        --stats=0 \
        "${BACKUP_LOCAL_DIR}/" \
        "${GDRIVE_REMOTE}:${GDRIVE_PATH}/"; then
        log_info "Google Drive sync completed successfully."
    else
        log_error "Google Drive sync FAILED!"
        return 1
    fi

    log_info "Sync complete. VPS can now pull from: ${GDRIVE_REMOTE}:${GDRIVE_PATH}/"
}

# ══════════════════════════════════════════════════════════════════════════════
# COMMAND: full — Base backup + sync (convenience)
# ══════════════════════════════════════════════════════════════════════════════
cmd_full() {
    cmd_base
    cmd_sync
}

# ══════════════════════════════════════════════════════════════════════════════
# COMMAND: status — Show backup status and disk usage
# ══════════════════════════════════════════════════════════════════════════════
cmd_status() {
    echo ""
    echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║              SWU OSR — Backup Status                        ║${NC}"
    echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""

    # ── Base backups ──────────────────────────────────────────────────────
    echo -e "${YELLOW}Base Backups:${NC}"
    if [ -d "${BACKUP_LOCAL_DIR}/base" ]; then
        local count
        count=$(find "${BACKUP_LOCAL_DIR}/base" -mindepth 1 -maxdepth 1 -type d | wc -l)
        echo "  Count: ${count}"
        if [ "$count" -gt 0 ]; then
            echo "  Latest:"
            # shellcheck disable=SC2012
            ls -dt "${BACKUP_LOCAL_DIR}/base"/*/ 2>/dev/null | head -3 | while read -r dir; do
                local size
                size=$(du -sh "$dir" 2>/dev/null | cut -f1)
                echo "    $(basename "$dir") — ${size}"
            done
        fi
    else
        echo "  No base backups found."
    fi

    # ── WAL segments ──────────────────────────────────────────────────────
    echo ""
    echo -e "${YELLOW}WAL Segments:${NC}"
    if [ -d "${BACKUP_LOCAL_DIR}/wal" ]; then
        local wal_count
        wal_count=$(find "${BACKUP_LOCAL_DIR}/wal" -type f | wc -l)
        local wal_size
        wal_size=$(du -sh "${BACKUP_LOCAL_DIR}/wal" 2>/dev/null | cut -f1)
        echo "  Count: ${wal_count} segments"
        echo "  Size:  ${wal_size}"
        if [ "$wal_count" -gt 0 ]; then
            echo "  Oldest: $(ls -t "${BACKUP_LOCAL_DIR}/wal/" 2>/dev/null | tail -1)"
            echo "  Newest: $(ls -t "${BACKUP_LOCAL_DIR}/wal/" 2>/dev/null | head -1)"
        fi
    else
        echo "  No WAL segments found."
    fi

    # ── Upload snapshots ──────────────────────────────────────────────────
    echo ""
    echo -e "${YELLOW}Upload Snapshots:${NC}"
    if [ -d "${BACKUP_LOCAL_DIR}/uploads" ]; then
        local uploads_count
        uploads_count=$(find "${BACKUP_LOCAL_DIR}/uploads" -name "*.tar.gz" | wc -l)
        local uploads_size
        uploads_size=$(du -sh "${BACKUP_LOCAL_DIR}/uploads" 2>/dev/null | cut -f1)
        echo "  Count: ${uploads_count}"
        echo "  Size:  ${uploads_size}"
    else
        echo "  No upload snapshots found."
    fi

    # ── Total disk usage ──────────────────────────────────────────────────
    echo ""
    echo -e "${YELLOW}Total Backup Size:${NC}"
    local total
    total=$(du -sh "${BACKUP_LOCAL_DIR}" 2>/dev/null | cut -f1)
    echo "  ${total}"

    # ── Remote status ─────────────────────────────────────────────────────
    echo ""
    echo -e "${YELLOW}Google Drive:${NC}"
    echo "  Enabled: ${GDRIVE_ENABLED}"
    echo "  Remote:  ${GDRIVE_REMOTE:-not configured}:${GDRIVE_PATH:-}"
    if [ "$GDRIVE_ENABLED" = "true" ] && command -v rclone &>/dev/null; then
        local rclone_opts=""
        if [ -n "${RCLONE_CONFIG:-}" ] && [ -f "${RCLONE_CONFIG}" ]; then
            rclone_opts="--config ${RCLONE_CONFIG}"
        fi
        local gdrive_size
        gdrive_size=$(rclone size ${rclone_opts} "${GDRIVE_REMOTE}:${GDRIVE_PATH}/" --json 2>/dev/null | grep -o '"bytes":[0-9]*' | grep -o '[0-9]*')
        if [ -n "$gdrive_size" ]; then
            echo "  Size:    $(numfmt --to=iec-i --suffix=B "$gdrive_size" 2>/dev/null || echo "${gdrive_size} bytes")"
        fi
    fi

    # ── WAL archiving status ──────────────────────────────────────────────
    # Optimasi: gabungkan 4x docker exec menjadi 1x query untuk menghilangkan
    # round-trip overhead (~300ms per pemanggilan)
    echo ""
    echo -e "${YELLOW}PostgreSQL WAL Archiving:${NC}"
    local pg_stats_raw
    pg_stats_raw=$(docker exec "${PG_CONTAINER}" psql -U "${PG_USER}" -tAc \
        "SELECT current_setting('archive_mode'), last_archived_wal, archived_count, failed_count \
         FROM pg_stat_archiver;" 2>/dev/null || echo "")

    if [ -n "$pg_stats_raw" ]; then
        local arc_mode last_wal arc_count fail_count
        IFS='|' read -r arc_mode last_wal arc_count fail_count <<< "$pg_stats_raw"
        arc_mode=$(echo "$arc_mode" | xargs)  # trim whitespace
        if [ "$arc_mode" = "on" ]; then
            echo -e "  Status: ${GREEN}ACTIVE${NC}"
        else
            echo -e "  Status: ${RED}INACTIVE${NC}"
            echo "  Run: docker compose up -d postgres (with WAL config)"
        fi
        echo "  Last archived WAL: ${last_wal:-none}"
        echo "  Total archived:    ${arc_count:-0}"
        echo "  Failed:            ${fail_count:-0}"
    else
        echo -e "  Status: ${RED}INACTIVE${NC} (cannot connect to PostgreSQL container)"
    fi

    echo ""
}

# ══════════════════════════════════════════════════════════════════════════════
# COMMAND: verify — Verify WAL archiving is working correctly
# ══════════════════════════════════════════════════════════════════════════════
cmd_verify() {
    log_step "Verifying WAL archiving setup..."

    local errors=0

    # Optimasi: gabungkan semua query psql menjadi 1x docker exec
    # untuk menghilangkan overhead pemanggilan berulang
    local pg_verify_raw
    pg_verify_raw=$(docker exec "${PG_CONTAINER}" psql -U "${PG_USER}" -tAc \
        "SELECT current_setting('archive_mode'), current_setting('wal_level'), \
               current_setting('archive_command'), \
               failed_count \
         FROM pg_stat_archiver;" 2>/dev/null || echo "")

    if [ -z "$pg_verify_raw" ]; then
        log_error "Cannot connect to PostgreSQL container: ${PG_CONTAINER} ✗"
        ((errors++))
    else
        local archive_mode wal_level archive_command failed_count
        IFS='|' read -r archive_mode wal_level archive_command failed_count <<< "$pg_verify_raw"
        archive_mode=$(echo "$archive_mode" | xargs)
        wal_level=$(echo "$wal_level" | xargs)
        archive_command=$(echo "$archive_command" | xargs)
        failed_count=$(echo "$failed_count" | xargs)

        # Check archive_mode
        if [ "$archive_mode" = "on" ]; then
            log_info "archive_mode = on ✓"
        else
            log_error "archive_mode = ${archive_mode:-unknown} ✗"
            ((errors++))
        fi

        # Check wal_level
        if [ "$wal_level" = "replica" ] || [ "$wal_level" = "logical" ]; then
            log_info "wal_level = ${wal_level} ✓"
        else
            log_error "wal_level = ${wal_level:-unknown} ✗ (needs 'replica' or 'logical')"
            ((errors++))
        fi

        # Check archive_command
        if [ -n "$archive_command" ]; then
            log_info "archive_command = '${archive_command}' ✓"
        else
            log_error "archive_command is empty ✗"
            ((errors++))
        fi

        # Check archiver stats
        if [ "${failed_count:-0}" = "0" ]; then
            log_info "No archive failures ✓"
        else
            log_warn "Archive failures detected: ${failed_count}"
        fi
    fi

    # Check WAL directory exists inside container (masih perlu exec terpisah)
    if docker exec "${PG_CONTAINER}" test -d /backups/wal 2>/dev/null; then
        log_info "/backups/wal directory exists ✓"
    else
        log_error "/backups/wal directory missing ✗"
        ((errors++))
    fi

    # Force a WAL switch to test archiving
    log_step "Forcing WAL switch to test archiving..."
    docker exec "${PG_CONTAINER}" psql -U "${PG_USER}" -c "SELECT pg_switch_wal();" >/dev/null 2>&1
    sleep 2

    local wal_count
    wal_count=$(find "${BACKUP_LOCAL_DIR}/wal" -type f 2>/dev/null | wc -l)
    if [ "$wal_count" -gt 0 ]; then
        log_info "WAL segments found in backup dir: ${wal_count} ✓"
    else
        log_warn "No WAL segments found yet (may need more DB activity)"
    fi

    # Check rclone
    log_step "Checking rclone setup..."
    if command -v rclone &>/dev/null; then
        log_info "rclone installed ✓"
        if [ "$GDRIVE_ENABLED" = "true" ]; then
            local rclone_opts=""
            if [ -n "${RCLONE_CONFIG:-}" ] && [ -f "${RCLONE_CONFIG}" ]; then
                rclone_opts="--config ${RCLONE_CONFIG}"
            fi
            if rclone lsd ${rclone_opts} "${GDRIVE_REMOTE}:" &>/dev/null; then
                log_info "Google Drive connection OK ✓"
            else
                log_error "Cannot connect to Google Drive ✗ (run: backup/setup-gdrive.sh)"
                ((errors++))
            fi
        fi
    else
        log_warn "rclone not installed (run: backup/setup-gdrive.sh)"
    fi

    echo ""
    if [ "$errors" -eq 0 ]; then
        log_info "All checks passed! Backup system is ready."
    else
        log_error "${errors} check(s) failed. Review the errors above."
        return 1
    fi
}

# ══════════════════════════════════════════════════════════════════════════════
# HELPERS
# ══════════════════════════════════════════════════════════════════════════════

# Prune old base backups, keeping only the most recent $RETAIN_FULL_COUNT
prune_base_backups() {
    local base_dir="${BACKUP_LOCAL_DIR}/base"
    if [ ! -d "$base_dir" ]; then return; fi

    local count
    count=$(find "$base_dir" -mindepth 1 -maxdepth 1 -type d | wc -l)

    if [ "$count" -gt "$RETAIN_FULL_COUNT" ]; then
        local to_remove
        to_remove=$((count - RETAIN_FULL_COUNT))
        # shellcheck disable=SC2012
        ls -dt "$base_dir"/*/ | tail -n "$to_remove" | while read -r dir; do
            log_info "Removing old base backup: $(basename "$dir")"
            rm -rf "$dir"
        done
    fi
}

# Prune WAL segments older than $RETAIN_WAL_DAYS days
prune_wal_segments() {
    local wal_dir="${BACKUP_LOCAL_DIR}/wal"
    if [ ! -d "$wal_dir" ]; then return; fi

    local pruned
    pruned=$(find "$wal_dir" -type f -mtime "+${RETAIN_WAL_DAYS}" -delete -print 2>/dev/null | wc -l)
    if [ "$pruned" -gt 0 ]; then
        log_info "Pruned ${pruned} old WAL segment(s)."
    fi
}

# ══════════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════════
main() {
    local command="${1:-}"

    case "$command" in
        base)
            cmd_base
            ;;
        sync)
            cmd_sync
            ;;
        full)
            cmd_full
            ;;
        status)
            cmd_status
            ;;
        verify)
            cmd_verify
            ;;
        *)
            echo "Usage: $0 {base|sync|full|status|verify}"
            echo ""
            echo "Commands:"
            echo "  base     Create a full base backup (pg_basebackup + uploads)"
            echo "  sync     Push backups to Google Drive"
            echo "  full     Run base + sync together"
            echo "  status   Show backup status and disk usage"
            echo "  verify   Verify WAL archiving + Google Drive connection"
            echo ""
            echo "Architecture:"
            echo "  Production ──push──▶ Google Drive ◀──pull── VPS"
            echo ""
            echo "Typical crontab setup:"
            echo "  0 19 * * 6  ${SCRIPT_DIR}/backup.sh base   # Weekly full backup"
            echo "  0 20 * * *  ${SCRIPT_DIR}/backup.sh sync   # Daily sync to GDrive"
            exit 1
            ;;
    esac
}

main "$@"
