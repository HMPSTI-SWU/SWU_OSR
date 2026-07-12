#!/usr/bin/env bash
# ============================================================================
# deploy.sh — Script deploy SWU OSR Platform ke Production (HTTPS + Let's Encrypt)
#
# Cara pakai:
#   chmod +x deploy.sh
#   sudo ./deploy.sh
#
# Script ini akan:
#   1. Mengecek dependencies (Docker, Docker Compose)
#   2. Minta input domain & email SSL saja
#   3. Baca konfigurasi sensitif dari backend/.env yang sudah ada
#   4. Generate nginx config HTTPS dari template
#   5. Request SSL certificate via Certbot (standalone)
#   6. Build & jalankan semua container (prod mode)
# ============================================================================

set -e

# ── Warna output ──────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# ── Banner ────────────────────────────────────────────────────────────────────
echo -e "${CYAN}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║          SWU OSR Platform — Production Deployment           ║"
echo "║              HTTPS via Let's Encrypt + Docker               ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# ── Check root / sudo ─────────────────────────────────────────────────────────
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}[ERROR] Script ini harus dijalankan dengan sudo!${NC}"
    echo "  Jalankan: sudo ./deploy.sh"
    exit 1
fi

# ── Pastikan script dijalankan dari root direktori proyek ─────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ── [1/7] Check dependencies ──────────────────────────────────────────────────
echo -e "${YELLOW}[1/7] Mengecek dependencies...${NC}"

if ! command -v docker &> /dev/null; then
    echo -e "${RED}[ERROR] Docker belum terinstall!${NC}"
    echo "  Install: https://docs.docker.com/engine/install/"
    exit 1
fi

if ! docker compose version &> /dev/null; then
    echo -e "${RED}[ERROR] Docker Compose V2 belum terinstall!${NC}"
    echo "  Install: https://docs.docker.com/compose/install/"
    exit 1
fi

echo -e "${GREEN}  ✓ Docker $(docker --version | awk '{print $3}' | tr -d ',') tersedia${NC}"
echo -e "${GREEN}  ✓ Docker Compose $(docker compose version --short) tersedia${NC}"

# ── [2/7] Input dari user ─────────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}[2/7] Masukkan informasi deployment:${NC}"
echo ""

# Domain
read -rp "  Domain (contoh: osr.example.com): " DOMAIN
while [ -z "$DOMAIN" ]; do
    echo -e "${RED}  Domain tidak boleh kosong!${NC}"
    read -rp "  Domain (contoh: osr.example.com): " DOMAIN
done

# Email untuk SSL
read -rp "  Email untuk SSL Let's Encrypt (contoh: admin@example.com): " EMAIL
while [ -z "$EMAIL" ]; do
    echo -e "${RED}  Email tidak boleh kosong!${NC}"
    read -rp "  Email untuk SSL Let's Encrypt: " EMAIL
done

# ── Baca nilai dari backend/.env yang sudah ada ───────────────────────────────
echo ""
if [ -f "backend/.env" ]; then
    echo -e "${CYAN}  Membaca konfigurasi dari backend/.env yang sudah ada...${NC}"

    # Helper: ambil nilai dari .env (abaikan baris komentar & kosong)
    _env_get() { grep -E "^${1}=" backend/.env | tail -1 | cut -d'=' -f2-; }

    DB_URL="$(_env_get DATABASE_URL)"
    # Parse user, password, dbname dari DATABASE_URL
    # format: postgres://user:pass@host:port/dbname?...
    DB_USER="$(echo "$DB_URL" | sed -E 's|postgres://([^:]+):.*|\1|')"
    DB_PASSWORD="$(echo "$DB_URL" | sed -E 's|postgres://[^:]+:([^@]+)@.*|\1|')"
    DB_NAME="$(echo "$DB_URL" | sed -E 's|.*/([^?]+).*|\1|')"

    GITHUB_CLIENT_ID="$(_env_get GITHUB_CLIENT_ID)"
    GITHUB_CLIENT_SECRET="$(_env_get GITHUB_CLIENT_SECRET)"
    JWT_SECRET="$(_env_get JWT_SECRET)"
    WEBHOOK_SECRET="$(_env_get WEBHOOK_SECRET)"
    ENCRYPTION_KEY="$(_env_get ENCRYPTION_KEY)"
    SIAKAD_BASE_URL="$(_env_get SIAKAD_BASE_URL)"
    RATE_LIMIT_IP="$(_env_get RATE_LIMIT_IP)"
    RATE_LIMIT_USER="$(_env_get RATE_LIMIT_USER)"

    echo -e "${GREEN}  ✓ Konfigurasi berhasil dibaca dari backend/.env${NC}"
