# Validation evidence — foundation release

Validated in the current cloud machine on 16 October 2026. This does not establish publication, remote CI success, or restoration in another chat.

| Check | Result | Evidence |
|---|---|---|
| Frozen installation + Prisma client + additive migrations + production build | Passed | `bash scripts/setup-cloud.sh`; repeated application preserved existing data and migration checksums |
| Strict TypeScript | Passed | `pnpm typecheck`, including API, browser, shared contracts, test and operational scripts |
| Application-source lint | Passed | `pnpm lint`; reference-only upstream research trees are excluded |
| Contracts/integration | 32 passed; none skipped | `docs/TEST_RESULTS.json`; final run explicitly checked no standalone worker was present, so resume and concurrency were controlled by the suite |
| Browser journeys | 5 passed; none skipped | `docs/E2E_RESULTS.json`; first-admin onboarding/login/logout, full workflow path and real mapping, lifecycle/search/responsive views, unsaved navigation, failed-cache refresh recovery |
| Compiled API/worker | Passed | Built artifacts started with other application ports closed; `scripts/production-smoke.ts` performed authenticated create/save/publish/enqueue and verified the real worker's persisted response |
| Backup/restore | Passed | `scripts/backup-smoke.ts`: actual executed checkpoint, vector extension version and exact ledger checksums restored into a separately created temporary database; source fixture and temporary database removed |
| Saved startup helper | Passed | `scripts/start-cloud.sh` started one API/worker/web set from free ports; API returned database-backed identity status and frontend returned Floxi HTML |
| Duplicate launch protection | Passed, expected refusal | A second startup returned nonzero with the occupied-port explanation, without starting duplicate services |
| Repository preservation | Passed | Roadmap, stack instructions and logos unchanged; only README changed among the pre-existing tracked files. `.env`, dependencies, builds and research checkouts are ignored |

Screenshots are native Floxi screens with temporary, explicitly generated test workflows. Both themes were visually inspected. Browser viewports include 390×844, 1366×768, 1440×1000 and 1920×1080. Only Studio overflow and the listed user journeys were automated; an exhaustive accessibility/performance audit is not claimed.

The full roadmap remains incomplete. See `feature-parity-matrix.md` and `PARITY_GAPS.csv`. There are no remaining environment blockers for the bounded foundation workflow. AI/provider services, external connectors and enterprise release gates were not validated or represented as complete.

## Git synchronization check — 16 October 2026

Prisma generation, strict TypeScript, ESLint, production build, and all 32 contract/integration tests passed with the additive AI/knowledge schema applied. The initial integration attempt preceded the pending migration and failed on the missing column; rerunning after migration passed. A database backup was saved outside the repository before migration. The AI/provider transport and contracts remain unfinished scaffolding and have not been verified against a live provider. Fresh-database CI uses the pgvector PostgreSQL image and enables the extension before creating the vector column.

Browser verification during synchronization: the first run passed four journeys but timed out locating the renamed workflow in the refresh-recovery journey. An unchanged full rerun passed all five journeys. This intermittent browser failure remains recorded here; no claim of flake-free execution is made.
