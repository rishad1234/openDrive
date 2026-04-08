.PHONY: dev server client deploy deploy-api deploy-ui

dev:
	@trap 'kill 0' INT; \
	(cd server && npx wrangler dev --env-file .env) & \
	(cd client && npm run dev) & \
	wait

server:
	cd server && npx wrangler dev --env-file .env

client:
	cd client && npm run dev

deploy: deploy-api deploy-ui

deploy-api:
	cd server && npx wrangler deploy

include .env
export

deploy-ui:
	cd client && VITE_API_URL=$(VITE_API_URL) npm run build
	cd client && npx wrangler pages deploy dist --project-name opendrive --branch main --commit-dirty=true
