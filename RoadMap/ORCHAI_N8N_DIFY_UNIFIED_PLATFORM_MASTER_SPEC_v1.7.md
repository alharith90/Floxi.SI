# OrchAI — Unified n8n + Dify Product and Engineering Master Specification

**Version:** 1.2 · **Prepared:** 2026-10-16 · **Status:** Architecture and implementation backlog, not a completed product.

> **PRIMARY DIRECTIVE FOR THE IMPLEMENTING AGENT**
>
> Build a cohesive, production-grade OrchAI platform combining Dify's approachable applications/workflows landing experience and AI-native features with n8n's workflow canvas, node configuration interaction model, execution/debugging UX and broad automation primitives. **Do not ship a cosmetic mock-up.** Every visible feature must be integrated end to end: UI → contract → backend → durable persistence → runtime execution → authorization → logs → tests. Inspect the live upstream source trees and this project's existing implementation before modifying code. Reuse valid existing functionality; replace broken design-system/canvas foundations rather than layering patches. Deliver meaningful complete vertical slices and always leave the application building.

## 0. Executive decision record

| Concern | Decision | Reference inspiration |
|---|---|---|
| Dashboard / homepage | Dify-style app and workflow library | Dify Studio |
| Workflow designer | n8n-style immersive editor | n8n editor |
| Node editing | n8n-style inspect/edit/test with input, parameters, output | n8n node detail view |
| AI-first capabilities | Dify-style AI workflows, agents, knowledge and model management | Dify |
| Automation | n8n-style triggers, transformations, integrations and operations | n8n |
| Source of truth | Single OrchAI versioned graph and node schema | Native OrchAI |
| Frontend | TypeScript, React, Vite, React Flow / XYFlow, Zustand, TanStack Query, Tailwind / design tokens | Native implementation |
| Backend | TypeScript, NestJS, PostgreSQL, pgvector, Redis/BullMQ, WebSocket/SSE | Native implementation |
| Execution | Durable graph interpreter with typed ports, queue-backed runs and checkpointing | Native implementation |
| Enterprise | Workspace/organization isolation, RBAC, audit, policies, secrets and observability | Native implementation |
| On-premise | Linux-first, Docker Compose optional, no mandatory internet or third-party cloud | Native implementation |
| Product philosophy | Polished UX, functional depth, predictable recovery, built-in troubleshooting | Both |

**Do not embed n8n/Dify runtimes, copy their branding, or claim source compatibility without validation.** An integration/import adapter may be developed independently. This document includes original illustrative OrchAI code snippets, **not verbatim upstream source code**.

## 1. Upstream primary sources and due-diligence protocol

- n8n: https://github.com/n8n-io/n8n (default branch typically `master`)
- Dify: https://github.com/langgenius/dify (default branch typically `main`)
- n8n licensing: https://github.com/n8n-io/n8n/blob/master/LICENSE.md
- Dify licensing: https://github.com/langgenius/dify/blob/main/LICENSE
- n8n docs: https://docs.n8n.io/
- Dify docs: https://docs.dify.ai/

### 1.1 Mandatory source inspection before coding

Clone or inspect both upstream repositories on the implementation machine, pin exact commit hashes and record them in `docs/upstream-audit.md`. The paths below are **entry points to verify against the pinned revisions**, not a claim that every directory was inspected in this document.

```bash
mkdir -p research/upstreams
# Use authorized network access or an approved, pre-fetched offline mirror.
git clone --filter=blob:none https://github.com/n8n-io/n8n.git research/upstreams/n8n
git clone --filter=blob:none https://github.com/langgenius/dify.git research/upstreams/dify

git -C research/upstreams/n8n rev-parse HEAD
git -C research/upstreams/dify rev-parse HEAD
find research/upstreams/n8n/packages -maxdepth 3 -type d | head -n 120
find research/upstreams/dify/web -maxdepth 4 -type d | head -n 120
find research/upstreams/dify/api -maxdepth 4 -type d | head -n 120
```

Inspect these *known architectural areas / probable search targets*:

| Product | Investigation area | What to extract as design understanding |
|---|---|---|
| n8n | `packages/editor-ui/` | Editor routing, canvas interaction, node insertion, parameter editor, UX state, run inspection |
| n8n | `packages/workflow/` | Graph data contracts, node definitions, expression semantics, connections |
| n8n | `packages/core/` | Execution interfaces, runner behavior, binary/item handling |
| n8n | `packages/cli/` | Persistence, REST endpoints, workflows, credentials, execution orchestration |
| n8n | `packages/nodes-base/` | Trigger/action node capability patterns, credentials and declarative fields |
| n8n | `packages/@n8n/` (if present) | Modular package boundaries and AI-related components |
| Dify | `web/` | Dashboard, Studio, workflow editor, component hierarchy, model configuration and datasets |
| Dify | `api/` | Python service API, workflows, apps, knowledge and execution business logic |
| Dify | `api/core/` (verify) | Workflow nodes, LLM provider execution, retrievers and agents |
| Dify | `packages/`, `dify-agent*` (where present) | Shared contracts, SDKs, agent execution environments |
| Dify | `docker/` | Service topology, operational dependencies and on-prem deployment choices |

For each significant UX/feature, document: path + symbol/component + behavioral evidence + screenshots in a locally running authorized deployment + OrchAI acceptance criterion. Search source with `rg 'NodeDetails|Workflow|Execution|Agent|Knowledge|Model'` rather than guessing filenames. Distinguish OSS/community code from proprietary or enterprise-only behavior. Never assume a directory name guarantees a given capability in a particular release.

### 1.2 License and IP policy — release blocker

n8n is *source-available, fair-code*, not an unrestricted OSI open-source license. Its Sustainable Use License restricts permitted uses, modification and redistribution. Dify uses a modified Apache 2.0 license that adds conditions (including specific multi-tenancy and frontend logo/copyright conditions) and mentions UI appearance protections. Therefore:

1. Obtain legal approval before incorporating copyrighted code, UI assets or exact visual designs, especially for a commercial/SaaS product.
2. Treat the repositories as references for requirements and interaction patterns; implement original components and styles.
3. Don't copy n8n node implementations, Dify frontend files or protected branding without a valid grant and compliance plan.
4. Inventory every third-party package and license; generate SPDX SBOM and notices.
5. Never claim 'fully compatible import' unless import roundtrips and behavior are tested.
6. Prefer original schemas and standards-based integrations (HTTP, MCP, OpenAPI, OAuth2, SQL, queues).
7. Preserve provenance and attribution for authorized reused code.

## 2. Product map / information architecture

**Left navigation (collapsible)**

- Home
- Studio
  - All Apps & Flows
  - Workflows
  - Chatflows
  - Agents
  - Automations
  - Templates
  - Shared with me
- Knowledge
  - Knowledge Bases
  - Documents
  - Pipelines
  - Retrieval Playground
- Models & AI
  - Providers & Endpoints
  - Model Registry
  - Prompt Studio
  - Agents & Skills
  - Tools / MCP
  - Evaluations
  - Guardrails
- Operations
  - Executions
  - Schedules & Triggers
  - Queues & Workers
  - Logs & Traces
  - Usage & Cost
- Connections
  - Integrations
  - Credentials
  - Webhooks
  - Environments
- Administration
  - Organizations & Workspaces
  - Members, Teams & RBAC
  - Policies & Audit
  - Deployment Center
  - Settings / Diagnostics

**Top app bar:** workspace switcher, global search, quick create, notification center, help, user menu and one-click light/dark/system mode. Route breadcrumbs are consistent throughout. Keyboard shortcuts available and discoverable.

### 2.1 Dify-inspired home experience — exact functional requirements

Hero area: welcoming title, minimal secondary text, prominent **Create App or Workflow**, global search and filter bar. A tasteful, substantial card grid (not cramped tables) with icons, app/flow type, description, state (Draft/Published), last changed, owner, run health, tags and action menu.

Tabs: **All, Workflows, Chatflows, Agents, Automations, Published, Templates, Favorites, Recent**. Cards support click-to-open designer, keyboard action, duplicate, rename, archive, share, export, restore and delete with confirmation. Template gallery supports searchable, licensed templates and one-click instantiate; template execution never starts before credentials are configured. Provide list/card toggle, sorting, pagination/virtualization and empty-state onboarding. Filtering and view choice survive reload for each user.

Create wizard: `Blank Workflow`, `AI Chatflow`, `AI Agent`, `Automation`, `Knowledge Pipeline`, `From Template`, `Import`. Required: name, type, workspace; optional description, icon and tags. Validate names, duplicate behavior and permissions. On submit persist valid draft first, then navigate to live designer. No default broken sample placeholders.

### 2.2 n8n-inspired canvas experience — detailed interaction contract

**Designer route:** `/studio/flows/:flowId/editor`. Minimal global chrome, full-height work area and reliable resizing. Layout states:

- **Default:** left vertical navigation/nodes rail (collapsible); central infinite pannable/zoomable canvas; right contextual inspector (closed until selection); top command header; bottom optional run/debug panel.
- **Node picker:** click `+` on canvas/connection, drop-to-add, keyboard search, typed search, category grouping, favorites, recently used, ready-to-use node descriptions.
- **Double click node:** open a focused **three-pane node inspection experience**: left `INPUT` (prior node/sample JSON/binary, run selector); middle `PARAMETERS` (fields, credential selectors, expression mode, validation and docs); right `OUTPUT` (JSON/table/schema/binary/errors). The panes are truly independently resizeable and collapsible; do not substitute a single narrow side drawer.
- **Single click node:** select, show lightweight inspector/toolbar without stealing keyboard focus.
- **Connections:** drag from an output handle to a compatible input handle; reject incompatible edge types with useful explanation; clicking edge opens actions (delete, insert node, annotate, reconnect).
- **Multi-select:** Shift+drag marquee, Shift+click, `Ctrl/Cmd+A`; align/distribute, group and copy/paste with new stable IDs. Undo/redo includes node edits and edge changes.
- **Navigation:** trackpad pinch zoom, mouse wheel configuration, zoom-to-fit, mini-map, hotkeys and reset viewport. Pan must not drag nodes accidentally.
- **Node state:** idle, selected, configured, running, success, failed, skipped, disabled, paused, breakpoint; errors indicated with icons and accessible labels rather than relying on color.
- **Editor state:** auto-save debounce with version/conflict status, explicit Save (optional), dirty indicator, Publish, Run, History, Settings, Share.
- **Debug:** click run to see animated active path, live node timings, per-node input/output and errors, events, cost/tokens, retries, run-as mode; allow run from selected node using pinned upstream fixtures with safety labeling.
- **Workflow controls:** Draft vs Published, version diff, rollback, environment-specific credentials, activation/deactivation, schedule overview, ownership, comments and share.
- **Performance:** large workflows remain responsive with memoized node renderers, virtualized side lists, graph indexing, batched updates, minimal pointer rerenders and cancellation of stale requests.

### 2.3 Suggested visual behavior

Use a distinctive OrchAI brand; borrow **interaction quality**, not exact proprietary visual styling. Spacious canvas with subtle dot grid, correctly balanced node cards, consistent 8px spacing scale, 14–16px body type, legible node ports, high contrast, coherent iconography and consistent dark theme. Canvas gets most viewport space. Node forms, output inspector and full-screen drawers must work at 1366×768, 1920×1080 and tablet widths. System theme auto-detect on first load; user selection overrides thereafter; both themes thoroughly tested. English LTR first, Arabic RTL supported with correctly mirrored navigation and sensible canvas behavior.

## 3. Combined feature catalogue and acceptance criteria

Mark every row in `/docs/feature-parity-matrix.md` with `Not Started / In Progress / Working / Tested / Blocked`, plus a link to implementation, automated test and screenshot. Do not use 'implemented' for static mock UI.

### 3.1 Workflow/automation feature scope (n8n-inspired)

| Capability | Priority | Required behavior |
|---|---|---|
| Manual trigger | P0 | Run with injected, validated input |
| HTTP webhook trigger | P0 | Dedicated URL, optional auth, deterministic 2xx/4xx/5xx response |
| Scheduled trigger | P0 | Cron, timezone, DST semantics, missed-run policy |
| HTTP request | P0 | Auth, body modes, pagination, timeouts, retry, response mapping, SSRF mitigation |
| Set/edit fields | P0 | Typed expressions, map/merge, bulk array support |
| Condition / IF / switch | P0 | Explicit case ports and mutually exclusive branch semantics |
| Loop / iterator | P0 | Bounded iteration, loop context, pause/resume |
| Merge/join | P0 | Branch-aware joins with wait-for-all / first / keyed merge strategies |
| Code | P1 | Sandboxed JS (and Python if approved), CPU/memory/runtime limits |
| Subflow | P1 | Version-pinned calls, parameter contract, recursion guard |
| Wait / Delay | P0 | Durable timer; survives server restart |
| Approval | P1 | Human-assigned approve/reject, expiry, audit and resume |
| Data transform | P0 | JSON path, flatten, array split/aggregate, format dates, parse CSV |
| SQL and databases | P1 | Least privilege, parameterized queries, credentials isolation |
| Message/event queues | P1 | Kafka/RabbitMQ/Redis adapters, idempotent consumption |
| Email and notifications | P1 | SMTP, templates, secure config, failure/receipt logging |
| SaaS connectors | P2 | Registry, OAuth, pagination, rate limiting and connector tests |
| Error workflow | P1 | Catch/compensate, run status, configured recovery |
| Variables and secrets | P0 | Typed references, redaction, no plaintext credentials in graph |
| Retries and timeout | P0 | Per-node policy with exponential backoff/jitter and max attempts |
| Activation & versions | P0 | Draft, published immutable revision and rollback |
| Execution logs | P0 | Node timeline, streamed events, redacted I/O, retention |
| Workflow templates | P1 | Search, clone, required setup and import/export |
| Credentials | P0 | Provider-based, encrypted at rest, RBAC and test connection |
| Run from node | P1 | Debug with fixtures and safe handling of side effects |
| Item-level execution | P1 | Data batch and per-item failure semantics documented |

### 3.2 AI feature scope (Dify-inspired)

| Capability | Priority | Required behavior |
|---|---|---|
| OpenAI-compatible LLM | P0 | Base URL + model name, test, streaming, health |
| Multi-provider registry | P0 | Multiple endpoints / per-workspace authorization |
| Chatflow | P0 | Session, history, typed user variables, streamed answer |
| LLM node | P0 | System/user templates, temperature, max tokens, structured output |
| Prompt Studio | P1 | Versioned prompt templates, variables, side-by-side test, eval |
| AI Agent | P0 | Bounded tool calls, policy, memory, intermediate trace, stop reason |
| Tool calling | P0 | JSON Schema validation, approval for privileged tools |
| RAG knowledge base | P0 | Ingest, chunk, embed, index, semantic search, citations |
| Hybrid retrieval | P1 | Keyword + vector, configurable fusion, rerank |
| Knowledge pipeline | P1 | Extraction → clean → chunk → embed → index, inspect status |
| Document extraction | P0 | PDF/DOCX/PPTX/XLSX/HTML/TXT/Markdown supported by installed readers |
| OCR | P1 | Pluggable local OCR service, processing trace, confidence metadata |
| Vision | P1 | Image input to vision-capable configured model |
| STT | P1 | Offline speech-to-text endpoint and transcription node |
| TTS | P1 | Offline text-to-speech endpoint and playback/asset node |
| Image generation | P2 | Authorized local model providers and asynchronous job/result |
| Embeddings | P0 | Batch embed, model version metadata, retry, dimensions |
| Reranking | P1 | Cross-encoder API, score/provenance and model fallback |
| Conversation memory | P1 | Scoped retention, summary, retrieval, delete/export |
| Multi-agent | P1 | Router, delegator, specialists, delegated run limits |
| MCP client/server | P1 | Trust policy, authenticated servers, controlled capabilities |
| Knowledge citation | P0 | Source ID, filename, section/page when available |
| Structured response | P0 | JSON Schema, validation and repair limit |
| Safety and guardrails | P0 | Input/output policy hooks, prompt injection defenses, PII masking |
| Human-in-the-loop | P1 | Approval actions, escalation, immutable decision trace |
| AI evaluation | P1 | Golden sets, scoring, regression detection, prompt/model comparisons |
| AI observability | P0 | Token counts, latency, usage, failures, trace IDs |
| App publishing | P1 | Versioned HTTP API, chat widget, service key, quotas |
| AI application templates | P1 | Create chat assistant, RAG bot, extraction flow, agent tool flow |
| AI credential privacy | P0 | Secret references, no user-visible raw keys |

### 3.3 Enterprise/platform capabilities

Org/workspace hierarchy; invite; SSO/OIDC/SAML (as applicable); MFA; role templates; service accounts; fine-grained permissions; least-privilege API tokens; environment segregation; audit trail; consent/policy; workspace scoped secrets; configurable content retention; encrypted backups; restore drill; metrics; HA strategy; quotas; retry/dead letter management; process supervision; diagnostics and offline package/dependency audit. Support shared nodes/templates with controlled publication.

## 4. Node taxonomy / minimum launch catalogue

**Triggers:** manual, schedule, webhook, chat input, API request, email received, database change (adapter), file arrival, queue event, workflow called.

**Logic:** start, end, if, switch, filter, loop, foreach, merge, split, wait, debounce, throttle, parallel, error branch, try/catch, retry, variable, date/time, subworkflow, approval.

**Data:** JSON transform, object/map, list aggregate, CSV, XML, YAML, text splitter, regex, schema validator, template, hash, encoding, file reader/writer, HTTP request, SQL query, object storage.

**AI:** model call, prompt template, chat completion, completion, agent, multi-agent delegation, classifier, extractor, summarizer, question answer, embedding, knowledge retrieval, reranker, knowledge write, moderation, evaluate, memory read/write, text-to-speech, speech-to-text, OCR, vision, image generation, tool adapter, MCP client.

**Operations:** send email, notification, logging, metrics, secrets reference, audit event, incident/ticket creation, webhook response, external API, queue publisher.

Every node must declare types, name, description, icon identifier, category, inputs/outputs, field metadata, credential requirements, side-effect classification, error/retry capability, minimum runner version, and whether it can run on an offline installation.

## 5. Monorepo and module layout

```text
orchai/
├── apps/
│   ├── web/                      # React + Vite SPA
│   │   └── src/
│   │       ├── app/              # bootstrap, providers, router
│   │       ├── layouts/          # Studio, Workbench, Admin
│   │       ├── features/
│   │       │   ├── home/         # Dify-inspired card hub
│   │       │   ├── workflow/     # canvas, editor, picker, commands
│   │       │   ├── executions/   # live run, data, timeline
│   │       │   ├── nodes/        # parameter editor and three panes
│   │       │   ├── ai/           # model, prompts, agents, tools
│   │       │   ├── knowledge/    # documents, ingest, retrieval
│   │       │   └── admin/
│   │       ├── components/ui/    # shared design system
│   │       ├── api/              # typed client and subscriptions
│   │       ├── state/            # local editor session state
│   │       └── styles/           # tokens, themes, layout
│   ├── api/                      # NestJS modular monolith
│   │   └── src/
│   │       ├── auth/
│   │       ├── organizations/
│   │       ├── workflows/
│   │       ├── versions/
│   │       ├── nodes/
│   │       ├── execution/
│   │       ├── scheduling/
│   │       ├── credentials/
│   │       ├── ai/
│   │       ├── knowledge/
│   │       ├── webhooks/
│   │       ├── observability/
│   │       └── deployment/
│   └── worker/                   # BullMQ-backed workflow execution
├── packages/
│   ├── contracts/                # Zod / OpenAPI / shared DTOs
│   ├── node-sdk/                 # type system, executor contracts
│   ├── engine/                   # graph compiler and runner
│   ├── expressions/              # safe variable resolver
│   ├── ai-sdk/                   # provider interfaces and streaming
│   ├── connectors/               # authorized native implementations
│   ├── db/                       # migrations and repositories
│   ├── security/                 # authz and encryption helpers
│   └── config/                   # typed environment config
├── infra/
│   ├── compose/
│   ├── systemd/
│   ├── installers/
│   └── reverse-proxy/
├── docs/
│   ├── upstream-audit.md
│   ├── feature-parity-matrix.md
│   ├── architecture-decisions/
│   ├── runbooks/
│   └── screenshots/
├── tests/
│   ├── e2e/
│   ├── contract/
│   ├── integration/
│   └── load/
└── pnpm-workspace.yaml
```

Use database migrations that never delete tenant data during repair. Use environment variable validation. Package names and folder structure can be adapted to a working existing repository; avoid gratuitous rewrites unless fixing root-cause architectural defects.

## 6. Native graph, node and port contracts (original reference code)

File: `packages/contracts/src/workflow.ts`

```ts
import { z } from 'zod';

export const PortType = z.enum([
  'any', 'json', 'string', 'number', 'boolean', 'binary',
  'chat-message', 'documents', 'embedding', 'control', 'error',
]);

export const NodePosition = z.object({ x: z.number(), y: z.number() });
export const GraphNode = z.object({
  id: z.string().uuid(),
  type: z.string().min(1),
  typeVersion: z.number().int().positive(),
  label: z.string().min(1).max(200),
  position: NodePosition,
  disabled: z.boolean().default(false),
  parameters: z.record(z.string(), z.unknown()).default({}),
  credentials: z.record(z.string(), z.string().uuid()).default({}),
});
export const GraphEdge = z.object({
  id: z.string().uuid(),
  source: z.string().uuid(), sourcePort: z.string().min(1),
  target: z.string().uuid(), targetPort: z.string().min(1),
});
export const WorkflowGraph = z.object({
  schemaVersion: z.literal(1),
  nodes: z.array(GraphNode),
  edges: z.array(GraphEdge),
  settings: z.object({
    concurrency: z.number().int().min(1).max(200).default(1),
    failurePolicy: z.enum(['stop', 'continue', 'error-edge']).default('stop'),
    timeoutMs: z.number().int().min(1000).max(86400000).default(900000),
  }),
});
export type WorkflowGraph = z.infer<typeof WorkflowGraph>;
export type GraphNode = z.infer<typeof GraphNode>;
export type GraphEdge = z.infer<typeof GraphEdge>;
```

**Invariants:** unique node and edge IDs; edge endpoints exist; declared source/target ports exist and match by type; required fields validate; no illegal cycles (unless explicitly modeled as bounded loop constructs); all triggers supported; no crossing workspace boundaries; graph execution uses an immutable published snapshot. Graph validation occurs on both client and server, and always on publish/run. The runtime must never trust canvas JSON alone.

File: `packages/node-sdk/src/types.ts`

```ts
export type NodeRuntimeContext = {
  workspaceId: string;
  executionId: string;
  nodeId: string;
  attempt: number;
  signal: AbortSignal;
  resolveSecret(name: string): Promise<string>;
  emit(event: RuntimeEvent): Promise<void>;
};
export type RuntimeEvent = {
  type: 'progress' | 'log' | 'metric';
  message?: string;
  data?: Record<string, unknown>;
};
export type Port = { name: string; type: string; multiple?: boolean };
export type ParameterField = {
  name: string; label: string;
  widget: 'text' | 'textarea' | 'number' | 'select' | 'boolean'
        | 'json' | 'expression' | 'credential' | 'model' | 'knowledge-base';
  required?: boolean;
  description?: string;
  options?: Array<{ label: string; value: string }>;
};
export interface NodeDefinition {
  type: string;
  version: number;
  displayName: string;
  category: string;
  icon: string;
  inputs: Port[];
  outputs: Port[];
  parameters: ParameterField[];
  sideEffect: 'none' | 'read' | 'write' | 'external';
  execute(ctx: NodeRuntimeContext, input: Record<string, unknown>, params: Record<string, unknown>):
    Promise<Record<string, unknown>>;
}
```

Node registry should support compatible type migrations, declaration validation, discoverability, category filtering, runtime caps and signed extension manifests. UI uses metadata; implementation never hardcodes an independent form for every node.

## 7. Frontend implementation blueprint

### 7.1 Core component tree

```text
<AppShell>
  <WorkspaceProvider />
  <ThemeProvider mode="system|light|dark" />
  <Routes>
    <StudioHomePage>
      <StudioHeader /> <AppTypeTabs /> <SearchFilters />
      <FlowCardGrid /> <TemplateGallery /> <CreateAppDialog />
    </StudioHomePage>
    <WorkflowEditorPage>
      <EditorHeader />
      <NodeLibraryRail />
      <WorkflowCanvas>
        <TypedNode /> <SmartEdge /> <ConnectionValidation />
        <MiniMap /> <ZoomControls /> <CanvasActions />
      </WorkflowCanvas>
      <NodeInspector />
      <NodeWorkbenchDialog>
        <InputPane /> <ParametersPane /> <OutputPane />
      </NodeWorkbenchDialog>
      <ExecutionBottomPanel />
    </WorkflowEditorPage>
    <ModelRegistryPage /> <KnowledgePage /> <AgentStudioPage />
    <ExecutionListPage /> <ExecutionDetailPage />
  </Routes>
</AppShell>
```

### 7.2 Flow card contract

Each flow card must include: `id`, `name`, `kind`, `description`, `icon`, `updatedAt`, `owner`, `tags`, `draftStatus`, `publishedVersion`, `enabled`, `lastExecutionAt`, `lastExecutionStatus`, `permission`. Skeleton only while fetching; true empty state only when server returns no results. Cards must be accessible button/link surfaces and support keyboard enter. Filter/sort server-side for large workspaces.

### 7.3 Original React Flow canvas example

File: `apps/web/src/features/workflow/WorkflowCanvas.tsx`

```tsx
import { useCallback, useMemo } from 'react';
import ReactFlow, {
  Background, Controls, MiniMap, addEdge,
  type Connection, type Edge, type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

type Props = {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: (changes: any[]) => void;
  onEdgesChange: (changes: any[]) => void;
  onConnectEdge: (edges: Edge[]) => void;
  onOpenNode: (id: string) => void;
};
export function WorkflowCanvas(props: Props) {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnectEdge, onOpenNode } = props;
  const isValidConnection = useCallback((connection: Connection | Edge) => {
    // Illustrative only: add registry-backed port typing and cycle validation.
    return !!connection.source && !!connection.target && connection.source !== connection.target;
  }, []);
  const edgeTypes = useMemo(() => ({}), []);
  return (
    <div className="relative h-full w-full" aria-label="Workflow designer">
      <ReactFlow
        nodes={nodes} edges={edges} edgeTypes={edgeTypes}
        onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
        onConnect={(conn) => onConnectEdge(addEdge(conn, edges))}
        isValidConnection={isValidConnection}
        onNodeDoubleClick={(_, node) => onOpenNode(node.id)}
        fitView snapToGrid snapGrid={[16, 16]} nodesDraggable
        selectionOnDrag minZoom={0.15} maxZoom={2.5}
      >
        <Background gap={20} size={1} />
        <Controls position="bottom-left" />
        <MiniMap pannable zoomable position="bottom-right" />
      </ReactFlow>
    </div>
  );
}
```

**Production hardening tasks:** create nodeTypes outside render; update only affected nodes; serialize and persist movement with debounced mutation + optimistic concurrency token; validate port types; never append a duplicate edge; keyboard shortcuts must be scoped to canvas, not active forms; click `+` adds at corresponding insertion point; selection changes must not overwrite unsaved node fields. Use `onEdgesChange` to keep state synchronized and support undo.

### 7.4 Three-pane node workbench — essential product differentiator

Route modal vs overlay: use an accessible dialog with resizable split-pane layout or dedicated full-screen workbench; URL query `?node=<id>&run=<runId>` deep-links selected node and execution. `Escape` closes from nested editor without losing dirty changes; node switching preserves validated drafts.

**Pane A / Input:** upstream connections, source selection, latest/test/production run selector, pin data, preview JSON/tree/table, diff current against previous, binary file metadata, null/empty/error explanations.

**Pane B / Parameters:** searchable form sections, metadata-driven controls, field-level documentation, dynamic expression mode, credential chooser, connection test, required state and inline validation; `Execute Step` shows a clear side-effect warning for write/external nodes.

**Pane C / Output:** current run output, table/JSON/schema/binary; payload size warnings and truncation, timing, status, error cause, retry button, trace, token/cost and structured response validation. Avoid rendering full multi-megabyte payload into DOM; paginate and download through authorized file endpoint.

File: `apps/web/src/features/nodes/NodeWorkbench.tsx` (layout skeleton)

```tsx
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';

type WorkbenchProps = {
  input: React.ReactNode;
  parameters: React.ReactNode;
  output: React.ReactNode;
};
export function NodeWorkbench({ input, parameters, output }: WorkbenchProps) {
  return (
    <PanelGroup direction="horizontal" className="h-full min-h-0">
      <Panel defaultSize={28} minSize={15}>
        <section aria-label="Node input" className="h-full overflow-auto">{input}</section>
      </Panel>
      <PanelResizeHandle className="w-1 cursor-col-resize bg-border" />
      <Panel defaultSize={43} minSize={25}>
        <section aria-label="Node parameters" className="h-full overflow-auto">{parameters}</section>
      </Panel>
      <PanelResizeHandle className="w-1 cursor-col-resize bg-border" />
      <Panel defaultSize={29} minSize={15}>
        <section aria-label="Node output" className="h-full overflow-auto">{output}</section>
      </Panel>
    </PanelGroup>
  );
}
```

Review installed `react-resizable-panels` version and corresponding package APIs before using verbatim. Implement collapse, reset sizes and persistent per-user split percentages. Add component-level error boundaries to prevent a malformed node inspector from crashing the entire editor.

### 7.5 Frontend state strategy

- **TanStack Query** = server data cache: flow list, flow detail, versions, executions, credentials (metadata only), models, KBs.
- **Zustand or equivalent** = transient editor: selection, viewport, open inspector, unsaved changes, undo stack, pinned data, workbench panes.
- **URL** = navigable state: `flowId`, selected node, runId, tab where appropriate.
- **Backend authoritative** = published workflow, revisions, credentials, execution status.

No duplicated ownership of a field across state stores. Provide deterministic editor hydration. Save mutation includes `baseRevision`; on `409` show conflict diff and safe choice to reload/fork/merge, never silently overwrite another user's edits.

### 7.6 Form engine and expressions

The same field schema powers form controls, validation, docs and API validation. Expression syntax example: `{{ $input.customerId }}`, `{{ $nodes.fetchCustomer.output.name }}`, `{{ $vars.region }}`. Parse to AST; **do not use JavaScript `eval` or `new Function` on user expressions**. Offer autocomplete, references from upstream graph, type mismatch warnings, preview with sanitized test values, and a variable browser.

### 7.7 Theming and UX QA

Design tokens for surface/sidebar/canvas/node/popup/border/text/muted/primary/success/warning/error/focus. WCAG contrast check, keyboard focus, tooltip behavior, hit targets, light/dark/system toggle and persisting override. Test screen sizes and zoom at 100%/125%/150%. Avoid tiny typography, useless enormous padding, clipped modals, empty navigation blocks, permanently spinning loaders, reset layouts, broken icon fonts or auto-close on errors.

## 8. Backend modular API and persistence

### 8.1 Domain model

`Organization` → `Workspace` → `Project`/`App`/`Workflow`; each workflow has mutable `Draft` and immutable `PublishedVersion`s. Runs refer to one exact version snapshot. Nodes have stable UUIDs within versions. KBs, documents, model connections, secrets and traces belong to a workspace. Templates live in private/team/global registries with review gates.

