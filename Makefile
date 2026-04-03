.PHONY: dev server client build up down

dev:
	@trap 'kill 0' INT; \
	(cd server && set -a && . ./.env && set +a && go run ./cmd/server) & \
	(cd client && npm run dev) & \
	wait

server:
	cd server && set -a && . ./.env && set +a && go run ./cmd/server

client:
	cd client && npm run dev

build-no-cache:
	podman compose build --no-cache

build:
	podman compose build

up:
	podman compose up

down:
	podman compose down
