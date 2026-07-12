# SWU OSR Platform

**Open Source Repository** — Platform komunitas open-source untuk mahasiswa STMIK WIDYA UTAMA (SWU).

SWU OSR adalah platform yang memungkinkan civitas akademika untuk menghubungkan akun GitHub mereka, memamerkan repository, berdiskusi melalui forum, melacak aktivitas kontribusi, dan berkompetisi di leaderboard berbasis poin.

---

## Fitur Utama

- **Autentikasi Ganda** — Login melalui SIAKAD (sistem akademik kampus) + OAuth GitHub, dilengkapi JWT & refresh token.
- **Profil Pseudonim** — Setiap pengguna memiliki alias unik, bio, avatar, dan banner yang dapat dikustomisasi.
- **Showcase Repository** — Pilih repository GitHub untuk dipamerkan dengan tag akademik (coursework, thesis, hackathon, personal research, team project).
- **Activity Feed** — Pelacakan aktivitas real-time dari GitHub webhooks (push, pull request, release).
- **Forum Diskusi** — Thread diskusi per repository showcase dengan komentar bersarang dan notifikasi.
- **Leaderboard & Gamifikasi** — Sistem poin (push=3, PR dibuka=5, PR merged=8, showcase=10, thread=2, komentar=1, streak bonus=15) dengan proteksi anti-gaming.
- **Statistik Komunitas** — Repository populer, daftar anggota, dan ringkasan kontribusi.
- **Rate Limiting** — Pembatasan request berbasis IP (100/menit) dan user (300/menit) via Redis.

---

## Tech Stack

### Backend

| Teknologi | Versi | Kegunaan |
|-----------|-------|----------|
| Go | 1.25 | Bahasa pemrograman utama |
| Chi | v5 | HTTP router |
| PostgreSQL | 16 | Database utama |
| Redis | 7 | Cache, session, rate limiting |
| golang-migrate | v4 | Migrasi database |
| JWT (golang-jwt) | v5 | Autentikasi token |
| Zap | - | Structured logging |
| Viper | - | Konfigurasi environment |

### Frontend

| Teknologi | Versi | Kegunaan |
|-----------|-------|----------|
| Next.js | 14.2 | Framework React |
| React | 18 | UI library |
| TypeScript | 5.4 | Type safety |
| TailwindCSS | 3.4 | Styling |
| TanStack Query | v5 | Data fetching & caching |
| React Hook Form | v7 | Manajemen form |
| Zod | v3 | Validasi schema |
| Axios | v1 | HTTP client |

### Infrastruktur

- **Docker** — Multi-stage build (distroless untuk backend, standalone Next.js untuk frontend)
- **Docker Compose** — Orchestration development & production
- **Nginx** — Reverse proxy (port 80/443)
- **Keamanan Produksi** — Read-only container, no-new-privileges, cap_drop ALL

---

## Arsitektur

```
backend/
├── cmd/api/            # Entry point aplikasi
├── internal/
│   ├── config/         # Konfigurasi environment (Viper)
│   ├── domain/         # Entity & interface (clean architecture)
│   ├── repository/     # Data access layer (PostgreSQL)
│   ├── service/        # Business logic layer
│   ├── handler/        # HTTP handler layer
│   ├── middleware/     # Auth, CORS, rate limit, cache
│   ├── cache/          # Redis caching (leaderboard)
│   ├── scheduler/      # Background jobs
│   ├── github/         # GitHub OAuth & API
│   ├── siakad/         # Integrasi sistem akademik kampus
│   └── upload/         # File storage (banner)
└── migrations/         # SQL migration files

frontend/
├── src/
│   ├── app/            # Next.js App Router
│   ├── components/     # Komponen UI
│   ├── lib/            # Utility & API client
│   └── hooks/          # Custom React hooks
└── public/             # Static assets
```

---

## Cara Menjalankan

### Prasyarat

