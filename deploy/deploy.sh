#!/usr/bin/env bash
# deploy.sh — push GoalOps frontend + MCP server to the production VPS.
#
# Run from your dev machine. Requires SSH key auth to $REMOTE.
# What it does:
#   1. Build the Vite frontend locally  (skip with SKIP_FRONTEND=1)
#   2. rsync dist/ to $REMOTE:/var/www/goalops/
#   3. rsync mcp sources + migrations to $REMOTE:/opt/goalops/
#   4. ssh in, npm ci + tsc build, run PB migrations, restart both services
#
# Usage:
#   ./deploy/deploy.sh                       # full deploy
#   SKIP_FRONTEND=1 ./deploy/deploy.sh       # only push MCP + migrations
#   SKIP_MCP=1 ./deploy/deploy.sh            # only push frontend
#   SKIP_MIGRATE=1 ./deploy/deploy.sh        # don't run pb migrate up

set -euo pipefail

# --- config (override via env) -----------------------------------------------
REMOTE="${REMOTE:-goalops@goal.996007.fun}"           # user@host
REMOTE_ROOT="${REMOTE_ROOT:-/opt/goalops}"            # PB + MCP live here
REMOTE_WEB="${REMOTE_WEB:-/var/www/goalops}"          # static dist target
NODE_BIN="${NODE_BIN:-/usr/bin/node}"                 # remote node path
NPM_BIN="${NPM_BIN:-/usr/bin/npm}"                    # remote npm path

# Local repo root = parent of this script's dir.
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

say() { printf '\033[1;34m==>\033[0m %s\n' "$*"; }

# --- 1. build frontend -------------------------------------------------------
if [[ -z "${SKIP_FRONTEND:-}" ]]; then
	say "Building frontend (npm run build)"
	npm run build
fi

# --- 2. push frontend dist ---------------------------------------------------
if [[ -z "${SKIP_FRONTEND:-}" ]]; then
	say "Rsyncing dist/ -> $REMOTE:$REMOTE_WEB"
	rsync -avz --delete \
		"$REPO_ROOT/dist/" \
		"$REMOTE:$REMOTE_WEB/"
fi

# --- 3. push MCP server + migrations -----------------------------------------
if [[ -z "${SKIP_MCP:-}" ]]; then
	say "Rsyncing mcp/ sources -> $REMOTE:$REMOTE_ROOT/mcp/"
	# Exclude node_modules/dist; we rebuild on the server.
	rsync -avz --delete \
		--exclude node_modules \
		--exclude dist \
		--exclude .env \
		"$REPO_ROOT/mcp/" \
		"$REMOTE:$REMOTE_ROOT/mcp/"

	say "Rsyncing pb_migrations/ -> $REMOTE:$REMOTE_ROOT/pocketbase/pb_migrations/"
	rsync -avz --delete \
		"$REPO_ROOT/backend/pocketbase/pb_migrations/" \
		"$REMOTE:$REMOTE_ROOT/pocketbase/pb_migrations/"
fi

# --- 4. remote build + restart ----------------------------------------------
REMOTE_SCRIPT=$(cat <<REMOTE_EOF
set -euo pipefail
cd $REMOTE_ROOT/mcp
echo "==> Installing MCP deps"
$NPM_BIN ci --no-audit --no-fund
echo "==> Building MCP"
$NPM_BIN run build

if [[ -z "\${SKIP_MIGRATE:-${SKIP_MIGRATE:-}}" ]]; then
	echo "==> Applying PB migrations"
	cd $REMOTE_ROOT/pocketbase
	./pocketbase migrate up --dir=$REMOTE_ROOT/pocketbase/pb_data --migrationsDir=$REMOTE_ROOT/pocketbase/pb_migrations
fi

echo "==> Restarting services"
sudo systemctl restart pocketbase.service
sudo systemctl restart goalops-mcp.service
sudo systemctl status --no-pager pocketbase.service goalops-mcp.service | head -30
REMOTE_EOF
)

if [[ -z "${SKIP_MCP:-}" || -z "${SKIP_MIGRATE:-}" ]]; then
	say "Running remote build + restart"
	# shellcheck disable=SC2029  # we *want* $REMOTE_SCRIPT expanded locally.
	ssh -t "$REMOTE" "bash -lc $(printf %q "$REMOTE_SCRIPT")"
fi

say "Done. Visit https://goal.996007.fun/"