### 8.2 PostgreSQL schema (conceptual migration)

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE organizations (
  id uuid PRIMARY KEY, name text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE workspaces (
  id uuid PRIMARY KEY, organization_id uuid NOT NULL REFERENCES organizations(id),
  name text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE workflows (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id),
  name text NOT NULL, kind text NOT NULL,
  description text NOT NULL DEFAULT '', draft_graph jsonb NOT NULL,
  draft_revision bigint NOT NULL DEFAULT 1,
  published_version_id uuid NULL, enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX workflows_workspace_updated ON workflows(workspace_id, updated_at DESC);
CREATE TABLE workflow_versions (
  id uuid PRIMARY KEY, workflow_id uuid NOT NULL REFERENCES workflows(id),
  version_number integer NOT NULL, graph jsonb NOT NULL,
  checksum text NOT NULL, published_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workflow_id, version_number)
);
ALTER TABLE workflows ADD CONSTRAINT workflow_published_fk
  FOREIGN KEY (published_version_id) REFERENCES workflow_versions(id);
CREATE TABLE executions (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id),
  workflow_id uuid NOT NULL REFERENCES workflows(id),
  workflow_version_id uuid NOT NULL REFERENCES workflow_versions(id),
  status text NOT NULL, trigger_type text NOT NULL,
  idempotency_key text, started_at timestamptz,
  finished_at timestamptz, error_summary text, metadata jsonb NOT NULL DEFAULT '{}'
);
CREATE UNIQUE INDEX executions_idempotency ON executions(workspace_id, workflow_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX executions_status_idx ON executions(workspace_id,status,started_at DESC);
CREATE TABLE node_executions (
  id uuid PRIMARY KEY, execution_id uuid NOT NULL REFERENCES executions(id),
  node_id uuid NOT NULL, attempt integer NOT NULL,
  status text NOT NULL, started_at timestamptz, finished_at timestamptz,
  input_ref text, output_ref text, error jsonb,
  UNIQUE(execution_id,node_id,attempt)
);
CREATE TABLE encrypted_credentials (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id),
  provider text NOT NULL, display_name text NOT NULL,
  encrypted_data bytea NOT NULL, key_version integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE knowledge_bases (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id),
  name text NOT NULL, embedding_model_id text NOT NULL,
  embedding_dimensions integer NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE documents (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id),
  knowledge_base_id uuid NOT NULL REFERENCES knowledge_bases(id),
  file_name text NOT NULL, content_sha256 text NOT NULL,
  ingest_status text NOT NULL, metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE document_chunks (
  id uuid PRIMARY KEY, document_id uuid NOT NULL REFERENCES documents(id),
  ordinal integer NOT NULL, body text NOT NULL, metadata jsonb NOT NULL DEFAULT '{}',
  embedding vector NOT NULL
);
-- For ANN indexing, choose a supported fixed dimension per collection/model,
-- e.g. expression indexes/cast or dimension-specific physical tables.
CREATE TABLE audit_events (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id),
  actor_id uuid, action text NOT NULL, resource_type text NOT NULL,
  resource_id text, details jsonb NOT NULL DEFAULT '{}',
  happened_at timestamptz NOT NULL DEFAULT now()
);
```

**Migration guidance:** do not assume `vector` with mixed dimensions can share one arbitrary HNSW index. Use dimension-aware strategy and enforce dimensions. Treat above as a foundational *illustrative* migration: production must add users, RBAC grants, sessions, lifecycle metadata, row security strategy, quotas, execution events, schedules, secrets key references, retention, document versions and appropriate indexes. Migrations must be forward-only, idempotence-tested where feasible, transactional and recoverable by backup/restore; do not reset existing databases.

### 8.3 REST and streaming API inventory

| Verb / path | Action | Authorization |
|---|---|---|
| GET `/v1/studio/apps` | Search/list paginated cards | workspace viewer |
| POST `/v1/workflows` | Create durable draft | editor |
| GET `/v1/workflows/:id` | Get graph + revision + settings | viewer |
| PATCH `/v1/workflows/:id/draft` | Optimistic update of draft | editor |
| POST `/v1/workflows/:id/validate` | Compile and return diagnostics | editor |
| POST `/v1/workflows/:id/publish` | Immutable version | publisher |
| GET `/v1/workflows/:id/versions` | Versions and diffs | viewer |
| POST `/v1/workflows/:id/activate` | Activate published version | operator |
| POST `/v1/workflows/:id/runs` | Create manual run | executor |
| GET `/v1/executions/:id` | Run details and node timeline | viewer |
| GET `/v1/executions/:id/events` | Server-sent events | viewer |
| POST `/v1/executions/:id/cancel` | Request cancel | operator |
| POST `/v1/executions/:id/retry` | Safe retry policy | operator |
| GET `/v1/nodes/catalog` | Catalog with field schemas | viewer |
| GET `/v1/models` | Model listing and capability metadata | viewer |
| POST `/v1/models/test` | Connectivity + sample inference | model admin |
| POST `/v1/knowledge-bases` | Create KB | knowledge editor |
| POST `/v1/knowledge-bases/:id/documents` | Signed/uploaded ingest request | knowledge editor |
| POST `/v1/knowledge-bases/:id/search` | Test retrieval with citations | viewer |
| POST `/v1/chat/:appId/messages` | Chat with streamed tokens | authorized app user |
| POST `/v1/webhooks/:publicToken` | Trigger, verified auth and signature | configured invocation |
| GET `/v1/operations/health` | Dependency and worker status | operations |

Use OpenAPI-generated TypeScript clients and strict request/response schemas. Never include secret bodies in GET responses. Apply workspace filters server-side, not only in frontend queries. Use API versioning, rate limits and trace IDs. Never leak whether IDs exist in other workspaces.

### 8.4 Original NestJS workflow controller example

```ts
import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';

@Controller('/v1/workflows')
export class WorkflowController {
  constructor(private readonly service: WorkflowService) {}

  @Get(':id')
  get(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.service.getAuthorized(req.principal, id);
  }

  @Patch(':id/draft')
  saveDraft(@Req() req: AuthedRequest, @Param('id') id: string,
    @Body() dto: { baseRevision: number; graph: unknown }) {
    return this.service.saveDraft(req.principal, id, dto);
  }

  @Post(':id/publish')
  publish(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.service.publishValidated(req.principal, id);
  }
}
```

Required unshown imports `WorkflowService`, `AuthedRequest` belong to app-specific modules; this is a contract illustration, not drop-in compilable code. In actual implementation use class-validator/Zod pipe, auth guard, permission guard, no `any`, error normalization and integration tests.

### 8.5 Atomic draft write / optimistic concurrency

```sql
UPDATE workflows
SET draft_graph = $3::jsonb,
    draft_revision = draft_revision + 1,
    updated_at = now()
WHERE id = $1 AND workspace_id = $4 AND draft_revision = $2
RETURNING draft_revision;
```

Rows updated=0 means forbidden/missing/conflict (differentiate via secure authorized read). Publishing must validate graph, calculate checksum and write version + published pointer in one transaction. Activating triggers must be serialized and idempotent.

## 9. Durable execution engine

### 9.1 Execution state machines

**Workflow run:** `CREATED → QUEUED → RUNNING → SUCCEEDED | FAILED | CANCELLED`; also `WAITING` for durable timers/approvals and `COMPENSATING` for approved rollback strategy. State transitions monotonic unless explicit retry creates a new attempt. Server restart must restore queued/running leased work safely without duplicating unsafe external effects.

**Node attempt:** `PENDING → READY → RUNNING → SUCCEEDED | FAILED | SKIPPED | CANCELLED | WAITING`. Every attempt has timestamps, inputs/outputs reference, safe error and metrics. Partial output streams are event records, not commitment of node success.

### 9.2 Compiler / scheduler algorithm

1. Load immutable version and workspace context; enforce execution authorization, quotas and trigger entitlement.
2. Validate node type versions, port types, credentials, required parameters, unknown plugins, unreachable nodes, edge uniqueness, graph cycles and branch joins.
3. Compute graph/branch dependencies and execution plan; define consistent item/batch semantics.
4. Persist run with idempotency key and enqueue transactionally (outbox pattern).
5. Worker leases runnable nodes with bounded concurrency. Resolve and decrypt only credentials needed for the node at execution time.
6. Evaluate expressions against context with a safe AST interpreter; enforce size/time constraints.
7. Execute through node-specific adapter with `AbortSignal` and per-node timeout, store encrypted/blob payloads by reference.
8. Atomically commit node result, emitted events and downstream readiness; publish event notifications after DB commit.
9. For failure: configured retry with jitter, error edge, compensation, dead letter or terminal failure. Prevent auto-retry of non-idempotent writes without policy.
10. On completion: finalize outputs and metrics, update run status, issue durable completion event and retention schedule.

**Never run entire long-lived workflows only in memory**. Redis/BullMQ coordinates jobs but PostgreSQL (and durable object storage) records truth. Avoid holding open DB transaction during external HTTP or model calls. Add heartbeat, lease expiry, deterministic resumption and safe cancellation.

### 9.3 Original minimal orchestration pseudocode

```ts
async function executeReadyNode(task: ReadyNodeTask) {
  const lease = await repository.acquireNodeLease(task); // fencing token
  if (!lease) return;
  const definition = registry.resolve(task.nodeType, task.nodeTypeVersion);
  const controller = new AbortController();
  try {
    const inputs = await payloadStore.loadAuthorizedInputs(task);
    const params = await expressionResolver.resolve(task, inputs);
    const result = await withDeadline(
      definition.execute(buildRuntimeContext(task, controller.signal), inputs, params),
      task.timeoutMs, controller,
    );
    await repository.commitNodeSuccessAndOutbox(task, lease.fencingToken, result);
  } catch (error) {
    await repository.commitNodeFailureAndRetryPolicy(
      task, lease.fencingToken, redactError(error),
    );
  } finally {
    controller.abort();
  }
}
```

**Implementation notes:** all referenced helpers must be concretely implemented and tested; this code intentionally illustrates transaction boundaries only. Use compare-and-swap fencing tokens to reject zombie workers. Define side-effect handling and idempotency before enabling automatic retries.

### 9.4 Live run event protocol

Events: `run.created`, `run.started`, `node.started`, `node.progress`, `node.stream`, `node.succeeded`, `node.failed`, `run.waiting`, `run.completed`, `run.failed`. Each has `{eventId, executionId, nodeId?, timestamp, sequence, payloadSummary}`. SSE must support `Last-Event-ID`, replay of persisted event history, permission checks, reconnect and bounded payloads. WebSockets may supplement but don't replace durable event storage.

### 9.5 Retry, concurrency and policy controls

Per-workspace queue limits; per-connector provider rate limit; per-model token/requests rate limits; exponential backoff/jitter; circuit breakers; DLQ replay permission; per-run time and token budgets; global kill switch. Implement schedule dedupe (DST/timezones, overlap strategies), webhook signature verification, error paths and abuse protection. Capture `correlationId` across API/queue/worker/AI calls.

## 10. Model registry and AI gateway

### 10.1 Provider interface

Support OpenAI-compatible REST endpoint first. Config includes: provider type, display name, base URL, model ID, capability flags (chat, completion, embeddings, reranking, vision, audio, streaming, tools, JSON mode), context window, max output, batching, timeout, retries, concurrency, pricing (optional), health status and workspace visibility. Never infer capabilities only from model names; support administrator override and handshake tests.

```ts
export type ModelCapabilities = {
  chat: boolean; streaming: boolean; toolCalling: boolean;
  vision: boolean; embeddings: boolean; reranking: boolean;
  audioInput: boolean; audioOutput: boolean; jsonSchema: boolean;
};
export interface ModelAdapter {
  id: string;
  capabilities: ModelCapabilities;
  complete(request: ModelRequest, signal: AbortSignal): Promise<ModelResponse>;
  stream?(request: ModelRequest, signal: AbortSignal): AsyncIterable<ModelChunk>;
  embed?(texts: string[], signal: AbortSignal): Promise<number[][]>;
}
```

Implement `ModelRequest`, `ModelResponse`, `ModelChunk` as strict shared contracts including messages, tool schema, response format, token metadata and error codes. Capture request IDs, latency, token consumption and retries in usage store; redact prompts based on configured privacy policy. A fallback only selects models that meet required capabilities and data-residency constraints.

### 10.2 Offline/on-premise local model compatibility

Provide a configurable OpenAI-compatible local gateway for vLLM, LiteLLM or other compatible server. Keep URLs and model IDs configurable, never hardcode machine IPs or usernames. Support separate endpoints for chat, embeddings, reranking, OCR, STT and TTS; not all tasks implement the same API contract. A local provider health-test page must show endpoint, TLS, model list, tools, vision and streaming checks with precise actionable errors. Protect internal models with service tokens/network policy and configurable timeouts.

### 10.3 LLM node behaviors

Message builder: system/developer/user/tool messages as permitted by adapter; variables; chat history; images/files; JSON schema; max output; temperature/top-p where supported; reasoning settings where supported; tool invocation and usage reports. Validation must check requested capability against model. Tool calls are logged as steps with tool name, schema-validated arguments, start/end, approval and sanitized result. The model cannot gain access to arbitrary tools automatically.

### 10.4 Agent engine

Agent configs: instructions, model, tool allowlist, KB bindings, memory policy, maximum iterations, maximum cost/time, optional approvals, structured final output and input/output guardrails. Agent runs as a node with structured child-step trace. A `tool-call` creates a typed child execution and may invoke a workflow or MCP server. Agent action policy must prohibit unapproved writes or external calls. Support handoff to human and resumable approval, tool errors, refusal/fallback and hallucination-minimizing citation mode.

### 10.5 Prompt Studio

Versioned prompts, parameter templates, test dataset, compare model versions, response diff, token/cost/latency, JSON validity and scoring rubric. Include preview/run directly on selected prompt and promote to node only via approved version pin. Changing a prompt should not silently change the published workflow unless explicitly configured to follow the latest approved prompt.

## 11. Knowledge base / RAG end-to-end

### 11.1 Lifecycle

`Upload → MIME/virus check → extract → OCR if necessary → normalize → chunk → embed → index → quality check → publish`. Every stage has progress/error/retry, file hash for deduplication, ownership and metadata (file, page, headings, timestamps and ACL). Retain original file securely subject to retention policy.

### 11.2 Supported modes

- Quick KB: upload files, choose embedding model and default chunk policy.
- Advanced KB: configurable ingestion pipeline with visual steps (parser, metadata extractor, OCR, splitter, language detection, filter, embed, index).
- Retrieval playground: submit question, inspect top chunks, scores, search method, reranker results and citations.
- KB versioning / refresh: replace document without losing lineage; re-embed only affected chunks; full model migration includes reindex and verification.
- Query-time authorization: filter results by workspace, document ACL and publishing permissions before returning snippets to the model.

### 11.3 Retrieval flow

`Query → normalize → query embedding → workspace/ACL filter → dense/keyword candidates → configurable fusion → reranker → token-aware context packing → LLM response with citations`. Keep citation mapping through to final answer; don't fabricate a page for documents lacking page metadata. If no suitable source exists, return uncertain/not found, not falsely sourced statements.

### 11.4 Embedding dimensions and model changes

Collection metadata must store embedding model identity, dimensions and pipeline revision. Reject mismatched vectors, show migration wizard and support controlled reindex from original documents. Separate search and source storage; do not change production retrieval semantics silently.

## 12. Integration and connector framework

Each connector declares auth type (API key, bearer, OAuth2, client credentials, basic for permitted systems), allowed network destinations, input/output fields, pagination strategy, rate limits, test connection, retries and credential rotation. Connector execution should be an independent node package through the node SDK; no direct UI-specific integrations.

Prioritized families: HTTP/OpenAPI, webhooks, Postgres/SQL Server, SMTP/IMAP, S3/SFTP, filesystem (sandboxed), Redis/RabbitMQ/Kafka, Slack/Teams and enterprise integrations authorized by admins. Offline installations show which connectors are installed and which need internet/external infrastructure, never a deceptive 'supported' badge for unusable connectors.

### 12.1 MCP support

MCP client registry with transport, auth, server trust classification, tool/schema discovery, timeouts and individual tool allowlists. Tool metadata is untrusted; prompt injection and output tampering controls apply. Approval required for privileged capabilities. MCP server capability for exposing approved OrchAI workflows/tools with traceable service access. Track protocol versions and version compatibility explicitly.

### 12.2 Secrets

Encrypt with authenticated encryption + managed key/rotation; avoid encrypting with a hardcoded application secret; per-workspace access control; never log raw values; credential test endpoint returns status, not secret. Use secret manager references where available. On migration and restore, preserve key identity and enable secure re-key procedures.

## 13. Templates, importing and exporting

Native export `.orchai.json` contains schema version, graph, node manifest references and nonsecret settings; optional sanitized sample payloads. Import validates node availability and displays a mapping wizard for model IDs, credentials, KB IDs and integrations. Missing node types are clearly flagged and do not produce half-executable flows.

**n8n/Dify importing:** separate opt-in adapters with an explicit compatibility matrix and user-owned authorized export files only. Importing layout/metadata is not equivalent to execution compatibility. Unknown node/feature support must be reported. License review applies. Tests: dozens of fixture samples, roundtrip structural invariants, representative semantic executions, credential mapping and rejection of malformed input. Never include original n8n/Dify UI or runtime code by default.

## 14. Security, isolation and reliability controls

### 14.1 Authentication and authorization

OIDC-based login for enterprises; local bootstrap admin only if configured, force password rotation; MFA where supported; RBAC actions `view/edit/publish/execute/manage_credentials/manage_models/manage_members/admin`. Checks on **every** route and event stream. Workspace ID in JWT is not accepted without current membership check. Audit all secret, permission and publication changes.

### 14.2 Runtime security

- Network egress deny-by-default for high-risk nodes and configurable allowlists for local subnet/internet.
- Prevent SSRF to cloud metadata and internal admin addresses unless explicitly granted.
- Sandboxed code execution via isolated worker/container/process with resource caps; no unrestricted `child_process` or filesystem access.
- Limit document uploads by MIME, maximum bytes, archive expansion and antivirus policy.
- Encrypt sensitive execution payloads and provide explicit run-data retention controls.
- Sanitize HTML/Markdown displayed in logs, AI outputs and node labels (XSS defense).
- Deny cross-workspace node references, KB retrieval and credentials.
- Human approval for high-impact actions and external side effects.
- Audit raw failure causes privately; present sanitized error messages to normal users.

### 14.3 Observability

OpenTelemetry spans across frontend request, API, queue, worker and model. Collect metrics: active runs, queue lag, success/failure, node latency, model errors, token usage, indexing health, worker heartbeats, DB connections, SSE clients. Logs with request/trace/run IDs. Maintain alert thresholds and operator-friendly diagnostics, not a featureless 'healthy' icon.

### 14.4 Operational resilience

Health probes readiness vs liveness; graceful worker shutdown; migration concurrency lock; scheduled encrypted backups; documented restore drills; workflow checkpoint/resume; lifecycle-safe retention; safe upgrade rollback with schema compatibility checks; controlled disk space; single logical source of truth. Never treat deletion/reinstallation of application files as permission to reset production settings or tenant data.

## 15. Deployment Center and offline operational experience

Build an actual admin Deployment Center (not merely an upload field): current app version/build, DB migration version, worker versions, model endpoints, installed node packages, environment flags (without showing secrets), storage path, path ownership, free space, service states and one-click test connections. Admin can set package staging path during setup instead of assuming `/home/atlas` or any username.

Offline packaging: assemble full release and lockfiles/downloaded dependencies where licenses allow; signed manifest with SHA-256; verify package size and files before offering download; progress and final file path; permission checks, disk-space checks, installer dry run, rollback/safe backup. No fake progress or empty 218KB 'full package'. Support isolated acceptance testing without touching existing deployments. Profile directory sizes only while file explorer is open, stream partial totals then final confirmed total; cancellation on close.

## 16. Delivery plan with vertical slices

### Milestone 0 — Baseline audit and foundation (P0)

**Goal:** stop building on a broken prototype. Inspect existing OrchAI source, build/test failures, current DB and dependency graph. Capture before screenshots. Audit n8n/Dify pinned code, features, interaction patterns and licensing. Write architecture decision records. Define shared design tokens and contracts. Establish CI and backup/migration baseline. **Exit:** clean boot, zero build errors, verified audit and working health endpoint.

### Milestone 1 — Dify-inspired Studio home + true persistence (P0)

Implement studio navigation, workflow cards, search, filters, favorites, templates placeholder only where clearly disabled, create wizard, durable draft CRUD, restore, permissions and tests. **Exit:** create → list → reload → open existing draft works reliably with DB.

### Milestone 2 — Replace workflow editor foundation (P0)

Implement native React Flow canvas, node registry, add/search, ports, connect, delete, drag, zoom, minimap, undo/redo, keyboard, autosave, revision conflicts, publish validation and dark/light. **Exit:** 30+ nodes editable fluidly, no disappearing connections, reload preserves positions and configuration, Playwright screenshot diff passes.

### Milestone 3 — n8n-style three-pane node workbench (P0)

Implement double-click open, Input/Parameters/Output, node forms from schema, credential selector, expression editor, JSON/table viewer and run selector. All node parameter edits saved. **Exit:** create HTTP node → configure → close/reopen → execute → see actual input/output and error.

### Milestone 4 — Durable execution foundation (P0)

Manual/webhook/scheduled start, control/data nodes, queue workers, run events, execution inspector, retry, timeout, stop, snapshots and restart recovery. **Exit:** 100 workflow test runs incl failures/retries plus resume after service restart.

### Milestone 5 — Dify-grade AI foundation (P0)

Model registry, OpenAI-compatible local inference, stream token output, prompt nodes, chatflow UI, agent with guarded tools, embeddings, basic KB pipeline, retrieval and real citations. **Exit:** upload PDF → index → ask → source-cited answer; agent invokes approved tool; all steps traced.

### Milestone 6 — Advanced AI and integrations (P1)

Hybrid retrieval/rerank, OCR, STT/TTS/vision, MCP, prompt IDE, advanced agent loops, human approval, knowledge pipeline, advanced expressions and enterprise connectors. **Exit:** each capability demonstrated using a genuinely connected local service and production-safe policies.

### Milestone 7 — Enterprise / production hardening (P1)

SSO, RBAC and sharing, tenant isolation tests, audit, governance, quota/cost, backup/restore, monitoring, rate limits, offline package, deployment center, security QA and load tests. **Exit:** signed runbooks, regression suite and install/upgrade on clean and existing DB.

**Priority rule:** P0 build/install/security/DB integrity blockers outrank new features. Deliver substantial cumulative releases, not small cosmetic patches. Every release retains earlier working features and migrates existing data safely.

## 17. Acceptance and QA matrix

### 17.1 Required end-to-end scenarios

1. Fresh account enters Studio; create flow; card appears immediately; reload and open exact saved graph.
2. Search/filter workflows; click card; double-click node and view fully functional three panes.
3. Add trigger→HTTP→condition→LLM→response, validate, save, publish and run; see accurate live path.
4. Wrong node connection gives actionable error and does not persist corrupt graph.
5. Workflow reopens and preserves node positions, zoom, tags, fields and valid connections.
6. Run fails on HTTP timeout; failed node shows cause, attempts and safe retry, not a spinner.
7. Two users edit same draft; stale save shows explicit conflict and does not silently overwrite.
8. Restart worker during long run; execution resumes or safely recovers with correct status.
9. Import document; process and embed; retrieve authorized chunks; answer with valid citations.
10. Configure offline OpenAI-compatible model; test chat + streaming + tool calling based on real capability.
11. Agent tries denied tool; backend blocks and audits it regardless of frontend state.
12. Viewer from Workspace A cannot read Workspace B's graph, embeddings, secrets or SSE.
13. Activate cron in configured timezone, test DST and disabled state, prevent double fire.
14. Navigate at 1366×768, 1920×1080, dark/light and Arabic; no clipping or inaccessible controls.
15. Archive/delete/restore workflow with clear confirmation, retention semantics and audit.
16. Apply upgrade against existing DB with tenant data/settings preserved; rollback runbook validated.
17. Offline installation works from verified complete bundle without hidden internet calls.
18. Template cloning reports missing node implementations and credentials accurately.
19. High-volume canvas and event stream remain usable under load and show bounded payloads.
20. User-facing errors include remediation, correlation ID and accessible recovery action.

### 17.2 Automated tests

- Unit: graph validator, expression AST, node SDK, credential policy, scheduling, safe errors, RAG citations.
- Integration: transaction/version, queue/outbox, model adapter streaming, RAG ingestion, authorization, SSE replay.
- Playwright: Studio onboarding, canvas interactions, workbench, state retention, dark/light, viewport, keyboard and publish/run.
- Property-based: random valid/invalid DAGs, deterministic validation and serialized roundtrip.
- Load: 500-node graph rendering target established by baseline; 100+ concurrent runs in measured environment; queue backlog and memory profiling. Targets must be based on actual hardware and documented, not asserted blindly.
- Security: cross-tenant IDOR, injection/XSS, SSRF, malicious docs, secret leaks, unsafe Code node, privilege escalation.
- Upgrade: migrated existing DB, interrupted migration recovery, backup/restore and service restart.

## 18. Definition of Done — hard gate

A feature is **DONE** only if all are true:

- User can discover it naturally in navigation and understand the state.
- UI performs real API calls with loading/empty/error/success states.
- Backend validates authorization and input.
- Data persists appropriately and survives restart.
- Runtime actually performs the intended capability (or function is appropriately disabled and not counted as done).
- Telemetry and comprehensible error handling exist.
- Unit/integration/E2E tests cover happy path and representative failure.
- Both themes and principal viewport sizes visually reviewed.
- User documentation and change log updated.
- No regression to previously working capabilities; CI green.

**Never deliver a screenshot-only or UI-only simulation as completed.** Never call static mock execution 'execution'. Never claim parity with n8n or Dify based merely on a list of similar node titles.

## 19. Agent implementation instructions / cut-and-paste master prompt

> You are the lead engineer of **OrchAI**, a new enterprise-grade unified AI and workflow orchestration product. Before coding, inspect the existing repository, installed environment, database schema, current build issues and current UI. Then inspect pinned GitHub revisions of n8n (`n8n-io/n8n`) and Dify (`langgenius/dify`) with special focus on Dify's Studio app home, AI/knowledge/agent features, and n8n's editor canvas, node picker, node details INPUT/PARAMETERS/OUTPUT interaction, execution debugging and automation patterns. Record concrete source file paths, components and relevant behaviors in an upstream audit. Respect each license and build an original OrchAI implementation; do not indiscriminately copy protected code or UI assets and do not ship n8n/Dify embedded as hidden runtimes.
>
> Implement a single TypeScript React/Vite frontend, NestJS backend, PostgreSQL + pgvector, Redis/BullMQ worker architecture with shared typed contracts. Prioritize **Dify-style cards/dashboard**, then **a completely redesigned n8n-quality graph canvas**, then **real three-pane node inspector**, then **backend execution end to end**, then **Dify-quality models, chatflows, agent tools, knowledge, embeddings and RAG**. Expand to advanced triggers, integrations, MCP, OCR, vision, STT/TTS, governance, evaluation and monitoring.
>
> Fix shared design problems at their root instead of patching a fundamentally broken workflow editor. Nodes must be truly connectable, executable and debuggable. Every node has metadata, inputs/outputs, configuration, backend execution and actual run I/O. Never count mockups as completed features. Confirm previous capabilities remain intact. Run install, typecheck, lint, unit tests, integration tests, Playwright flows and production build. Apply safe additive DB migrations; preserve existing settings, tenant data and credentials. Provide a cumulative release with a machine-readable feature parity report, screenshots, clear remaining limitations and setup/upgrade documentation. Favor substantial finished vertical slices over many tiny partial releases.

## 20. Additional next-phase refinements

### 20.1 Advanced workbench experiences

Node type 'HTTP' should have guided tabs for auth, params, query, headers, body, redirect, timeout, retries and pagination; live curl preview with secrets hidden; response code/body inspector and trace. LLM node should have model dropdown, provider badges, capability checks, system/user prompt editors, attachments, variable browser, tools, response schema, sampler settings and stream preview. KB retrieval node should show which index/model is used, topK, threshold, filter and rerank controls and source results side by side. Approval node should show assignee, reason, expiry, web/email action and operator audit.

### 20.2 Professional Dify-inspired application hub

Include interactive templates (not decorative thumbnails): `Document Q&A`, `Customer Support Agent`, `Incident Summary`, `Daily Email Digest`, `Webhook API Automation`, `Data Enrichment`, `Research Assistant`, `Approval Flow`, `Knowledge Ingestion`, `Multimodal Assistant`. Each template declares required models, permissions, credentials, knowledge base and nodes; instantiating checks readiness and clearly lists setup tasks. Show actual sample input/output using sandbox fixtures, never invoke external write actions while previewing.

### 20.3 Good editor behavior under failure

If node schema cannot load, keep canvas visible with error boundary and recover/retry. If SSE disconnects, show reconnecting with event replay and run remains available. If model is offline, the AI node displays a specific local endpoint health problem and alternative allowed endpoints. If a connected account expires, show credentials need renewal and stop dependent runs safely. If file ingestion fails, preserve input file and allow retry from failed stage. If save collides, retain local draft in memory and offer conflict resolution; never silently drop edits.

### 20.4 Collaboration and versions

Comments linked to node IDs and workflow revision; presence of other editors, optional optimistic locking rather than premature complex real-time CRDT collaboration; review and publish approval; version diff of node parameters/edges and rollback; environment promotion dev→test→prod with model/credential mapping. Published flows are immutable and executions permanently identify the exact version and configuration lineage.

### 20.5 Agent/RAG operational safeguards

Tool allowlists by role/workspace; admin approval for connectors accessing private networks; prompt-injection-safe retrieval strategy; citations trace back to document versions/chunks; relevance thresholds; PII redaction; controlled memory retention; token/cost quotas; refusal/unknown when no sufficient evidence; evaluate and regression-test changes to prompts or embedding models. Human reviewers can see step-by-step plan, tool calls, evidence and reason for approval requests.

## 21. Required release notes format

For each cumulative release provide:

```markdown
# OrchAI Release X.Y.Z
## Summary: completed vertical slices
## Upstream source review: pinned commits and file evidence
## New functions (links to code/tests)
## Fixed defects and underlying causes
## Data migrations and rollback
## New/changed API contracts
## UI screenshots: desktop light/dark, node workbench, mobile
## Test evidence: install/typecheck/lint/unit/integration/E2E/build
## Feature parity: working/tested/blocked by module
## Known limitations, security caveats and next priorities
## Upgrade instructions for existing installations
```

## 22. Source attribution / review notes

Public upstream primary repositories reviewed at the repository overview and available documentation level as of document preparation:

- https://github.com/n8n-io/n8n — source-available automation platform, visual editor, integrations and native AI positioning.
- https://github.com/langgenius/dify — application/workflow studio, AI model integration, RAG, agent, knowledge and observability positioning.
- https://github.com/n8n-io/n8n-docs/blob/main/docs/n8n-community-license/README.md — Sustainable Use License explanations.
- https://github.com/langgenius/dify/blob/main/LICENSE — Dify modified Apache-based license and conditions.

**Scope honesty:** This artifact is an original, detailed engineering specification plus illustrative implementation code. It is **not** a claim that every source file in the two very large repositories was downloaded or line-by-line audited in this session. The implementing engineer must complete the pinned-commit source audit in §1 before copying or adapting implementation details. Some reference snippets deliberately omit surrounding concrete services, DI registration and imports; they are starting contracts, not a verified fully built executable application.

---

# PART II — MANDATORY NODE EXPERIENCE, LIVE DATA MAPPING, FORMS, TRIGGERS AND CONNECTIONS

**Version 1.1 extension, 2026-10-16. P0 PRIORITY.** This entire part is a binding expansion of the master specification above. Implement it ahead of additional decorative screens, catalog expansion or secondary AI features. A canvas with boxes and lines but no working per-node configuration, prior-step output explorer, live execution, or mapping is NOT a workflow builder.

## 23. Source-level findings and exact upstream inspection targets

The following repository files were fetched and inspected directly through GitHub on 2026-10-16 (blob SHAs identify the files read, not a comprehensive pinned-repository audit):

| Component | Upstream file | Blob SHA / observation |
|---|---|---|
| n8n schedule | [`ScheduleTrigger.node.ts`](https://github.com/n8n-io/n8n/blob/master/packages/nodes-base/nodes/Schedule/ScheduleTrigger.node.ts) | `44c3042c87442d1f36238426b8170ed492ea1a1a`: node-defined `fixedCollection` trigger rules; seconds/minutes/hours/days/weeks/months/custom cron; conditional config; schedule lifecycle |
| n8n inbound webhook | [`Webhook.node.ts`](https://github.com/n8n-io/n8n/blob/master/packages/nodes-base/nodes/Webhook/Webhook.node.ts) | `705f34e200da43f971f88c57c98c725b0670a645`: test/production URL modes; HTTP verbs; auth; response modes; output JSON `headers`, `params`, `query`, `body`; binary handling |
| n8n form trigger | [`FormTriggerV2.node.ts`](https://github.com/n8n-io/n8n/blob/master/packages/nodes-base/nodes/Form/v2/FormTriggerV2.node.ts) | `e3e854c89cf5a1696ebbdfb32855f877312d01a1`: GET to render form, POST to submit, distinct response modes, user-configurable fields, form URL, credential and sensitive field handling |
| Dify HTTP node | [`web/.../nodes/http/types.ts`](https://github.com/langgenius/dify/blob/main/web/app/components/workflow/nodes/http/types.ts) | `6d89b7fa0187ff419ef14132f2c4ce7d1ab577cd`: methods, body modes, authorization variants, parameter/headers, file variables, timeout, SSL verify |

Also inspect these primary code/documentation pathways during implementation: [n8n node UI elements and data paths](https://github.com/n8n-io/n8n-docs/blob/main/docs/connect/create-nodes/build-your-node/reference/node-ui-elements.md), [n8n UI mapper](https://github.com/n8n-io/n8n-docs/blob/main/docs/build/work-with-data/reference-data/use-the-ui-mapper.md), [n8n node authoring guidance](https://github.com/n8n-io/n8n/blob/master/packages/nodes-base/AGENTS.md), [n8n form continuation](https://github.com/n8n-io/n8n/blob/master/packages/nodes-base/nodes/Form/Form.node.ts), [n8n webhook routing](https://github.com/n8n-io/n8n/blob/master/packages/cli/src/webhooks/webhook-helpers.ts), and [Dify's schedule trigger documentation](https://github.com/langgenius/dify-docs/blob/main/en/cloud/use-dify/nodes/trigger/schedule-trigger.mdx).

**Key distinction:** These are confirmed source examples and inspection targets; precise Vue component locations of n8n's live data mapper were not verified by this extension. Find and inspect those actual editor components before finalizing UX. Do not pass off approximate code as an exact copy of the upstream implementation. Respect source licenses; implement independent original code.

## 24. The foundation: each node type has a different real configuration UI

**There is no universal 'Node name / Description / JSON' properties dialog.** Every node type declares its own versioned schema, category, icon, credentials, input/output ports, options, validation, output typing, trigger lifecycle and executable handler. The editor interprets this schema consistently while permitting specialized views.

### 24.1 Versioned node definition contract (original TypeScript)

```ts
// packages/contracts/src/nodes.ts
export type DataType = 'any'|'string'|'number'|'boolean'|'object'|'array'|'file'|'binary'|'date'|'chat-message';
export type FieldKind =
  | 'text'|'textarea'|'number'|'toggle'|'select'|'multi-select'|'secret'
  | 'code'|'json'|'expression'|'template'|'file'|'date-time'|'time-zone'
  | 'key-value'|'collection'|'fixed-collection'|'resource-locator'
  | 'model-selector'|'credential-selector'|'prompt-editor'|'schema-editor'
  | 'form-builder'|'cron-builder'|'condition-builder'|'sql-editor';
