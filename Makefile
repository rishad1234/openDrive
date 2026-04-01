.PHONY: dev server client

dev:
	@trap 'kill 0' INT; \
	(cd server && set -a && . ./.env && set +a && go run ./cmd/server) & \
	(cd client && npm run dev) & \
	wait

server:
	cd server && set -a && . ./.env && set +a && go run ./cmd/server

client:
	cd client && npm run dev
