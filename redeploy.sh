#!/usr/bin/env bash
# ============================================================================
# redeploy.sh — Rebuild & restart semua container tanpa input domain/email
#
# Cara pakai:
#   chmod +x redeploy.sh
#   sudo ./redeploy.sh
#
# Script ini membaca konfigurasi dari file yang sudah ada:
#   - Domain dari backend/.env (CORS_ORIGIN)
#   - SSL cert dari certbot/conf/live/<domain>/
# ============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║           SWU OSR — Quick Redeploy (No Input)               ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# ── Check root ────────────────────────────────────────────────────────────────
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}[ERROR] Jalankan dengan sudo!${NC}"
    echo "  sudo ./redeploy.sh"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ── Baca domain dari backend/.env ─────────────────────────────────────────────
if [ ! -f "backend/.env" ]; then
    echo -e "${RED}[ERROR] backend/.env tidak ditemukan!${NC}"
    exit 1
fi

CORS_ORIGIN=$(grep -E "^CORS_ORIGIN=" backend/.env | tail -1 | cut -d'=' -f2-)
DOMAIN=$(echo "$CORS_ORIGIN" | sed -E 's|https?://||')

if [ -z "$DOMAIN" ]; then
    echo -e "${RED}[ERROR] Tidak bisa baca domain dari backend/.env (CORS_ORIGIN)${NC}"
    exit 1
fi

echo -e "${GREEN}  ✓ Domain    : ${DOMAIN}${NC}"

# ── Cek SSL cert ──────────────────────────────────────────────────────────────
CERT_PATH="$(pwd)/certbot/conf/live/${DOMAIN}/fullchain.pem"
if [ -f "$CERT_PATH" ]; then
    echo -e "${GREEN}  ✓ SSL cert  : Ada (skip request baru)${NC}"
else
    echo -e "${RED}[ERROR] SSL cert tidak ditemukan di: ${CERT_PATH}${NC}"
    echo -e "${RED}        Jalankan ./deploy.sh terlebih dahulu untuk request sertifikat.${NC}"
    exit 1
fi

# ── Cek docker-compose.ssl.yml ────────────────────────────────────────────────
if [ ! -f "docker-compose.ssl.yml" ]; then
    echo -e "${RED}[ERROR] docker-compose.ssl.yml tidak ditemukan!${NC}"
    echo -e "${RED}        Jalankan ./deploy.sh sekali untuk generate file ini.${NC}"
    exit 1
fi
echo -e "${GREEN}  ✓ docker-compose.ssl.yml: Ada${NC}"

# ── Regenerate nginx config ───────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}[1/3] Regenerate nginx config untuk ${DOMAIN} ...${NC}"

mkdir -p nginx certbot/www certbot/conf

cat > nginx/nginx.prod.conf << 'NGINXEOF'
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

    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_min_length 1000;
    gzip_types text/plain text/css application/json application/javascript
               text/xml application/xml application/xml+rss text/javascript
               image/svg+xml font/woff2;

    limit_req_zone $binary_remote_addr zone=api:10m rate=100r/m;

    # Proxy cache untuk leaderboard (endpoint publik read-heavy)
    proxy_cache_path /var/cache/nginx/api
        levels=1:2
        keys_zone=api_public:10m
        max_size=50m
        inactive=5m
        use_temp_path=off;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    # X-XSS-Protection sudah deprecated — diganti CSP
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://avatars.githubusercontent.com https://*.githubusercontent.com; font-src 'self'; connect-src 'self'; frame-ancestors 'none';" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;

    server {
        listen 80;
        server_name DOMAIN_PLACEHOLDER;

        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }

        location / {
            return 301 https://$host$request_uri;
        }
    }

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
        # OCSP Stapling: kurangi latency TLS handshake
        ssl_stapling on;
        ssl_stapling_verify on;

        resolver 127.0.0.11 valid=10s;

        set $backend_upstream http://backend:8080;
        set $frontend_upstream http://frontend:3000;

        location ~ ^/uploads/banners/([a-f0-9]+\.(jpg|jpeg|png|webp|gif|mp4|webm))$ {
            alias /data/uploads/banners/$1;
            add_header X-Content-Type-Options "nosniff" always;
            add_header Cache-Control "public, max-age=31536000, immutable";
        }

        location /uploads/ {
            return 403;
        }

        # Leaderboard — di-cache 60 detik di nginx (endpoint publik read-heavy)
        location /api/leaderboard {
            limit_req zone=api burst=20 nodelay;

            proxy_cache api_public;
            proxy_cache_valid 200 60s;
            proxy_cache_valid 404 10s;
            proxy_cache_bypass $http_authorization;
            proxy_no_cache $http_authorization;
            proxy_cache_key "$scheme$host$request_uri";
            add_header X-Cache-Status $upstream_cache_status always;

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

        location /health {
            proxy_pass $backend_upstream;
            proxy_http_version 1.1;
            proxy_set_header Connection "";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }

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

sed -i "s/DOMAIN_PLACEHOLDER/${DOMAIN}/g" nginx/nginx.prod.conf
echo -e "${GREEN}  ✓ nginx/nginx.prod.conf diperbarui${NC}"

# ── Build & Run ───────────────────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}[2/3] Building & starting semua container ...${NC}"
echo ""

docker compose \
    -f docker-compose.yml \
    -f docker-compose.prod.yml \
    -f docker-compose.ssl.yml \
    up --build -d

# ── Health check ──────────────────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}[3/3] Menunggu semua container siap ...${NC}"
sleep 5

docker compose \
    -f docker-compose.yml \
    -f docker-compose.prod.yml \
    -f docker-compose.ssl.yml \
    ps

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                  REDEPLOY SELESAI!                          ║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════════════════════════╣${NC}"
printf  "${GREEN}║  URL  : https://%-44s║${NC}\n" "${DOMAIN}"
printf  "${GREEN}║  API  : https://%-44s║${NC}\n" "${DOMAIN}/api/..."
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${CYAN}Lihat log: sudo docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.ssl.yml logs -f${NC}"