export type ValueMode = 'fixed'|'expression';
export interface NodePort { id:string; label:string; type:DataType; multiple?:boolean; required?:boolean; }
export interface Option { label:string; value:string|number|boolean; description?:string; }
export interface FieldCondition {
  field:string; operator:'eq'|'ne'|'in'|'present'; value?:unknown;
}
export interface ConfigField {
  key:string; label:string; kind:FieldKind; required?:boolean; defaultValue?:unknown;
  description?:string; placeholder?:string; group?:string; order?:number;
  options?:Option[]; optionSource?:{service:string; operation:string; credentialKey?:string};
  showWhen?:FieldCondition[]; hideWhen?:FieldCondition[];
  itemFields?:ConfigField[]; min?:number; max?:number; pattern?:string;
  acceptsExpression?:boolean; acceptsDrop?:boolean; inputTypes?:DataType[];
  sensitive?:boolean; allowMultiple?:boolean; helpUrl?:string;
}
export interface NodeDefinition {
  type:string; version:number; name:string; subtitle?:string; description:string;
  category:'trigger'|'action'|'flow'|'data'|'ai'|'knowledge'|'integration'|'human';
  icon:string; colorToken:string; tags:string[];
  inputs:NodePort[]; outputs:NodePort[];
  fields:ConfigField[];
  operations?:{id:string; label:string; fields:ConfigField[]; outputs?:NodePort[]}[];
  credentialTypes?:string[];
  supportsPartialExecution:boolean; supportsPinning:boolean; supportsStreaming?:boolean;
  outputSchema?:JsonSchema; inputSchema?:JsonSchema;
  handlerKey:string; // registered server implementation; never arbitrary user-supplied module path
}
export type JsonSchema = Record<string,unknown>;
export type ValueBinding =
  | {mode:'fixed'; value:unknown}
  | {mode:'expression'; expression:ExpressionAst; fallback?:unknown};
export interface ExpressionAst {
  kind:'reference'; nodeId:string; outputPort:string; path:string; itemMode:'current'|'first'|'all';
}
export interface WorkflowNode {
  id:string; type:string; version:number; position:{x:number;y:number};
  config:Record<string,unknown|ValueBinding>;
  disabled?:boolean; retryPolicy?:{maxAttempts:number; backoffMs:number};
}
```

### 24.2 Schema-to-form renderer rules

1. **Identity and operation:** Header contains logo, node type, editable display name, short explanation. Integration nodes show `Resource` and `Operation` first. Operation changes field sets and sometimes outputs/ports.
2. **Dynamic fields:** `showWhen` / `hideWhen` recompute immediately when operation, resource, body type, authentication, model provider, etc. change. Preserve hidden values safely if toggling back, but do not submit irrelevant fields.
3. **Real widget types:** Proper dropdowns, async searchable selectors, model pickers, text editors, syntax-highlighted JSON/code/SQL, file mapping, headers/body key-value rows, boolean toggles, date/time controls, nested repeated fields, condition rules, tool selection and prompt template editors.
4. **Field-level mapping:** Every mapping-capable field has **Fixed / Expression** toggle, drag target highlight, type hints, `fx` button, insert variable, clear value, preview, validation and error states.
5. **Credentials:** Select an existing connection or create/test a connection in a secure modal. Never expose stored secret values to frontend responses or sample outputs.
6. **Examples/defaults:** First use is immediately intelligible: sensible placeholders and descriptions, valid default operation, obvious required fields, link to instructions where relevant.
7. **Versions:** A saved node pins `type + version`; schema migrations are explicit, reversible where possible, and tested against old workflows. Version mismatch must never silently change behavior.
8. **Backend parity:** Parameters must be validated server-side with the identical schema rules and executed by a handler registered for the node type/version. No frontend-only controls.

### 24.3 Feature-specific node configuration matrix

| Node type | Distinct UI fields (examples) | Runtime output / behavior |
|---|---|---|
| Manual trigger | optional example input JSON | provided sample payload |
| Schedule trigger | interval/at-time/calendar/cron, timezone, next runs, overlap policy | timestamp, scheduledAt, firedAt, trigger metadata |
| Webhook trigger | method(s), path, test/prod URLs, authentication, response strategy, schema | body/query/params/headers/files; optional response |
| Form trigger | title, description, fields, validation, theme, authentication, submit/thank-you | typed submission values, file references, submitter metadata |
| HTTP request | method, URL, query, headers, auth, content type, body mode, pagination, timeout, TLS | status, headers, JSON/text/binary, pagination data |
| SQL | connection, operation, prepared query, parameter mapping, transaction | rows, count, metadata |
| If / Switch | typed condition builder, branches, operators, AND/OR groups | named true/false or case ports |
| Loop / Split in batches | source array, batch size, iteration bounds, continue criteria | item/currentIndex/done, loop output |
| Merge / Join | mode, key selectors, clash policy, wait behavior | combined items with provenance |
| Set / Edit Fields | field names, types, mappings, keep/remove fields | transformed JSON, item linked to source |
| Transform | JSONPath/JMESPath, expression or safe code sandbox, output schema | transformed typed object |
| AI LLM | provider, credential, model, messages, system prompt, temperature, token budget, structured output, tools | text, structured result, tokens, usage, latency |
| Agent | instruction, tool list, memory, reasoning budget, approval checkpoints, loop limits | final answer, tool traces, state |
| Knowledge retrieve | KB, query mapping, retrieval strategy, filters, rerank, score/count | chunks with citations, relevance score |
| Embedding / Rerank | provider/model, batch settings, input/output | vectors / ordered candidates |
| STT / TTS | language, speech model, input audio, voice, output format | transcript / generated audio |
| Image / Vision | files or image references, model, prompt, detail mode | structured text, image output, usage |
| Email / Chat | connection, recipients, subject, templated body, attachment refs | message id, delivery status |
| Human approval | assignees, timeout, action buttons, form fields, notification | approved/rejected/timeout branch and inputs |
| Delay / Wait | duration/date/resume webhook/expiry | durable suspended/resumed execution |
| Error handler | retry/continue/stop/route, code filters | structured failure details |
| Execute subflow | selected published workflow, inputs, async/sync mode, timeout | validated subflow output |
| Event connector | provider, connection, subscription/webhook, event filters | normalized event and raw payload |

### 24.4 Example: three different node manifests

```ts
const httpRequest: NodeDefinition = {
  type:'core.http', version:1, name:'HTTP Request', description:'Call an HTTP endpoint',
  category:'integration', icon:'globe', colorToken:'blue', tags:['api','web'],
  inputs:[{id:'main',label:'Input',type:'any'}], outputs:[{id:'main',label:'Response',type:'object'}],
  supportsPartialExecution:true, supportsPinning:true, handlerKey:'http/v1', fields:[
    {key:'method',label:'Method',kind:'select',required:true,defaultValue:'GET',options:['GET','POST','PUT','PATCH','DELETE'].map(x=>({label:x,value:x}))},
    {key:'url',label:'URL',kind:'text',required:true,acceptsExpression:true,acceptsDrop:true,inputTypes:['string']},
    {key:'authentication',label:'Authentication',kind:'select',defaultValue:'none',options:[{label:'None',value:'none'},{label:'Connection',value:'connection'}]},
    {key:'connectionId',label:'Connection',kind:'credential-selector',showWhen:[{field:'authentication',operator:'eq',value:'connection'}]},
    {key:'query',label:'Query Parameters',kind:'key-value',acceptsDrop:true},
    {key:'headers',label:'Headers',kind:'key-value',acceptsDrop:true},
    {key:'bodyType',label:'Body Type',kind:'select',defaultValue:'json',options:['json','form-data','x-www-form-urlencoded','raw-text','binary'].map(x=>({label:x,value:x})),showWhen:[{field:'method',operator:'in',value:['POST','PUT','PATCH']}]},
    {key:'body',label:'Body',kind:'json',acceptsExpression:true,acceptsDrop:true,showWhen:[{field:'bodyType',operator:'eq',value:'json'}]},
    {key:'timeoutMs',label:'Timeout (ms)',kind:'number',defaultValue:30000,min:1000,max:300000},
  ]
};
const schedule: NodeDefinition = {
  type:'trigger.schedule',version:1,name:'Schedule Trigger',description:'Start workflow on a schedule',
  category:'trigger',icon:'clock',colorToken:'orange',tags:['time','cron'], inputs:[],
  outputs:[{id:'main',label:'Event',type:'object'}],supportsPartialExecution:true,
  supportsPinning:true,handlerKey:'trigger/schedule/v1',fields:[
    {key:'mode',label:'Schedule mode',kind:'select',defaultValue:'interval',options:[{label:'Every N seconds/minutes/hours',value:'interval'},{label:'Specific date/time',value:'datetime'},{label:'Cron',value:'cron'}]},
    {key:'intervalSeconds',label:'Run every (seconds)',kind:'number',min:10,defaultValue:60,showWhen:[{field:'mode',operator:'eq',value:'interval'}]},
    {key:'timezone',label:'Timezone',kind:'time-zone',required:true,defaultValue:'UTC'},
    {key:'cron',label:'Cron expression',kind:'cron-builder',showWhen:[{field:'mode',operator:'eq',value:'cron'}]},
    {key:'overlap',label:'Overlapping runs',kind:'select',defaultValue:'skip',options:[{label:'Skip',value:'skip'},{label:'Queue',value:'queue'},{label:'Allow',value:'allow'}]},
  ]
};
const llm: NodeDefinition = {
  type:'ai.llm',version:1,name:'LLM',description:'Generate with an AI model',category:'ai',
  icon:'brain',colorToken:'purple',tags:['ai','generation'],
  inputs:[{id:'main',label:'Input',type:'any'}],outputs:[{id:'result',label:'Generation',type:'object'}],
  supportsPartialExecution:true,supportsPinning:true,supportsStreaming:true,handlerKey:'ai/llm/v1',fields:[
    {key:'connectionId',label:'Provider / Connection',kind:'credential-selector',required:true},
    {key:'modelId',label:'Model',kind:'model-selector',required:true},
    {key:'system',label:'System instruction',kind:'prompt-editor',acceptsExpression:true,acceptsDrop:true},
    {key:'prompt',label:'User prompt',kind:'prompt-editor',required:true,acceptsExpression:true,acceptsDrop:true},
    {key:'temperature',label:'Temperature',kind:'number',defaultValue:0.3,min:0,max:2},
    {key:'outputSchema',label:'Structured output',kind:'schema-editor'},
  ]
};
```

**Important:** These schemas are examples, not exhaustive manifests. Deliver concrete schemas/handlers/renderers for every enabled node type, with unit tests and operations as necessary. Compile and typecheck these examples in the real monorepo before declaring them production-ready.

## 25. The critical n8n interaction: execute a step → inspect its output → drag into the next node

### 25.1 Non-negotiable experience

1. Build `Form Trigger → HTTP Request → IF → LLM → Email` in one workflow.
2. Open HTTP Request; n8n-style overlay shows **INPUT | PARAMETERS | OUTPUT**. With no execution, left input shows meaningful empty state and **Execute previous steps**. With cached data, show latest upstream result.
3. Click **Test step**: backend executes the selected node with real accessible predecessor data (or validated pinned sample). Show loading, streaming logs, duration, error, and the resulting items without closing the editor.
4. OUTPUT pane shows **Schema / Table / JSON** tabs, item-count, searchable tree, files/binary metadata and `Copy JSON Path`. Expand nested object/arrays.
5. Open IF node. Left INPUT pane is the *actual output of the previous node*, including response body and metadata. From an expanded field such as `body.customer.email`, **drag the key/value** to IF field on the middle pane. Dropping creates an expression reference bound to a stable node ID and path, e.g. conceptually `node('http-01').output.main[0].body.customer.email`.
6. Expression input displays linked reference chip + live resolved preview (e.g. `user@example.com`). On next real run it uses the **new runtime value**, never the recorded sample. Changing sample data updates preview only.
7. Drag must work across **any earlier accessible node**, not just the adjacent predecessor; allow node picker and cross-branch links where graph semantics make the data available. Show an explicit warning for unsafe/unavailable branches.
8. Support scalar, object, array, file, binary references; incompatible drops show a type warning and offer explicit supported conversion, never silent lossy conversion.
9. Test node again after mapping and visually validate that condition/LLM/email receives the correct value. Save/reload editor and prove the expression persists and resolves during execution.
10. Item linking must preserve origin across filter, fan-out, split, map, join, loop and parallel branches. User can choose first/current/all/selected item and see which item is being previewed.

### 25.2 Internal data model and run record

```ts
// packages/contracts/src/executions.ts
export interface OutputArtifact {
  nodeId:string; portId:string; runId:string; itemIndex:number;
  json:unknown; binary?:Record<string,{artifactId:string;fileName?:string;mimeType:string;size:number}>;
  sourceItems?:{nodeId:string;portId:string;itemIndex:number}[];
  schema?:JsonSchema; createdAt:string; // masked before editor transport
}
export interface NodeRun {
  id:string; workflowRunId:string; workflowVersion:number; nodeId:string;
  status:'queued'|'running'|'succeeded'|'failed'|'skipped'|'cancelled'|'waiting';
  startedAt?:string; finishedAt?:string; durationMs?:number;
  inputArtifactIds:string[]; outputArtifactIds:string[];
  error?:{code:string;message:string;retryable:boolean};
  logs:{at:string;level:'debug'|'info'|'warn'|'error';message:string}[];
}
```

Use **stable node IDs** in mapping AST; show human-readable names in UI. Renaming a node must not break bindings. On delete/duplicate, detect invalid or remapped references. Never evaluate untrusted arbitrary JavaScript using `eval`, `Function`, or direct dynamic execution. Support safe AST/path evaluator, bounded recursion/size/time, type validation and an allowlisted transformation function library.

### 25.3 Original mapping helper (shared runtime; example)

```ts
import type { ExpressionAst, ValueBinding, OutputArtifact } from './contracts';

export function resolveReference(ast:ExpressionAst, outputs:Map<string,OutputArtifact[]>):unknown {
  const candidates=(outputs.get(`${ast.nodeId}:${ast.outputPort}`)??[]);
  if (!candidates.length) throw new Error(`Output not available from ${ast.nodeId}`);
  const selected=ast.itemMode==='all' ? candidates : [ast.itemMode==='first' ? candidates[0] : candidates[candidates.length-1]];
  const values=selected.map(x=>readPointer(x.json, ast.path));
  return ast.itemMode==='all' ? values : values[0];
}
function readPointer(root:unknown,pointer:string):unknown {
  if (pointer==='') return root;
  if (!pointer.startsWith('/')) throw new Error('Expected JSON pointer');
  return pointer.slice(1).split('/').reduce<unknown>((node,token)=>{
    const key=token.replace(/~1/g,'/').replace(/~0/g,'~');
    if (!node || typeof node!=='object' || !Object.prototype.hasOwnProperty.call(node,key))
      throw new Error(`Missing path token: ${key}`);
    return (node as Record<string,unknown>)[key];
  },root);
}
export function resolveBinding(binding:ValueBinding,outputs:Map<string,OutputArtifact[]>):unknown {
  return binding.mode==='fixed' ? binding.value : resolveReference(binding.expression,outputs);
}
```

**Production correction required:** `itemMode:'current'` in the illustrative helper uses the most recent item as a placeholder; the actual production evaluator MUST use *lineage-linked current item* from run context, not the last array member. Include regression tests for multi-item input, branches, loops and merges.

### 25.4 Original React drag source and drop field contracts

```tsx
// DataTreeLeaf.tsx — a fragment integrated with the actual tree component
export function DraggableOutputKey({nodeId,portId,pointer,label}:{
  nodeId:string;portId:string;pointer:string;label:string;
}) {
  const ast={kind:'reference' as const,nodeId,outputPort:portId,path:pointer,itemMode:'current' as const};
  return <span draggable onDragStart={e=>{
    e.dataTransfer.effectAllowed='copy';
    e.dataTransfer.setData('application/x-orchai-reference',JSON.stringify(ast));
    e.dataTransfer.setData('text/plain',label);
  }}>{label}</span>;
}
// DropMappingField.tsx — real implementation must connect to form state and validation
export function DropMappingField({onMap}:{onMap:(binding:ValueBinding)=>void}) {
  return <div role="group" aria-label="Data mapping field"
    onDragOver={e=>{if(e.dataTransfer.types.includes('application/x-orchai-reference'))e.preventDefault();}}
    onDrop={e=>{e.preventDefault();const raw=e.dataTransfer.getData('application/x-orchai-reference');
      if(!raw)return;try{
        const ast=JSON.parse(raw) as ExpressionAst;
        if(ast.kind!=='reference'||!ast.nodeId||!ast.outputPort||typeof ast.path!=='string')return;
        onMap({mode:'expression',expression:ast});
      }catch {/* show accessible error toast in production */}
    }}>Drop previous output here, or click fx to select a variable</div>;
}
```

**Production requirements:** DnD must work with pointer/touch and keyboard accessible alternatives; validate payload provenance and reachable graph context on backend; use safe MIME handling, `aria` announcements, drop target indicators, support multiline expression insertion without overwriting unrelated text, schema auto-completion and masking. Do not claim this 30-line fragment alone creates a full mapper.

### 25.5 UX fidelity checklist

- Panels resize, scroll independently and remember dimensions; entire view is responsive; light/dark device preference and manual override.
- Node modal opens on **double-click** (single click selects), Escape closes, keyboard tab order correct; canvas zoom/pan preserved when closing.
- Left: node INPUT with upstream dropdown, data tabs, `Execute previous nodes`, pin data. Middle: node-specific **Parameters** plus **Settings** tab, authentication, expression and test actions. Right: OUTPUT with JSON/Table/Schema, search, execution history, sample item selector, error diagnostics.
- Show **Test step**, **Execute previous steps**, **Listen for test event**, **Copy test URL**, **Copy production URL** according to node type and state. No fake buttons.
- Distinguish actual run data from manually pinned/test data visually and in run records; prevent production from using pinned data accidentally.
- Redaction and access permissions apply to all incoming/outgoing values and downloaded files.

## 26. Triggers: consistent wizard, diverse implementations

### 26.1 Easy schedule builder and minimum 10-second interval

Provide fast presets: **Every 10 seconds, 30 seconds, minute, 5 minutes, 10 minutes, 15 minutes, 30 minutes, hourly, every N hours, daily at HH:mm, weekdays, weekly, monthly, specified date/time, advanced cron**. Include timezone selector, effective human-readable summary and preview of next five firings. Multiple rules may be supported per trigger with distinct rule IDs. Display publish status and next scheduled time on the node and workflow list.

Seconds-based intervals need a **seconds-aware scheduler**, not a 5-field cron parser that cannot represent 10 seconds. For `*/10 * * * * *`, validate against a 6-field implementation or use durable `intervalSeconds:10`. Never quietly round up to a minute. A once-per-minute poller is insufficient to run jobs every 10 seconds. Schedule workers must be long-lived, coordinate via Postgres/Redis lease, enqueue idempotent events, monitor lag, recover after restart and avoid duplicates. Enforce admin-defined min interval (default 10 sec) and rate/concurrency limits to prevent overload; surface platform restrictions clearly. Define DST behavior, timezone/UTC conversion, misfire policy (`skip`, `catch-up-once`, `catch-up-all` with cap), max lag and overlap policy.

```ts
export type ScheduleRule =
  | {kind:'interval'; everySeconds:number; anchorAt:string; timezone:string}
  | {kind:'cron'; expression:string; timezone:string; secondsEnabled:boolean}
  | {kind:'calendar'; timezone:string; frequency:'daily'|'weekly'|'monthly'; at:'HH:mm'; weekdays?:number[]; monthDays?:number[]};
export interface ScheduleActivation {
  workflowId:string; version:number; ruleId:string; rule:ScheduleRule;
  active:boolean; nextFireAt:string; lastFireAt?:string;
  misfire:'skip'|'catch-up-once'|'catch-up-capped'; overlap:'skip'|'queue'|'allow';
}
// Scheduler tick transaction sketch (SQL): acquire due rows using FOR UPDATE SKIP LOCKED;
// write unique dispatch rows (rule_id, scheduled_at) with ON CONFLICT DO NOTHING;
// enqueue via transactional outbox; compute/store nextFireAt; commit.
```

Use a unique constraint on `(rule_id, scheduled_at)` and transactional outbox so a crash between recording and publishing a queue message cannot drop or duplicate processing invisibly. The queue handler also enforces idempotent run creation. Give scheduler and event-queue tests for rolling deployment, process restart, multiple replicas, clock skew and DST transitions.

### 26.2 Webhook trigger — genuine test and production endpoints

- Generate distinct URLs such as `https://orchai.example.com/hooks/test/{unguessable-token}` and `https://orchai.example.com/hooks/{unguessable-token}`; allow optional custom slug where security policy permits.
- Editable method (GET/POST/PUT/PATCH/DELETE; multiple methods optional), expected content type, auth (`none`, Basic, HMAC signature, API key, verified JWT/OAuth where supported), IP allowlist, max request size, file limits, body schema, response mode, headers, success/error codes and CORS rules.
- **Listen for Test Event** registers ephemeral webhook route with expiry; show waiting status, curl example and latest request. On request, validate credentials/signature and capture masked test body, then execute chosen draft revision; do not require production publish.
- Production endpoint routes only to active published versions, persists route-registration metadata and survives restarts/replicas. Show **Copy URL**, method, active state, received count and last event.
- Response modes: immediate 202/200 with run ID, last-node response with bounded deadline, explicit `Respond to Webhook` node, and streamed response where transport supports it. Waiting for execution must time out safely; do not block indefinitely.
- Normalize the trigger output as `{headers, params, query, body, files, receivedAt, method, requestId}`. Mask `authorization`, `cookie` and credentials; control whether untrusted raw headers are accessible to downstream nodes.
- Support replay of captured test events in draft mode and safe test-only mock payloads; webhook deduplication via `Idempotency-Key` or provider event ID with TTL.

### 26.3 Forms as first-class triggering products

Form builder is **not just a generic web page or JSON box**. A dedicated visual Form Trigger node opens a real form designer, while the resulting submission appears in the same n8n-style INPUT data tree and can be dragged to any next step.

Form controls: short/long text, email, number, phone, date/time, dropdown, multiselect, radio, checkbox, boolean, file/multi-file, hidden, read-only, computed, consent, headings, rich descriptions; required rules, length/regex/range, options, conditional visibility, default values, help text, AR/EN labels and RTL layout. Dynamic option providers require permission and caching. Multi-page form nodes and branching are stretch features; initial single-page must actually work.

Form publication: draft preview, **test URL**, **production URL**, optional authorized custom path, title/description/logo/theme, authenticated/private/public options, anti-spam/rate limits, CAPTCHA option where permitted, file scanning and quotas, accessible responsive controls, customizable submit/success/error state, submission history. Generated HTML endpoint `GET` renders the form; `POST` validates form version and CSRF/session policy where relevant, stores submission and dispatches a workflow run. Also supply JSON API submission where explicitly configured; auth policy cannot be bypassed by switching transport.

**Output example:**

```json
{
  "submissionId":"sub-001",
  "formId":"form-123",
  "formVersion":4,
  "values":{"customerName":"Amina","email":"amina@example.test","priority":"high"},
  "files":[{"field":"attachment","artifactId":"file-789","mimeType":"application/pdf"}],
  "submittedAt":"2026-10-16T08:00:00Z"
}
```

**Demonstration:** publish `Incident Report Form → Classify using LLM → Create incident ticket → Email notification`. Submit actual form, show run, drag `values.email` into Email recipient and `values.priority` into IF. Edit the form later without silently breaking existing published-run schemas; support versioned field IDs and change impact view.

### 26.4 Other trigger families

Manual/on-demand, app chat input, API invocation, file arrival/watch, database change/CDC (provider-dependent), event bus/queue, SaaS polling/webhook, email received/IMAP, subflow invocation, application event, human approval response, system alert, knowledge ingestion completion. Every trigger must implement `activate`, `deactivate`, `testListen`, `normalize`, and `recover` where relevant; its authentication and environment availability must be explicit. External internet should never be a mandatory requirement for on-prem operation.

## 27. Connections and credentials — usable for every node

### 27.1 Dedicated Connections Center

`Settings → Connections` and contextual `Create connection` in any node. Filter by integration, tenant, owner, status, last validated and used-by-workflows. Support API Key, Basic, Bearer, OAuth2 where possible, database connection strings, local model endpoints, SSH, SMTP, file shares, S3-compatible storage, webhook signature verification, and application-specific credentials. Support TLS/certificates/proxy, scopes, connection test, expiry/health, rotate, revoke, change owner, bulk impact analysis, and import/export of **non-secret metadata only**.

Connection records must **reference** secrets encrypted at rest with envelope encryption or external vault integration; secret material must never be returned to the browser or execution log. Values injected only into authorized execution worker, audit every use, prevent cross-org access, restrict outbound destinations and SSRF (block metadata IPs/private ranges unless expressly allowlisted with policy), and test DNS rebinding defenses. Credentials never become normal draggable JSON output.

```ts
export interface ConnectionDescriptor {
 id:string; organizationId:string; provider:string; displayName:string; kind:'api-key'|'oauth2'|'basic'|'database'|'smtp'|'model'|'custom';
 status:'untested'|'healthy'|'invalid'|'expired'|'disabled';
 allowedNodeTypes:string[]; secretRef:string; createdAt:string; lastCheckedAt?:string;
}
export interface ConnectionTestResult { ok:boolean; latencyMs?:number; code:string; safeMessage:string; }
```

### 27.2 Event subscriptions and trigger connections

Distinguish normal **outbound connection** from inbound **trigger subscription**: webhook registration may call the provider, require callback URL and signed verification challenge, hold cursor/checkpoint for polling, and must unregister on unpublish. A connection used by 12 nodes should have a **Used by** list and safe rotation path. If connection fails, explain error without leaking secrets and offer Test/Repair rather than generic `500`.

### 27.3 Connection API

```http
GET    /api/connections?provider=&status=
POST   /api/connections
GET    /api/connections/:id
PATCH  /api/connections/:id
POST   /api/connections/:id/test
POST   /api/connections/:id/rotate
GET    /api/connections/:id/usages
DELETE /api/connections/:id
GET    /api/integrations/catalog
GET    /api/integrations/:type/resources?connectionId=
GET    /api/integrations/:type/operations?resource=
GET    /api/integrations/:type/options?field=&query=&connectionId=
```

## 28. Execution/backend interfaces and tests

### 28.1 APIs for editor, mapper, individual node testing, triggers/forms

```http
GET    /api/nodes/definitions?category=&search=
GET    /api/nodes/definitions/:type/:version
POST   /api/workflows/:id/validate
POST   /api/workflows/:id/execute-node             {nodeId, draftVersion, inputMode, pinnedArtifactIds?}
POST   /api/workflows/:id/execute-upstream         {nodeId, draftVersion}
GET    /api/workflows/:id/executions/:runId/nodes/:nodeId
GET    /api/workflows/:id/executions/:runId/nodes/:nodeId/outputs?portId=&page=&pageSize=
GET    /api/workflows/:id/executions/:runId/nodes/:nodeId/schema
POST   /api/workflows/:id/expressions/preview      {nodeId, fieldKey, binding, sampleRunId}
POST   /api/workflows/:id/publish
GET    /api/workflows/:id/schedules/preview?count=5
POST   /api/workflows/:id/triggers/:triggerId/test-listen
DELETE /api/workflows/:id/triggers/:triggerId/test-listen
GET    /api/workflows/:id/triggers/:triggerId/endpoints
GET    /hooks/test/:token
POST   /hooks/test/:token
POST   /hooks/:token
GET    /forms/test/:token
POST   /forms/test/:token
GET    /forms/:token
POST   /forms/:token
GET    /api/forms/:id/submissions
```

Webhook routes must also honor the configured HTTP verbs; `POST` samples here are not the complete method matrix. Authorize editor APIs by workspace; public endpoints by token/auth/signature/rate limits; never expose graph internals to public users. Validate input against schema and enforce published-version binding. Test URL tokens expire; production URLs can be rotated with staged migration.

### 28.2 Durable storage: add migration-backed tables

```sql
CREATE TABLE node_definitions (
 type text NOT NULL, version int NOT NULL, manifest jsonb NOT NULL,
 handler_key text NOT NULL, enabled boolean NOT NULL DEFAULT true,
 PRIMARY KEY(type,version)
);
CREATE TABLE workflow_node_runs (
 id uuid PRIMARY KEY, workflow_run_id uuid NOT NULL,
 node_id text NOT NULL, status text NOT NULL, item_count int NOT NULL DEFAULT 0,
 started_at timestamptz, completed_at timestamptz, error jsonb
);
CREATE TABLE workflow_output_artifacts (
 id uuid PRIMARY KEY, node_run_id uuid NOT NULL REFERENCES workflow_node_runs(id),
 port_id text NOT NULL, item_index int NOT NULL, payload jsonb,
 binary_refs jsonb, source_items jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE workflow_trigger_registrations (
 id uuid PRIMARY KEY, workflow_id uuid NOT NULL, workflow_version int NOT NULL,
 node_id text NOT NULL, environment text NOT NULL,
 route_token_hash text, method text, config jsonb NOT NULL,
 status text NOT NULL, expires_at timestamptz
);
CREATE UNIQUE INDEX workflow_trigger_unique_route
 ON workflow_trigger_registrations(environment,route_token_hash,method)
 WHERE route_token_hash IS NOT NULL;
CREATE TABLE workflow_schedule_rules (
 id uuid PRIMARY KEY, workflow_id uuid NOT NULL, workflow_version int NOT NULL,
 node_id text NOT NULL, rule jsonb NOT NULL, next_fire_at timestamptz NOT NULL,
 last_fire_at timestamptz, enabled boolean NOT NULL DEFAULT true
);
CREATE TABLE workflow_schedule_dispatches (
 rule_id uuid NOT NULL REFERENCES workflow_schedule_rules(id),
 scheduled_at timestamptz NOT NULL, workflow_run_id uuid,
 PRIMARY KEY(rule_id,scheduled_at)
);
CREATE TABLE workflow_forms (
 id uuid PRIMARY KEY, organization_id uuid NOT NULL,
 workflow_id uuid NOT NULL, node_id text NOT NULL,
 form_version int NOT NULL, schema jsonb NOT NULL, published boolean NOT NULL DEFAULT false
);
CREATE TABLE workflow_form_submissions (
 id uuid PRIMARY KEY, form_id uuid NOT NULL REFERENCES workflow_forms(id),
 form_version int NOT NULL, values jsonb NOT NULL, file_refs jsonb,
 submitted_at timestamptz NOT NULL DEFAULT now(), workflow_run_id uuid
);
```

