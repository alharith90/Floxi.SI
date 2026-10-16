# Targeted upstream review

Reviewed 16 October 2026. Exact revisions and license hashes are in [UPSTREAM_REVISIONS.lock.json](UPSTREAM_REVISIONS.lock.json). These are reference-only inspections; no upstream code, runtime, or branding was copied into the implementation.

| Repository / pinned commit | File and inspected range | Observed behavior | Native acceptance / evidence |
|---|---|---|---|
| n8n `447fc866bb0a841decfa5e8a29fba06057bfc5bc` | `packages/frontend/editor-ui/src/features/ndv/parameters/components/ParameterInput.vue`, 1–120 | Dispatches specialized controls and expression/resource/credential editors | Shared catalog selects distinct JSON, number, comparison and value controls in `apps/web/src/editor/Workbench.tsx`; browser journey verifies parameter persistence |
| same | `packages/frontend/editor-ui/src/features/ndv/panel/components/InputPanel.vue`, 1–100 | Separates input sources, run selection, mapping and debug display modes | Native independent input/parameters/output panes and actual-output mapping; run selection is still incomplete |
| same | `packages/core/src/execution-engine/execution-context.ts`, 1–120 | Context lineage and resume preservation, with scoped execution identity | Native persisted run/version context and wait checkpoints; integration resume test |
| Dify `69e9ca4e01ce05da52255939330fbcec454dce23` | `web/app/components/apps/list.tsx`, 1–140 | Permission-aware create, category/search state, debounce, API query composition | Original Floxi Studio with durable drafts, URL search/filter state, permission enforcement on server |
| same | `web/app/components/apps/__tests__/app-card.spec.tsx`, 1–100 | Card actions have distinct mutations and ACL test fixtures | Duplicate/archive/restore browser journey; backend workspace isolation tests |
| both | Root license texts, opening conditions | n8n Sustainable Use/enterprise exceptions and Dify modified Apache conditions | No source incorporation; original implementation; package license inventory and release review document |

The pinned public Git trees contain 31,657 n8n paths and 14,160 Dify paths. Machine-generated tracked-file CSVs are in `upstream-inventories`. Entries default to **Not reviewed**. The node/block path inventories are discovery aids; operation metadata has not been extracted, and they are not parity evidence. This review is targeted, not exhaustive. Neither upstream application was installed or run, so no upstream runtime screenshots or behavior validation are claimed. Floxi screenshots show the native application with temporary test fixtures.

Next review queue: full parameter-renderer tests, dynamic resource metadata authorization, graph scheduling/joins, Dify agent/model/knowledge internals, form publication, and license review before any proposed source reuse. The roadmap's exhaustive source-parity and deployment gates remain open.