else
    echo -e "${YELLOW}  ⚠ backend/.env tidak ditemukan, menggunakan nilai default / auto-generate${NC}"
    DB_USER="postgres"
    DB_PASSWORD="$(openssl rand -base64 24 | tr -d '/+=\n')"
    DB_NAME="swu_osr"
    GITHUB_CLIENT_ID=""
    GITHUB_CLIENT_SECRET=""
    JWT_SECRET=""
    WEBHOOK_SECRET=""
    ENCRYPTION_KEY=""
    SIAKAD_BASE_URL="https://smartone.smart-service.co.id"
    RATE_LIMIT_IP="100"
    RATE_LIMIT_USER="300"
fi

# Fallback: generate jika nilai masih kosong
if [ -z "$JWT_SECRET" ]; then
    JWT_SECRET="$(openssl rand -base64 48 | tr -d '/+=\n')"
    echo -e "${CYAN}  → JWT Secret di-generate otomatis${NC}"
fi
if [ -z "$WEBHOOK_SECRET" ]; then
    WEBHOOK_SECRET="$(openssl rand -hex 32)"
    echo -e "${CYAN}  → Webhook Secret di-generate otomatis${NC}"
fi
if [ -z "$ENCRYPTION_KEY" ]; then
    ENCRYPTION_KEY="$(openssl rand -hex 32)"
    echo -e "${CYAN}  → Encryption Key di-generate otomatis${NC}"
fi
if [ -z "$DB_PASSWORD" ]; then
    DB_PASSWORD="$(openssl rand -base64 24 | tr -d '/+=\n')"
    echo -e "${CYAN}  → DB Password di-generate otomatis${NC}"
fi

# Validasi nilai wajib
if [ -z "$GITHUB_CLIENT_ID" ] || [ -z "$GITHUB_CLIENT_SECRET" ]; then
    echo -e "${RED}[ERROR] GITHUB_CLIENT_ID atau GITHUB_CLIENT_SECRET kosong di backend/.env!${NC}"
    echo -e "${RED}        Isi terlebih dahulu di backend/.env lalu jalankan ulang script ini.${NC}"
    exit 1
fi

