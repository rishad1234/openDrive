# OpenDrive

A file browser backed by Cloudflare R2. Built with Hono (Cloudflare Workers), React, and D1.

**Live:** [https://opendrive.pages.dev](https://opendrive.pages.dev)

## Tech Stack

- **API** — [Hono](https://hono.dev/) on Cloudflare Workers
- **Database** — Cloudflare D1 (SQLite)
- **Storage** — Cloudflare R2 (S3-compatible, via [aws4fetch](https://github.com/mhart/aws4fetch))
- **Frontend** — React + Vite on Cloudflare Pages
- **Auth** — JWT (jose) + bcryptjs

## Prerequisites

- Node.js 20+
- Cloudflare account with `npx wrangler login` completed

## Configuration

Copy the example env file and fill in your values:

```bash
cp server/.env.example server/.env
```

| Variable | Description |
|----------|-------------|
| `JWT_SECRET` | Secret key for signing JWTs — use a random string (`openssl rand -hex 32`) |
| `R2_ENDPOINT` | Cloudflare R2 endpoint (`https://<account-id>.r2.cloudflarestorage.com`) |
| `R2_ACCESS_KEY_ID` | R2 API token access key |
| `R2_SECRET_ACCESS_KEY` | R2 API token secret key |
| `R2_BUCKET` | R2 bucket name |
| `R2_REGION` | R2 region (usually `auto`) |

## Development

Start both the Worker and Vite dev server:

```bash
make dev
```

Or run them separately:

```bash
make server   # Worker dev server on :8787
make client   # Vite dev server on :5173 (proxies /api to :8787)
```

Open `http://localhost:5173`

## Deploy

Deploy everything:

```bash
make deploy
```

Or individually:

```bash
make deploy-api   # Deploy Worker
make deploy-ui    # Build + deploy Pages
```

See [DEPLOY.md](DEPLOY.md) for first-time setup (D1 creation, migrations, secrets, R2 CORS).

