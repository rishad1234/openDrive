# openDrive — Design Document

## Overview

A self-hosted, Docker-based file browser backed by Cloudflare R2 storage. Provides a filesystem-like experience with multi-user support and a super admin role.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | React + Vite (TypeScript) |
| Backend | Go + Gin |
| Auth | JWT (bcrypt password hashing) |
| Object Storage | Cloudflare R2 (via `aws-sdk-go-v2`, S3-compatible API) |
| Database | SQLite (users table only) |
| DB Backup | Litestream → Cloudflare R2 |
| Containerization | Docker + Docker Compose |

---

## Folder Structure (Planned)

```
openDrive/
├── backend/              # Go + Gin API server
│   ├── cmd/
│   ├── internal/
│   │   ├── auth/
│   │   ├── fs/           # R2 file/folder operations
│   │   └── user/
│   ├── db/               # SQLite + migrations
│   └── Dockerfile
├── frontend/             # React + Vite SPA
│   └── Dockerfile
├── docker-compose.yml
├── litestream.yml        # Litestream backup config
└── DESIGN.md
```

---

## Authentication

- JWT-based auth (access token in `Authorization: Bearer` header)
- Passwords stored as bcrypt hashes in SQLite
- Two roles: **user** and **admin**
- Admin can see and manage all users' files
- No public sign-up — users are created exclusively by an admin via the admin panel

---

## Storage Design (R2)

No database is used for file/folder metadata — R2's native prefix system handles the folder structure.

### Key Namespace per User

```
users/{userID}/documents/report.pdf
users/{userID}/photos/vacation/img1.jpg
```

- Admin sees the full `users/` prefix — has access to all user namespaces
- Each user is scoped to `users/{userID}/`

### Folder Simulation

| Operation | R2 Mechanism |
|---|---|
| List folder | `ListObjectsV2` with `Prefix` + `Delimiter: "/"` |
| Create folder | Upload zero-byte object at `prefix/.keep` |
| Delete folder | Paginated `ListObjectsV2` on prefix → batched `DeleteObjects` (up to 1000 keys/request) — no native recursive delete in R2 |
| Move / Rename | `CopyObject` + `DeleteObject` |
| Upload file | `PutObject` (multipart for large files) |
| Download file | `GetObject` (streamed) |

---

## API Routes (Planned)

### Auth
```
POST /api/auth/login       → { token }
POST /api/auth/logout
GET  /api/auth/me          → { id, username, role }
```

> There is no public sign-up. Only an admin can create new users.

### Filesystem
```
GET    /api/fs/list?prefix=path/          → { folders[], files[] }
POST   /api/fs/upload?prefix=path/        → multipart upload
GET    /api/fs/download?key=path/file     → stream file
DELETE /api/fs/delete?key=path/file       → delete file or folder (recursive)
POST   /api/fs/mkdir                      → { prefix }
POST   /api/fs/move                       → { src, dst }
```

### Admin
```
GET    /api/admin/users          → list all users
POST   /api/admin/users          → create user
DELETE /api/admin/users/:id      → delete user
PATCH  /api/admin/users/:id      → update user (password, role)
```

---

## Database (SQLite)

### `users` table

```sql
CREATE TABLE users (
    id         TEXT PRIMARY KEY,   -- UUID
    username   TEXT UNIQUE NOT NULL,
    password   TEXT NOT NULL,      -- bcrypt hash
    role       TEXT NOT NULL DEFAULT 'user',  -- 'user' | 'admin'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

No tables needed for files or folders — all handled by R2.

---

## DB Backup — Litestream

Litestream runs as a sidecar process (or second container) and continuously streams SQLite WAL changes to a dedicated R2 bucket/prefix.

```yaml
# litestream.yml (sketch)
dbs:
  - path: /data/opendrive.db
    replicas:
      - type: s3
        bucket: opendrive-backup
        path: litestream/opendrive.db
        endpoint: https://<account-id>.r2.cloudflarestorage.com
```

On container restart, Litestream restores the DB from R2 if no local DB is found.

---

## Docker Compose (Planned)

Single `docker-compose.yml` spins up:
- `backend` — Go API server, also serves built React frontend as static files
- `litestream` — sidecar for DB backup (or bundled into backend container)

Environment variables (via `.env` file):

```
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
R2_ENDPOINT=

JWT_SECRET=
DB_PATH=/data/opendrive.db
```

---

