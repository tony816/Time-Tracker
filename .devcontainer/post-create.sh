#!/usr/bin/env bash
set -euo pipefail

# Keep dependencies deterministic
npm ci

# Create .env from template if missing
if [[ ! -f .env && -f .env.example ]]; then
  cp .env.example .env
fi

# Inject Codespaces secrets (if available) into .env safely
upsert_env() {
  local key="$1"
  local value="${2:-}"
  if [[ -z "$value" ]]; then
    return 0
  fi

  if grep -qE "^${key}=" .env; then
    sed -i "s|^${key}=.*|${key}=${value}|" .env
  else
    printf '\n%s=%s\n' "$key" "$value" >> .env
  fi
}

upsert_env "NOTION_API_KEY" "${NOTION_API_KEY:-}"
upsert_env "NOTION_DATABASE_ID" "${NOTION_DATABASE_ID:-}"
upsert_env "NOTION_VERSION" "${NOTION_VERSION:-2025-09-03}"
upsert_env "SUPABASE_URL" "${SUPABASE_URL:-}"
upsert_env "SUPABASE_ANON_KEY" "${SUPABASE_ANON_KEY:-}"
upsert_env "PORT" "${PORT:-3000}"

echo "Dev container bootstrap complete."
