# OpenDrive — Deploy Guide

## Architecture

- **Worker API** — Cloudflare Worker (Hono + D1 + R2 via S3 API)
- **Frontend** — Cloudflare Pages (React + Vite)

## Prerequisites

- Node.js 20+
- `wrangler` CLI (installed as a project dependency)
- Cloudflare account with `npx wrangler login` completed

## First-Time Setup

### 1. Create Remote D1 Database

```bash
cd server
npx wrangler d1 create opendrive-dev
```

Copy the `database_id` from the output and update `server/wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "opendrive-dev"
database_id = "<your-database-id>"
```

### 2. Run Migrations

```bash
npx wrangler d1 migrations apply opendrive-dev --remote
```

### 3. Seed Admin User

```bash
npx tsx scripts/seed.ts > /tmp/opendrive-seed.sql
npx wrangler d1 execute opendrive-dev --remote --file /tmp/opendrive-seed.sql
```

### 4. Upload Secrets

Ensure `server/.env` has all required values, then:

```bash
bash scripts/upload-secrets.sh
```

This uploads: `JWT_SECRET`, `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_REGION`

### 5. Configure R2 CORS

In the Cloudflare dashboard: **R2 → opendrive-dev → Settings → CORS Policy**

```json
[
  {
    "AllowedOrigins": ["https://opendrive.pages.dev"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }
]
```

### 6. Create Pages Project (one-time)

```bash
npx wrangler pages project create opendrive --production-branch main
```

## Deploy

### Worker (API)

```bash
cd server
npx wrangler deploy
```

Deployed to: `https://opendrive-api.<your-subdomain>.workers.dev`

### Frontend (Pages)

```bash
cd client
VITE_API_URL=https://opendrive-api.<your-subdomain>.workers.dev npm run build
npx wrangler pages deploy dist --project-name opendrive --branch main --commit-dirty=true
```

Deployed to: `https://opendrive.pages.dev`

## Local Development

```bash
# Terminal 1 — Worker
cd server
npx wrangler dev --env-file .env

# Terminal 2 — Frontend (proxies /api/* to :8787)
cd client
npm run dev
```

Open `http://localhost:5173`

## Useful Commands

| Command | Description |
|---------|-------------|
| `make dev` | Start Worker + Vite dev server in parallel |
| `make server` | Start Worker dev server only |
| `make client` | Start Vite dev server only |
| `make deploy` | Deploy both API and UI |
| `make deploy-api` | Deploy Worker only |
| `make deploy-ui` | Build and deploy Pages only |
| `npm run db:migrate` | Apply D1 migrations locally |
| `npm run db:seed` | Seed local D1 with admin user |
| `npx wrangler d1 execute opendrive-dev --local --command "SELECT * FROM users"` | Query local DB |
| `npx wrangler d1 execute opendrive-dev --remote --command "SELECT * FROM users"` | Query remote DB |
| `bash scripts/upload-secrets.sh` | Upload all secrets from .env |
