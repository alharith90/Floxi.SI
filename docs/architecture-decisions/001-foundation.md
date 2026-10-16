# ADR 001 — Floxi foundation architecture

Accepted for the 0.1 development release, 16 October 2026.

The repository initially contained only the roadmap, stack rules, and supplied logos. There was no source implementation or relational application schema to preserve. The installed PostgreSQL 17.11 cluster, pgvector 0.8.0, `floxi.si` database, and `floxi` database were retained. A pre-migration custom-format backup was taken outside the checkout.

The newer `Docs/Floxi_Technology_Stack_SKILL.md` takes precedence over the generic roadmap where they differ: React 19, Vite 7, React Router 7, Tailwind, TanStack Query, React Hook Form/Zod, Lucide, NestJS 11/Express 5, Prisma 6, Socket.IO, database-backed jobs and pnpm. No Redis service is used. Zustand holds transient graph undo/redo history; Prisma owns relational persistence. Browser and server share the native versioned graph and node catalog.

Prisma's JS query compiler + `@prisma/adapter-pg` avoid a blocked binary-engine host. `prisma.config.ts` uses the experimental JS schema adapter for SQL generation. Its deployment path failed on PostgreSQL catalog type `name`. Rather than patch dependencies, skip verification, or mark migrations as applied, a small pg-based runner executes the **Prisma-generated SQL** with one transactional advisory lock, immutable checksums, and a separate ledger. This is a deliberate migration-tool limitation; there is one Prisma schema and one PostgreSQL persistence architecture. Native Prisma deploy remains unvalidated here. Do not mix the two migration ledgers.

Every run pins an immutable published graph, backed by a composite version foreign key. The database itself is the work queue. A short row-lock transaction selects a runnable run using `SKIP LOCKED`, executes one bounded pure step, and commits the checkpoint/events atomically. Durable waits commit `wakeAt` and release the transaction. Worker death before commit rolls back that step; after commit the next process continues. This design is safe for the admitted pure handlers only. External side effects require a future fenced-lease/outbox/idempotency protocol and must not be added inside this transaction.

Socket.IO delivers persisted event sequence IDs, with membership and session revalidation and cursor replay on reconnect. REST polling is a readiness fallback; neither transport owns run state. A stale draft save returns 409 and blocks autosave until explicit recovery. Local draft export is available before discarding it.

We intentionally expose only connected functionality. The source inventories distinguish file discovery from actual review. Reference source, UI artwork and runtimes from n8n/Dify are not incorporated. Floxi branding uses the user's repository assets.
