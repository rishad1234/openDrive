#!/bin/bash
set -e

ENV_FILE="$(cd "$(dirname "$0")/.." && pwd)/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "Error: .env file not found at $ENV_FILE"
  exit 1
fi

SECRETS="JWT_SECRET R2_ENDPOINT R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY R2_BUCKET R2_REGION"

for key in $SECRETS; do
  value=$(grep "^${key}=" "$ENV_FILE" | cut -d'=' -f2-)
  if [ -z "$value" ]; then
    echo "⚠ Skipping $key (not found in .env)"
    continue
  fi
  echo "$value" | npx wrangler secret put "$key"
  echo "✓ $key set"
done

echo ""
echo "All secrets uploaded."
