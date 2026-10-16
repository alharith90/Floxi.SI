# Floxi.si — Technology Stack Skill

> **Purpose:** Mandatory implementation rules for all work in the existing Floxi.si repository. Append this section to the existing start skill. The existing workspace, PostgreSQL startup, preservation, and connection instructions remain authoritative.

## 1. Core Engineering Rules

- Work **only** in the existing isolated checkout at `/workspace/Floxi.SI`. Do not create a second project, Git worktree, or duplicate source tree unless explicitly requested.
- Use a **TypeScript-first pnpm monorepo**. Keep frontend, backend, shared types, configuration, and database tooling within one coherent repository.
- Follow the stack below consistently. Do not silently substitute other frameworks, databases, ORMs, UI libraries, or package managers.
- Build real, connected, production-oriented functionality. No fake APIs, hard-coded sample outcomes, non-functional UI, or placeholder implementations presented as complete.
- The repository starts empty: inspect it before generating files, create a clean initial structure, and **do not invent an existing schema, migrations, features, or test coverage**.
- Prefer incremental, reversible changes. Preserve existing data, migrations, configuration, authentication, and working functionality.
- Apply strict TypeScript, clear module boundaries, reusable components, accessible responsive UI, and production-grade error handling and logging.

## 2. Mandatory Technology Stack

| Layer | Required technology | Purpose |
|---|---|---|
| Frontend | React 19 + TypeScript | Web application, workflow editor, and admin portal |
| Build tool | Vite 7 | Development server and production builds |
| UI framework | Tailwind CSS | Responsive styling and shared design system |
| Routing | React Router 7 | Application navigation and nested routing |
| Server-state fetching | TanStack React Query | API fetching, caching, retries, and invalidation |
| Forms and validation | React Hook Form + Zod | Typed forms and validation |
| Icons | Lucide React | Consistent icon set |
| Backend | NestJS 11 + TypeScript | Modular enterprise API and business logic |
| Runtime | Node.js 24+ | Frontend tooling and backend runtime |
| HTTP adapter | Express 5 via NestJS | HTTP request handling |
| API contract | REST + OpenAPI | Typed API contracts and documentation |
| **Primary database** | **Existing PostgreSQL 17.11** | Transactional application data |
| **Vector layer** | **Existing pgvector 0.8.0** | Embeddings, similarity search, and RAG |
| ORM and migrations | Prisma 6 | Relational access, schema management, and migrations |
| Real-time communication | Socket.IO | Live execution events, chat, and notifications |
| AI model integration | OpenAI-compatible APIs | Local GPT-OSS-120B and other configurable local/cloud models |
| AI features | RAG, knowledge base, agents, tools | Context-aware assistance and automation |
| Email | Nodemailer + IMAPFlow | Outgoing email and inbound email ingestion |
| WhatsApp integration | Baileys | Optional WhatsApp integration, isolated behind an adapter |
| Identity and access | OIDC / SAML + RBAC | Enterprise SSO and authorization |
| Background processing | Database-backed jobs | Retryable execution, triggers, and asynchronous work |
| Package management | pnpm Workspaces | Monorepo package management and shared dependencies |

**Database decision:** The generic reference stack originally specified Microsoft SQL Server. **For Floxi.si, PostgreSQL 17.11 + pgvector 0.8.0 supersede SQL Server**, because they are already provisioned and must be preserved. Do not add SQL Server, a second default database, or a parallel persistence architecture unless explicitly instructed.

## 3. Workspace and Database Contract — Do Not Override Start Skill

- Existing checkout: `/workspace/Floxi.SI`.
- PostgreSQL binaries and helper: `/workspace/.postgres` **outside** the repo.
- Persistent data directory: `/workspace/.postgres/data`.
- At the beginning of **every task**, run: `bash /workspace/.postgres/start.sh`.
- PostgreSQL listens on Unix socket `/workspace/.postgres/socket` with **TCP disabled**.
- Database name: `floxi.si`; user: `agent`; port setting: `5432`; UTF8; local trust authentication in this isolated development environment.
- Connect with:
  ```bash
  /workspace/.postgres/root/usr/lib/postgresql/17/bin/psql -h /workspace/.postgres/socket -U agent -d floxi.si
  ```
- Set the application environment explicitly when required:
  ```bash
  PGHOST=/workspace/.postgres/socket
  PGPORT=5432
  PGUSER=agent
  PGDATABASE=floxi.si
  ```
- Prisma must use a `DATABASE_URL` configured for the **existing Unix-socket connection**, not a new TCP instance. Validate its connection format against installed Prisma before applying migrations. Do not expose a guessed or untested connection string as working.
- Verify extension presence using `CREATE EXTENSION IF NOT EXISTS vector;` when necessary; the startup helper already creates the database and validates vector readiness.
- Never run `initdb`, recreate the cluster, drop existing databases, automatically reset Prisma, or execute destructive migrations against preserved data.
- If the startup helper is missing, follow the **existing start skill's** `pg_ctl` fallback procedure; do not create a separate PostgreSQL installation.
- The earlier `floxi` database is preserved; **do not rename, drop, merge, or overwrite it**.
- Use additive, reviewed Prisma migrations. Back up and plan explicitly before any potentially destructive schema evolution.
- For pgvector columns or operators unsupported by the Prisma 6 schema/client, use carefully scoped SQL migrations and parameter-safe raw queries. Do not pretend Prisma has native vector support. Choose embedding dimensions from the configured model, not an arbitrary hard-coded default.