**Migration requirement:** Adapt UUID/foreign keys/tenant isolation to existing project schema; implement RBAC/RLS, encryption/redaction, indices, retention/partitioning, quotas, artifact size thresholds/object storage, transactional outbox and secret references. SQL above is illustrative, not a drop-in complete production migration.

### 28.3 Acceptance and end-to-end proof (must pass in CI and visible QA)

| Test | Required observable proof |
|---|---|
| Node config variety | HTTP, SQL, IF, Agent, Form, Schedule show **different** specialized fields; conditions switch correctly |
| Execute previous steps | Selected node receives *actual* upstream persisted output and displays lineage |
| Drag field to next node | Drop of nested value stores AST; runtime uses latest run value, not screenshot/sample |
| Data tabs | JSON, Table, Schema work for arrays, objects, files, zero/large inputs |
| Persist mappings | Save, reload, rename upstream node, republish: bindings still work |
| Item linking | 3 inputs, filter to 2, split, merge, loop: references point to correct linked items |
| Validation | Invalid references/types/unavailable branch produce actionable errors before run |
| 10-second scheduler | Observe ≥6 planned events per minute under a healthy load; unique dispatch per planned time, no duplication on restart |
| Timezones | Daily at 09:00 respects selected timezone and documented DST policy |
| Webhook | Test URL works without publish; production URL only active after publish; auth failure blocked |
| Webhook response | Immediate, response-node and timeout scenarios return documented HTTP output |
| Form | Public GET renders; POST validates; submission launches workflow; value is draggable downstream |
| Form protection | CSRF/session where applicable, anti-abuse, file quotas, auth, malicious payload rejection |
| Connections | Create, test, bind, rotate, disable connection; credential never reaches frontend logs |
| Offline | Localhost/on-prem model, DB, queue, webhook and form flows work without internet |
| Accessibility | Mapping via keyboard alternative, correct focus/dialog semantics, light/dark, mobile modal scroll |
| Security | Cross-org artifact access denied, SSRF blocked, masking and rate limits verified |
| Build | Clean install, migrations, lint, typecheck, unit/integration/e2e builds all pass |

### 28.4 Mandatory end-user demo flow

**Build and record one real end-to-end demonstration:** `Form Trigger` collecting incident name, severity, reporter email and attachment → `IF` severity high → `HTTP Request` to internal service → `Knowledge Retrieval` for procedure → `LLM` to draft response → `Human Approval` → `Email` → `Respond to Webhook` where applicable. Show panel-by-panel actual output values, drag/drop mapping on each downstream node, one-node test, full workflow test, form submitted from public URL, production registration, run logs, error handling, audit and saved/reopened workflow. Also demonstrate `Schedule Trigger` at 10-second interval with 6 observed distinct scheduled firings in a healthy minute, and an authenticated webhook initiated externally.

## 29. Engineering delivery instructions / hard stop

1. **Source audit first:** pin Git SHAs for both upstream projects; inspect relevant UI mapping, node definition/types, form trigger, schedule trigger, webhook registry, credential and test execution subsystems. Document inspected paths in `UPSTREAM_NODE_RESEARCH.md` with exact source links and behavioral findings. Do not claim full source review when only select modules were inspected.
2. **Inspect OrchAI before changing:** identify current build state, schema, UI routing, workflow editor, execution services and unimplemented buttons; prioritize root cause repairs, not visual overlays.
3. **Build vertical slices:** (a) manifest-based diverse node editor, (b) test-node + upstream outputs, (c) drag/preview/persist/resolve expressions, (d) 10-sec scheduling, (e) webhooks, (f) form designer, (g) connection center and integration credentials. Every slice frontend+backend+DB+tests.
4. **No dummy configurations:** each real node field must affect its real execution; include runtime implementation and failure/log capture before marking complete. Missing handlers are shown as not installed/disabled, never as a fake runnable node.
5. **No fake result data:** explicitly label manually pinned/simulated test inputs; never present them as live execution. Ensure masked sample trees derive from actual stored test output.
6. **Graph safety:** server validates reachable references, branch/loop lineage, schema shape, port types, runtime version, resource permissions and secret boundaries. Dynamic data mapping should be frictionless **without** becoming unsafe arbitrary-code execution.
7. **Cumulative release only:** preserve prior migrations/data/workflows/settings and existing working features, provide rollback/recovery, release notes and full QA test evidence. Do not mark milestone complete unless production-like tests demonstrate it working.

## 30. Updated definition of done

**The workflow editor is only acceptable when an operator can open a form URL or call a webhook to start a workflow; alternatively configure it to run every 10 seconds, every minute, hourly or at a specific local time; click each different node and see meaningful type-specific configuration; test the first step; see actual output JSON; drag a nested output field into a later node's configuration; preview the mapped value; execute the downstream node using that value; save, publish, reload and run it automatically; and then inspect run-by-run inputs, outputs, errors and connection health.** If even one of these fundamental interactions is decorative or disconnected from the backend, OrchAI's core Workflow Builder is not complete.


---

# PART IV — Comprehensive source-led subsystem parity and fully unified App/Agent/Form runtime

**v1.2 extension — 2026-10-16.** This is an engineering specification with ORIGINAL illustrative code snippets, not code copied wholesale from n8n or Dify, and not a claim that every file of either enormous repository has been exhaustively read. Files positively inspected are identified in §31. A machine-generated full-tree audit is an explicit first acceptance gate in §43. Implementing teams must use pinned revisions to reconcile changing upstream APIs and new node families. Avoid using the upstream trademarks in OrchAI product UI, and complete a source/dependency license review before copying anything.

## 31. Verified upstream source audit, actual implementation signals

