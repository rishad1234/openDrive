# ── Stage 1: Build React frontend ─────────────────────────────────────────────
FROM node:24-slim AS frontend-builder

WORKDIR /app/client

COPY client/package.json client/package-lock.json ./
RUN npm install

COPY client/ ./
RUN npm run build


# ── Stage 2: Build Go binary ───────────────────────────────────────────────────
# go-sqlite3 requires CGo, so we need gcc
FROM golang:1.26-bookworm AS backend-builder

WORKDIR /app/server

COPY server/go.mod server/go.sum ./
RUN go mod download

COPY server/ ./
RUN CGO_ENABLED=1 GOOS=linux go build -ldflags="-s -w" -o /opendrive ./cmd/server


# ── Stage 3: Runtime image ─────────────────────────────────────────────────────
FROM debian:bookworm-slim

# ca-certificates for HTTPS calls to R2; libc for CGo sqlite3
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=backend-builder /opendrive ./opendrive
COPY --from=frontend-builder /app/client/dist ./static

# Data directory for SQLite — mount a volume here in production
RUN mkdir -p /app/data

EXPOSE 3000

ENV STATIC_DIR=/app/static \
    DB_PATH=/app/data/opendrive.db \
    PORT=3000

ENTRYPOINT ["./opendrive"]