## 4. Repository Structure

Start with this structure when creating the initially empty repository; adjust only for a clearly justified technical reason:

```text
/workspace/Floxi.SI/
├── apps/
│   ├── web/                  # React 19 + Vite 7
│   └── api/                  # NestJS 11 + Express 5
│       ├── src/
│       └── prisma/           # Prisma schema and versioned migrations
├── packages/
│   ├── ui/                   # Shared accessible UI components
│   ├── shared/               # Shared types, schemas, contracts
│   └── config/               # Shared lint, TS, tooling configuration
├── pnpm-workspace.yaml
├── package.json
├── pnpm-lock.yaml
├── .env.example
└── README.md
```

- Keep API and browser-specific code separated. Share DTO/schema contracts where appropriate, never database secrets or server-only code.
- Use a single Prisma source of truth for the application schema, plus explicit SQL migrations where required for pgvector.
- Keep generated code, build artifacts, dependencies, secrets, and runtime data out of Git.
- Use feature-based NestJS modules and feature-based React folders, not a single massive service or component.

## 5. Platform Implementation Standards

### Frontend
- Build a cohesive responsive design system with Tailwind CSS, Lucide React, keyboard accessibility, usable loading/empty/error states, and light/dark/system themes.
- Use React Router 7 for page navigation; React Query for server state; React Hook Form and Zod for forms. Avoid ad hoc duplicate implementations.
- For a workflow canvas, prefer `@xyflow/react` (React Flow) as an **additional specialized editor library**, not a replacement for the required frontend stack. Implement real nodes, typed ports, edges, validation, persisted layouts, and execution-state displays.
- Use reusable node configuration schemas and forms. Keep per-node fields and connection rules driven by node definitions rather than hard-coded panels.

### Backend and API
- Use NestJS modules, dependency injection, DTO validation, explicit service boundaries, OpenAPI documentation, consistent errors, and structured audit logs.
- Enforce RBAC and tenant/resource authorization **server-side**, including for Socket.IO events, background jobs, agents, and tool execution. UI visibility is not authorization.
- Expose REST APIs for CRUD, configuration, executions, history, and administration; use Socket.IO for real-time event streaming, not as a replacement for reliable persistence.
- Keep credentials encrypted or stored through an appropriate secrets mechanism; never return raw secrets to the browser or include them in logs.

### AI, RAG, Agents, and Workflows
- Integrate models through provider adapters with configurable base URLs, model IDs, timeouts, streaming, tool-calling support, and provider-specific capabilities.
- Support OpenAI-compatible **local** endpoints, including GPT-OSS-120B; do not assume every model supports vision, JSON modes, tools, or identical token limits.
- Store knowledge metadata and access rules in PostgreSQL; use pgvector for embeddings and similarity search, with source references and permission-aware retrieval.
- Implement workflow execution as persisted, observable state: triggers, step input/output, run statuses, retries, timeouts, resumability, and audit history. Use database-backed jobs initially; introduce a separate queue technology only with explicit approval or demonstrated need.
- Keep model/tool/agent calls governed by explicit access checks, bounded execution, cancellation where feasible, and safe error handling.

### Integrations
- Nodemailer handles outbound mail; IMAPFlow handles inbound mail through dedicated backend services and retryable jobs.
- Isolate Baileys behind an optional WhatsApp adapter and document that it is an unofficial integration subject to WhatsApp platform compatibility and policy changes. Never make application startup depend on its availability.
- Implement OIDC/SAML through well-maintained server-side integrations. Do not design a custom identity protocol.

## 6. Build, Test, and Delivery Gates

For each meaningful implementation or change:

1. Run the existing PostgreSQL start helper and verify the current database is healthy.
2. Inspect the current repository and installed dependencies before making changes.
3. Make changes inside the existing checkout only, preserving prior work.
4. Install dependencies using `pnpm` and maintain the lockfile; use compatible versions of the mandated technologies.
5. Run available lint, TypeScript checks, unit/integration tests, and production builds for affected packages.
6. When adding a database migration, inspect its SQL and validate it on the existing development database without deleting or resetting preserved data.
7. Test backend/API and frontend integration, including actionable error states and authorization where relevant.
8. Report the actual commands run, pass/fail results, limitations, changed files, and remaining work. **Never claim a test passed if it was not run.**

If no tests exist yet, establish minimal meaningful smoke tests as part of bootstrap rather than falsely reporting the application as tested.

## 7. Non-Negotiable Constraints

- **Do not replace PostgreSQL with Microsoft SQL Server.**
- **Do not initialize or overwrite the existing PostgreSQL cluster.**
- **Do not create another worktree or a parallel repository.**
- **Do not introduce another primary frontend/backend framework.**
- **Do not change the mandated major versions without explicit direction.**
- **Do not silently switch pnpm to npm or yarn.**
- **Do not implement insecure client-side-only authorization.**
- **Do not introduce mock behavior as completed functionality.**
- **Do not claim completion without running the checks available in the environment.**

**Instruction precedence:** Preserve and honor the existing start skill's workspace and database operational details. Apply this technology skill as the implementation standard. Where the generic legacy stack says SQL Server, the existing Floxi.si PostgreSQL + pgvector setup takes precedence.