# Validasi panjang Encryption Key
if [ ${#ENCRYPTION_KEY} -ne 64 ]; then
    echo -e "${RED}[ERROR] ENCRYPTION_KEY di backend/.env harus tepat 64 karakter hex (32 bytes)!${NC}"
    exit 1
fi

# ── Konfirmasi ────────────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}  ┌────────────────────────────────────────────────────┐"
echo -e "  │  Ringkasan Deployment                              │"
echo -e "  ├────────────────────────────────────────────────────┤"
echo -e "  │  Domain       : ${DOMAIN}"
echo -e "  │  Email SSL    : ${EMAIL}"
echo -e "  │  DB User      : ${DB_USER}"
echo -e "  │  DB Name      : ${DB_NAME}"
echo -e "  │  GitHub App   : ${GITHUB_CLIENT_ID}"
echo -e "  │  URL Prod     : https://${DOMAIN}"
echo -e "  └────────────────────────────────────────────────────┘${NC}"
echo ""
read -rp "  Lanjutkan deployment? (y/n): " CONFIRM
if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
    echo -e "${RED}  Dibatalkan.${NC}"
    exit 0
fi

# ── [3/7] Update backend/.env (hanya domain-sensitive values) ────────────────
echo ""
echo -e "${YELLOW}[3/7] Memperbarui backend/.env dengan domain baru...${NC}"

# Update hanya nilai yang bergantung pada domain
# Nilai lain (GitHub creds, secrets, dll.) dipertahankan dari file asli
sed -i "s|^GITHUB_REDIRECT_URI=.*|GITHUB_REDIRECT_URI=https://${DOMAIN}/auth/github/callback|" backend/.env
sed -i "s|^WEBHOOK_URL=.*|WEBHOOK_URL=https://${DOMAIN}/api/webhooks/github|" backend/.env
sed -i "s|^CORS_ORIGIN=.*|CORS_ORIGIN=https://${DOMAIN}|" backend/.env
sed -i "s|^COOKIE_SECURE=.*|COOKIE_SECURE=true|" backend/.env

echo -e "${GREEN}  ✓ backend/.env diperbarui (domain-sensitive values)${NC}"

# ── [3b/7] Update frontend/.env ───────────────────────────────────────────────
echo -e "${YELLOW}      Memperbarui frontend/.env ...${NC}"

if [ -f "frontend/.env" ]; then
    sed -i "s|^NEXT_PUBLIC_API_URL=.*|NEXT_PUBLIC_API_URL=https://${DOMAIN}/api|" frontend/.env
else
    cat > frontend/.env <<EOF
# ==============================================================================
# SWU OSR Platform - Frontend Environment Variables (Production)
# Auto-generated by deploy.sh on $(date -u +"%Y-%m-%dT%H:%M:%SZ")
# ==============================================================================

# API URL — gunakan path relatif agar nginx proxy menangani request
NEXT_PUBLIC_API_URL=https://${DOMAIN}/api
EOF
fi

echo -e "${GREEN}  ✓ frontend/.env diperbarui${NC}"

# ── [4/7] Generate nginx HTTPS config dari template ───────────────────────────
echo ""
echo -e "${YELLOW}[4/7] Membuat konfigurasi Nginx HTTPS ...${NC}"

mkdir -p certbot/www
mkdir -p certbot/conf

# Buat nginx config dengan HTTPS support
cat > nginx/nginx.prod.conf <<'NGINXEOF'
worker_processes auto;

events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    sendfile    on;
    tcp_nopush  on;
    tcp_nodelay on;

    keepalive_timeout 65;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # Rate limiting zone
    limit_req_zone $binary_remote_addr zone=api:10m rate=100r/m;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;

    # HTTP → HTTPS redirect
    server {
        listen 80;
        server_name DOMAIN_PLACEHOLDER;

        # Let's Encrypt ACME challenge
        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }

        location / {
            return 301 https://$host$request_uri;
        }
    }

    # HTTPS server
    server {
        listen 443 ssl;
        http2 on;
        server_name DOMAIN_PLACEHOLDER;

        ssl_certificate     /etc/letsencrypt/live/DOMAIN_PLACEHOLDER/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/DOMAIN_PLACEHOLDER/privkey.pem;

        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_prefer_server_ciphers off;
        ssl_session_cache shared:SSL:10m;
        ssl_session_timeout 1d;

        # Use Docker's embedded DNS resolver
        resolver 127.0.0.11 valid=10s;

        set $backend_upstream http://backend:8080;
        set $frontend_upstream http://frontend:3000;

        # Uploaded banner files — served directly by nginx
        location ~ ^/uploads/banners/([a-f0-9]+\.(jpg|jpeg|png|webp|gif|mp4|webm))$ {
            alias /data/uploads/banners/$1;
            add_header X-Content-Type-Options "nosniff" always;
            add_header Cache-Control "public, max-age=31536000, immutable";
        }

        # Deny any other request under /uploads/
        location /uploads/ {
            return 403;
        }

        # API routes
        location /api/ {
            limit_req zone=api burst=20 nodelay;
            proxy_pass $backend_upstream;
            proxy_http_version 1.1;
            proxy_set_header Connection "";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_read_timeout 30s;
            proxy_send_timeout 30s;
        }

        # Health check
        location /health {
            proxy_pass $backend_upstream;
            proxy_http_version 1.1;
            proxy_set_header Connection "";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }

        # Frontend routes
        location / {
            proxy_pass $frontend_upstream;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
        }
    }
}
NGINXEOF