- [Docker](https://docs.docker.com/get-docker/) & Docker Compose
- [GitHub OAuth App](https://github.com/settings/developers) (untuk fitur login)
- Akses ke SIAKAD (sistem akademik kampus)

### Development

1. **Clone repository:**

   ```bash
   git clone https://github.com/FallCatsinSeng/SWU_OSR.git
   cd SWU_OSR
   ```

2. **Salin dan konfigurasi environment:**

   ```bash
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env.local
   ```

   Edit file `.env` dengan nilai yang sesuai (JWT secret, GitHub OAuth credentials, dll).

3. **Jalankan semua service:**

   ```bash
   docker compose up
   ```

4. **Akses aplikasi:**

   | Service | URL |
   |---------|-----|
   | Frontend | http://localhost:3000 |
   | Backend API | http://localhost:8080 |
   | PostgreSQL | localhost:5432 |
   | Redis | localhost:6379 |

### Production

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

Konfigurasi production menambahkan:
- Container read-only
- Restart policy (`unless-stopped`)
- Security hardening (no-new-privileges, cap_drop ALL)
- Redis memory limit (256MB, LRU eviction)

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Deskripsi | Default |
|----------|-----------|---------|
| `SERVER_PORT` | Port server | `8080` |
| `DATABASE_URL` | PostgreSQL connection string | - |
| `REDIS_URL` | Redis connection string | - |
| `JWT_SECRET` | Secret untuk signing JWT (min 32 karakter) | - |
| `JWT_EXPIRY` | Masa berlaku access token | `15m` |
| `REFRESH_EXPIRY` | Masa berlaku refresh token | `168h` |
| `GITHUB_CLIENT_ID` | GitHub OAuth App client ID | - |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App client secret | - |
| `GITHUB_REDIRECT_URI` | GitHub OAuth callback URL | - |
| `WEBHOOK_SECRET` | Secret untuk verifikasi GitHub webhook | - |
| `ENCRYPTION_KEY` | AES-256 key (64 hex chars) untuk enkripsi token | - |
| `SIAKAD_BASE_URL` | URL sistem akademik kampus | - |
| `CORS_ORIGIN` | Allowed origin untuk CORS | `http://localhost:3000` |
| `COOKIE_SECURE` | Set `true` untuk HTTPS (production) | `true` |
| `RATE_LIMIT_IP` | Max request per menit per IP | `100` |
| `RATE_LIMIT_USER` | Max request per menit per user | `300` |

### Frontend (`frontend/.env.local`)

| Variable | Deskripsi | Default |
|----------|-----------|---------|
| `NEXT_PUBLIC_API_URL` | URL backend API | `http://localhost:8080` |

---

## Sistem Poin & Leaderboard (Dynamic Scoring)

Sistem poin di SWU OSR menggunakan algoritma **PageRank Lite** dan deteksi anomali untuk memastikan keadilan dan kualitas kontribusi.

### Base Points
| Aktivitas | Poin Base |
|-----------|-----------|
| Push ke repository | 3 |
| Pull Request dibuka | 2 |
| Pull Request di-merge | 12 |
| Showcase repository | 10 |
| Membuat thread forum | 2 |
| Memposting komentar | 1 |
| Streak bonus (7 hari) | 20 |

### 🌟 Repo Reputation Multiplier
Poin untuk *Push* dan *Merged PR* dikalikan secara dinamis berdasarkan jumlah Bintang (Stars) GitHub dari repositori tujuan. Kontribusi ke proyek populer (misal 1000+ stars) dapat menghasilkan hingga **5.0x multiplier**. Ini mendorong kualitas kontribusi ke proyek open-source yang berdampak besar.

### 🛡️ Anti-Spam & Anomaly Detection (Z-Score)
Sistem dilengkapi dengan proteksi *anti-gaming* otomatis:
- Burst activity (spam commit) akan terdeteksi oleh algoritma Z-Score dan otomatis mendapat penalti.
- Maksimum 30 poin push per hari per user.
- Caps kuartalan untuk tiap repositori (Maks 90 push & 20 PR merged).

**Periode Leaderboard:** Quarterly (Q1-Q4) & All-Time.

---

## Roadmap & Future Ideas 🚀

Kami menyadari platform ini terus berkembang. Berikut adalah beberapa ide yang direncanakan untuk iterasi selanjutnya:

1. **Brand & Visual Identity**
   - Mengganti logo dan *branding* sementara dengan identitas visual yang lebih kuat (SVG animasi, ilustrasi 3D) yang mencerminkan nama "ORBIT".
   - Peningkatan UI/UX untuk *dark mode* dan penambahan mikro-animasi pada komponen utama.

2. **Evolusi Algoritma Leaderboard**
   - **Quality over Quantity:** Mengintegrasikan alat analitik statis untuk menilai kompleksitas kode (misal: jumlah baris kode yang diubah, efisiensi bahasa pemrograman) sebagai penentu poin, bukan sekadar "jumlah push".
   - **Bounty System:** Dosen atau senior dapat membuat isu spesifik (Bounty) di platform dengan hadiah poin besar untuk siapa saja yang berhasil memecahkannya.

3. **Rich Badges System (V2)**
   - Saat ini *badges* sudah memiliki sistem *Multi-Tier* (Iron ke Diamond) berdasarkan statistik (*Night Owl*, *Weekend Warrior*).
   - Ke depannya: Mengimplementasikan sistem **Achievement Tree** interaktif (seperti *skill tree* di game RPG) untuk memandu kontributor baru (mahasiswa) agar perlahan-lahan berkembang menjadi *maintainer* profesional.

---

## API Endpoints

### Public (tanpa autentikasi)

| Method | Path | Deskripsi |
|--------|------|-----------|
| GET | `/api/profiles/{alias}` | Profil publik user |
| GET | `/api/feed` | Activity feed global |
| GET | `/api/members` | Daftar anggota komunitas |
| GET | `/api/stats` | Statistik komunitas |
| GET | `/api/repos/popular` | Repository populer |
| GET | `/api/leaderboard` | Leaderboard |
| GET | `/api/repos/{id}/threads` | Thread diskusi per repo |
| POST | `/api/webhooks/github` | GitHub webhook receiver |

### Autentikasi

| Method | Path | Deskripsi |
|--------|------|-----------|
| POST | `/api/auth/siakad-login` | Login via SIAKAD |
| POST | `/api/auth/github-callback` | GitHub OAuth callback |
| POST | `/api/auth/refresh` | Refresh access token |
| POST | `/api/auth/logout` | Logout (protected) |
| GET | `/api/auth/me` | Info user saat ini (protected) |

### Protected (membutuhkan autentikasi)

| Method | Path | Deskripsi |
|--------|------|-----------|
| PUT | `/api/profile` | Update profil |
| GET | `/api/repos` | List showcase repos user |
| POST | `/api/repos` | Tambah showcase repo |
| DELETE | `/api/repos/{id}` | Hapus showcase repo |
| POST | `/api/threads` | Buat thread baru |
| POST | `/api/threads/{id}/comments` | Tambah komentar |

---

## Kontribusi

1. Fork repository ini
2. Buat branch fitur (`git checkout -b fitur/fitur-baru`)
3. Commit perubahan (`git commit -m 'Menambahkan fitur baru'`)
4. Push ke branch (`git push origin fitur/fitur-baru`)
5. Buat Pull Request

---

## Lisensi

Proyek ini dilisensikan di bawah **MIT License** — lihat file [LICENSE](LICENSE) untuk detail lengkap.

---

## Tim Pengembang

Dikembangkan oleh tim **LPT HMPS-TI** dan **FallCatsinSeng** untuk komunitas open-source STMIK WIDYA UTAMA.
