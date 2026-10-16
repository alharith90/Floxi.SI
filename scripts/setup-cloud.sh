#!/bin/bash
set -euo pipefail
cd /workspace/Floxi.SI
export XDG_DATA_HOME=/workspace/.local/share
export XDG_CACHE_HOME=/workspace/.cache
export XDG_STATE_HOME=/workspace/.local/state
node -e 'if(Number(process.versions.node.split(".")[0])<24)throw new Error("Node.js 24 or later is required")'
# The existing PostgreSQL cluster is part of the environment snapshot. Never initialize it here.
bash /workspace/.postgres/start.sh
if [ ! -f .env ]; then cp .env.example .env; fi
pnpm install --frozen-lockfile
pnpm db:generate
pnpm db:migrate
pnpm build