# Substitusi DOMAIN_PLACEHOLDER dengan domain sebenarnya
sed -i "s/DOMAIN_PLACEHOLDER/${DOMAIN}/g" nginx/nginx.prod.conf

echo -e "${GREEN}  ✓ nginx/nginx.prod.conf berhasil dibuat${NC}"

# ── [5/7] Request SSL Certificate ────────────────────────────────────────────
echo ""
echo -e "${YELLOW}[5/7] Mengecek SSL certificate ...${NC}"

CERT_PATH="$(pwd)/certbot/conf/live/${DOMAIN}/fullchain.pem"

if [ -f "${CERT_PATH}" ]; then
    echo -e "${GREEN}  ✓ Sertifikat SSL sudah ada untuk ${DOMAIN}, skip request baru.${NC}"
    echo -e "${CYAN}    (Sertifikat akan diperbarui otomatis oleh certbot renewal)${NC}"
else
    echo -e "${CYAN}  Meminta SSL certificate dari Let's Encrypt ...${NC}"
    echo -e "${CYAN}  (Pastikan domain ${DOMAIN} sudah mengarah ke IP server ini!)${NC}"
    echo -e "${CYAN}  (Port 80 harus terbuka di firewall)${NC}"
    echo ""

    # Stop container yang mungkin memakai port 80
    docker compose -f docker-compose.yml -f docker-compose.prod.yml down 2>/dev/null || true

    # Jalankan certbot standalone untuk mendapatkan sertifikat
    docker run --rm \
        -v "$(pwd)/certbot/conf:/etc/letsencrypt" \
        -v "$(pwd)/certbot/www:/var/www/certbot" \
        -p 80:80 \
        certbot/certbot certonly \
            --standalone \
            --non-interactive \
            --agree-tos \
            --email "${EMAIL}" \
            -d "${DOMAIN}"

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}  ✓ SSL certificate berhasil didapatkan!${NC}"
    else
        echo -e "${RED}  ✗ Gagal mendapatkan SSL certificate!${NC}"
        echo -e "${RED}    Pastikan:${NC}"
        echo -e "${RED}    - Domain ${DOMAIN} sudah mengarah ke IP server ini (A record)${NC}"
        echo -e "${RED}    - Port 80 tidak dipakai proses lain${NC}"
        echo -e "${RED}    - Firewall membuka port 80 dan 443${NC}"
        exit 1
    fi
fi

# ── [6/7] Generate docker-compose.ssl.yml ────────────────────────────────────
echo ""
echo -e "${YELLOW}[6/7] Membuat docker-compose.ssl.yml ...${NC}"

cat > docker-compose.ssl.yml <<EOF
# Auto-generated by deploy.sh — DO NOT EDIT MANUALLY
# Generated on: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
# Domain: ${DOMAIN}
#
# Extends docker-compose.yml + docker-compose.prod.yml dengan:
#   - Nginx HTTPS (port 80 redirect + 443 SSL)
#   - Volume certbot (Let's Encrypt)
#   - PostgreSQL dengan credentials dari backend/.env

services:
  postgres:
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME}

  nginx:
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.prod.conf:/etc/nginx/nginx.conf:ro
      - ./certbot/conf:/etc/letsencrypt:ro
      - ./certbot/www:/var/www/certbot:ro
      - uploads:/data/uploads/banners:ro

  certbot:
    image: certbot/certbot
    volumes:
      - ./certbot/conf:/etc/letsencrypt
      - ./certbot/www:/var/www/certbot
    entrypoint: >
      sh -c "trap exit TERM;
             while :; do certbot renew --webroot -w /var/www/certbot --quiet;
             sleep 12h & wait \$\${!}; done"
