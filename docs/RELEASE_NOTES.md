# Floxi.SI 0.1 — Workflow foundation

The repository now contains a runnable native application using the user's logos and mandated stack. Studio drafts persist to the existing PostgreSQL database. Users can build five supported node families, configure real parameters, publish an immutable version, run it through a separate database-backed worker, and inspect stored input/output and errors.

This release delivers bounded portions of roadmap milestones 0–4. It does **not** implement the entire cumulative specification or n8n/Dify source parity. AI/RAG/agents, forms, schedules/webhooks, connectors and enterprise SSO remain open in [the matrix](feature-parity-matrix.md).

## Evidence

- TypeScript checks, application-source ESLint, production builds and the reusable setup script are required release checks.
- 32 contract/integration tests: graph validation, safe mapping, strict comparisons, OpenAPI references, login/revocation, request origin checks, tenant/RBAC denial, optimistic conflicts, immutable snapshots, idempotent submission, socket authorization/replay, 100 persisted runs, branch skipping, errors, concurrent claims, wait resume and cancellation.
- Five Playwright journeys: first-administrator onboarding/login/logout, create/connect/configure/save/reload/publish/run/map/republish/run, history, theme screenshots, search/duplicate/archive/restore/responsive viewports, save-before-navigation, and recovery from a failed cached draft refresh.
- Actual execution data, pgvector 0.8.0, and exact migration checksums restored successfully into a separately created temporary database. The temporary database and source fixtures were removed.
- [Targeted upstream audit](upstream-audit.md), pinned commits/license hashes, tracked-file discovery inventories, dependency licenses and SPDX package inventory. No exhaustive upstream or legal review is claimed.

## Migrations and operation

The foundation migrations create the application tables and add run idempotency/version integrity. Additive migrations also ensure pgvector is enabled and introduce the schema for the next AI/knowledge milestone. Existing databases and vector extension remain. The deployment runner uses transactional checksums because Prisma 6's experimental migration adapter failed on a PostgreSQL catalog type. See [ADR](architecture-decisions/001-foundation.md); do not use reset/dev/deploy against the preserved DB.

Run `bash scripts/setup-cloud.sh` to refresh dependencies/migrations/build, and `bash scripts/start-cloud.sh` to start the database, API, worker and frontend. On first use create your own administrator. The application is a development foundation; production security/operations gates remain open. No push, deployment, environment publication, or remote CI execution is claimed.

Known limits include five node types, acyclic single-input graphs, English UI, bounded listing sizes, no generic code or HTTP execution, no retryable external side effects, no secret management, and no production payload encryption/retention. Screenshots show actual temporary test workflows and runs, not shipped sample outcomes.

## AI/knowledge work in progress

This snapshot includes shared model/knowledge contracts, additive database tables, and an OpenAI / OpenAI-compatible transport adapter for Chat Completions, Responses text, and embeddings. These are scaffolding: no model-management endpoints, AI workflow nodes, knowledge ingestion/retrieval service, or related UI are wired into the application yet. No live provider calls have been validated. The runnable application remains the five-node foundation described above.
