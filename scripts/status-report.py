"""Inventory the roadmap's core feature tables without overstating completion."""
import csv,pathlib
root=pathlib.Path(__file__).resolve().parents[1]
lines=(root/'RoadMap/ORCHAI_N8N_DIFY_UNIFIED_PLATFORM_MASTER_SPEC_v1.7.md').read_text().splitlines()
status={
 'Manual trigger':('Tested','JSON-object input, published graph snapshot, real persisted execution','tests/integration.test.ts'),
 'Set/edit fields':('In Progress','JSON merge and durable output references work; general expression transforms and bulk arrays are pending','packages/shared/src/index.ts'),
 'Condition / IF / switch':('In Progress','Strict comparisons and true/false routing tested; switch/case and branch joins pending','apps/api/src/execution/engine.ts'),
 'Wait / Delay':('Tested','Durable 1–3600 second wait with restart-safe checkpoints','tests/integration.test.ts'),
 'Activation & versions':('In Progress','Immutable publication/history and version-pinned runs work; rollback and activation lifecycle pending','apps/api/src/workflows/workflows.ts'),
 'Execution logs':('In Progress','Persisted per-node I/O, statuses, errors and replayable events; retention/encryption and full traces pending','apps/api/src/execution'),
 'Retries and timeout':('In Progress','Atomic pure-step replay and a 24-hour run deadline; configurable retries/side-effect protocol pending','apps/api/src/execution/engine.ts'),
}
rows=[];in_core=False
for line in lines:
 if line.startswith('### 3.1'):in_core=True
 if line.startswith('### 3.3'):in_core=False
 if not in_core or not line.startswith('|'):continue
 cols=[v.strip() for v in line.strip().strip('|').split('|')]
 if len(cols)<3 or cols[0]=='Capability' or cols[0].startswith('---'):continue
 feature,priority,requirement=cols[:3]
 state,notes,evidence=status.get(feature,('Not Started','No connected implementation in 0.1',''))
 rows.append([feature,priority,state,notes,evidence,requirement])
extras=[('Studio CRUD/search/archive','P0','Tested','Durable create/list/search/reload/duplicate/archive/restore','tests/e2e/studio.spec.ts',''),('Canvas and workbench','P0','In Progress','Five connectable node families; autosave, conflicts, undo/redo and real data mapping. Full keyboard/multi-selection/clipboard/viewport parity pending','apps/web/src/editor',''),('Local authentication and workspace RBAC','P0','Tested','Bootstrap and local login sessions with server-side access checks; enterprise SSO/member management still pending','tests/integration.test.ts',''),('OIDC/SAML and enterprise administration','P1','Not Started','No SSO/member/policy management interfaces','', ''),('Form/app publishing','P0','Not Started','No public forms, agent presentations, widgets or app APIs','', ''),('Advanced node metadata and parameter operations','P0','Not Started','No connector resource schema discovery or plugin migration layer','', ''),('Light/dark and responsive Studio','P0','Tested','Desktop light/dark and 390/1366/1920 px captures','docs/screenshots',''),('Arabic RTL','P1','Not Started','English interface only','', ''),('Full upstream parity audit','P1','In Progress','Pinned trees and targeted source review only; discovered paths are not reviewed implementations','docs/upstream-audit.md',''),('Production hardening','P1','In Progress','Local access checks and restore smoke tested; SSO, secrets, encryption, retention, quotas/load and deployment certification pending','docs/architecture-decisions/001-foundation.md','')]
with (root/'docs/PARITY_GAPS.csv').open('w') as f:
 w=csv.writer(f);w.writerow(['capability','priority','status','scope_or_gap','evidence','roadmap_acceptance']);w.writerows(rows+extras)
print(f'Wrote {len(rows)+len(extras)} core feature status rows; this is not an exhaustive decomposition of every cumulative roadmap assertion.')
