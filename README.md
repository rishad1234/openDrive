# OpenDrive

A self-hosted file browser backed by Cloudflare R2. Built with Go, React, and SQLite.

## Prerequisites

### Development

- Go 1.26+
- Node.js 24+
- GCC (required by go-sqlite3)

### Docker

- Podman or Docker

## Configuration

Copy the example env file and fill in your values:

```bash
cp server/.env.example server/.env
```

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default `3000`) |
| `JWT_SECRET` | Secret key for signing JWTs — use a random string (`openssl rand -hex 32`) |
| `DB_PATH` | Path to the SQLite database file |
| `R2_ENDPOINT` | Cloudflare R2 endpoint (`https://<account-id>.r2.cloudflarestorage.com`) |
| `R2_ACCESS_KEY_ID` | R2 API token access key |
| `R2_SECRET_ACCESS_KEY` | R2 API token secret key |
| `R2_BUCKET` | R2 bucket name |
| `R2_REGION` | R2 region (usually `auto`) |

## Running

### Development

Starts the Go server and Vite dev server concurrently:

```bash
make dev
```

Or run them separately:

```bash
make server   # Go backend on :3000
make client   # Vite dev server on :5173
```

### Docker / Podman

Build the image:

```bash
make build
```

Start the container:

```bash
make up
```

Stop the container:

```bash
make down
```

The app will be available at `http://localhost:3000`.

The SQLite database is stored in `server/data/` and is shared between dev and Docker via a bind mount.