| Repo | Exact inspected source | What the code actually proves | OrchAI design response |
|---|---|---|---|
| Dify | [`web/app/components/workflow/types.ts`](https://github.com/langgenius/dify/blob/main/web/app/components/workflow/types.ts) | Typed `BlockEnum` includes LLM, knowledge retrieval, question classifier, if/else, code, template transform, HTTP request, variable assign/aggregate, tool, parameter extractor, iteration, document extractor, list filter, Agent/AgentV2, Loop, HumanInput, data source, knowledge index and schedule/webhook/plugin triggers; node state covers error modes and transient execution UI | Preserve dedicated node types and control-flow semantics; never flatten into one generic JSON editor |
| Dify | [`web/app/components/workflow/nodes/agent/types.ts`](https://github.com/langgenius/dify/blob/main/web/app/components/workflow/nodes/agent/types.ts) | Agent node has `agent_strategy_provider_name`, `agent_strategy_name`, `agent_parameters`, plugin identifier, output schema, memory and versions | Make agent strategy a plug-in with strategy-specific UI and executor |
| Dify | [`api/core/workflow/nodes/agent/entities.py`](https://github.com/langgenius/dify/blob/main/api/core/workflow/nodes/agent/entities.py) | Backend Agent configuration stores strategy provider/name, memory, typed parameter inputs and tool-version compatibility | Maintain versioned agent policy and typed variable bindings on server |
| Dify | [`api/core/agent/entities.py`](https://github.com/langgenius/dify/blob/main/api/core/agent/entities.py) | Legacy agent strategy enum has chain-of-thought and function-calling, tool descriptors and max iteration | Separate legacy chat agents from workflow Agent strategies; do not conflate them |
| Dify | [`api/core/app/apps/agent_chat/app_runner.py`](https://github.com/langgenius/dify/blob/main/api/core/app/apps/agent_chat/app_runner.py) | App agent runner dispatches strategy-specific runners, session, conversation and model | App execution is different from raw graph execution and needs session/conversation APIs |
| Dify | [`web/types/app.ts`](https://github.com/langgenius/dify/blob/main/web/types/app.ts) | App modes include completion, workflow, chat, advanced-chat, agent-chat and agent; theme includes light/dark/system | Preserve distinct app presentations sharing reusable graph definitions |
| Dify | [`web/app/components/workflow/nodes/llm/types.ts`](https://github.com/langgenius/dify/blob/main/web/app/components/workflow/nodes/llm/types.ts) | Model selector, templates, memory, context selector, vision, structured output and reasoning formats | Rich LLM inspector with independent controls and typed outputs |
| Dify | [`web/app/components/workflow/nodes/knowledge-retrieval/types.ts`](https://github.com/langgenius/dify/blob/main/web/app/components/workflow/nodes/knowledge-retrieval/types.ts) | Retrieval models have top-k, score threshold, reranking/weights, metadata filters and logical operations | RAG retriever controls and provenance data must be real |
| Dify | [`web/app/components/workflow/nodes/http/types.ts`](https://github.com/langgenius/dify/blob/main/web/app/components/workflow/nodes/http/types.ts) | HTTP node declares methods, body encoding, headers, params, auth, timeouts, SSL verify, file selectors | Dedicated operation-specific form editor for request nodes |
| Dify | [`langgenius/dify-official-plugins`](https://github.com/langgenius/dify-official-plugins) | Model, tool and Agent Strategy plugins have been separately packaged since Dify 1.0 | Plugin categories, version pinning, allowlisting and offline bundle parity |
| n8n | [`packages/workflow/src/interfaces.ts`](https://github.com/n8n-io/n8n/blob/master/packages/workflow/src/interfaces.ts) | Core execution function family has execute, single-item, supplyData, poll, trigger, webhook and credentials-aware capabilities; binary item metadata | Multiple handler interfaces, item-oriented outputs and binary references |
| n8n | [`packages/nodes-base/nodes/Schedule/ScheduleTrigger.node.ts`](https://github.com/n8n-io/n8n/blob/master/packages/nodes-base/nodes/Schedule/ScheduleTrigger.node.ts) | Schedule property definition has second/minute/hour/day/week/month and cron variants, conditional subfields | Native timezone-safe schedule editor; 10-sec interval supported by OrchAI |
| n8n | [`packages/nodes-base/nodes/Webhook/Webhook.node.ts`](https://github.com/n8n-io/n8n/blob/master/packages/nodes-base/nodes/Webhook/Webhook.node.ts) | Separate test/production flows, method options, authentication, response and output modes | Webhook registry with distinct test and production activation lifecycle |
| n8n | [`packages/nodes-base/nodes/Form/v2/FormTriggerV2.node.ts`](https://github.com/n8n-io/n8n/blob/master/packages/nodes-base/nodes/Form/v2/FormTriggerV2.node.ts) | Form trigger declares GET setup and POST submit webhooks, parameters, response modes and authentication | Public form initiation backed by validated submissions and typed output |
| n8n | [`packages/nodes-base/nodes/Form/common.descriptions.ts`](https://github.com/n8n-io/n8n/blob/master/packages/nodes-base/nodes/Form/common.descriptions.ts) | Form types include text, email, file, date, dropdown, radio, checkbox, number, password, hidden and HTML | Full form-element registry and separate builder properties |
| n8n | [`packages/nodes-base/nodes/Form/Form.node.ts`](https://github.com/n8n-io/n8n/blob/master/packages/nodes-base/nodes/Form/Form.node.ts) | Form steps can suspend/resume workflow execution awaiting later input | Durable multi-page forms, intermediate steps and return-to-form links |

**Verified scope:** targeted subsystem source reads, not every upstream file. **Source audit required next:** recursively enumerate all upstream tracked files at pinned SHAs; create machine-readable file inventory; sample and annotate every major subsystem, all node type definitions and all plugin manifests; identify commercial/license constraints; generate an evidence-backed gap matrix. The user requests exhaustive coverage; exhaustive review cannot be honestly claimed until the machine-readable audit is produced, reviewed and tied to tested acceptance cases.

## 32. The correct product ontology: Graph, App, Agent, Skill, Tool, Connector, Form

| Object | Description | Can be reused by | Editor & UX |
|---|---|---|---|
| Workflow Definition | Typed versioned execution graph | Apps, Agents, schedules, forms, APIs, subflows | n8n-style canvas |
| App Definition | User-facing product around one or more graph versions | People, teams, customer-facing embed/API | Dify-style Studio card + App Builder |
| Agent Definition | Goal/model/system instructions, tools, skills, strategy, memory and limits | App and workflow Agent node | Agent designer + test console |
| Skill | Named versioned portable capability with manifest, instructions, permitted tools, resources and input/output contract | Multiple agents, workflows, apps | Skill library, file browser, test bench |
| Tool | Bounded function: API, SQL, MCP operation, Python sandbox, platform action | Agent, workflow node | Operation-parameter editor |
| Integration/Connection | Credentials + provider settings + capability discovery + health state | Tools, triggers and nodes | Connection Center |
| Form | Versioned schema/UI and form responses | Trigger, app input, human approval, multi-step wizard | Form designer with preview |
| Deployment | A pinned published App/Workflow/Form with routes, auth, versions and policies | External clients | Publish/URLs/Embed panel |
| Knowledge | Sources/chunks/embeddings/indexes and ingestion pipelines | Agent, retrieval node, app | Knowledge Studio |
| Model Endpoint | LLM, embedding, reranker, vision, STT, TTS, OCR, image generation | Agent, LLM node, knowledge, media app | AI Model Center |

**Cardinal rule:** Workflow and App are not synonyms. A single graph can be published as a chatbot, guided form, agent/copilot, one-shot generator, API automation and scheduled job by attaching distinct presentation definitions. Conversely, an App can orchestrate several workflows with a shared conversation, variables, output and deployment policy.

### 32.1 Unified publishing examples

| Graph | App presentation | UI | Input mapping | Output treatment |
|---|---|---|---|---|
| Customer support triage | Chat App | Streaming chat with attachments | `message`, `conversation`, `files` | Assistant message + trace + references |
| Incident reporting | Form App | Branded multi-step form (n8n-style) | Typed validated form fields | Ticket ID + receipt page + notification |
| Contract analysis | File Analyzer App | Upload/drop zone and review panels | `files[]`, `questions`, `language` | Downloadable structured report + source references |
| Internal helpdesk | Agent App | Tool activity timeline + approval cards | Prompt, identity and resource scope | Streaming answer, actions and audit |
| Daily summary | Automated App | Configuration, preview and execution feed | Schedule, saved prompt, connections | Report + email/webhook dispatch |
| Human approval | Approval App | Task queue and decision form | Execution checkpoint + user identity | Resume token bound to checkpoint |
| Voice assistant | Multimodal App | Voice recorder and chat transcript | STT/audio + user query | Voice TTS + text, with streaming |
| Document ingestion | Pipeline App | Upload wizard, indexing status | Files, metadata, security tags | Index status + errors + dataset linkage |

## 33. Source-complete functional inventory and implementation matrix

A **checkbox is NOT evidence of implementation**. `required`, `designed`, `implemented`, `integrated`, `tested`, `deployed` are separate fields in `FEATURE_PARITY_MATRIX.csv`. Preserve license and maturity notes. The source audit must enrich this matrix whenever source demonstrates additional capability.

### 33.1 Dify-derived Studio, App and Agent product surface

- Studio: App list/grid, workspace switch, creation wizard, app type selection, search/filter, recent, owned/shared, archived, duplicate, import/export, templates, team sharing, publish status, last edited and run analytics.
- App modes: Chatbot, Chatflow, Workflow, Agent chat, Text Generator/Completion, Tool/Workflow API, Form App, Voice App, File Analysis App, Dashboard/Portal App. OrchAI variants may extend upstream concepts but must be marked custom.
- App Builder: title, icon, summary, branding, theme, welcome message, conversation starter prompts, prompt templates, app variables, secret variables, file upload restrictions, vision/audio flags, output layout, streaming, citations, feedback, abuse guardrails, token budgets, rate limits and access policy.
- Publish: testing/staging/production, versions, runtime URLs, share link, iframe embed, standalone hosted site, API keys, webhook endpoints, rollback, domain/path allowlist, anonymous versus SSO access and short-lived public submission tokens.
- Agent strategies: function calling, ReAct and extensible provider strategies; strategy-specific parameters, model capabilities, reasoning iterations, tool-selection policy, budget, fallback, structured output, final-response synthesis and trace tree.
- Agent capabilities: tools, Skills, memory, knowledge, delegated agents, human confirmation, file access, approvals, scheduled/background jobs, voice/vision, safe code execution, agent history, skill invocation trace and evaluation suite.
- Skills: curated/offline skill catalog, manifest, version, input/output schema, instruction/resource package, trusted signer, review, tool access, resource scopes, dependency resolver, token/context budget and deterministic fallback. **Do not equate a Skill with an executable tool**: a skill can contain instructions and references plus permitted tool bindings.
- Prompt Lab: model playground, prompt versions, variable insertion, A/B, batch tests, structured output schema authoring, temperature/top-p/max tokens, response controls, safety, prompt injection tests and revision rollback.
- Knowledge: knowledge bases, datasets, document/data-source sync, OCR, multimodal parsing, segmentation, embeddings, semantic/keyword/hybrid retrieval, metadata filters, reranking, top-k/thresholds, citation extraction and ingestion/reindex jobs.
- AI Models: local OpenAI-compatible endpoints, service provider registry, chat/vision/reasoning/embedding/reranking/OCR/STT/TTS/image, connection probes, max context/output, per-tenant quotas, caching, fallback routing, inference logs and token/cost accounting.
- Plugin marketplace: models, tools, agent strategies, triggers, datasources; install via verified offline packages; compatibility and dependency checks; per-workspace permission requests; support upgrade/rollback and signed manifests.
- Observability: app usage, retention, latency, quality/feedback, traces, retrieval quality, model costs, agent tool errors, dataset health, conversation search/export and full audit.

### 33.2 n8n-derived workflow product surface

- Editing: multi-workflow list, high-performance zoom/pan, sticky notes, node palette and favorites, nested group, line routing, copy/paste, multi-select, auto arrange, keyboard shortcuts, undo/redo, command palette and mini-map.
- Node manifests: node versions, multiple operations/resources, contextual parameter visibility, dynamic dropdowns, nested/fixed collections, JSON editor, credentials, info/help panels, complex input widgets, item streams and binary/file ports.
- Testing: execute workflow, execute selected node plus prerequisite ancestors, pin/unpin actual data, show JSON/Table/Schema/Binary output, item index selection, schema-derived dynamic field picker, per-node retries and errors.
- Mapping: drag fields from previous node sample into any compatible downstream control; live expression suggestions, type conversions, mappings across branches/iterations, semantic object tree, JSONPath/path operators and no literal copying unless explicitly selected.
- Triggers: manual, every 10 seconds, fixed intervals, daily/weekly/monthly local times, cron, webhook, OAuth webhooks, provider events, polling, mailbox/queue/database, form trigger, file arrival and human approval resume.
- Forms: branded single/multiple pages, conditional questions, validations, file upload, secure fields, initial values, public/private endpoints, intermediate workflow steps, completion/redirect page and submissions.
- Integrations: reusable provider credentials; OAuth2/API key/basic/bearer/headers/mTLS; connection testing; refresh; granular workspace access; integrations by action/resource; pagination; rate limits and webhook lifecycle registration.
- Execution: queue-mode, cancellation, resume, timeout, schedule next-run, idempotency, retry/backoff, DLQ, replay, loop/foreach, branch merge, parallelism, concurrency limits, wait/suspend, full per-node trace and run compare.
- Operators: email, HTTP, SQL, code sandbox, JSON/XML/CSV, date/string/math, object merging, set/rename/delete fields, filters, switch, aggregate, split batches, iterator, subflow, error trigger, AI inference and knowledge actions.
- Lifecycle: draft vs published version, safe import/export, workflow sharing, access control, bulk operations, audit events, backups, instance credentials and expression compatibility policy.

### 33.3 Each node family MUST have its own form and output semantics

| Family | Example controls displayed | Outputs | Execution behavior |
|---|---|---|---|
| Webhook Trigger | Test/production URL, method, path, auth, response mode, example payload | Headers, query, params, body, files | Receives validated HTTP request |
| Form Trigger | Title, fields, pages, auth, theme, rate limit | Typed answers + uploaded file refs | Renders and submits form |
| Schedule Trigger | Interval presets, every 10 sec, timezone, cron, misfire | event timestamp, run ID | Durable recurring schedule |
| HTTP Request | Method, URL, auth, headers, query, encoding, body, TLS, timeout, pagination | status, headers, parsed/raw body, binary | HTTP execution with SSRF protections |
| SQL Query | Connection, read/write flag, SQL parameters, transaction timeout | rows, schema, affected count | Parameterized tenant-scoped query |
| LLM | Provider, model, prompt roles, temperature, context, structured output, reasoning, vision | text, JSON, usage, tool calls | Model gateway |
| Agent | Strategy, model, prompt, tools/skills, max turns, memory, delegated agents, approvals | messages, decision trace, tool calls, structured result | Bounded agent loop |
| Knowledge Retrieval | Dataset, filters, score threshold, top-k, hybrid/rerank strategy | passages, score, metadata, citation | Search index |
| OCR/Document | Parser, pages, language, tables/images, output format | text blocks, table cells, file refs | Offline/OCR worker |
| Audio STT | Model, language, diarization, chunking, timestamps | transcript, segments, confidence | Speech model |
| TTS | Voice, accent, rate, format, streaming | audio file/stream | Speech synthesizer |
| Image/Vision | Model, images, prompt, resolution | extracted structured/text result | Vision inference |
| Router / IF | LHS expression, operator, RHS, missing-value policy | named branch ports | Exact branching |
| Switch | Variable, condition case collection, default | N named ports | Multi-way branching |
| Loop/ForEach | Input collection, concurrency, fail policy | item output, aggregated output | Isolated item scopes |
| Merge | Mode, merge key, cardinality policy, timeout | merged item stream | Deterministic joins |
| Code | Runtime, sandbox limits, input bindings, output schema | arbitrary typed result | Isolated restricted worker |
| Transform | JSON schema, mapping and expression rules | transformed object/array | Type-checked mapper |
| Human Approval | User/team, form, deadline, escalation, action | decision, signer, timestamp | Suspend/checkpoint/resume |
| Send Email | Connection, recipient, templates, attachments | message ID, delivery status | Authenticated provider |
| Subworkflow | Graph/version, input binding, wait/sync mode | child-run output | Permission checked invocation |

## 34. Unified UI routes and navigation architecture

```
/studio                           Dify-style app/workflow gallery
/studio/new                       Create App / Workflow / Agent / Skill / Form
/studio/apps/:appId               App overview with Preview, Design, Data, Logs, Publish
/studio/apps/:appId/designer      One-click open linked n8n-style graph designer
/studio/apps/:appId/presentation  End-user chat/form/upload/agent appearance editor
/studio/apps/:appId/test          Playground, side-by-side run inspector
/studio/apps/:appId/publish       Live URL, embed, API tokens and versions
/studio/agents                    Agent gallery, strategies, capabilities
/studio/agents/:id                Agent configuration, tools/skills, memory, trace
/studio/skills                    Skills catalog / bundle manager
/studio/skills/:id                Files, manifests, resource scopes, evaluator
/studio/workflows/:id             Immersive n8n-like canvas
/studio/forms/:id                 Multi-page form builder and preview
/studio/knowledge                 Datasets, knowledge ingestion and indexing
/studio/models                    Providers, local inference endpoints, testing
/studio/connections               Integration and credential library
/studio/plugins                   Offline installation and health
/studio/executions                Cross-workflow runs and DLQ
/studio/evaluations               Prompt, Agent and RAG test suites
/a/:deploymentSlug                Published App (chat, form, file, copilot)
/forms/:deploymentSlug            Public authenticated/anonymous form endpoint
/hooks/test/:token                Ephemeral test hook route
/hooks/:deploymentSlug            Production webhook route
/api/v1/apps/:id/run              Authenticated runtime API
```

**App overview main tabs:** Overview, Design Workflow, App Experience, Prompt/Agent, Knowledge, Tools/Skills, API, Publish, Insights, Logs, Settings. Tabs appear conditionally by app type. No duplicate navigations. Studio offers gallery cards and folder filters; selecting a workflow opens n8n-grade editor; double-clicking a node opens the three-pane Node Detail experience. In the App experience editor, the same workflow outputs bind to chat bubbles, tables, cards, rich reports and forms. Responsive dark/light/system with user override and correct Arabic RTL supported.

## 35. Native data contracts (original TypeScript sample)

Create `packages/contracts/src/domain.ts`:

```ts
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type DataType = 'string'|'number'|'boolean'|'object'|'array'|'file'|'audio'|'image'|'json'|'any';
export type AppMode = 'chat'|'agent'|'workflow'|'form'|'completion'|'file-analyzer'|'voice'|'portal';
export type PresentationField = {
  key: string; label: string; type: 'text'|'textarea'|'number'|'email'|'date'|'select'|'multi-select'|'checkbox'|'radio'|'file'|'hidden';
  required?: boolean; options?: {label:string,value:string}[];
  help?: string; visibleWhen?: { field:string; equals:JsonValue };
  source?: { nodeId:string; outputPath:string }; validation?: Record<string, JsonValue>;
};
export type AppDefinition = {
  id:string; workspaceId:string; title:string; description?:string; icon?:string;
  mode:AppMode; workflowId:string; publishedWorkflowVersion:number;
  ui:{ theme:'light'|'dark'|'system'; layout:'chat'|'form'|'dashboard'|'assistant'|'upload';
    intro?:string; fields?:PresentationField[]; outputWidgets?:OutputWidget[]; brand?:Record<string,string> };
  access:{mode:'private'|'workspace'|'authenticated-public'|'public'; roles?:string[]};
  publish:{slug:string; enabled:boolean; revision:number; allowEmbed:boolean; apiEnabled:boolean};
};
export type OutputWidget = {
  id:string; type:'text'|'markdown'|'table'|'chart'|'file'|'json'|'audio'|'citation'|'approval';
  source:{nodeId:string;path:string}; title?:string;
};
export type Mapping = {kind:'literal';value:JsonValue} | {
  kind:'ref';nodeId:string;outputPath:string;itemIndex?:number;
  onMissing?:'fail'|'null'|'default';default?:JsonValue;
};
export type NodeParam = {key:string;label:string;input:'text'|'number'|'boolean'|'select'|'code'|'expression'|'json'|'secret'|'variable'|'model'|'knowledge'|'resource'|'collection'|'form-builder';
  dataType:DataType;required?:boolean;default?:JsonValue;
  options?:{label:string;value:string}[];
  visibleWhen?:{field:string;is:JsonValue|JsonValue[]};
  dependsOn?:string[]; secret?:boolean; acceptsMapping?:boolean; help?:string; children?:NodeParam[];
};
export type NodeManifest = {
  type:string; version:string; title:string; category:string; icon:string;
  inputs:{name:string;dataType:DataType}[]; outputs:{name:string;dataType:DataType;schema?:JsonValue}[];
  params:NodeParam[];
  operations?:{id:string;label:string; params:NodeParam[]}[];
  trigger?:boolean; credentials?:{provider:string;scopes?:string[]}[];
  supportsTest:boolean; license?:string; requiredCapabilities?:string[];
};
export type GraphNode = {id:string;type:string;nodeVersion:string;params:Record<string,JsonValue|Mapping>;position:{x:number;y:number}};
export type GraphEdge = {id:string;source:string;sourcePort:string;target:string;targetPort:string};
export type WorkflowDefinition = {id:string;workspaceId:string;version:number;nodes:GraphNode[];edges:GraphEdge[];status:'draft'|'published';};
export type AgentDefinition = {id:string;workspaceId:string;name:string;modelId:string;strategyId:string;
  systemPrompt:string;skillVersions:{id:string;version:string}[];toolIds:string[];
  knowledgeIds:string[];memory:{mode:'none'|'session'|'persistent';maxTokens:number};
  safety:{maxIterations:number;maxToolCalls:number;maxDurationMs:number;requireApprovalFor:string[]};
  outputSchema?:JsonValue;};
export type SkillManifest = {id:string;version:string;name:string;summary:string;
  instructionsPath:string;resources:string[];allowedToolIds:string[];
  inputs:JsonValue;outputs:JsonValue;permissions:{network:boolean;files:boolean;secrets:string[]};
  publisher:string;signature:string;};
```

**Runtime schemas:** use Zod at boundary, JSON Schema/OpenAPI for generated clients and AJV for individual dynamic node params. Do not trust client-supplied schema IDs or executable expressions. Every saved graph pins node versions. Apply migrations when manifests evolve, recording before/after schema and reversible upgrades where possible.

## 36. Frontend reference code: App Studio that opens shared graph designer

Create `apps/web/src/pages/StudioAppsPage.tsx`:

```tsx
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { AppDefinition, AppMode } from '@orchai/contracts';
const MODES: AppMode[]=['chat','agent','workflow','form','completion','file-analyzer','voice','portal'];
async function fetchApps():Promise<AppDefinition[]>{
  const r=await fetch('/api/v1/apps',{credentials:'include'});
  if(!r.ok)throw new Error('Cannot load apps');return r.json();
}
export function StudioAppsPage(){
  const nav=useNavigate(); const [q,setQ]=useState('');
  const [mode,setMode]=useState<AppMode|'all'>('all');
  const query=useQuery({queryKey:['apps'],queryFn:fetchApps});
  const apps=(query.data??[]).filter(a=>(mode==='all'||a.mode===mode)&&
    `${a.title} ${a.description||''}`.toLowerCase().includes(q.toLowerCase()));
  return <main className="studio">
    <header className="studio-header"><div><h1>Studio</h1><p>Apps, Agents, Workflows and Forms</p></div>
      <button onClick={()=>nav('/studio/new')}>+ Create</button></header>
    <nav aria-label="App type filters"><button onClick={()=>setMode('all')}>All</button>
      {MODES.map(m=><button key={m} aria-pressed={mode===m} onClick={()=>setMode(m)}>{m}</button>)}</nav>
    <input aria-label="Search apps" placeholder="Search apps..." value={q} onChange={e=>setQ(e.target.value)}/>
    {query.isLoading?<p>Loading...</p>:query.isError?<p role="alert">Could not load apps</p>:
    <section className="app-grid" aria-label="Apps">{apps.map(a=><article className="app-card" key={a.id}>
      <div className="app-icon" aria-hidden="true">{a.icon||'◇'}</div>
      <h2>{a.title}</h2><p>{a.description}</p><small>{a.mode} · {a.publish.enabled?'Published':'Draft'}</small>
      <div className="app-actions">
        <button onClick={()=>nav(`/studio/apps/${a.id}`)}>Open App</button>
        <button onClick={()=>nav(`/studio/workflows/${a.workflowId}`)}>Design Flow</button>
        <button onClick={()=>nav(`/studio/apps/${a.id}/presentation`)}>Edit UI</button>
      </div></article>)}</section>}
  </main>;
}
```

**CSS acceptance:** grid adapts ≥320px through desktop, 44px touch targets, keyboard focus visible, semantic button controls, accessible contrast, empty/error/skeleton states. Cards indicate workflow version, publish status, role, app mode and last test. Changes to App UI never silently mutate published graph version.

### 36.1 Node configuration UI and field mapping

The Node Detail layout has a selectable **INPUT** pane with actual upstream run items, center **PARAMETERS** pane generated from `NodeManifest.params`, and **OUTPUT** pane with run result. In read-only mode render actual run values; in design mode allow dragging. A separate **Settings** tab exposes retry, timeout, continue-on-error, notes and credentials. The `NodeParam` renderer must vary by `input`, operation, conditional visibility and allowed data type. Collections allow nested repeating subfields. A generic textarea for all nodes is a failure.

```tsx
import { useMemo, useState, type DragEvent } from 'react';
import type { NodeManifest, Mapping, JsonValue } from '@orchai/contracts';
type OutputPath = {nodeId:string;path:string;dataType:string;sample:JsonValue};
const DRAG_TYPE='application/vnd.orchai.output-path+json';
export function OutputField({value}:{value:OutputPath}){
  function start(e:DragEvent<HTMLButtonElement>){
    e.dataTransfer.setData(DRAG_TYPE,JSON.stringify(value));e.dataTransfer.effectAllowed='copy';
  }
  return <button draggable onDragStart={start} title="Drag to a compatible parameter">
    {value.path} <small>{value.dataType}</small></button>;
}
export function MappableInput({parameter, value, onChange}:{parameter:{dataType:string;label:string};
  value:JsonValue|Mapping;onChange:(value:JsonValue|Mapping)=>void}){
  const [message,setMessage]=useState('');
  function drop(e:DragEvent<HTMLInputElement>){e.preventDefault();
    try {const data=JSON.parse(e.dataTransfer.getData(DRAG_TYPE)) as OutputPath;
      if(parameter.dataType!=='any'&&data.dataType!=='any'&&parameter.dataType!==data.dataType){
        setMessage(`Expected ${parameter.dataType}; dropped ${data.dataType}`);return;
      }
      onChange({kind:'ref',nodeId:data.nodeId,outputPath:data.path,onMissing:'fail'});setMessage('');
    }catch{setMessage('Invalid output reference');}
  }
  const mapping=value&&typeof value==='object'&&!Array.isArray(value)&&'kind' in value
    ? value as Mapping:undefined;
  return <label>{parameter.label}
    <input aria-invalid={!!message} onDragOver={e=>e.preventDefault()} onDrop={drop}
      value={mapping?.kind==='ref'?`⇢ ${mapping.nodeId}.${mapping.outputPath}`:String(value??'')}
      onChange={e=>onChange(e.target.value)}/>
    {message&&<span role="alert">{message}</span>}
  </label>;
}
```

**Code scope note:** These excerpts demonstrate contracts and interactions, not a drop-in complete editor. The production implementation must add pointer-based drag/drop accessibility alternatives, nested arrays/binary/file handling, schema compatibility/coercion, mapped-value chips, autocomplete, typeahead and expression preview. Derive input tree from server-stored run outputs **not fabricated placeholder samples**.

## 37. App + Form Builder unified experience, backend contract and page UX

The form builder is a legitimate App Presentation as well as a workflow trigger and a human-interaction node. Users can add field types, reorder, group into pages, add conditional logic, map to start-node variables and publish as branded App. Underlying flow may contain AI Agent, retrieval, tools, human approval and response renderer. Support form-as-chat input when desired.

### 37.1 User journey (must work end-to-end)

1. Studio → Create → Form App → choose template or blank.
2. Designer displays `Form Input` trigger, AI processing and `Respond` node; right side previews actual public form.
3. Add Email, Name, Priority, Document (PDF) and Consent fields; set conditional mandatory rules and file limits.
4. Click `Test Form`: create one-time secure test URL; fill/submit; see captured input as typed, masked node output.
5. Drag `priority` and `document.fileRef` from INPUT into IF or LLM node; click **Execute Step** and inspect actual values/Agent trace.
6. Add second approval page with resume behavior and a mandatory login requirement. Publish staging/production versions independently.
7. Public app `/a/incident-report` exposes the branded form; submission creates durable run, stores file separately with virus scan, and returns tracked receipt.
8. Admin sees run log, forms submissions, who submitted, outcome, retries and diagnostic details; secure data is redacted.

### 37.2 Form model, renderer and type safety

```ts
export type FormPage = {id:string;title:string;description?:string;fields:PresentationField[];
  next?:{mode:'sequential'|'conditional';branches?:{when:JsonValue;pageId:string}[]}};
export type FormVersion = {id:string;workspaceId:string;revision:number;
  title:string;description?:string;pages:FormPage[];
  workflowId:string;triggerNodeId:string;
  auth:{mode:'public'|'sso'|'login'|'signed-link';captcha?:boolean};
  upload:{maxFiles:number;maxBytes:number;mimeAllowlist:string[]};
  submit:{idempotency:'required'|'optional';response:'sync'|'async';maxWaitMs:number};
};
```

```tsx
import { useState } from 'react';
import type { FormVersion } from './form-types';
export function PublishedForm({form}:{form:FormVersion}){
  const [page,setPage]=useState(0),[values,setValues]=useState<Record<string,unknown>>({});
  const [error,setError]=useState(''),[receipt,setReceipt]=useState('');
  const current=form.pages[page];
  async function submit(){
    setError('');
    // UI validation is advisory. Server repeats all schema/auth/size checks.
    if(page+1<form.pages.length){setPage(page+1);return;}
    const response=await fetch(`/api/v1/public/forms/${encodeURIComponent(form.id)}/submissions`,{
      method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID()},
      body:JSON.stringify({revision:form.revision,values})});
    const body=await response.json().catch(()=>({}));
    if(!response.ok){setError(body.message||'Unable to submit form');return;}
    setReceipt(body.receiptId);
  }
  if(receipt)return <main role="status"><h1>Submitted</h1><p>Receipt: {receipt}</p></main>;
  return <main><h1>{form.title}</h1><p>{current.description}</p>
    <form onSubmit={e=>{e.preventDefault();void submit()}}>
      {current.fields.map(f=><label key={f.key}>{f.label}
        {/* Production renderer delegates select/file/date/checkbox to typed components. */}
        <input name={f.key} type={f.type==='email'?'email':f.type==='number'?'number':'text'}
          required={f.required} value={String(values[f.key]??'')}
          onChange={e=>setValues(v=>({...v,[f.key]:e.target.value}))}/></label>)}
      {error&&<p role="alert">{error}</p>}
      <button type="submit">{page+1===form.pages.length?'Submit':'Next'}</button>
    </form></main>;
}
```

**Do not misrepresent the example:** production form handling MUST support every enumerated field with specialized controls, `multipart/form-data` or presigned uploads with completion tokens (not JSON blobs), conditional visibility, sanitized rich text, CSRF strategy, accessibility, session isolation and durable state for multi-page/human-wait flows.

### 37.3 API endpoints (real handlers mandatory)

```
POST   /api/v1/forms                       Create form in workspace
GET    /api/v1/forms/:id                   Read schema/revision/permissions
PATCH  /api/v1/forms/:id                   Save draft with optimistic concurrency
POST   /api/v1/forms/:id/test-url          Create expiring test URL
POST   /api/v1/forms/:id/publish           Publish immutable schema snapshot
GET    /api/v1/public/forms/:slug          Fetch safe public view only
POST   /api/v1/public/forms/:slug/uploads  Authorize and scan files
POST   /api/v1/public/forms/:slug/submissions  Validate/start graph/return receipt
GET    /api/v1/forms/:id/submissions       Audited workspace submissions
POST   /api/v1/workflow-runs/:id/resume    Authenticated, idempotent human resume
```

Never expose internal graph details, credential IDs, unpublished variables, arbitrary output samples, secret nodes or stack traces from public endpoints.

## 38. Agent, Skill and Tool architecture: separate but composable

**Agent != Skill != Tool != Workflow**. Agent delegates work based on goal and strategy. A Skill is a documented, discoverable and permissioned capability package whose instructions/resources may make the Agent more competent. A Tool is a callable operation. A workflow is an orchestrated deterministic/durable graph; agent actions run inside its bounded Agent node or standalone Agent App. All share credential authorization, audit, timeout, model gateway and trace contracts.

### 38.1 Agent runtime interface (original sample)

```ts
export interface AgentStrategy {
  id:string;
  run(ctx:AgentContext,input:{prompt:string;attachments?:string[]}):AsyncIterable<AgentEvent>;
}
export interface AgentContext {
  workspaceId:string;userId:string;runId:string;modelId:string;
  maxIterations:number;maxToolCalls:number;deadline:Date;
  listTools():Promise<{id:string;description:string;inputSchema:JsonValue}[]>;
  callTool(id:string,args:JsonValue,approvalToken?:string):Promise<JsonValue>;
  retrieve(query:string,datasets:string[]):Promise<JsonValue>;
  loadSkill(id:string,version:string):Promise<{instructions:string;resources:string[]}>;
  complete(messages:JsonValue[]):Promise<{text?:string;toolCalls?:{id:string;args:JsonValue}[];usage?:JsonValue}>;
  checkpoint(state:JsonValue):Promise<void>;
}
export type AgentEvent = {kind:'token'|'tool_call'|'tool_result'|'approval_required'|'final'|'error';
  time:string;sequence:number;payload:JsonValue};
```

### 38.2 Bounded agent loop code

```ts
export class FunctionCallingStrategy implements AgentStrategy {
  id='function-calling';
  async *run(ctx:AgentContext,input:{prompt:string}):AsyncIterable<AgentEvent>{
    const messages:JsonValue[]=[{role:'user',content:input.prompt}];
    let calls=0;
    for(let step=0;step<ctx.maxIterations;step++){
      if(Date.now()>ctx.deadline.getTime())throw new Error('Agent deadline exceeded');
      const response=await ctx.complete(messages);
      const proposed=response.toolCalls??[];
      if(proposed.length===0){yield {kind:'final',time:new Date().toISOString(),sequence:step,
        payload:{text:response.text??''}};return;}
      for(const tool of proposed){
        if(++calls>ctx.maxToolCalls)throw new Error('Tool budget exhausted');
        yield {kind:'tool_call',time:new Date().toISOString(),sequence:step,payload:tool};
        // ctx.callTool MUST validate allowlisted tool, schema, policy, and human approvals.
        const result=await ctx.callTool(tool.id,tool.args);
        messages.push({role:'tool',toolCallId:tool.id,content:result});
        yield {kind:'tool_result',time:new Date().toISOString(),sequence:step,payload:result};
      }
      await ctx.checkpoint({messages,calls,step});
    }
    throw new Error('Agent reached maximum iterations');
  }
}
```

**Required beyond excerpt:** include actual assistant tool-call messages in model-specific format; normalize provider schemas; handle streaming and partial tool calls; propagate cancellation; store checkpoint before potentially non-idempotent actions; emit cost/latency; revoke on logout; detect recursive agent/workflow call cycles; add human approval for destructive/financial/externally visible operations; harden against prompt injections originating in retrieved documents and tool outputs; enforce per-run tool call and wall-clock quotas.

### 38.3 Skill catalog and safe installation

```yaml
id: incident-report-drafting
version: 1.2.0
name: Incident Report Drafting
summary: Draft a structured incident report using approved templates
instructions: SKILL.md
resources:
  - templates/initial-sitrep.md
  - schemas/sitrep.schema.json
allowed_tools:
  - knowledge.search
  - incident.lookup
permissions:
  network: false
  files: true
  secrets: []
inputs:
  type: object
  required: [incidentId]
  properties:
    incidentId: {type: string}
outputs:
  type: object
  properties:
    title: {type: string}
    summary: {type: string}
    sources: {type: array, items: {type: string}}
```

**Important:** this is an OrchAI-proposed `skill.yaml` schema, not a claim of Dify's on-disk manifest format. Implement adapters to import other formats only after source/version-specific format review. Skill activation may supply instructions/resources to an agent but MUST NOT silently grant tool/network/file privileges. Sign and hash bundles, flag unsigned content, scan code artifacts, disable prohibited network calls and require explicit workspace approval.

### 38.4 Skill / Agent / App UI screens

Agent designer: Identity & Instructions → Model/Strategy → Tools & Permissions → Skills → Knowledge → Memory → Guardrails → Test Playground → Evaluation → Publish. Separate settings for each. Tool picker includes connection indicator and auth; Skill picker shows version, instructions preview, manifest permissions, compatibility and last evaluation. Agent Test displays token stream, decisions, tool arguments with redacted secrets, policy checks, retrieved passages, iterations, cost and final answer. A rejected tool call must be visible as policy denial, not silently skipped.

## 39. Node registry and operation-dependent form generation

```ts
const httpNode:NodeManifest={
 type:'core.http',version:'1.0.0',title:'HTTP Request',category:'Integrations',icon:'globe',
 inputs:[{name:'input',dataType:'json'}],outputs:[{name:'response',dataType:'json'}],supportsTest:true,
 params:[
  {key:'method',label:'Method',input:'select',dataType:'string',required:true,default:'GET',
   options:['GET','POST','PUT','PATCH','DELETE'].map(v=>({label:v,value:v}))},
  {key:'url',label:'URL',input:'expression',dataType:'string',required:true,acceptsMapping:true},
  {key:'credential',label:'Connection',input:'resource',dataType:'string'},
  {key:'bodyType',label:'Body type',input:'select',dataType:'string',
   options:['json','form','multipart','raw'].map(v=>({label:v,value:v})),
   visibleWhen:{field:'method',is:['POST','PUT','PATCH']}},
  {key:'body',label:'Body',input:'json',dataType:'json',acceptsMapping:true,
   visibleWhen:{field:'bodyType',is:'json'}},
  {key:'timeoutMs',label:'Timeout (ms)',input:'number',dataType:'number',default:30000}
 ]
};
const agentNode:NodeManifest={
 type:'ai.agent',version:'1.0.0',title:'AI Agent',category:'AI',icon:'bot',
 inputs:[{name:'context',dataType:'json'}],outputs:[{name:'result',dataType:'json'}],supportsTest:true,
 params:[
  {key:'strategy',label:'Strategy',input:'resource',dataType:'string',required:true},
  {key:'modelId',label:'Model',input:'model',dataType:'string',required:true},
  {key:'systemPrompt',label:'Instructions',input:'expression',dataType:'string',acceptsMapping:true},
  {key:'tools',label:'Available Tools',input:'collection',dataType:'array'},
  {key:'skills',label:'Skills',input:'collection',dataType:'array'},
  {key:'datasets',label:'Knowledge',input:'knowledge',dataType:'array'},
  {key:'maxIterations',label:'Maximum Iterations',input:'number',dataType:'number',default:10},
  {key:'memory',label:'Memory',input:'select',dataType:'string',
   options:['none','session','persistent'].map(v=>({label:v,value:v}))}
 ]
};
```

**Manifest is a starting point**: production registry validates manifest shape and version, merges strategy/provider-driven extension fields, supports dynamic option resolution with backend permissions, and loads operation-specific help. Each `operation` may add/remove its own fields, not just relabel generic form. The editor cannot show options unsupported by current connected integration or model capabilities. When switching operation, preserve compatible values and show a diff/confirmation for destructive changes.

## 40. Backend API, persistence and execution contracts

### 40.1 Core entities and indexes

```sql
CREATE TABLE IF NOT EXISTS app_definitions (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL, workflow_id uuid NOT NULL,
  mode text NOT NULL, title text NOT NULL, draft jsonb NOT NULL,
  published_revision integer, created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS ix_apps_workspace ON app_definitions(workspace_id, updated_at DESC);
CREATE TABLE IF NOT EXISTS app_deployments (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL, app_id uuid NOT NULL,
  slug text NOT NULL, environment text NOT NULL, revision integer NOT NULL,
  workflow_version integer NOT NULL, enabled boolean NOT NULL DEFAULT false,
  policy jsonb NOT NULL DEFAULT '{}'::jsonb, published_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, environment, slug));
CREATE TABLE IF NOT EXISTS agents (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL, revision integer NOT NULL,
  definition jsonb NOT NULL, published_revision integer, updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS skills (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL, skill_key text NOT NULL,
  version text NOT NULL, manifest jsonb NOT NULL, package_sha256 text NOT NULL,
  status text NOT NULL, UNIQUE(workspace_id,skill_key,version));
CREATE TABLE IF NOT EXISTS forms (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL, revision integer NOT NULL,
  schema jsonb NOT NULL, published_revision integer, updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS form_submissions (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL, form_id uuid NOT NULL,
  revision integer NOT NULL, run_id uuid, submitter_id uuid,
  idempotency_hash text NOT NULL, redacted_values jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(form_id,idempotency_hash));
CREATE TABLE IF NOT EXISTS node_run_outputs (
  run_id uuid NOT NULL, node_id text NOT NULL, attempt int NOT NULL,
  item_index int NOT NULL, output jsonb, artifact_ref text,
  is_pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(run_id,node_id,attempt,item_index));
CREATE INDEX IF NOT EXISTS ix_node_output_run ON node_run_outputs(run_id,node_id);
CREATE TABLE IF NOT EXISTS human_checkpoints (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL, run_id uuid NOT NULL,
  node_id text NOT NULL, resume_token_hash text NOT NULL,
  version integer NOT NULL, expires_at timestamptz NOT NULL,
  resumed_at timestamptz, result jsonb);
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL, workflow_id uuid NOT NULL,
  trigger_node_id text NOT NULL, trigger_type text NOT NULL,
  enabled boolean NOT NULL DEFAULT false, config jsonb NOT NULL,
  next_run_at timestamptz, last_run_at timestamptz,
  UNIQUE(workflow_id,trigger_node_id));
```

Production migration must add FK relations consistent with actual user/workspace tables, RLS or mandatory repository scopes, retention limits, encryption and partitioning/index lifecycle as appropriate. In particular avoid storing full raw credentials or unredacted sensitive inputs in these JSON columns. Form submission responses requiring privacy protection belong in encrypted object storage with short-lived links or envelope encryption, not plainly stored in `redacted_values`.

### 40.2 NestJS App endpoints (illustrative)

```ts
import {Controller,Get,Post,Param,Body,Req,UseGuards,ForbiddenException} from '@nestjs/common';
@Controller('api/v1/apps')
export class AppsController {
  constructor(private readonly apps: AppsService) {}
  @Get() async list(@Req() req:AuthedRequest){
    return this.apps.listForWorkspace(req.auth.workspaceId,req.auth.userId);
  }
  @Post() async create(@Req() req:AuthedRequest,@Body() body:CreateAppDto){
    return this.apps.create(req.auth.workspaceId,req.auth.userId,body);
  }
  @Post(':id/publish') async publish(@Req() req:AuthedRequest,@Param('id') id:string,
     @Body() body:PublishAppDto){
    await this.apps.assertCanPublish(req.auth.workspaceId,req.auth.userId,id);
    return this.apps.publishImmutable(req.auth.workspaceId,id,body.expectedRevision);
  }
}
```

`AuthedRequest`, DTO validation, `AppsService` implementations and guards shown above are **interfaces to implement**; this example is not claimed compilable independently. Full release requires generated types, actual auth guards, dependency injection, controllers, repositories, migrations, telemetry and integration tests.

### 40.3 Workflow + App APIs

```
GET/POST          /api/v1/apps
GET/PATCH         /api/v1/apps/:appId
POST              /api/v1/apps/:appId/publish
POST              /api/v1/apps/:appId/preview
POST              /api/v1/apps/:appId/run
GET               /api/v1/apps/:appId/logs
GET/POST          /api/v1/agents
GET/PATCH         /api/v1/agents/:agentId
POST              /api/v1/agents/:agentId/test
GET/POST          /api/v1/skills
POST              /api/v1/skills/install
GET               /api/v1/skills/:skillId/versions
GET               /api/v1/nodes/manifests
GET               /api/v1/nodes/:type/:version/operations
POST              /api/v1/workflows/:id/nodes/:nodeId/test
GET               /api/v1/executions/:runId/nodes/:nodeId/items
GET               /api/v1/executions/:runId/events
POST              /api/v1/workflows/:id/publish
POST              /api/v1/integrations/:id/test
GET/POST          /api/v1/knowledge/datasets
POST              /api/v1/models/:modelId/test
```

## 41. Trigger scheduler and webhook connectivity: production semantics

- Schedules: `every 10 seconds`, `every 30 seconds`, `every minute`, `every N minutes`, `hourly at minute X`, `daily HH:mm`, `weekdays`, `weekly`, `monthly`, timezone and optional cron with seconds; disclose next 10 timestamps before enabling. Use a proper recurring scheduler; distributed leader/leases and persistent next-fire tracking prevent duplicate enqueue. Enforce quotas to avoid 10-second storms; do not restrict to hourly because some reminder products have different limitations.
- Misfire: `skip`, `run_once` or `catch_up` bounded; define overlap: allow/queue/skip/cancel-previous. Disable published recurring triggers when deployment deactivated. Store both scheduled and actual times for auditing.
- Webhook: distinct ephemeral test URL from stable production URL; auth (secret header, HMAC signature, Basic, OAuth token, mTLS/IP allowlist), HTTP method, MIME, size, response behavior (immediate, wait-for-run, custom response node), version binding, idempotency and replay protection. Inbound body retained according to policy, never silently logged in full.
- Integration triggers: webhook registration/deregistration with vendor API, polling fallback, lease renewal, OAuth refresh, rate limits, cursor/checkpoint management and connection health.
- Forms: must share webhook authentication, access scope and anti-abuse but expose safe GET UI and validated POST submit endpoints; `/forms` submission is not a raw unrestricted webhook.
- Resume triggers: human tasks use one-time expiring token, identity+role check, optimistic checkpoint version and append-only audit; repeated POST cannot resume twice.

### 41.1 Schedule contract and deterministic validation

```ts
export type ScheduleConfig =
 | {kind:'interval';seconds:number;timezone:string;overlap:'skip'|'queue'|'parallel'}
 | {kind:'daily';hour:number;minute:number;timezone:string;overlap:'skip'|'queue'|'parallel'}
 | {kind:'cron';expression:string;timezone:string;overlap:'skip'|'queue'|'parallel'};
export function assertScheduleConfig(s:ScheduleConfig){
  if(!Intl.supportedValuesOf('timeZone').includes(s.timezone))throw Error('Invalid timezone');
  if(s.kind==='interval'&&(!Number.isInteger(s.seconds)||s.seconds<10))
    throw Error('Minimum interval is 10 seconds');
  if(s.kind==='daily'&&(s.hour<0||s.hour>23||s.minute<0||s.minute>59))
    throw Error('Invalid time');
  // Cron format, DST policy, next-fire preview, tenancy and quotas validated server-side.
}
```

## 42. QA: executable user journeys and contract suites

| Test ID | Journey | Mandatory verification |
|---|---|---|
| APP-01 | Create Agent App from Studio | Card persists; App/Graph IDs linked; reopen works |
| APP-02 | Publish workflow as Form App | Public URL renders correct pinned form revision |
| APP-03 | Publish same workflow as Chat App | Independent chat presentation; same authorized engine |
| APP-04 | Build file-review App | File upload, malware scan, temporary ref, AI output, audit |
| AGT-01 | Agent with two Skills and three Tools | Correct permissions, capabilities, trace and result |
| AGT-02 | Function calling with unavailable tool | Transparent error, controlled fallback, no fake success |
| AGT-03 | Agent approval required | Suspends; reviewer resumes once; unauthorized denied |
| AGT-04 | Agent prompts and memories | Cross-workspace memory isolation; deletion and retention |
| SKL-01 | Import signed Skill bundle | Integrity, version, permissions and installation audit |
| SKL-02 | Untrusted Skill requests network | Denied by default, explicit review needed |
| NOD-01 | HTTP node GET vs POST | UI changes body/auth/headers fields correctly |
| NOD-02 | LLM vs Agent | Different config forms, result contracts and traces |
| NOD-03 | OCR vs SQL vs Send Email | Distinct settings and separate output schema |
| NOD-04 | Test upstream → drag field to downstream | Stores reference, previews run value, executes with resolved value |
| NOD-05 | Test variable on loop branch | Correct per-item and ancestor scope; invalid refs rejected |
| NOD-06 | File/binary mapping | Preserves reference and metadata, not raw base64 in DB |
| FRM-01 | Multi-page form with conditional field | Correct visibility and server-side required validation |
| FRM-02 | File upload form → Agent | File scanned, ACL enforced, results traced |
| FRM-03 | Form inside waiting workflow | Resume exactly once; completed page correct |
| TRG-01 | Every 10 seconds over restart | Next-run durable; overlap and idempotency correct |
| TRG-02 | Daily local time across DST | Explicit DST behavior, correct next-fire preview |
| TRG-03 | Test webhook then production | Routes isolated; published version pinned |
| TRG-04 | Unauthenticated webhook replay | Denied/duplicate; secret masked; no data leak |
| SEC-01 | Cross-workspace graph/data/agent access | Denied for all REST, websocket and runtime routes |
| SEC-02 | Prompt injection in retrieved document | Cannot cause privileged tool execution |
| REL-01 | Upgrade existing OrchAI database | Preserves Apps, Workflows, versions, credentials and run history |
| REL-02 | Offline cold install | Packages, migrations, models and plugins resolve without external network |
| UX-01 | Light/dark/system RTL and mobile | No broken node inspector, missing buttons or inaccessible fields |

All suites run against real services with fake integrations isolated at the boundary. For the most important tests, capture screenshots/videos plus API traces and DB assertions; no screenshot-only mock acceptance. Error paths and permissions are first-class.

## 43. Full upstream repository audit: required executable recipe and evidence requirements

In an internet-enabled review environment (not inside production/offline deployment), run:

```bash
set -euo pipefail
mkdir -p upstream-review && cd upstream-review
git clone --filter=blob:none https://github.com/n8n-io/n8n.git
git clone --filter=blob:none https://github.com/langgenius/dify.git
git clone --filter=blob:none https://github.com/langgenius/dify-official-plugins.git
for project in n8n dify dify-official-plugins; do
  (cd "$project" && git rev-parse HEAD && git ls-files > "../${project}-tracked-files.txt")
done
```

Use a reviewed release tag or fixed commit SHA for reproducibility, not changing default-branch HEAD. Produce **all** of these artifacts:

1. `UPSTREAM_REVISIONS.md`: exact SHA, date, upstream license, link and review timestamp for each repo; licensing counsel decisions for copied/modified source or redistributed assets.
2. `UPSTREAM_FILE_MANIFEST.csv`: every tracked source/config/plugin manifest path with language, size, hash and subsystem tag. Make clearly labeled `unclassified` queue.
3. `N8N_NODE_REGISTRY.csv`: each core/community node type; versions, resource/operation, parameter types, conditional display, credentials, trigger/webhook/poll, output ports, docs and tested parity.
4. `DIFY_BLOCK_REGISTRY.csv`: each workflow block, front/back type, fields, executor, input/output schemas, version and tests.
5. `DIFY_APP_REGISTRY.csv`: every Dify app variant with UI route and backend services, configuration, publishing, app API, history and embedding.
6. `AGENT_SKILL_PLUGIN_INVENTORY.csv`: strategy/provider, Agent node vs agent-chat runner, tool definitions, plugin daemon, manifests, skill capabilities and model categories. Record true upstream semantics of "skills" rather than conflating with tools or Claude-style skills.
7. `FORM_TRIGGER_MATRIX.csv`: every form field type, validation, trigger behavior, resume semantics, URL/auth features and response options.
8. `UI_INTERACTION_PARITY.md`: actual source-owned React/Vue components for home card, canvas, edge/toolbar, inspector, variable tree, mapping drop, expression editor, form and publishing UX; keyboard/mobile/a11y notes.
9. `BACKEND_EXECUTION_PARITY.md`: schedulers, queue workers, graph execution, checkpoints, concurrency, events, webhook lifecycle, API controllers, credentials, secrets and plugin policies.
10. `FEATURE_PARITY_MATRIX.csv`: feature owner, path, SHA, complexity, required endpoint/schema/worker/UI, quality tier, current state, assigned implementer, test evidence, license notes and release target.
11. `ORCHAI_PARITY_GAPS.md`: compare all of above against OrchAI existing repo with reproducible frontend/build/migration tests. Prioritize P0 broken designer/build/data, then nodes/mapping, then publish App/Form, then Agent/Skill/Knowledge and broader integrations.

**Review strategy:** identify relevant tracked files programmatically and inspect all distinct node/interface/plugin classes at least at manifest level; read representative complex implementations from each family, plus all app types, publishing, skill/strategy integration and security boundaries. A codebase of this size cannot be guaranteed "everything" through casual spot checks. The inventory + gap matrix is the measurable alternative. Extend this master spec from verified newly discovered features, tag uncertainty, and keep links to pinned source lines wherever possible.

### 43.1 Review checklist per upstream component

For each component, inspect: `description/manifest`, UI component and state management, backend handler, input validation, emitted output schema, error flow, auth/connection handling, persistence, tests, docs, upgrade version constraints, environment assumptions, and licensing. Record the feature only once if it spans multiple files. Separate behavior that is verified in source from expected behavior inferred from documentation, and from new OrchAI-designed behavior.

## 44. Cumulative release and completeness gate — non-negotiable

A release passes only if (a) all existing OrchAI features build and operate, (b) App catalog and mode-specific presentation work, (c) n8n-grade canvas, node-specific panels and mapping work, (d) `Agent` plus `Skill` plus `Tool` have DISTINCT wired screens and runtimes, (e) published workflow can act as a form/chat/API using the SAME graph version, (f) triggers, credentials, knowledge and model gateways work with safe persistence, and (g) migration/rollback, security and offline installation tests pass. Do not hide unfinished modules behind active navigation, claim every node type is supported, or mark an AI feature complete based on a mock response. Deliver cumulative releases as meaningful vertical slices with unimplemented capability exposed transparently.


# PART V — Source-reviewed completeness program, executable architecture and parity gates (v1.3, 2026-10-16)

> **Audit status, accurately stated:** This document extends the previous master specification with a more rigorous source-reviewed set of contracts. The precise files in Section 45 were directly fetched from the upstream GitHub repositories at their recorded blob hashes. This is **not** a claim that every file in two large, changing repositories was read, or that OrchAI currently implements every feature. The only responsible claim of exhaustive coverage comes after machine-generated inventories, reviewed differences, executable parity tests, and per-feature evidence are produced against pinned upstream commits. The reproducible inventory workflow below is a mandatory part of delivery.

## 45. Verified upstream source ledger and traceability

| System | Upstream path | Observed design evidence | Blob SHA / provenance |
|---|---|---|---|
| n8n | `packages/workflow/src/interfaces.ts` | Execution contexts, credentials and node types, item/binary data contracts | `71b9876e80b5a9113819258e9984f683a17ba701` |
| n8n | `packages/nodes-base/nodes/Schedule/ScheduleTrigger.node.ts` | Schedule node description, conditional intervals seconds/minutes/hours/days/weeks/months, cron and timing rules | `44c3042c87442d1f36238426b8170ed492ea1a1a` |
| n8n | `packages/nodes-base/nodes/Webhook/Webhook.node.ts` | Multiple HTTP methods, credential configuration, test/production activation, customizable outputs, response handling | `705f34e200da43f971f88c57c98c725b0670a645` |
| n8n | `packages/nodes-base/nodes/Form/v2/FormTriggerV2.node.ts` | Separate GET render and POST submit routes; form trigger configuration and authentication, output redaction | `e3e854c89cf5a1696ebbdfb32855f877312d01a1` |
| n8n | `packages/nodes-base/nodes/Form/common.descriptions.ts` | Conditional form field descriptions: checkbox, HTML, date, dropdown, email, file, hidden, number, password, radio, text, textarea | `f4f2b936da06e9e2d799a7181e268e0f1a88036e` |
| Dify | `web/app/components/workflow/types.ts` | Graph block enumeration: start/end/answer/LLM/knowledge/classifier/if/code/template/HTTP/variables/tools/extraction/iteration/agent/loop/human/data source/knowledge index/schedule/webhook/plugin triggers; graph state and error modes | `5d5782ebe6db82939f850a3f2cc56f9c63245334` |
| Dify | `web/app/components/workflow/nodes/agent/types.ts` | Agent strategy identity, plugin selector, strategy parameters, output schema, memory, versions | `11e9c22791edc5e0dde57752cfdc58385ad2c2c1` |
| Dify | `web/app/components/workflow/nodes/llm/types.ts` | Model, model selector, prompt, context, memory, vision, structured JSON output, reasoning format | `82a2eeb14d6c7e916ddb8603a4b4108c457b470a` |
| Dify | `web/app/components/workflow/nodes/knowledge-retrieval/types.ts` | Top-K, rerank, weighted keyword/vector, metadata filters and expression operators | `4b3ebc5c99496f060d7a30581865687e05666a3e` |
| Dify | `web/app/components/workflow/nodes/http/types.ts` | HTTP methods, body formats including file/multipart/form/JSON, auth and timeout | `6d89b7fa0187ff419ef14132f2c4ce7d1ab577cd` |
| n8n | `LICENSE.md` | Sustainable Use License and other license scope exceptions; separate enterprise code | `f85f59baa906530c26cee26e0c9ddd6bd5f86dbd` |
| Dify | `LICENSE` | Dify modified Apache-2.0 license and additional multi-tenancy / frontend branding restrictions | `329ee302875f292fdd11e12e830562d0be9ade1c` |

**Policy:** Never imply code copied from these projects can be redistributed under an ordinary MIT/Apache assumption. Perform counsel review for commercial reuse, frontend assets, proprietary enterprise components, attribution and downstream plugins. The examples in this document are original platform designs, not verbatim source extracts.

## 46. Exhaustive inventory must be generated, not guessed

At a chosen upstream commit, inspect every tracked file metadata entry, enumerate every node/trigger/credential/agent/tool/skill/app type, and create a `feature_id` for every externally observable capability. Group families but never use grouped row counts to pretend individual nodes have been implemented. Persist immutable source snapshot metadata.

```bash
# Execute in a real development machine with GitHub access; do not run against production.
git clone --filter=blob:none https://github.com/n8n-io/n8n.git upstream/n8n
git clone --filter=blob:none https://github.com/langgenius/dify.git upstream/dify
for project in n8n dify; do
  git -C upstream/$project rev-parse HEAD > "${project}-head.sha"
  git -C upstream/$project ls-files > "${project}-tracked-files.txt"
done
find upstream/n8n/packages/nodes-base/nodes -name '*.node.ts' -o -name '*.node.json' > n8n-node-source-files.txt
find upstream/n8n/packages/nodes-base/credentials -name '*.credentials.ts' > n8n-credential-source-files.txt
find upstream/dify/web/app/components/workflow/nodes -type f > dify-workflow-ui-files.txt
find upstream/dify/api -type f > dify-backend-source-files.txt
```

Use a parser (TypeScript AST, Python AST, manifest parser) instead of regular expressions to derive definitive type IDs, node versions, methods, properties and conditional visibility. Validate derived manifests manually for representative complex nodes. Import all inventory into `upstream_features` records (project, repo_commit, file, symbol, version, category, feature_id, evidence_sha, feature_dependency_ids). Emit inventories with deterministic sorting and checksums; never silently drop unparseable files.

**Repository coverage checklist:**

1. n8n editor shell; canvas controls; node graph interactions; node picker; node details view; expressions and result panels; run debugger; workflow versions; templates; projects/sharing; credentials; connections; triggers; webhook processors; form builders; node-description schema; node execution helpers; binaries and paired items; workers and queues; scheduling; active workflow registration; external secrets; subworkflows; variables; execution history; import/export; community packages; AI nodes; agent memory; embeddings and vector stores; HTTP integrations; file transport; error workflows; observability; licensing-specific features.
2. Dify Studio; app types and draft/published app experience; chat/completion/agent/workflow applications; conversation lifecycle and streaming; workflow editor and versioning; node definitions; app prompts and input schemas; context and structured output; model providers; LLM runtime; vision/audio/file handling; agents and strategies; tools/plugins/MCP; skills/manifest lifecycle where present at pinned version; dataset and knowledge pipeline; document ingestion; retrieval and reranking; citation rendering; feedback/annotations/evaluations; workflow monitoring; workspace accounts/roles; publishing/API/embeds; marketplace; security.
3. For each item, inspect frontend screen, dynamic fields/validation, service/API, runtime, database, deployment, tests and upgrade path. Maintain columns `verified_in_source`, `verified_in_tests`, `implemented_in_orchai`, `tested_end_to_end`; these flags mean different things.

## 47. Canonical complete node taxonomy and operations

Support node *families* and specific actions, not only colored rectangles. A family may have dozens or hundreds of operations and versions. Maintain an exact, versioned operation manifest for each one.

| Family | Examples of distinct nodes or operation types | UI and runtime specialization |
|---|---|---|
| Start/trigger | Manual, form, webhook, schedule, app invocation, chat message, file upload, email received, database change, poll, event subscription, plugin trigger | Distinct request/auth/listener settings, test/live URLs, event payload schemas |
| Flow control | If, Switch, Merge, Wait, Loop, For Each, Retry, Error, Stop, No-op, Subworkflow, Execute Workflow, Approval, Human Input | Typed branch handles, iteration state, durable waits and resumes |
| General data | Set/Edit Fields, JSON, parse, aggregate, split, filter, sort, rename, date/time, expressions, code, file conversion | Typed operations; preview and item-link preservation |
| Network and apps | HTTP, GraphQL, SQL, SMTP, IMAP, SFTP, SSH, storage, calendars, communication APIs, generic SaaS | Credentials, resource selector, operation selector, dynamic parameters and pagination |
| AI generation | LLM, text generation, structured generation, classification, parameter extraction, translation, moderation, tool use | Provider/model/temperature/token budget/prompt schema and output parsing |
| AI agents | ReAct/tool-calling agent, planning, delegation, multi-agent, handoff, agent-as-tool, guardrails, evaluation | Strategy-specific conditional inputs, tool/skill catalog, reasoning and iterations |
| RAG/knowledge | File source, document parse, OCR, chunk, embedding, vector search, hybrid search, rerank, knowledge write, citation | Data source/schema/index/version/metadata filters and provenance |
| Multimodal | STT, TTS, audio generation, image understanding, image creation, video analysis, document vision | MIME validation, binaries/artifacts, timestamps, transcription segments |
| Outputs | Answer, webhook response, chat response, form result, downloadable file, API JSON, email/send, event publish | Mode-specific output contracts and response streaming |
| Human collaboration | Form pages, approvals, assign task, pause/resume, escalations, SLAs | Public/authorized forms, secure resume tokens and deadlines |

**Every operation** must declare: `id`, `nodeType`, `version`, `resource`, `operation`, `inputPorts`, `outputPorts`, `fields`, `credentialTypes`, `dynamicOptionsLoader`, `execute`, `outputSchema`, `errorPolicies`, `visibilityConditions`, `scope`, `capabilities`, `testFixtures`, `migration`. The editor uses the same manifest that the backend validates; do not maintain disconnected UI and backend schemas.

## 48. Versioned node manifest with conditional nested fields (original TypeScript)

```ts
export type FieldType = 'text'|'textarea'|'number'|'boolean'|'select'|'multiSelect'|
  'json'|'code'|'expression'|'credential'|'file'|'resourcePicker'|'date'|
  'collection'|'fixedCollection'|'keyValue'|'mapping'|'model'|'skill'|'tool';
export type FieldCondition = { path: string; operator: 'eq'|'in'|'truthy'; value?: unknown };
export interface FieldDefinition {
  id: string; label: string; type: FieldType; required?: boolean;
  defaultValue?: unknown; help?: string; placeholder?: string;
  visibleWhen?: FieldCondition[]; options?: Array<{label:string;value:string}>;
  loadOptions?: { endpoint:string; dependsOn:string[] };
  children?: FieldDefinition[];
  supportsExpression?: boolean; supportsDrop?: boolean;
  isSecret?: boolean; validation?: {min?:number;max?:number;pattern?:string};
}
export interface NodeOperationManifest {
  operationId:string; title:string; fields:FieldDefinition[];
  inputSchema:unknown; outputSchema:unknown;
}
export interface NodeManifest {
  typeId:string; version:number; family:string; displayName:string;
  icon:string; trigger:boolean; inputs:Array<{id:string;dataType:string}>;
  outputs:Array<{id:string;dataType:string}>;
  credentials?:string[]; operations:NodeOperationManifest[];
  supportsStepTest:boolean; supportsBinary:boolean; supportsPartialExecution:boolean;
}
export const httpManifest: NodeManifest = {
  typeId:'core.http',version:1,family:'integration',displayName:'HTTP Request',
  icon:'globe',trigger:false,inputs:[{id:'main',dataType:'items'}],
  outputs:[{id:'success',dataType:'items'},{id:'error',dataType:'error'}],
  credentials:['none','apiKey','basic','oauth2'],
  supportsStepTest:true,supportsBinary:true,supportsPartialExecution:true,
  operations:[{operationId:'request',title:'Send request',inputSchema:{},outputSchema:{},fields:[
    {id:'method',label:'Method',type:'select',required:true,defaultValue:'GET',options:
      ['GET','POST','PUT','PATCH','DELETE'].map(value=>({label:value,value}))},
    {id:'url',label:'URL',type:'text',required:true,supportsExpression:true,supportsDrop:true},
    {id:'sendBody',label:'Send body',type:'boolean',defaultValue:false},
    {id:'bodyType',label:'Body format',type:'select',visibleWhen:[{path:'sendBody',operator:'eq',value:true}],
      options:[{label:'JSON',value:'json'},{label:'Multipart',value:'multipart'},
      {label:'Form encoded',value:'form'},{label:'Raw',value:'raw'}]},
    {id:'body',label:'Body',type:'mapping',supportsExpression:true,supportsDrop:true,
      visibleWhen:[{path:'sendBody',operator:'eq',value:true}]},
    {id:'auth',label:'Connection',type:'credential'}
  ]}]
};
```

Execution MUST reject invalid configurations (including invisible stale fields where prohibited), pin the manifest version to the workflow revision, and resolve operation-appropriate output schemas from actual runs. For dynamic options, apply cache, cancellation and scoped credentials. Secrets must never appear in execution preview.

## 49. Three-pane UX: entire interactions, not only layout

- LEFT: complete actual input *items* with Table, JSON, Schema and Binary tabs; choose run, previous node, item index, path, filter and search. Expand objects/arrays lazily. Show missing-path warnings and null/undefined distinctly.
- CENTER: selected node's parameters, settings, operation-specific fields, inline help, expression toggle, field-level drag targets, connections, retry, error handling, idempotency and Continue-on-Fail options. Changes validate immediately; draft updates persist safely without replacing last published revision.
- RIGHT: real output results, schema, performance, tokens/cost, binary metadata, error details, logs and request traces (secrets redacted). Allow Pin Data / Use Sample / Re-run node / Re-run from here / Copy as JSON; mark simulated/pinned data unmistakably.
- On double click, open inspector, focusing the relevant field; Escape closes if no unsaved edits; keyboard navigation; layout persists by user. Canvas must retain zoom/pan when panel opens.
- Drag a source leaf value onto a compatible target field => create an immutable AST expression referencing source node, output branch, item index/path, and execution context. Dropping must not bake the test value into a constant. Hover previews resolved value; preserve type and warn on compatibility mismatch.
- Values and binary files work across distinct output types: `text`, `number`, `boolean`, `object`, `array`, `fileRef`, `items`, `stream`, `error` with explicit coercion policies. Untrusted expressions execute in sandboxed evaluator, no arbitrary runtime JavaScript.

### 49.1 React drop target and variable token (original example)

```tsx
import React, {useState} from 'react';
type ValueReference = {nodeId:string; path:string; item?:number; output?:string};
type Binding = {kind:'literal';value:unknown}|{kind:'reference';ref:ValueReference};
const REF_MIME='application/x-orchai-node-field';
export function SourceVariable({refValue,label}:{refValue:ValueReference;label:string}) {
  return <button draggable onDragStart={e=>e.dataTransfer.setData(REF_MIME,JSON.stringify(refValue))}
    aria-label={`Drag ${label} into a parameter`}>{label}</button>;
}
export function MappableField({value,onChange,resolve}:{value:Binding;
 onChange:(next:Binding)=>void;resolve:(ref:ValueReference)=>unknown}) {
  const [preview,setPreview]=useState<unknown>(undefined);
  return <div className="mapping-field" onDragOver={e=>e.preventDefault()}
    onDrop={e=>{e.preventDefault();try{
      const ref=JSON.parse(e.dataTransfer.getData(REF_MIME)) as ValueReference;
      if(!ref.nodeId||!ref.path)return;
      onChange({kind:'reference',ref});setPreview(resolve(ref));
    }catch{ /* show invalid-source inline validation in full implementation */ }}}>
    {value.kind==='reference'?<code>{`${value.ref.nodeId}.${value.ref.path}`}</code>:
      <input aria-label="Literal value" value={String(value.value??'')}
        onChange={e=>onChange({kind:'literal',value:e.target.value})}/>}
    {value.kind==='reference'&&<output>{JSON.stringify(preview)}</output>}
  </div>;
}
```

**Required tests:** drag from form attachment to OCR file parameter; JSON array index to HTTP header; numeric classifier confidence to IF threshold; text from LLM to email; nonexistent output path on changed schema; source node renamed/deleted; cross-branch scope; multiple items, linked-items context; no fake preview for unexecuted steps.

## 50. Workflow execution durability and graph contracts

```ts
export interface ExecutionContext {
  runId:string; revisionId:string; tenantId:string; initiator:{type:'user'|'webhook'|'schedule'|'app'|'form';id:string};
  startedAt:string; timezone:string; traceId:string; cancelled:boolean;
}
export interface Item { json:Record<string,unknown>; binary?:Record<string,{assetId:string;mime:string;name:string}>;
  pairedItem?:{fromNode:string;index:number}; }
export interface PortOutput { port:string; items:Item[]; nextCursor?:string; schema?:unknown; }
export interface NodeExecutionResult { status:'success'|'error'|'waiting'|'skipped';
  outputs:PortOutput[]; metrics?:{durationMs:number;tokens?:number;cost?:number};
  error?:{kind:string;message:string;retryable:boolean}; resumeTokenHash?:string; }
export interface NodeRuntime {
  execute(ctx:ExecutionContext,inputs:PortOutput[],config:Record<string,unknown>):Promise<NodeExecutionResult>;
}
```

A production worker MUST enforce graph validity, topological readiness, branch semantics, item pairing, loop bounds, checkpoint persistence, cancellation, idempotency keys, retry policies, exponential backoff, dead-letter handling, job leases, secure state restore, concurrency quotas, timeout limits, binary retention and isolation. Do not regard a synchronous mock graph traversal as a workflow engine. A graph is published as an immutable revision and all production run events reference that revision. Resume waiting workflows after restart; ensure triggers do not double-fire following lease expiry.

## 51. Unified application presentation: forms, chat, agents and API, one flow

An **App** is a published experience, not a synonym for a workflow definition. App modes include `chat`, `agent`, `completion`, `workflow`, `form`, `multiStepForm`, `fileAnalysis`, `voice`, `api`, `embedded`, `humanApproval`. One App references an immutable published workflow revision; an editor can create several apps with different input bindings, branding and outputs backed by the same workflow.

```ts
export interface PublishedApp {
  id:string; mode:'chat'|'agent'|'completion'|'workflow'|'form'|'multiStepForm'|'fileAnalysis'|'voice'|'api'|'embedded'|'humanApproval';
  title:string; slug:string; revisionId:string; access:'private'|'workspace'|'public'|'token';
  inputBindings:Record<string,{source:'form'|'chat'|'api'|'default';field?:string;value?:unknown}>;
  outputBindings:Record<string,{nodeId:string;port:string;path:string}>;
  ui:{logoAssetId?:string;theme:'system'|'light'|'dark';locale:string;showProgress:boolean};
  guardrails:{maxRequestsPerMinute:number;fileMaxBytes:number;requiresAuth:boolean};
  lifecycle:'draft'|'published'|'suspended';
}
```

**Example:** publish `Customer Support Triage` in three modes: a branded public intake form (name/email/topic/file), a conversational chat assistant (follow-up questions), and a machine API endpoint. Each launches one revision of a common graph `Start → Validation → OCR → KB retrieval → Agent → IF priority → Human approval/Ticket → Response`. Form fields and chat variables bind to identical canonical graph parameters with explicit per-app validation. App analytics aggregate requests/run outcomes by app ID, graph revision, trigger and tenant without leaking cross-tenant content.

## 52. Form Builder parity including multi-step forms and resumable human tasks

**Designer:** drag reorder form fields and pages; sections, text, email, phone, number, date/time, select, multi-select, radio, checkbox, rating, file, password, hidden, textarea, read-only, computed, consent and rich content (sanitize HTML); responsive preview and theme; multilingual labels and messages; conditional visibility, calculated defaults, dynamic select options, dependent selects and server-side validation. Repeater/group support and field-level visibility policies.

**Publishing:** draft vs production URL, GET for rendering schema/HTML and POST for submission; rate limiting, captcha option, upload presigned tokens, virus scanning, max size/MIME limits, antiforgery for same-site session forms, public-form auth options, IP allowlist, webhook signature for server callers, TLS URL construction behind proxy, custom slugs, expiry dates, CSRF and CORS as appropriate. Sensitive form values and passwords never included in logs.

**Flow:** per-field mapping; branching based on submitted values; email verification option; duplicate detection; webhook response node; result/success/error redirect; form submit event schema preview; workflow step run appears immediately in execution history; use same form as *Human Input/Approval* during paused execution; securely resume with one-time expiring token, task identity and audit history.

```ts
export interface FormField { id:string;kind:string;label:Record<string,string>;
 required:boolean;defaultValue?:unknown;options?:{label:string;value:string}[];
 showWhen?:{fieldId:string;operator:'eq'|'in'|'exists';value?:unknown};
 validation?:{regex?:string;min?:number;max?:number;mime?:string[];maxBytes?:number}; }
export interface FormPage {id:string;title:string;fields:FormField[]; nextRule?:unknown;}
export interface FormDefinition {id:string;version:number;pages:FormPage[];
 response:{mode:'message'|'redirect'|'workflowOutput';message?:string;redirectUrl?:string};}
```

## 53. Trigger platform with understandable configuration and full lifecycle

| Trigger | Easy default | Advanced controls | Runtime lifecycle |
|---|---|---|---|
| Manual | Execute Workflow | sample/pinned input | no subscription |
| Schedule | Every 10 sec / minute / hour / day / specified time | cron, timezone, calendar, DST, blackout, missed-fire policy | persistent recurrence, distributed lease, skip/backfill |
| Webhook | Copy Test URL / Production URL | methods, path, headers/query/body, auth/IP limits, response node, content type | listen/test TTL, production registration, paused/published revision |
| Form | Public Form URL | auth, validation, file upload, conditional pages | form publish and submission event |
| Email | Received email | IMAP connection, filters, attachments | polling or push subscriptions |
| Event | Application event / message | event types, filter, signature, service bus | subscription and acknowledgement |
| Poll | Every N seconds/minutes | incremental cursor, dedupe | persisted cursor and rate limits |
| App | Chat/API/Agent called | user authorization, input schema, streaming | app invocation bound to revision |
| Human task | Approval submitted | single-use token, timeout, escalation | resume checkpoint |
| Database | Row changed | connector, CDC/poll, table and filter | watermark/reconciliation |

Second-level recurrence is explicitly supported where deployment limits permit it, independently of an hourly notification service. For `every 10 seconds` use the scheduler system with validated run frequency, not a browser timer. Implement periodic heartbeat and drift metrics. For single cron instance use an interoperable cron library; for HA use persistent schedule rows, locked due triggers and unique `(schedule_id,scheduled_at)` fire keys.

### 53.1 Trigger and publication APIs

```http
POST   /api/workflows/:id/triggers
GET    /api/workflows/:id/triggers
PATCH  /api/triggers/:id
POST   /api/triggers/:id/test-listen
POST   /api/triggers/:id/test-fire
GET    /api/triggers/:id/next-occurrences
POST   /api/workflows/:id/publish
GET    /webhooks/test/:id/:path
POST   /webhooks/test/:id/:path
POST   /webhooks/:publicId/:path
GET    /forms/:slug
POST   /forms/:slug/submissions
POST   /api/tasks/:taskId/complete
GET    /api/runs/:runId/stream
```

Test URL and live URL MUST be distinct, and a test listener must never execute production revisions by accident. A node can define different HTTP methods and configurable responses. Correctly handle submitted files and binary references, not only JSON.

## 54. Agents, skills, tools, plugins and MCP are different entities

| Concept | Persistence unit | UX | Execution |
|---|---|---|---|
| Agent | Versioned agent definition | Create Agent, prompts, strategy, models, memory, tool/skill permissions, run traces | Bounded plan/tool/observe/respond loop |
| Skill | Manifest plus optional resources/instructions | Skills catalog, preview, install/approve, version selection and policies | Permission-filtered instructions/resources/actions; no implicit arbitrary shell |
| Tool | Callable operation with JSON schema and auth | Tool picker and parameter form, test tool | Validated input → scoped execution → typed result |
| Plugin | Signed/versioned package declaring tools/nodes/models/triggers | Marketplace or offline admin installer, compatibility and security checks | Sandboxed plugin host with quotas |
| MCP | Scoped remote/local tool server connection | MCP servers, discovery, allowlist, reconnect and permissions | Protocol client, schema validation and provenance |
| Model Provider | Models, quotas, credentials, endpoint routing | Model settings, capabilities, tests and fallback | OpenAI-compatible/local/other gateway with model capability checks |
| Knowledge | Datasets, indexes, ingestion jobs and retrieval policies | Knowledge UI and pipeline designer | ETL → chunk → embedding → hybrid retrieval → rerank → citation |

Do not represent installing a skill as merely adding a node. A skill can be granted to an Agent, and an Agent can be embedded into a workflow node or published as an App. Agent handoff must preserve context under token budgets. Record tool-call arguments/results with redaction, authorizations and billing metrics. Support multimodal agent inputs and offline-only providers with no accidental cloud calls.

### 54.1 Agent policy enforcement (original backend example)

```ts
type ToolSpec = {id:string;inputSchema:unknown;execute:(args:unknown)=>Promise<unknown>};
type AgentConfig = {modelId:string;maxIterations:number;allowedToolIds:string[];
 maxOutputTokens:number;maxTotalTokens:number;timeoutMs:number};
export async function runAgent(cfg:AgentConfig, tools:Map<string,ToolSpec>,
 invokeModel:(input:unknown)=>Promise<{done:boolean;answer?:string;call?:{tool:string;args:unknown}}>,
 check:(toolId:string,args:unknown)=>Promise<void>) {
  const iterations=Math.min(Math.max(cfg.maxIterations,1),30);
  const transcript:unknown[]=[];
  for(let i=0;i<iterations;i++) {
    const step=await invokeModel({transcript,remaining:iterations-i});
    if(step.done)return {answer:step.answer??'',transcript};
    if(!step.call)throw new Error('Agent returned no answer or tool call');
    if(!cfg.allowedToolIds.includes(step.call.tool))throw new Error('Tool not allowed');
    const tool=tools.get(step.call.tool);if(!tool)throw new Error('Unknown tool');
    await check(tool.id,step.call.args); // Also validate schema, tenant and action scope in production.
    const result=await tool.execute(step.call.args);
    transcript.push({tool:tool.id,result});
  }
  throw new Error('Agent iteration limit reached');
}
```

Production additions: AbortSignal/timeout around *every* tool/model invocation, JSON-schema validation, budget counters, streaming tokens, conversation persistence, retrieval sources, PII redaction, approvals for side effects, recursion limits, source provenance, test harness and structured exceptions. The sample deliberately does not pretend to be a complete safe agent runner.

## 55. Connections, credentials and node-specific integration UX

Credentials are not arbitrary text boxes. Each credential type defines its own setup, OAuth/browser flow, token refresh, connection test, scope requirements and rotation. Resources and operations may change their visible fields and dynamically loaded options. A `Microsoft 365 → Send email` node should not present the fields of `SQL Server → Execute query` or `HTTP Request → Send body`.

Store credentials encrypted with KMS/envelope encryption, tenant and workspace ownership, audit records, controlled secret rotation and grants to workflows. Only the backend resolves secrets at execution; never send decrypted values to the frontend or node output. Provide a Connections Center: provider catalog, active connection cards, credential status, scopes, expiring tokens, test, revoke, owner, usage and restricted cross-workspace sharing. In an air-gapped installation support offline services, local OAuth alternatives if supported, manual secrets and service accounts.

## 56. Knowledge, RAG, document pipeline and AI evaluation

Mandatory flows: create KB; select files/data connectors; staged upload; virus checks; parse PDF/DOCX/HTML/CSV/images; OCR; table and image metadata; chunk/rechunk; embeddings; vector storage; metadata indexing; retrieval filter; hybrid query; rerank; source snippets; citations in answer; access control at retrieval and result time; version/reindex; archive/delete; job progress; quality measurements. Explain the distinction between indexing workflow and end-user retrieval workflow.

Models: chat, reasoning, embedding, rerank, image understanding, OCR, transcription/STT, speech/TTS, optional image generation. Every model has a capability declaration (vision/audio/tools/structured JSON/context/input length/streaming/residency/cost). UI hides or warns about incompatible features. Agent / workflow traces show selected model, latency, usage and error; redact content where policy requires it.

## 57. Data model addendum (PostgreSQL with tenant-safe keys)

```sql
CREATE TABLE IF NOT EXISTS upstream_source_snapshots (
 id uuid PRIMARY KEY, project text NOT NULL, repo_url text NOT NULL,
 commit_sha text NOT NULL, captured_at timestamptz NOT NULL DEFAULT now(),
 inventory_sha256 text, UNIQUE(project,commit_sha));
CREATE TABLE IF NOT EXISTS parity_features (
 id text PRIMARY KEY, source_snapshot_id uuid REFERENCES upstream_source_snapshots(id),
 source_path text, source_symbol text, family text NOT NULL,
 proposed_module text NOT NULL, source_verified boolean NOT NULL DEFAULT false,
 backend_implemented boolean NOT NULL DEFAULT false,
 frontend_implemented boolean NOT NULL DEFAULT false,
 tested_end_to_end boolean NOT NULL DEFAULT false, qa_evidence_url text);
CREATE TABLE IF NOT EXISTS node_manifests (
 type_id text NOT NULL, version int NOT NULL, schema_json jsonb NOT NULL,
 enabled boolean NOT NULL DEFAULT true, PRIMARY KEY(type_id,version));
CREATE TABLE IF NOT EXISTS app_presentations (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL, workflow_revision_id uuid NOT NULL,
 mode text NOT NULL, slug text NOT NULL, definition jsonb NOT NULL,
 state text NOT NULL, UNIQUE(tenant_id,slug));
CREATE TABLE IF NOT EXISTS workflow_triggers (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL, workflow_revision_id uuid NOT NULL,
 type text NOT NULL, config jsonb NOT NULL, enabled boolean NOT NULL DEFAULT false,
 next_fire_at timestamptz);
CREATE TABLE IF NOT EXISTS trigger_fires (
 trigger_id uuid NOT NULL REFERENCES workflow_triggers(id), scheduled_at timestamptz NOT NULL,
 execution_id uuid, PRIMARY KEY(trigger_id,scheduled_at));
CREATE TABLE IF NOT EXISTS execution_node_outputs (
 execution_id uuid NOT NULL, node_id text NOT NULL, branch_id text NOT NULL,
 item_index int NOT NULL, output_json jsonb NOT NULL, output_schema jsonb,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(execution_id,node_id,branch_id,item_index));
```

Add composite tenant-safe FKs/RLS policies, retention rules, indexes, encrypted/separated binary references, migration rollback policy and concurrency tests before production. Never store credential secrets, password form values or raw sensitive tokens in execution outputs.

## 58. UI route map and view-level acceptance

| UI | Core behavior | API/backend proof |
|---|---|---|
| `/studio` | Dify-inspired apps/flows home, filters, favorites, templates, collections | real pagination, listing, RBAC |
| `/studio/apps/:id` | App Overview, Prompt/Model, Experience, Monitoring, API, Embed, Publish | versioned app settings, analytics |
| `/studio/workflows/:id` | n8n-grade graph and node inspector; minimap, branch handles, mapping, errors, undo/redo, hotkeys | draft persistence, graph validation, execution |
| `/studio/runs/:id` | Timeline, node input/output, cost/tokens, item data, logs, retries, replay | persisted execution traces and SSE |
| `/studio/forms/:id` | WYSIWYG form builder, multi-page, conditional fields, file uploads, theme, preview | schema validation, public endpoint |
| `/studio/agents` | Create/configure/test agent, strategy, tool access, memory, knowledge | agent runtime and persisted versions |
| `/studio/skills` | Browse/import/test/approve versioned skills, usage policy | signed/approved installation and registry |
| `/studio/tools` | Tools catalog, JSON schemas and credentials | callable sandbox and test results |
| `/studio/models` | Provider setup, model capability tests, budgets/fallback | model gateway health and quotas |
| `/studio/knowledge` | Datasets, upload, indexing, RAG pipeline, citations | ingestion workers and retrieval |
| `/connections` | credentials, OAuth, scopes, test and rotate | encrypted credential backend |
| `/marketplace` | templates and extensions, offline installer | package trust policy and isolated runtime |
| `/admin` | tenants, users, roles, audit, quotas, maintenance, release manager | RBAC, audit, migrations and backups |

Mobile layout must support viewing flow and editing forms/parameters, though complex canvas authoring can require desktop. Light/dark follow system by default with user override. Keyboard-only, screen-reader labels, RTL and responsive overflow are required. No navigation to placeholder features presented as completed.

## 59. Evidence-driven acceptance suite and failure handling

**End-to-end scenario 1 — Form + agent + approval:** Create a multi-page form with name, email, priority and PDF file. Publish test URL, submit sample, view a live run, map real attachment by dragging into OCR input, execute OCR alone, drag extracted text to agent, give agent a knowledge skill and allowed ticket tool, branch on priority, assign human approval, resume through authenticated form, receive final response. Reload and ensure draft/publish revisions and outputs persist.

**Scenario 2 — 10-second schedule:** Create schedule trigger for every 10 seconds, inspect next 10 occurrences, publish, verify observed fires within tolerance, restart workers, prove no duplicate `(trigger,scheduled_at)` and zero browser dependence. Disable and verify no further fires.

**Scenario 3 — Dynamic connector:** Create connection; select node resource and operation; ensure conditional fields update; test dynamic options; map a previous output into a typed parameter; handle pagination, rate limits and invalid credentials; rotate secrets and verify subsequent execution.

**Scenario 4 — AI multimodal:** User uploads scanned Arabic PDF, triggers OCR, indexing, RAG with rerank, agent with structured output, model-compatibility checks, citations, and optional STT/TTS; run fully offline when cloud disallowed. Record source pages, usage, evaluation and negative tests.

**Scenario 5 — Publishing modes:** Use *the same immutable workflow revision* via chat UI, API, published form and embedded app. Confirm different presentation settings and identical backend graph semantics, input validation, authentication policies, analytics, cancellation and error handling.

**Scenario 6 — Security:** Cross-tenant attempt, forged webhook signature, replayed form/approval token, oversized file, expression escape attempt, workflow revision race, plugin with forbidden network access, credentials displayed in previews. Each must fail safely with audit events.

## 60. Delivery bundles and quantitative closure requirements

Deliver the following **with the resulting implementation**, not merely as aspirational filenames:

- `UPSTREAM_REVISIONS.lock.json` — exact immutable commit SHAs and repo license hashes.
- `N8N_ALL_NODE_TYPES.csv` — discovered node ID, versions, resources/operations, field schema paths, credential class, execution class, output/test coverage.
- `DIFY_ALL_BLOCKS_APPS_AGENTS_SKILLS.csv` — all discovered blocks, app modes, agent strategies, skill/plugin/tool metadata and source symbols at the pinned commit.
- `UI_COMPONENT_TRACEABILITY.csv` — upstream UI interaction → native OrchAI component/file → corresponding API and proof.
- `EXECUTION_ENGINE_TRACEABILITY.csv` — source concepts → implemented worker/queue/scheduler/handler → durability tests.
- `PARITY_GAPS.csv` — missing/partial/complete/verified with exact evidence links and risk.
- `TEST_RESULTS.json`, Playwright screenshots and recorded sample traces for every core scenario.
- `LICENSE_REVIEW.md` — external-counsel decisions where source copying or trademark-sensitive reuse is proposed.

**Gates:** A feature is `Complete` only if schema, UI, API, executor, validation, persistence, RBAC and tests exist. `Source-reviewed` means an actual upstream implementation and its tests have been inspected, not a README mention. `Exhaustively audited` requires a machine-generated tracked-file list and dispositions for all applicable implementation files; dynamically generated plugins and optional enterprise-only code must be explicitly marked as outside the pinned public source. Report numeric percentages only with denominators and excluded categories. Never label a release "100% parity" based only on passing a handful of workflows.

## 61. Build orchestration instructions for an implementation agent

1. Read this *entire* cumulative specification and baseline the existing OrchAI code/database first. Do not discard functioning components.
2. Clone/pin upstream source snapshots, respect both licenses, generate inventories automatically, and inspect their actual node/agent/form/frontend/backend paths.
3. Design one typed node registry and one persisted engine; no hardcoded fake node inspector or per-demo backend.
4. Prioritize Dify-like Studio and n8n-quality canvas/interactions together, then live step outputs and mapping, form/app publishing, triggers/connections, Agent/Skill/Tool, knowledge and multimodal AI.
5. Implement coherent vertical slices spanning UI + API + DB + worker + migration + tests; never claim an unconnected UI mock as implementation.
6. Provide evidence and linked source references for every implemented family; all errors resolved and successful local/prod installation, health and rollback verified before handoff.
7. Re-run upstream diff and regenerate parity matrices on every major release; show newly discovered feature gaps instead of silently changing scope.

**Ultimate quality bar:** the ease of n8n's contextual three-pane node setup and drag-from-real-output mapping; Dify's approachable Studio/App UX and modern AI/Agent/RAG stack; n8n's triggers, connections, forms and integration depth — all delivered as one independently designed, integrated and secure OrchAI product.

---

# Part XXIV — Source-level audit expansion (2026-10-16, v1.4)

> This section records *verified individual source files*, with paths, blob SHAs, design findings, target modules, acceptance tests, and original integration examples. It is an expansion, **not** a claim of exhaustive inspection of every file or integration in either fast-changing repository. Treat source links as references, not permission to transplant restricted code. Pin upstream commits before implementing.

## 24.1 Verified repository source register

| # | Project | Path (relative to repository root) | SHA (Git blob) | Finding / OrchAI requirement |
|---|---|---|---|---|
| 1 | n8n | `packages/frontend/editor-ui/src/features/ndv/runData/components/RunDataJson.vue` | `cb78fcbd6bb73be44788cb64283ba527dc74cc81` | JSON execution view builds field-path expressions and starts mapping drag gestures. Create `RunDataJson`, path-aware drag payloads, and expression persistence. |
| 2 | n8n | `packages/frontend/editor-ui/src/features/ndv/runData/components/RunDataTable.vue` | `a63fe2dc33fee1ca1793d3720b25e4e3c46b23ea` | Tabular results support mapping, run item pairing, display modes and column hover. Include item lineage, stable mapping paths, and JSON/Table parity. |
| 3 | n8n | `packages/frontend/editor-ui/src/features/ndv/runData/components/VirtualSchema.vue` | `502fa3b4b8b7e13654d1d790c86b1d3f13a2872c` | Schema trees can derive from live execution or declared schema, are virtualized for large structures, and can execute missing inputs. Build scalable searchable output-schema tree. |
| 4 | n8n | `packages/cli/src/credential-types.ts` | `6a3280cdc6e6d7121df2a9cc9d01a16ce94d364e` | Credential types are discoverable, have supported nodes, and can inherit parent types. Implement a versioned credential definition registry, not a single global API key. |
| 5 | n8n | `packages/workflow/src/mcp-helpers.ts` | `3523eb307b9b82bf5caa375567e1cfa90bc8790e` | MCP endpoint definitions include transport, credential binding, template resolution and refresh rules. Never open a templated endpoint before resolving and validating its host. |
| 6 | n8n | `packages/nodes-base/nodes/Schedule/ScheduleTrigger.node.ts` | `44c3042c87442d1f36238426b8170ed492ea1a1a` | Seconds, minutes, hours, days, weeks, months and cron are real scheduler configuration variants. |
| 7 | n8n | `packages/nodes-base/nodes/Webhook/Webhook.node.ts` | `705f34e200da43f971f88c57c98c725b0670a645` | Test and production webhook URLs, configurable HTTP methods, output connection behavior, auth and response modes. |
| 8 | n8n | `packages/nodes-base/nodes/Form/v2/FormTriggerV2.node.ts` | `e3e854c89cf5a1696ebbdfb32855f877312d01a1` | Form trigger has setup/render and submit paths, credential requirements, output types and response modes. |
| 9 | n8n | `packages/nodes-base/nodes/Form/common.descriptions.ts` | `f4f2b936da06e9e2d799a7181e268e0f1a88036e` | Verified elements include checkbox, HTML, date, dropdown, email, file, hidden, number, password, radio, text and textarea; design validation must follow field type. |
| 10 | n8n | `packages/workflow/src/interfaces.ts` | `71b9876e80b5a9113819258e9984f683a17ba701` | Distinct trigger, polling, webhook, execute and supply-data runtime contracts: one generic run() method is insufficient. |
| 11 | Dify | `web/features/agent-v2/AGENTS.md` | `d9e9a517f7e984564c36abe2d07d3198d153429d` | **Agent V2 is distinct from legacy Agent**: separate composition state, dedicated node kind and version discriminator. Do not erase compatibility boundary. |
| 12 | Dify | `web/app/components/workflow/nodes/agent/types.ts` | `11e9c22791edc5e0dde57752cfdc58385ad2c2c1` | Legacy strategy-provider/name, parameters, schema, plugin identifier, memory and version require an explicit versioned agent contract. |
| 13 | Dify | `web/app/components/workflow/nodes/llm/types.ts` | `82a2eeb14d6c7e916ddb8603a4b4108c457b470a` | LLM node includes model selector, prompts, context, memory, vision, structured output and reasoning format. |
| 14 | Dify | `web/app/components/workflow/nodes/knowledge-retrieval/types.ts` | `4b3ebc5c99496f060d7a30581865687e05666a3e` | Retrieval requires rerank, top-k, score threshold, weighted hybrid search and metadata condition types. |
| 15 | Dify | `web/app/components/workflow/nodes/http/types.ts` | `6d89b7fa0187ff419ef14132f2c4ce7d1ab577cd` | HTTP operation configuration spans method, content type, body, auth, connect/read/write timeout and SSL verification. |
| 16 | Dify | `web/app/components/workflow/types.ts` | `5d5782ebe6db82939f850a3f2cc56f9c63245334` | Typed block catalog includes agent variants, tool, knowledge, iteration, loop, human input and trigger families; `ValueSelector` is path-based. |
| 17 | Dify | `api/core/plugin/impl/agent.py` | `6697cc7cb0c98244b604bbf4714b94ab264a2bbc` | Agent strategies discovered and invoked via plugin daemon; execution is streamed and includes tenant/user/conversation contextual identity. |
| 18 | Dify | `api/factories/agent_factory.py` | `2570bc22f1cf73f336e78adaef74cb77d63d084e` | Agent strategy resolution depends on provider+name+tenant and provider version; pin strategy version per published app. |
| 19 | Dify | `api/events/event_handlers/update_app_triggers_when_app_published_workflow_updated.py` | `d55fe262fb25a39e71dccf0f956741b4e6f365d4` | Publishing reconciles trigger records by graph node ID: removes old records, inserts new ones, updates titles. OrchAI publish must be transactionally reconciled. |
| 20 | Dify | `api/events/event_handlers/sync_workflow_schedule_when_app_published.py` | `5f8fcd86170b7a15c7f4b91455b1071b0f38bdf3` | Publish creates/updates/deletes persisted schedule plans derived from the graph, with timezone and cron. |
| 21 | Dify | `api/controllers/console/app/workflow_node_output_inspector.py` | `f473d0313750bad83ff52f958151a1b8c7cbf2fe` | Snapshot, node detail, output previews and SSE are available for **both draft and published runs**; expose tenant/RBAC-controlled output inspection. |
| 22 | n8n | `LICENSE.md` | `f85f59baa906530c26cee26e0c9ddd6bd5f86dbd` | License restrictions and enterprise edition boundaries; copying source requires a separate licensed-use review. |
| 23 | Dify | `LICENSE` | `329ee302875f292fdd11e12e830562d0be9ade1c` | Modified Apache-based licensing contains additional conditions; check use case and branding before copying. |

Source browser prefix: `https://github.com/n8n-io/n8n/blob/master/` and `https://github.com/langgenius/dify/blob/main/` followed by listed path. SHA identifies the verified file *blob*, not a complete repository snapshot.

## 24.2 Critical missing behavioral contracts (mandatory)

### A. Actual-output mapping is NOT copying sample JSON

1. Run an upstream node, obtain an execution ID, and display **JSON**, **Table**, and **Schema** views from the same persisted output records.
2. Drag a scalar, object, array element, binary attachment or schema field from an upstream run into a valid parameter control of a downstream node.
3. Serialize a **reference descriptor** `{sourceNodeId, outputPort, itemPolicy, pathTokens, expectedType}` into the graph, not the sample value. Show a human-readable expression chip.
4. Preview value using selected run ID and output item index, preserving lineage. When data is absent, display *No sample run* and offer **Execute previous steps**; never silently turn missing data into empty string.
5. Support missing/null values, optional chaining, explicit fallback, numeric coercion, arrays, mapping over items, multiple node runs, paired item index, binary data and runtime-defined outputs.
6. Validate upstream reachability, type compatibility, loop scope, permission to read output, secret masking and recursion before saving.
7. Offer a keyboard-accessible **Insert variable** option with the same behavior as drag-and-drop.
8. Replaying a pinned run must never fetch later, unrelated outputs; published graph must resolve against each execution's own data.

### B. Dynamic node definition lifecycle

`NodeDefinition` must include **node family, type ID, immutable version, display name, icon, categories, inputs, outputs, credentials, operations, property UI schema, dynamic options endpoint, output schema, capabilities, permissions, docs, example fixtures, migrations, validation schema, executable handler reference and visibility rules**. Values must be versioned separately from presentation. A user's existing workflow cannot break because an upstream connector's dynamic options changed.

Node definition requirements: rich text, plain text, secret, number, boolean, select, multi-select, async/searchable select, resource locator, operation selector, credentials picker, file, JSON editor, expression editor, code editor, array/object/repeater/collection, table mapping, dates, time zones, cron builder, model selector, prompt editor, schema editor, tool selector and conditional form sections. Every definition needs no-selection/invalid-loading/valid/disabled/error states. Resource and operation choices should dynamically change property sets, credentials and output schemas.

### C. Dify Agent V2 is a separate entity

Agent V2 configuration is not a rewrite of legacy strategy nodes. Define discriminator `agentKind: 'legacyStrategy' | 'agentV2'`; a separately versioned V2 model (identity, prompt, policy, tools, skill bindings, knowledge, memory, sandbox, steps, handoff, checkpoints and publish state). Preserve backward-compatible import, provide a deliberate migration wizard, and independently test both kinds until migration is proven.

### D. Publish is an atomic *deployment* operation

Draft editing never changes active public routes. Publishing freezes graph+node versions+agent strategies+credential references+forms+app presentation in a published revision. Reconcile webhooks, schedules, form endpoints, API deployments and connection subscriptions against the new revision. On failure, roll back provisioning, retaining last known-good publication; audit who changed what. Automatic reconciliation must be idempotent, and schedule workers must use a lease to prevent duplicate firing.

### E. Forms are a first-class app surface

A single workflow can be published simultaneously as web app, embedded chat, structured form, API and a human task inbox if its configured inputs allow that. Support page groups, conditional questions, sections, choice lists, uploads, validation, field defaults, prefill with signed tokens, guest/authenticated identities, organization branding, completion page/redirect, invitation links, draft submissions (where enabled), accessibility and localization (including RTL). Distinguish test versus production links. Run form submissions through the same versioned execution graph, not a second form-only workflow engine.

### F. Ingress and trigger reliability

Support HTTP methods, path parameters, headers, query, body, multipart/file uploads, test and production routes, public versus protected access, HMAC signature verification, basic/API key/OAuth as applicable, rate limiting, CORS rules, IP policy, request-size limits, response mode (immediate/deferred/last step), replay ID, deduplication key, expiry, and redacted request logging. Calendar scheduling supports seconds intervals (including 10-second intervals if permitted by configured deployment quotas), fixed time, day/week/month, time zone, DST transitions, blackout windows, catch-up policy and missed-run behavior. Shared poll connectors require cursor storage, lease and durable checkpoints.

## 24.3 Original shared TypeScript contracts

These snippets are independently authored **reference contracts**, not directly copied from upstream source.

```ts
// packages/contracts/src/node-definition.ts
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type ParameterField = {
  name: string;
  label: string;
  kind: 'string' | 'number' | 'boolean' | 'select' | 'multiselect'
      | 'json' | 'expression' | 'file' | 'credential' | 'model'
      | 'secret' | 'collection' | 'schema' | 'cron';
  required?: boolean;
  expressionAllowed?: boolean;
  visibleWhen?: { field: string; equals: JsonPrimitive };
  options?: { label: string; value: string }[];
  optionsEndpoint?: string;
  children?: ParameterField[];
  sensitive?: boolean;
};

export type Port = { id: string; type: 'main' | 'error' | 'ai-model' | 'tool' | 'memory' | 'binary' };
export type NodeDefinition = {
  type: string;
  version: string;
  family: string;
  title: string;
  inputs: Port[];
  outputs: Port[];
  credentialTypes?: string[];
  operations: Record<string, { fields: ParameterField[]; outputSchema: object }>;
  capabilities: ('execute' | 'trigger' | 'poll' | 'webhook' | 'supply' | 'test')[];
};

export type VariableReference = {
  kind: 'nodeOutput';
  sourceNodeId: string;
  outputPort: string;
  path: (string | number)[];
  itemPolicy: 'paired' | 'first' | 'all' | 'index';
  index?: number;
  fallback?: JsonValue;
};
export type BoundValue = JsonValue | { $ref: VariableReference };
```

```ts
// apps/api/src/workflows/value-resolver.ts
import type { BoundValue, JsonValue, VariableReference } from '@orchai/contracts';

export interface ExecutionContext {
  getNodeItems(nodeId: string, port: string): ReadonlyArray<JsonValue> | undefined;
  pairedIndex(sourceNodeId: string, targetNodeId: string, targetItemIndex: number): number | null;
}
function pathOf(value: unknown, segments: readonly (string | number)[]): unknown {
  return segments.reduce<unknown>((current, part) => {
    if (current === null || typeof current !== 'object') return undefined;
    return (current as Record<string | number, unknown>)[part];
  }, value);
}
export function resolveReference(
  ref: VariableReference,
  execution: ExecutionContext,
  targetNodeId: string,
  targetItemIndex: number,
): JsonValue | undefined {
  const items = execution.getNodeItems(ref.sourceNodeId, ref.outputPort);
  if (!items) return ref.fallback;
  const selected = ref.itemPolicy === 'all'
    ? items.map(item => pathOf(item, ref.path))
    : pathOf(items[ref.itemPolicy === 'index' ? (ref.index ?? 0)
      : ref.itemPolicy === 'paired'
        ? (execution.pairedIndex(ref.sourceNodeId, targetNodeId, targetItemIndex) ?? -1)
        : 0], ref.path);
  return selected === undefined ? ref.fallback : selected as JsonValue;
}
```

The execution engine must additionally enforce tenant authorization, topological reachability, secret redaction, type validation, stream/file handling, size limits, and loop safety; the above helper is a minimal contract demonstration, not a complete security boundary.

```tsx
// apps/web/src/workflow/OutputMappingField.tsx
import { useState } from 'react';
import type { VariableReference } from '@orchai/contracts';

type Props = {
  label: string;
  value: VariableReference | null;
  onChange: (value: VariableReference) => void;
  preview: (value: VariableReference) => Promise<string>;
};
export function OutputMappingField({ label, value, onChange, preview }: Props) {
  const [sample, setSample] = useState('');
  function accept(raw: string) {
    try {
      const ref = JSON.parse(raw) as VariableReference;
      if (ref.kind !== 'nodeOutput' || !Array.isArray(ref.path) || !ref.sourceNodeId) return;
      onChange(ref);
      void preview(ref).then(setSample).catch(() => setSample('Preview unavailable'));
    } catch { setSample('Unsupported mapping'); }
  }
  return <div className="mapping-field">
    <label>{label}</label>
    <div role="textbox" tabIndex={0} aria-label={`Drop output mapping for ${label}`}
      onDragOver={event => event.preventDefault()}
      onDrop={event => { event.preventDefault(); accept(event.dataTransfer.getData('application/vnd.orchai.output-ref+json')); }}>
      {value ? `${value.sourceNodeId} → ${value.path.join('.')}` : 'Drag previous step output or choose a variable'}
    </div>
    <output aria-live="polite">{sample}</output>
  </div>;
}
```

```ts
// apps/api/src/publishing/publish-plan.ts
export interface TriggerSpec {
  nodeId: string;
  kind: 'webhook' | 'form' | 'schedule' | 'poll' | 'subscription';
  revisionId: string;
  settings: Record<string, unknown>;
}
export interface DeploymentAdapter {
  prepare(appId: string, revisionId: string, triggers: TriggerSpec[]): Promise<string>;
  commit(preparationId: string): Promise<void>;
  rollback(preparationId: string): Promise<void>;
}
export async function deployRevision(
  adapter: DeploymentAdapter,
  appId: string,
  revisionId: string,
  triggerDefinitions: TriggerSpec[],
) {
  const preparationId = await adapter.prepare(appId, revisionId, triggerDefinitions);
  try {
    await adapter.commit(preparationId);
  } catch (error) {
    await adapter.rollback(preparationId);
    throw error;
  }
}
```

Production implementation must use a transactional outbox + idempotent provisioning workers; database transaction alone cannot atomically commit third-party subscriptions, web routes or external scheduler operations.

## 24.4 Engineering traceability / acceptance matrix

| Feature | Frontend deliverable | Backend deliverable | Must-pass acceptance evidence |
|---|---|---|---|
| Dynamic node operation | Operation selector changes property fields live | Versioned schema validation/handler dispatch | Run two different operations and compare saved inputs/outputs |
| Output mapping | JSON/Table/Schema drag and keyboard mapping | Typed expression resolver, paired items | Drag nested field; preview; publish; rerun on new data; value changes correctly |
| Execute node | Node-local run/debug toolbar and spinners | Scoped upstream dependency execution and checkpoint | Execute step with upstream missing; dependent nodes run safely |
| Agent V2 | Composer, preview chat, versions, tools, skills | Independent V2 execution contract and permissions | Publish V2 with 2 tools; legacy agent remains executable |
| Tool and skill registry | Searchable catalog, capability/permission install prompts | Signed/versioned manifests, sandbox, secrets gating | Revoke skill; invocation denied; audit preserved |
| Form + App | Dify app card opens branded form or chat shell | Single graph with bound form input and app presentation | Submit form; inspect run; valid response appears in app |
| Webhook | Copy test and production URLs, Listen toggle | Route registry, auth, body parser, response adapter | Test-only URL expires; production still works after publish |
| Scheduler | Every 10 seconds/minute/hour/time + timezone builder | Durable scheduler with UTC normalization and lease | DST case, no duplicate fire, missed-run policy evidenced |
| Trigger publish | Deployment review and compare revisions | Reconcile subscriptions and routes with rollback | Fail midway and verify previous published version remains live |
| Execution output inspector | Draft/published node snapshots and SSE | RBAC-scoped snapshot/detail/preview stream | View successful/failed/redacted results; unauthorized user denied |
| Credentials/MCP | Credentials catalog, OAuth setup, test, rotation | Encrypted secret store, token refresh, endpoint allowlist | No secret in logs/UI; DNS rebinding attempt blocked |
| Knowledge retrieval | Hybrid settings, metadata filters, sample retrieval | Vector/keyword ranking, rerank, permissions and citations | Compare recall/rank score and enforce document-level ACL |

## 24.5 Additional mandatory upstream file inspection queue

The following are **audit targets, not claims of completed review**. Each should be discovered at a pinned commit, read file by file, and produce a diff-backed OrchAI mapping: n8n's `mappingUtils`, node-details-view stores, parameter input components, node descriptions and authentication definitions, workflow activation/runtime, execution queues, webhooks, form responders, polling, integrations, code sandbox and test suites; Dify's Agent V2 composer, app-creation and app-publishing components, application modes, workflow graph engine, variable inspector, human-input routes, plugin lifecycle, AI model provider adapters, retrievers, indexing pipelines, file upload lifecycle, inference usage accounting, conversation memory and API controllers.

For a truly exhaustive inventory, use Git tree enumeration on **both pinned commits**, not selective search hits. Produce one machine-readable CSV row per file and one per concrete node/plugin type, mark each `not inspected`, `inspected`, `mapped`, `implemented`, `tested`, or `not applicable`, and include owner, runtime role, license constraints and commit evidence. Do not use the word **complete** until all source inventory rows have been dispositioned, all required product features have mapped implementations, and the integration test suite has passed.


---

# V1.5 — Additional Verified Source-Level Audit (16 October 2026)

> **Audit boundaries.** This appendix records another eight inspected implementation files (plus the prior audited files). Paths, repository owners and SHA-1 Git blob identifiers below come from GitHub content retrieval. For large files, the first 150 lines were directly read; remaining logic must be reviewed before implementation claims. This is an incremental, source-grounded audit, **not** a statement that all files in either repository have been examined. All OrchAI code in this appendix is an original design/reference implementation, not copied from n8n or Dify. Respect each project's source licensing before any code reuse.

## A. Newly inspected upstream files and verified findings

| # | Project / verified source file | Blob SHA | What is directly confirmed | OrchAI work item |
|---|---|---|---|---|
| 1 | [n8n `useDataSchema.ts`](https://github.com/n8n-io/n8n/blob/master/packages/frontend/editor-ui/src/app/composables/useDataSchema.ts) | `6546c0606b15237cb3e09b9a395131944006d604` | Schema extraction from sample execution objects; arrays may be collapsed, and JSON Schema is converted to a navigable tree; binary data is differentiated. | A typed **Data Browser** that supports sample-derived, declared, nested, array and binary schemas. |
| 2 | [n8n `from-ai-parse-utils.ts`](https://github.com/n8n-io/n8n/blob/master/packages/workflow/src/from-ai-parse-utils.ts) | `c45caf3cb735b54661a56b92c16d8fbe4dd1440f` | AI-supplied parameter declarations have names, descriptions, primitive/JSON types, default values and generated Zod validation. | Distinguish **AI-populated tool arguments** from mapped workflow variables and validate them as typed schemas. |
| 3 | [n8n `node-tool-factory.ts`](https://github.com/n8n-io/n8n/blob/master/packages/cli/src/modules/agents/tools/node-tool-factory.ts) | `5c8460144a22ee77e84f59504126a2912040cc59` | Workflow nodes can be presented as tools to agents. Tool parameter schema can be inferred from AI placeholders or tool introspection; credential bindings propagate to execution. | Build a **Node-as-Agent-Tool adapter** preserving schema, credential scope and audit trail. |
| 4 | [n8n `Webhook/utils.ts`](https://github.com/n8n-io/n8n/blob/master/packages/nodes-base/nodes/Webhook/utils.ts) | `b9a238cc4c4f2c84cdbae08da5840cf8f3ddd1f0` | Webhook response-code selection, optional per-method outputs, test/production mode and URL distinction, and IP allowlist handling. | Implement mode-specific routes, allowed HTTP methods, safe response templates and request authentication. |
| 5 | [Dify Agent V2 configure hooks](https://github.com/langgenius/dify/blob/main/web/features/agent-v2/agent-detail/configure/hooks.ts) | `87ad85649765fc67fe095246fda663f1f421f701` | Agent composer, draft Agent Soul, active configuration snapshots, explicit versions and ACL gating are independently represented. | Implement separate **Agent Studio** draft/release state, access rights, preview and immutable version snapshots. |
| 6 | [Dify Agent composer API](https://github.com/langgenius/dify/blob/main/api/controllers/console/agent/composer.py) | `fb2446f5fe845c99d261aad9329df9327979e495` | Agent composer offers workflow-node-specific load/save routes; saves are permission-checked and validated; version and secret errors have explicit forms. | Support **embedded agent editing in workflows**, validated server-side saves, RBAC and optimistic concurrency. |
| 7 | [Dify human-input form list](https://github.com/langgenius/dify/blob/main/web/app/components/workflow/panel/human-input-form-list.tsx) | `554cd11f8038c71b4dc5f20332442a6085b3d61f` | Runtime forms are listed in workflow panels; form-token submission callbacks and delivery modes include web app/email choices. | Differentiate **start forms** from **pause/resume human tasks**; use signed, expiring, single-use action tokens. |
| 8 | [Dify workflow-tool publisher hook](https://github.com/langgenius/dify/blob/main/web/app/components/app/app-publisher/publisher-content/use-workflow-tool.ts) | `85c362a9fa2414477c0ab633d5d0e340b4c63587` | Workflow-as-tool publishing UI checks published versions and tooling rights; configurations with trigger or human-input nodes are not exposed in that path. | Define a **presentation compatibility matrix** instead of making every app/workflow publish mode universal. |

### Corroborating sources inspected in the earlier v1.4 pass

- [n8n RunDataJson.vue](https://github.com/n8n-io/n8n/blob/master/packages/frontend/editor-ui/src/features/ndv/runData/components/RunDataJson.vue): drag data-derived expressions from JSON view.
- [n8n RunDataTable.vue](https://github.com/n8n-io/n8n/blob/master/packages/frontend/editor-ui/src/features/ndv/runData/components/RunDataTable.vue): row/column selection, drag mapping and paired-item correspondence.
- [n8n VirtualSchema.vue](https://github.com/n8n-io/n8n/blob/master/packages/frontend/editor-ui/src/features/ndv/runData/components/VirtualSchema.vue): navigable virtualized schema, mapping and on-demand execution.
- [Dify `agent-v2/AGENTS.md`](https://github.com/langgenius/dify/blob/main/web/features/agent-v2/AGENTS.md): Agent V2 state and payload must not be silently folded into legacy Agent strategy shape.
- [Dify published node-output inspector](https://github.com/langgenius/dify/blob/main/api/controllers/console/app/workflow_node_output_inspector.py): draft/published output inspection routes and streaming run updates.
- [Dify published trigger synchronization](https://github.com/langgenius/dify/blob/main/api/events/event_handlers/update_app_triggers_when_app_published_workflow_updated.py): reconcile trigger registrations on publish.

## B. New critical architecture refinements

### B1. Publish as different products, not just different skins

A graph and an **App Presentation** are separate versioned resources. One graph may have multiple presentation definitions, but a target is enabled only if supported by graph semantics:

| Publish target | Trigger source | Interactive state | Preconditions |
|---|---|---|---|
| Interactive chat / Agent App | New message / user conversation | Stateful sessions | Explicit response strategy, configured model/agent, session access policy |
| Single-request Form App | Public/employee form submission | Request-response, possibly queued | Versioned form schema, publish URL, file policy, validation |
| Approval / Human Task App | Paused active workflow | Durable resumed execution | Token lifecycle, task assignee, permitted delivery channel, timeout path |
| Scheduled automation | Internal scheduler | Headless | Valid timezone, cadence, concurrency policy, idempotency |
| Webhook API | Validated external request | Headless or synchronous | Method/authentication/response policy, stable deployment URL |
| Reusable Tool / Skill | Agent invokes tool | Strict input/output contract | Tool-safe entrypoint; no unhandled trigger or interactive wait; permissions |
| Embedded Widget | Host app calls signed session | UI dependent | Origin allowlist, scoped publish token, CSP/security policy |

**Incompatibility example:** An arbitrary multi-page approval graph cannot automatically become a synchronous agent tool. Allow an explicit wrapper (submit-and-return-operation-ID or wait-with-timeout) only when formally modeled. The UI must explain why a publish target is unavailable and link directly to the node/configuration causing it.

### B2. Trigger and form kinds must be explicitly separate

1. **Start Form Trigger**: a browser URL starts a *new* run, with all submitted values exposed as named output fields.
2. **Human Input / Approval**: a form URL belongs to a *specific paused run*, stores the previously resolved variables, and resumes once with replay protection.
3. **Form App Presentation**: the UI presentation of an input contract; can initiate a run, not inherently a node type.
4. **Webhook**: a raw event/request; may accept JSON, multipart files, query, headers and signature verification, and may use form middleware, but is not itself a form page.
5. **AI Agent chat**: conversation state, model output streaming and tool use; optionally exposes form-like structured inputs.

### B3. AI fills a parameter vs user maps a parameter

A parameter must have **exactly one primary binding mode**, with explicit transitions:

```ts
// packages/contracts/src/parameter-binding.ts — original OrchAI reference design
export type ValueSource =
  | { mode: 'literal'; value: unknown }
  | { mode: 'reference'; producerNodeId: string; jsonPath: string; itemPolicy: 'paired' | 'first' | 'all' }
  | { mode: 'expression'; source: string; language: 'orch-expression-v1' }
  | { mode: 'agent'; name: string; description: string; schema: Record<string, unknown>; optional: boolean }
  | { mode: 'secret'; connectionId: string; field: string };

export type ParameterSpec = {
  key: string;
  label: string;
  editor: 'text'|'number'|'boolean'|'select'|'resource'|'json'|'code'|'file'|'key-value'|'repeatable'|'credential';
  schema: Record<string, unknown>;
  visibleWhen?: { key: string; operator: 'eq'|'in'|'exists'; value?: unknown }[];
  optionsLoader?: { operationId: string; dependsOn: string[] };
  required?: boolean;
  accept: Array<ValueSource['mode']>;
};
```

Never save a sample execution value when a user drags a producer's field into a destination field. Persist `mode: 'reference'` and the producer identity/path. Render a temporary sample preview separately. Prevent references to inaccessible nodes, incompatible output types and execution items unrelated to the current paired item. Change of a node's operation/version must show broken references and provide repair suggestions.

### B4. Output discovery has two independent sources

- **Declared output schema**: available before a run; supports early mapping, autocomplete and type-checking.
- **Observed execution output**: runtime sample, potentially richer or narrower; supports inspecting JSON/Table/Schema and debugging.

Merge for editor display but do not silently alter a published schema. Show a tooltip indicating `Declared`, `Observed`, `Missing in last run`, or `Sensitive / redacted`. Binary paths are references to secured artifacts, not inlined base64 blobs.

### B5. Tools used by Agents are executable nodes with different contracts

A reusable **Tool Definition** wraps a versioned executable operation with JSON schema input, deterministic output schema, accepted credentials, permission policy, cost/time limit and idempotency description. An agent can supply typed arguments, but it **cannot** choose hidden credentials, override tenant scope, reach arbitrary network targets or call unpublished nodes. The tool invocation is itself an auditable child execution linked to its parent agent turn.

## C. New backend example: scoped tool invocations

```ts
// apps/api/src/agents/tool-dispatch.service.ts — original architecture example
interface ToolCall { toolId: string; arguments: unknown; agentRunId: string; tenantId: string; actorId: string; }
interface RegisteredTool {
  id: string; tenantId: string; publishedVersionId: string;
  inputSchema: { parse(v: unknown): Record<string, unknown> };
  allowedRoles: string[]; timeoutMs: number;
}
interface ToolRuntime {
  invoke(input: { versionId: string; tenantId: string; actorId: string; args: Record<string, unknown>; parentRunId: string; timeoutMs: number }): Promise<unknown>;
}
export class ToolDispatcher {
  constructor(private readonly registry: { get(id: string): Promise<RegisteredTool> },
              private readonly access: { hasAnyRole(userId: string, tenantId: string, roles: string[]): Promise<boolean> },
              private readonly runtime: ToolRuntime) {}
  async invoke(call: ToolCall) {
    const tool = await this.registry.get(call.toolId);
    if (tool.tenantId !== call.tenantId) throw new Error('Tool tenant mismatch');
    if (!(await this.access.hasAnyRole(call.actorId, call.tenantId, tool.allowedRoles))) {
      throw new Error('Tool execution forbidden');
    }
    const args = tool.inputSchema.parse(call.arguments);
    return this.runtime.invoke({ versionId: tool.publishedVersionId, tenantId: call.tenantId,
      actorId: call.actorId, args, parentRunId: call.agentRunId, timeoutMs: tool.timeoutMs });
  }
}
```

Production hardening must add atomic idempotency, secret-scoped credential resolution inside the runtime, immutable audit logs, tool invocation quotas, cancellation propagation, per-tool allowlisted egress and structured/typed output validation.

## D. New UI example: display a mapping chip rather than raw text

```tsx
// apps/web/src/features/designer/fields/MappedParameterField.tsx
import React from 'react';
import type { ValueSource } from '@orchai/contracts/parameter-binding';

export function MappedParameterField(props: {
  value: ValueSource;
  onChange: (v: ValueSource) => void;
  resolvePreview: (v: ValueSource) => { label: string; preview?: string; type?: string; error?: string };
}) {
  const item = props.resolvePreview(props.value);
  function onDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const raw = event.dataTransfer.getData('application/x-orchai-output-reference');
    if (!raw) return;
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { return; }
    if (!parsed || typeof parsed !== 'object') return;
    const data = parsed as Record<string, unknown>;
    if (typeof data.producerNodeId !== 'string' || typeof data.jsonPath !== 'string') return;
    // The backend and graph service MUST validate producer scope/type before save.
    props.onChange({ mode: 'reference', producerNodeId: data.producerNodeId,
      jsonPath: data.jsonPath, itemPolicy: 'paired' });
  }
  return (
    <div role="group" aria-label="Parameter mapping" onDragOver={event => event.preventDefault()} onDrop={onDrop}>
      <strong>{item.label}</strong>
      {item.type && <small>Type: {item.type}</small>}
      {item.preview && <output aria-label="Mapped preview">{item.preview}</output>}
      {item.error && <p role="alert">{item.error}</p>}
      <button type="button" onClick={() => props.onChange({ mode: 'literal', value: '' })}>Clear mapping</button>
    </div>
  );
}
```

The production editor additionally needs keyboard-based mapping and click-to-insert, expression autocomplete, accessible node/type selectors, focus restoration when panes resize, drag highlighting, JSON-path quoting, array item selection and automated visual regression tests. Do **not** rely on browser drag-and-drop as the only way to bind output fields.

## E. End-to-end scenarios newly required

| ID | Acceptance workflow | Expected evidence |
|---|---|---|
| AUD-201 | Execute REST request node, drag nested `customer.email` into the next node's recipient field, rerun with different customer | Saved binding references producer path and resolves the new actual email; not original sample |
| AUD-202 | Convert workflow node to agent-callable tool with two AI inputs; validate integer/object type and RBAC | Model sees typed input schema; malformed arguments fail without execution; child run has parent linkage |
| AUD-203 | Build a form that starts a new workflow; pause for human approval; resume from emailed signed link | Two distinct form tokens/scopes; exactly one resume even under concurrent submissions |
| AUD-204 | Publish workflow as Form App and as API; attempt to publish human-wait workflow as synchronous Tool | Two working valid entrypoints; rejected target explains incompatible wait node |
| AUD-205 | Change workflow trigger from two webhooks to one schedule and republish | Old webhook de-registered, new schedule registered exactly once; prior published runs remain auditable |
| AUD-206 | Inspect declared and observed outputs for draft and published runs | JSON/Table/Schema views display correct types; secrets redacted; binary objects referenced securely |
| AUD-207 | Update agent draft while a published agent version serves active users | Draft preview differs; published traffic remains pinned to immutable snapshot until promotion |
| AUD-208 | Try a cross-tenant tool binding or credential | Explicit denial at backend, audit event, no outbound call or secret leakage |

## F. Continuing audit queue — not yet verified in this appendix

To approach repository-level completeness, a systematic extraction tool must enumerate every relevant default-branch directory and file, then record each path, blob SHA, capability category, test path and review decision. Next prioritized targets:

1. n8n node-description UI field dispatchers, conditional `displayOptions`, resource locators, search-backed option loaders and credential selectors.
2. n8n node versions/migrations, `loadOptions`, polling registration, queue recovery, wait/resume and subworkflow tools.
3. n8n form multi-page renderer, upload storage policy, response modes, custom HTML sanitation and dynamic form schemas.
4. n8n editor canvas connection validation, keyboard commands, undo history, zoom selection, pinned execution data and debugging sessions.
5. Dify current Agent V2 runtime orchestration, tool configuration, memory, agent context, chat events and version publishing.
6. Dify Chatflow and Workflow differences, App web UI publisher, embeddable widgets, API keys and conversation/usage history.
7. Dify plugins, marketplace installation, Agent Strategy providers, model provider plugins, workflow tools and skill/extension boundaries.
8. Dify dataset indexing, ingestion, document extraction, retriever/reranker, metadata, citation provenance and vector-store adapters.
9. Dify human-input form server submission/resume, email/web app delivery, token validity and asynchronous execution errors.
10. Both products' release, RBAC, multi-tenancy, limits, deployment, licensing and error-recovery tests.

**Definition of source-reviewed:** actual file content retrieved, functionality recorded with link and source revision, limitations documented, mapped to an OrchAI component, and at least one acceptance test defined. A search-result filename alone is never considered inspected. **Definition of implemented:** source exists in OrchAI, frontend and backend are connected, automated tests pass, and a real execution can demonstrate the feature; a specification alone does not qualify.


---

# v1.6 — Additional verified source-file audit: execution internals, subworkflows, AI tools, triggers, and knowledge indexing
**Review date:** 2026-10-16. **Method:** Direct GitHub source reads, bounded to the first ~130 lines of each listed file, combined with targeted source search. This is a **partial-file, not whole-repository, audit**. All implementation code below is newly authored OrchAI reference code, not copied upstream code. Repository paths refer to the default branch at review time; recorded blob hashes enable exact verification.

## Verified source evidence register (new in v1.6)

| ID | System | Source file | Blob SHA | Inspection result |
|---|---|---|---|---|
| S01 | n8n | `packages/core/src/execution-engine/node-execution-context/node-execution-context.ts` | `bfb981a773ddb569a1ebe7b4010d333db421006e` | Per-node runtime context mediates parameters, execution IDs, runtime data, node graph and credentials. |
| S02 | n8n | `packages/nodes-base/nodes/ExecuteWorkflow/ExecuteWorkflow/ExecuteWorkflow.node.ts` | `c626d8704722656ed07189a191fe50488845cf7b` | Child-workflow input mapping is schema-aware, versioned and dependent on selected workflow; older versions differ in conversion policy. |
| S03 | n8n | `packages/nodes-base/nodes/If/V2/utils.ts` | `21af3724218c6dca86ff73f9dedf6fe2e9e937ab` | Input-type strictness is conditioned on saved node version. |
| S04 | n8n | `packages/cli/src/modules/agents/tools/workflow-tool-factory.ts` | `80e26174214590b4cfb74b0741beafc5fb605cb1` | Child workflows usable as agent tools have compatibility checks, bounded waits, interruption and HITL handling. |
| S05 | Dify | `api/core/workflow/workflow_entry.py` | `c0f532a6750c2181eecd9cd02d43e607343d0543` | Graph engine setup incorporates variable pools, typed node factory, event streams and human-input filters. |
| S06 | Dify | `api/core/app/apps/workflow/app_runner.py` | `df545d0e34554b03d69b9de08d6dae1dbe02281d` | App runner distinguishes invocation context, persisted run state, runtime layers, command channels and streaming. |
| S07 | Dify | `api/core/plugin/impl/trigger.py` | `867cfb970cd7276ecae6c6b468f16ba9d3419ed8` | Plugin triggers have provider/event identity, credential types, subscriptions and external event dispatch. |
| S08 | Dify | `api/tasks/document_indexing_task.py` | `c9af37a1fcb34078fd644e0f1ba17b9c33dae334` | Document indexing is a queued, status-tracked, tenant-scoped pipeline; legacy entry points are explicitly marked for deprecation. |
| S09 | Dify | `web/app/components/datasets/settings/form/components/indexing-section.tsx` | `de7bcb3f17e5afbde4a390949b6496f26aa8338d` | Knowledge settings separate chunk structure, index method, model selection, retrieval config and summary index. |

Review paths:
- https://github.com/n8n-io/n8n/blob/master/packages/core/src/execution-engine/node-execution-context/node-execution-context.ts
- https://github.com/n8n-io/n8n/blob/master/packages/nodes-base/nodes/ExecuteWorkflow/ExecuteWorkflow/ExecuteWorkflow.node.ts
- https://github.com/n8n-io/n8n/blob/master/packages/nodes-base/nodes/If/V2/utils.ts
- https://github.com/n8n-io/n8n/blob/master/packages/cli/src/modules/agents/tools/workflow-tool-factory.ts
- https://github.com/langgenius/dify/blob/main/api/core/workflow/workflow_entry.py
- https://github.com/langgenius/dify/blob/main/api/core/app/apps/workflow/app_runner.py
- https://github.com/langgenius/dify/blob/main/api/core/plugin/impl/trigger.py
- https://github.com/langgenius/dify/blob/main/api/tasks/document_indexing_task.py
- https://github.com/langgenius/dify/blob/main/web/app/components/datasets/settings/form/components/indexing-section.tsx

## 1. Runtime context is a deliberate API, not unrestricted access to engine internals

**Evidence: S01, S05, S06.** Implement an `ExecutionContext` granted per node with only scoped run data, typed inputs, variable resolver, redacted logger, cancellation, file handles and credential capability references. Never pass raw DB access, other tenants' run data or decrypted credentials to arbitrary plugins. Record node runtime's code/version/parameters and workflow publication hash so retries replay deterministically.

### Original TypeScript contracts

```ts
export type NodeErrorPolicy = 'fail' | 'continue' | 'error-branch' | 'retry';
export interface DataItem {
  id: string;
  json: Record<string, unknown>;
  binary?: Record<string, { blobId: string; mimeType: string; name?: string }>;
  pairedItem?: { parentNodeId: string; parentItemId: string };
}
export interface NodeRunContext {
  tenantId: string;
  runId: string;
  nodeId: string;
  workflowVersionId: string;
  signal: AbortSignal;
  inputs: Record<string, DataItem[]>;
  params: Record<string, unknown>; // already resolved and validated
  credentials: { getCapability(kind: string): Promise<string> };
  emit(event: NodeEvent): Promise<void>;
}
export type NodeEvent =
  | { type: 'started'; at: string }
  | { type: 'progress'; percent?: number; message: string }
  | { type: 'output'; port: string; items: DataItem[] }
  | { type: 'waiting'; waitTokenId: string }
  | { type: 'failed'; code: string; message: string };
export interface NodeExecutor {
  execute(ctx: NodeRunContext): AsyncIterable<NodeEvent>;
}
```

**Backend obligations:** persist output per node/port/item; enforce size limits with artifact references; use idempotency keys for non-repeatable external actions; cancellation and resume must be supported; scrub secrets and PII from traces. Output inspector must connect runtime data to the three-pane editor for test *and* published runs, subject to permissions.

## 2. Schema-driven subworkflow input mapping with versioned contracts

**Evidence: S02, S03.** A subworkflow has a versioned input schema, output schema, execution policy (once / for each item), timeout, errors, and required role. A selector loads its schema, which then populates fields; changing subworkflow version invalidates mappings visibly. Support per-field value chips, drag-and-drop previous outputs, `auto-map matching fields`, strict/coerce type modes, and a *Test with input* button. Do not silently replace missing fields with empty strings.

```ts
export interface WorkflowReference {
  workflowId: string;
  revisionId: string; // immutable published revision
}
export interface InputBinding {
  field: string;
  source:
    | { kind: 'literal'; value: unknown }
    | { kind: 'output'; nodeId: string; port: string; jsonPath: string }
    | { kind: 'expression'; ast: unknown };
}
export interface CallWorkflowConfig {
  target: WorkflowReference;
  mode: 'once' | 'each-item';
  mapping: InputBinding[];
  onError: NodeErrorPolicy;
  maxDepth: number;
  timeoutMs: number;
  awaitCompletion: boolean;
}
```

**Validation:** schema mismatch; missing required input; cyclic calls; cross-tenant access; recursion quota; a deleted referenced revision; incompatible output changes. Pin revision at publish, not on each invocation.

## 3. Reusable Agent Tools ≠ ordinary workflow triggers

**Evidence: S04.** Distinguish callable tools with declared inputs/outputs from long-running applications with webhooks, schedules or human waits. Expose a compatibility report before adding a workflow to an agent. Support tool invocation, child-run inspection, idempotency, token budgets, per-tool grants and escalation when a task cannot finish synchronously.

```ts
export type ToolCompatibility = {
  eligible: boolean;
  reasons: string[];
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  maySuspend: boolean;
  recommendedMode: 'sync' | 'async-job' | 'human-approval';
};
export interface ToolInvocation {
  tenantId: string; agentRunId: string; toolId: string;
  args: Record<string, unknown>; idempotencyKey: string;
}
export type ToolResult =
  | { status: 'completed'; output: unknown }
  | { status: 'queued'; jobId: string }
  | { status: 'approval-required'; approvalId: string };
```

**UI:** agent tool catalog filters compatible workflow revisions; tool details show input arguments with descriptions, permission scope, output preview and latency; test tools against mock data; display tool call input/output and redacted failures.

## 4. Trigger providers, subscriptions and event delivery

**Evidence: S07.** Implement distinct lifecycle phases: `register -> validate credentials -> subscribe -> active -> dispatch -> unsubscribe`. A trigger plugin may require external setup/cleanup, event type discovery and signature validation. Store subscription state and last event IDs; deduplicate retried events; retry failed handler work through a durable inbox.

```ts
export interface EventTriggerAdapter {
  validate(config: unknown, credentialRefId?: string): Promise<void>;
  subscribe(input: { tenantId: string; workflowRevisionId: string; config: unknown }): Promise<{
    externalSubscriptionId?: string; expiresAt?: string;
  }>;
  unsubscribe(input: { tenantId: string; subscriptionId: string }): Promise<void>;
  normalize(input: {
    body: unknown; headers: Record<string, string>; rawBody: Uint8Array;
  }): Promise<{ eventId: string; occurredAt: string; payload: unknown }>;
}
```

**Mandatory:** no browser-only scheduling, no UI session dependence, separate test and production subscriptions, reliable webhooks, subscription reconciliation after publish, on/off indicators and reasoned failure diagnostics. For every-10-seconds triggers, expose backend capacity controls and missed-run policy (`skip`, `catch-up-one`, `catch-up-all-with-cap`); never promise exact intervals under overload.

## 5. Knowledge indexing as an auditable data-processing workflow

**Evidence: S08, S09.** Dataset creation must support parsing, OCR, chunk preview, parent-child chunking, embedding selection, vector indexing, lexical/hybrid retrieval, metadata extraction, reranking and optional summary indexes. Treat ingestion as an independent async state machine, not a request that blocks the browser until all files finish.

**Required states:** `uploaded -> scanning -> parsing -> chunking -> embedding -> indexing -> indexed`, with `failed`, `paused`, `cancelled`, `retrying` and `superseded` branches. Maintain per-document status, revisions, checksums, source mappings, token usage and restart-safe failure handling. Reject retrieval of stale/unauthorized chunks and preserve citations.

```ts
export interface IngestionJob {
  tenantId: string;
  datasetId: string;
  documentId: string;
  documentRevision: number;
  parsingProfileId: string;
  chunkPolicy: { mode: 'standard' | 'parent-child'; chunkSize: number; overlap: number };
  embedding: { connectionId: string; modelId: string; dimensions: number };
  retrieve: { mode: 'vector' | 'keyword' | 'hybrid'; rerankModelId?: string };
}
```

**UI screens:** document job timeline; chunk preview and editable chunk boundaries; embedding/model compatibility warning; test query results with citations and scores; index rebuild with staged activation; detailed parsing/OCR errors; image/audio/video and PDF multimodal policy as provider capabilities permit.

## 6. Unified UI acceptance journey

1. On Dify-style App Studio home, create **Customer Intake** and select presentation `Form App`.
2. Build a multi-page form with email, dropdown, number, file and consent; test and publish at a stable form URL.
3. Add `Form Trigger -> HTTP Request -> Condition -> Knowledge Retrieval -> Agent -> Human Approval -> Response`.
4. Select HTTP node operation; populate context-sensitive fields and credential; click **Execute Step**. Inspect real output as Table/JSON/Schema.
5. Drag `customer.id` from HTTP output into Agent parameter and `priority` into Condition; saved typed references must survive restart.
6. Attach an agent tool based on a different *published subworkflow*; verify typed input mapping and tool eligibility.
7. Configure fallback schedule (every minute / hour / daily time / 10 seconds where policy permits). View next-run timestamps with timezone and DST policy.
8. Pause workflow at approval form, send signed one-time link, submit approval, resume exactly once.
9. Publish as Form App and API; publishing as an Agent Tool must surface eligibility and incompatible behaviors.
10. Verify tenant isolation, version-pinned execution, secret masking, replay, idempotency, analytics and post-publish node output inspector.

## 7. New acceptance tests and non-regression gates

| Test | Passing evidence |
|---|---|
| NODE-RUNTIME-01 | Node context has only scoped data; cancellation and errors persisted |
| NODE-INPUT-02 | Child-workflow mapping generated from pinned input schema |
| NODE-INPUT-03 | Version changes warn about unmappable fields; no data loss |
| NODE-AGENT-04 | A subworkflow can be a typed Agent tool with inspectable execution |
| NODE-AGENT-05 | Incompatible tool workflow is blocked with clear explanation |
| TRIGGER-06 | Subscription provisioned on publish and cleaned up on unpublish |
| TRIGGER-07 | Duplicate deliveries trigger one logical run |
| TRIGGER-08 | Ten-second schedule honors quotas, late-run and DST policies |
| RAG-09 | Per-file ingestion status survives restart and resumes correctly |
| RAG-10 | Re-index is staged, audit logged and tenant-scoped |
| UX-11 | All selected operations expose distinct, validated controls |
| UX-12 | Real outputs can be dragged from JSON, Table and Schema views |
| UX-13 | Draft and published node inspectors produce permission-filtered results |
| APP-14 | Same revision works as a supported Form App/API and reports tool compatibility |
| SEC-15 | No cross-tenant references or decrypted secrets in logs or outputs |

## 8. Explicit review limitations and next source inspection queue

This audit sampled the beginning of **9 additional source files**, not entire files. That matters because downstream functions can reveal behavior not apparent at the top. Therefore, this appendix marks source understanding as **targeted and verified**, not complete implementation parity. Next high-value review should include complete implementations and tests of: n8n parameter renderer and display conditions, resource mapper implementation, mappingUtils and expression engine, task-run persistence, scheduler execution, database migration behavior, Dify `graphon` graph-engine internals, Agent V2 config services, Skills/Tools marketplace package/version handling, publisher services, and complete RAG indexing adapters. Preserve a per-file review ledger with review date, commit SHA, inspected line range, summary and test mapping.

---

# v1.7 Source Audit — Dynamic Parameter Renderer, Resource Mapper, Agent V2 State and Variable Contracts

**Audit date:** 2026-10-16. **Audit method:** Direct GitHub connector `fetch_file` reads, default-branch source, lines 1–180 (or entire file when shorter). Source paths and blob SHAs are captured below. Findings are grounded in the inspected portions; do not describe this as a full-file or full-repository audit. The following TypeScript and JSX snippets are original implementation proposals, not copied upstream.

## Newly verified source-file ledger

| ID | Repository | Path | Verified blob SHA | Finding / OrchAI requirement |
|---|---|---|---|---|
| 1 | n8n | `packages/frontend/editor-ui/src/features/ndv/parameters/components/ParameterInput.vue` | `7845e81f94a8dfdc27441f50183a730bd1b754be` | Parameter types delegate to specialized code, JSON, SQL, HTML, resource locator, credential, workflow and agent selectors. Build a pluggable control renderer rather than one generic form. |
| 2 | n8n | `packages/frontend/editor-ui/src/features/ndv/parameters/components/ParameterInputFull.vue` | `13bbe115ce28650e762114474063c0b9ea5abe6e` | Drag target, fixed/expression/AI modes, AI overrides and evaluated mapping feedback are composed around inputs. |
| 3 | n8n | `packages/frontend/editor-ui/src/features/ndv/parameters/components/ResourceMapper/ResourceMapper.vue` | `5d24ec4e798ac0ddba444bf0d9bc136c59ddf82d` | Resource mapper persists mapping mode, matching columns, typed schema, type-coercion options, stale-schema state and refresh controls. |
| 4 | n8n | `packages/frontend/editor-ui/src/features/ndv/parameters/components/ResourceMapper/MappingFields.vue` | `51eeea6f94e0ceaa7bffc365ef2aa76d2805afa2` | Remote resource fields become distinct typed inputs; required, read-only, matching and removed/restorable fields are meaningful. |
| 5 | n8n | `packages/cli/src/services/dynamic-node-parameters.service.ts` | `2170f7ba82af05f8762474d1578af1384831b814` | Dynamic options/schema discovery is a privileged backend operation: project/workflow/credential access is checked before lookup. |
| 6 | Dify | `web/app/components/workflow/nodes/agent-v2/agent-soul-config.ts` | `e4c7558969d9e9c8b822a8ea82e0315b177cb80b` | Agent V2 keeps draft composer state with conversion, serialized save, autosave debounce and separate app/snippet endpoints. |
| 7 | Dify | `web/app/components/workflow/nodes/_base/components/variable/utils.ts` | `85a655a32b8dd85b51fa6db4ea5eacd366e0632f` | Output variables differ by node type, including Agent V2, tools, LLM, HTTP, human input, knowledge, triggers; scope system/global variables separately. |
| 8 | Dify | `web/app/components/workflow/nodes/assigner/default.ts` | `33ddcf5946ca977523029f48847e1076aa15eddb` | Assignment operations have operation-specific validations, versioned defaults and distinct required-value semantics. |

**Direct source links:**

- https://github.com/n8n-io/n8n/blob/master/packages/frontend/editor-ui/src/features/ndv/parameters/components/ParameterInput.vue
- https://github.com/n8n-io/n8n/blob/master/packages/frontend/editor-ui/src/features/ndv/parameters/components/ParameterInputFull.vue
- https://github.com/n8n-io/n8n/blob/master/packages/frontend/editor-ui/src/features/ndv/parameters/components/ResourceMapper/ResourceMapper.vue
- https://github.com/n8n-io/n8n/blob/master/packages/frontend/editor-ui/src/features/ndv/parameters/components/ResourceMapper/MappingFields.vue
- https://github.com/n8n-io/n8n/blob/master/packages/cli/src/services/dynamic-node-parameters.service.ts
- https://github.com/langgenius/dify/blob/main/web/app/components/workflow/nodes/agent-v2/agent-soul-config.ts
- https://github.com/langgenius/dify/blob/main/web/app/components/workflow/nodes/_base/components/variable/utils.ts
- https://github.com/langgenius/dify/blob/main/web/app/components/workflow/nodes/assigner/default.ts

## Architecture A — Node description → operation → conditional parameter tree

A node is **not** an icon and a JSON textarea. Every node family can define resources, operations, inherited controls, nested collections, conditional field visibility, custom editor widgets, required fields, backend lookups, input/output ports, typed output contracts, credentials and runtime executor. The editor must resolve controls from the node's pinned **type/version + resource + operation + current sibling values**. Revalidate server-side. Maintain backwards compatibility for older published versions.

```ts
// packages/contracts/src/node-definition.ts — original proposed OrchAI contract
export type ParameterKind =
  | 'string' | 'number' | 'boolean' | 'secret' | 'date' | 'time'
  | 'select' | 'multi-select' | 'resource-locator' | 'resource-mapper'
  | 'code' | 'json' | 'sql' | 'html' | 'markdown' | 'file'
  | 'credential' | 'workflow-select' | 'agent-select'
  | 'collection' | 'fixed-collection' | 'notice';
export type ValueSource =
  | { mode: 'fixed'; value: unknown }
  | { mode: 'expression'; expression: string }
  | { mode: 'node-output'; nodeId: string; port: string; jsonPath: string; item: 'paired' | number }
  | { mode: 'ai'; argumentKey: string; description: string; valueType: 'string' | 'number' | 'boolean' | 'json' };
export interface ParameterDefinition {
  name: string; label: string; type: ParameterKind;
  required?: boolean; default?: unknown; description?: string;
  visibleWhen?: { path: string; in: unknown[] }[];
  enabledWhen?: { path: string; in: unknown[] }[];
  options?: { label: string; value: string }[];
  dynamic?: { method: string; dependsOn: string[]; cacheSeconds?: number };
  children?: ParameterDefinition[];
  supportsExpression?: boolean; supportsAi?: boolean;
  sensitivity?: 'normal' | 'secret';
  validation?: { min?: number; max?: number; regex?: string };
}
export interface NodeDefinition {
  type: string; version: string; title: string; category: string;
  inputs: { key: string; dataType: string }[];
  outputs: { key: string; dataType: string }[];
  properties: ParameterDefinition[];
  credentialTypes?: string[];
  capabilityFlags: string[];
}
```

### UI implementation example: recursive operation-specific renderer

```tsx
// apps/web/src/features/workflows/components/NodeParameterRenderer.tsx
import type { ReactNode } from 'react';
import type { ParameterDefinition, ValueSource } from '@orchai/contracts';

type Props = {
  schema: ParameterDefinition[];
  values: Record<string, ValueSource>;
  plain: Record<string, unknown>;
  onUpdate(path: string, source: ValueSource): void;
  renderWidget(field: ParameterDefinition, source: ValueSource | undefined,
               update: (next: ValueSource) => void): ReactNode;
};
function visible(field: ParameterDefinition, values: Record<string, unknown>): boolean {
  return (field.visibleWhen ?? []).every(r => r.in.includes(values[r.path]));
}
export function NodeParameterRenderer({ schema, values, plain, onUpdate, renderWidget }: Props) {
  function fields(items: ParameterDefinition[], prefix = ''): ReactNode {
    return items.filter(f => visible(f, plain)).map(f => {
      const path = prefix ? `${prefix}.${f.name}` : f.name;
      return <section key={path} className="node-parameter" data-parameter={path}>
        <label htmlFor={path}>{f.label}{f.required ? ' *' : ''}</label>
        {renderWidget(f, values[path], next => onUpdate(path, next))}
        {f.description && <p className="field-help">{f.description}</p>}
        {f.children && fields(f.children, path)}
      </section>;
    });
  }
  return <div className="node-parameters">{fields(schema)}</div>;
}
```

Production renderer responsibilities omitted in the minimal example: accessible input IDs, field validation, safe form state, undo/redo, DnD sensors, nested array indices, keyboard navigation, lazy options, migration logic, immutable updates and a unified error summary. Build them before acceptance.

## Architecture B — One draggable value system for fixed, expression and AI control

An upstream result field dragged from JSON/Table/Schema must create a **durable reference**, not a frozen example value. A field should expose inline mode switching: `Fixed | Expression | AI` (AI only if the node/role allows it). Show a resolved sample *without overwriting the saved reference*. The expression resolver must use node IDs, port names, run ID and paired-item identity, never rely exclusively on renamable display names. Never execute arbitrary JavaScript in the browser or on the API process; use a sandboxed typed expression evaluator.

```ts
export type MappingDropPayload = {
  workflowId: string; runId: string; sourceNodeId: string;
  outputPort: string; path: string; itemId?: string; dataType: string;
};
export function acceptMapping(target: ParameterDefinition, drop: MappingDropPayload): ValueSource {
  if (target.type === 'secret' || target.sensitivity === 'secret')
    throw new Error('A secret field requires a credential binding');
  if (!target.supportsExpression) throw new Error(`${target.label} cannot use mapped expressions`);
  return { mode: 'node-output', nodeId: drop.sourceNodeId,
    port: drop.outputPort, jsonPath: drop.path, item: 'paired' };
}
```

### Output contract registry

Output schemas originate from (1) type/version declarations, (2) per-operation schemas, (3) dynamic resource schemas, or (4) actual execution samples. Mark samples as `sample-derived` so the editor doesn't falsely guarantee a particular field exists for every future run. Preserve binary references and handle arrays, optional properties, multi-item outputs, branches and nested paths. Unexecuted nodes display declared schema and “Execute step to inspect actual output.”

## Architecture C — backend dynamic resource metadata, NEVER browser-secret fetches

The dynamic options/schema endpoint accepts node type/version and validated dependent fields, checks the authenticated actor's workspace, scopes access to the selected project/workflow, validates connection grants and then calls an allowlisted provider adapter. Rate-limit and cache results by `(tenant, actor-permission-scope, credential-id, type, version, dependency-hash)`; never cache results across tenants or leak tokens.

```ts
// NestJS reference design — authorization methods are project interfaces,
// not built-in framework functions; implement them in your application.
export class DynamicNodeMetadataService {
  constructor(private readonly acl: AccessPolicy,
              private readonly registry: NodeRegistry,
              private readonly cache: ScopedCache) {}

  async resolve(actor: Actor, req: {
    projectId: string; workflowId: string; nodeType: string;
    nodeVersion: string; method: string; dependsOn: Record<string, unknown>;
    connectionId?: string;
  }) {
    await this.acl.assertWorkflowRead(actor, req.workflowId, req.projectId);
    if (req.connectionId) await this.acl.assertConnectionUse(actor, req.connectionId);
    const adapter = this.registry.get(req.nodeType, req.nodeVersion)
      .metadataMethods[req.method];
    if (!adapter) throw new Error('Unsupported metadata method');
    return this.cache.withScopedKey(actor, req, () => adapter({ actor, ...req }));
  }
}
```

**UI cases:** loading, empty list, error/retry, cursor pagination, filter as you type, stale schema callout, explicit Refresh Fields, add/remove optional fields, type conversion choices, matching columns, change detection, and a non-destructive reconcile dialog when remote schemas change. Never silently delete previously mapped fields.

## Architecture D — Dify Agent V2 composition and variable assigner

Agent V2 is a configurable, publishable runtime artifact separate from Agent legacy strategy providers. Composer state must have distinct `localDirtyDraft`, `savedDraftRevision`, `publishedSnapshot`, `previewConfiguration`, ACL capabilities and conflict detection. Use serial autosave, debouncing and revision ETags; do not allow a slower save response to overwrite newer edits. To publish, atomically snapshot agent config, tool bindings, model version and app presentation together with the pinned workflow revision.

```ts
export interface AgentComposerVersion {
  agentId: string; workspaceId: string; etag: string;
  schemaVersion: number; model: { provider: string; model: string };
  prompt: { system: string; developer?: string };
  memory: { enabled: boolean; policy: string };
  tools: { id: string; version: string; approvalPolicy?: string }[];
  knowledgeBaseIds: string[];
  outputSchema?: Record<string, unknown>;
}
// PUT /api/agents/:id/draft with If-Match: <etag>
// 409 CONFLICT => show compare/resolve; never overwrite silently.
```

Variable assignment is similarly operation-specific: `set`, `clear`, `increment`, `decrement`, `multiply`, `divide`, `append`, `remove-first`, `remove-last`, with only compatible operations shown for each type. Validate zero divisors, null values, array-only operations, immutable system vars, and scope (execution/conversation/app). The backend must enforce equivalent rules.

## Publishing and release invariants

- Node **definition version** and workflow **revision** are different and both must be pinned.
- An existing flow remains runnable after upgrading an installed plugin; explicit migration/upgrade is required.
- Draft UI, single-node execution, published app, webhook, cron and agent-tool execution all call one version-aware backend engine.
- Dynamic node metadata must be scoped by RBAC and tenant; real secrets stay server-side.
- Form trigger creates new run; Human Input resumes an existing run with one-time token.
- Published web apps are separate presentations over an immutable graph; form and chat interfaces share input/output contracts only when compatible.
- Connection health checks, webhook subscriptions and scheduling run independently of open browser sessions.

## New v1.7 acceptance and QA cases

| ID | Test | Required evidence |
|---|---|---|
| UI-PARAM-01 | Distinct editor widgets for different node parameter types | Screenshots, component and E2E tests |
| UI-PARAM-02 | Change resource/operation; fields and validation change predictably | Saved configuration survives edit/reload |
| UI-PARAM-03 | Change remote schema; stale mappings flagged without data loss | Reconcile modal and migration diff |
| UI-PARAM-04 | Drag previous output into nested field, switch fixed/expression/AI | Real executed value preview + saved reference |
| UI-PARAM-05 | Double-click opens three-pane editor, schema/table/json mappings all work | Keyboard and pointer tests |
| API-META-06 | Dynamic metadata blocks foreign-project and foreign-tenant lookup | Authorization integration tests |
| API-META-07 | Dynamic provider option pagination, errors and retries | Contract and load tests |
| AGENT-08 | Concurrent autosaves cannot overwrite newer Agent V2 draft | Revision conflict E2E test |
| AGENT-09 | Agent publication pins prompt, model, tools, revision | Rollback and reproducibility test |
| VAR-10 | Assigners validate each operation and variable type | Unit test matrix |
| BACKCOMPAT-11 | Node definition upgrades preserve existing published flows | Migration and replay tests |

## Review limitations and follow-on source queue

This source pass checked the **opening portions of eight additional files**. It does not demonstrate every line, every feature, or all UI behavior. Future audits should retrieve the full implementation and tests for parameter control registries, n8n `mappingUtils.ts`, `ExpressionParameterInput.vue`, `ResourceLocator` and `MappingModeSelect`, and Dify `agent-composer/conversions`, `agent-composer/store`, `nodes/agent-v2/types`, `nodes/variable-assigner/types`, plus backend validators and execution actions. Include repository/commit SHA/line ranges and test evidence in each subsequent audit entry. Do not claim full source parity until a machine-generated file inventory is reconciled against actual implementation and tests.
