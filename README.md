# Floxi.SI

Super Intelligence Orchestration — a native workflow platform built from the supplied roadmap and Floxi technology stack.

This is the **0.1 foundation release**, not full n8n/Dify parity. It includes real authenticated workflow CRUD, a connectable editor, versioned publication, a PostgreSQL-backed interpreter, and inspectable execution data. AI/RAG, forms, enterprise SSO, and external integrations remain on the roadmap. See [feature status](docs/feature-parity-matrix.md). The source also includes unfinished AI/provider contracts, transport code and database scaffolding; these are not yet exposed as application features.

## Develop in this cloud environment

Requires Node 24+, pnpm 11.25.0, and the existing PostgreSQL installation. Use this checkout; no second checkout or worktree is needed.

```bash
cd /workspace/Floxi.SI
bash /workspace/.postgres/start.sh
export XDG_DATA_HOME=/workspace/.local/share
export XDG_CACHE_HOME=/workspace/.cache
export XDG_STATE_HOME=/workspace/.local/state
# Copy only when .env is absent; preserve any existing configuration.
test -f .env || cp .env.example .env
pnpm install --frozen-lockfile
pnpm db:generate
pnpm db:migrate
pnpm dev
```

`pnpm dev` starts the React/Vite web app on port 5173, Nest API on loopback port 3001, and a separate database-backed worker. Open the frontend in your development environment and create the first administrator with your own email and a password of at least 12 characters. No default account or password is installed. The backend and Socket.IO are proxied by Vite. `WEB_ORIGIN` must match the frontend origin exactly; its development default is `http://localhost:5173`.

Database connection (validated with Prisma 6's PostgreSQL adapter):

```env
DATABASE_URL="postgresql://agent@localhost:5432/floxi.si?host=/workspace/.postgres/socket"
```

This uses the existing Unix socket. It does not enable TCP, recreate the cluster, or alter the earlier `floxi` database. Local trust authentication is a development configuration.

## First workflow

1. Create a workflow in Studio.
2. Add **Manual trigger → Set fields → Response**. Drag from each output handle to the next input.
3. Double-click Set fields and enter a JSON object such as `{"message":"Hello"}`. Configure Response with a JSON object.
4. Wait for **All changes saved**, validate, then publish. Run the published version with a JSON input object.
5. Inspect the execution dock or Executions page. Open the node workbench to see actual input/output. Drag an upstream output into a JSON/value parameter to create a stable node-ID/path reference. Publish again to execute the changed mapping.

Supported nodes: Manual trigger, Set fields, Condition (strict equals/not-equals/greater-than/contains), Wait (1–3600 seconds), Response. The graph is a bounded acyclic graph with one incoming edge per non-trigger node; branch joins and loops are rejected. A condition's inactive downstream branch is explicitly skipped. Waits survive worker restart because the wake time and input are committed to PostgreSQL.

## Validate and build

Run API and web first; integration/browser tests create isolated temporary workspaces and remove only their own generated fixtures. Stop the normal worker before `pnpm test` so restart tests can control ticks; browser tests run their own database worker tick loop.

```bash
pnpm typecheck
pnpm lint
pnpm test
# Uses /usr/bin/chromium; set CHROMIUM_PATH for a different installed Chromium.
pnpm test:e2e
pnpm build
```

Production artifacts are `dist/api` and `dist/web`. Backend commands are `pnpm start:api` and `pnpm start:worker`. Serve `dist/web` with your HTTPS reverse proxy, proxy `/api` and `/socket.io` to port 3001 (WebSocket upgrade required), and set `WEB_ORIGIN` and `COOKIE_SECURE=true`. This release is a development foundation, **not approved for public production deployment**; review the limitations below first.

## Migrations and preservation

Prisma schema: `apps/api/prisma/schema.prisma`. Versioned migrations: `apps/api/prisma/migrations`. `pnpm db:migrate` applies the reviewed SQL transactionally with an advisory lock and a checksum ledger named `_floxi_migrations`. Reapplying an unchanged migration is a no-op; modifying an applied migration is an error.

Prisma 6's experimental WASM migration adapter cannot deserialize PostgreSQL's catalog `name` type in this environment. Therefore **do not use `prisma migrate deploy/dev/reset` against this database**. SQL generation via `prisma migrate diff` and Prisma ORM operations use the supported JS engine and work without downloading binary engines. The migration runner never writes fabricated entries into `_prisma_migrations`. See [ADR](docs/architecture-decisions/001-foundation.md) and [backup/upgrade runbook](docs/runbooks/database.md).

## Security and release scope

- HttpOnly, SameSite-strict database sessions; scrypt password hashes; request verification headers; strict origin checks; per-process login throttling.
- Server-side workspace scoping and viewer/editor/publisher/operator/admin role checks. Only bootstrap-admin management is exposed; member/role administration and OIDC/SAML are not implemented.
- Immutable graph snapshots and version foreign keys; atomic step/result/event checkpoints using `FOR UPDATE SKIP LOCKED`; manual request deduplication when an idempotency key is supplied.
- Only pure local node handlers are available. No arbitrary code execution or general HTTP workflow nodes are exposed. Model calls are available separately through the role-gated text playground; keys use server environment bindings.
- Local database user `agent` is an administrative development role. Production requires least-privilege DB credentials, HTTPS, payload-at-rest encryption, distributed throttling, retention policies, SSO, monitoring, resource/load review, and tested backup/restore.
- Studio is capped at the most recent 100 matching workflows; execution history is capped at 50. Full pagination, canvas clipboard/multi-selection, viewport persistence, version rollback, single-step execution, and collaborative editing are not complete.

[Upstream audit](docs/upstream-audit.md) · [License review](docs/LICENSE_REVIEW.md) · [Release notes](docs/RELEASE_NOTES.md) · [Screenshots](docs/screenshots) · [Machine-readable gaps](docs/PARITY_GAPS.csv)


## Model registry and text playground

Open **Models** as an administrator to register an OpenAI-compatible base URL (including `/v1` if required), exact model ID, API style and optional credential binding such as `FLOXI_MODEL_KEY_LOCAL`. Set that variable on the API server; never paste an API key into endpoint metadata. `https://api.openai.com` is approved by default. For local inference, set `MODEL_ALLOWED_ORIGINS=http://localhost:8000` (comma-separated exact origins supported) and restart the API. The provider must be reachable from the API host.

**Test connection** checks the provider's `/models` response and persists reachability or a sanitized error. It does not certify that a configured model supports inference. Editors, publishers, operators and administrators can use **Generate text** to test the actual model. Requests are bounded to 30 seconds, 4 MiB responses and 4096 requested output tokens. The playground does not persist prompt/answer text; successful completion audit records contain IDs only. The provider may apply its own retention policies.

This is a bounded milestone 5 slice. Automated provider checks use a local HTTP protocol fixture, not an AI model. Live-model compatibility, streaming, chat history, workflow LLM nodes, RAG/citations, agent tools, endpoint editing/deletion, quotas and distributed concurrency limits remain open. Embeddings have transport validation only. The allowlist is an operator trust boundary: approve only controlled origins and network routes.