EOF

echo -e "${GREEN}  ✓ docker-compose.ssl.yml berhasil dibuat${NC}"

# ── [7/7] Build & Run semua container ────────────────────────────────────────
echo ""
echo -e "${YELLOW}[7/7] Building & starting semua container ...${NC}"
echo ""

docker compose \
    -f docker-compose.yml \
    -f docker-compose.prod.yml \
    -f docker-compose.ssl.yml \
    up --build -d

# ── Tunggu backend healthy ─────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}  Menunggu backend siap...${NC}"
RETRY=0
MAX_RETRY=30
until docker compose \
        -f docker-compose.yml \
        -f docker-compose.prod.yml \
        -f docker-compose.ssl.yml \
        exec -T backend /healthcheck &>/dev/null || [ $RETRY -ge $MAX_RETRY ]; do
    RETRY=$((RETRY + 1))
    echo -e "  ${YELLOW}  Mencoba health check... ($RETRY/$MAX_RETRY)${NC}"
    sleep 3
done

if [ $RETRY -ge $MAX_RETRY ]; then
    echo -e "${YELLOW}  ⚠ Backend belum merespons setelah ${MAX_RETRY} percobaan.${NC}"
    echo -e "${YELLOW}    Cek log dengan: docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.ssl.yml logs backend${NC}"
else
    echo -e "${GREEN}  ✓ Backend sudah siap!${NC}"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                 DEPLOYMENT PRODUCTION BERHASIL!             ║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║                                                              ║${NC}"
printf "${GREEN}║  URL     : https://%-41s ║${NC}\n" "${DOMAIN}"
printf "${GREEN}║  Health  : https://%-41s ║${NC}\n" "${DOMAIN}/health"
printf "${GREEN}║  API     : https://%-41s ║${NC}\n" "${DOMAIN}/api/..."
echo -e "${GREEN}║                                                              ║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║  Perintah berguna:                                           ║${NC}"
echo -e "${GREEN}║                                                              ║${NC}"
echo -e "${GREEN}║  Logs    : docker compose -f docker-compose.yml \\            ║${NC}"
echo -e "${GREEN}║              -f docker-compose.prod.yml \\                    ║${NC}"
echo -e "${GREEN}║              -f docker-compose.ssl.yml logs -f               ║${NC}"
echo -e "${GREEN}║                                                              ║${NC}"
echo -e "${GREEN}║  Stop    : docker compose -f docker-compose.yml \\            ║${NC}"
echo -e "${GREEN}║              -f docker-compose.prod.yml \\                    ║${NC}"
echo -e "${GREEN}║              -f docker-compose.ssl.yml down                  ║${NC}"
echo -e "${GREEN}║                                                              ║${NC}"
echo -e "${GREEN}║  Restart : docker compose -f docker-compose.yml \\            ║${NC}"
echo -e "${GREEN}║              -f docker-compose.prod.yml \\                    ║${NC}"
echo -e "${GREEN}║              -f docker-compose.ssl.yml restart               ║${NC}"
echo -e "${GREEN}║                                                              ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${CYAN}Auto-renew SSL (tambahkan ke crontab dengan: sudo crontab -e):${NC}"
echo -e "${CYAN}  0 3 * * * cd ${SCRIPT_DIR} && docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.ssl.yml exec -T certbot certbot renew --quiet && docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.ssl.yml exec -T nginx nginx -s reload${NC}"
echo ""
echo -e "${YELLOW}⚠  Jangan lupa daftarkan GitHub Webhook di repository showcase Anda:${NC}"
echo -e "${YELLOW}   Payload URL : https://${DOMAIN}/api/webhooks/github${NC}"
echo -e "${YELLOW}   Secret      : (lihat WEBHOOK_SECRET di backend/.env)${NC}"
echo ""
