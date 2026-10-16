# Floxi.SI development

Read `Docs/Floxi_Technology_Stack_SKILL.md` and the roadmap before extending features. Work in this existing isolated checkout; do not create another worktree unless requested. Preserve user files and the existing PostgreSQL cluster/databases.

Start DB: `bash /workspace/.postgres/start.sh`. Application configuration is in `.env` (never commit secret values). Use the Unix socket from `.env.example`; TCP is disabled. In this cloud image export XDG_DATA_HOME=/workspace/.local/share, XDG_CACHE_HOME=/workspace/.cache, XDG_STATE_HOME=/workspace/.local/state before invoking pnpm.

Use pnpm and Node 24, the pinned lockfile and mandated major versions. Run `pnpm db:generate`, `pnpm db:migrate`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:e2e`, and `pnpm build` as relevant. Integration checks require the API on port 3001, but stop the normal worker so tests control execution. E2E uses installed Chromium and starts its own tick loop. Never reset the DB for tests.

One Prisma schema is authoritative. Add new additive migrations; never edit applied SQL. `pnpm db:migrate` uses the checksum-checked transactional runner described in ADR 001. Do not use Prisma reset/dev/deploy against the preserved database. Treat the current worker transaction model as pure-node-only: external adapters need a lease/outbox design first.

Keep feature status honest in `docs/feature-parity-matrix.md`. Do not add clickable fake features, fabricated model results, or unsupported node types to the catalog. Do not incorporate n8n/Dify code or branding without an explicit compliant license decision.
