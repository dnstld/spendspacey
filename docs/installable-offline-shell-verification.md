# Installable offline shell verification

## Deterministic repair-outcome correction (2026-10-21)

Branch: `fix/repair-outcome-ordering`, clean main baseline
`fae9f51b489db95d672a4761cbd9ecef80b53de6`. The separate paused
`docs/accept-installable-offline-shell` worktree and its uncommitted production
acceptance evidence are not imported or modified here. Task 3.2 remains unchecked.

### Failure evidence and diagnosis

[Merge CI attempt 1](https://github.com/dnstld/spendspacey/actions/runs/39474487087/attempts/1)
and [attempt 2](https://github.com/dnstld/spendspacey/actions/runs/39474487087/attempts/2)
both failed `strict recovery and deliberate bounded repair > reports cancelled
without automatic retry or lock release by page timeout` at
`src/pwa/generations.test.ts:366`, expecting cancelled and receiving timed-out.
The test durations were 84/92 ms; generation-file durations were 9,116/9,983 ms;
both suites finished 447/448. Assertion log timestamps were
2026-10-20T18:25:28.0912772Z and 18:46:01.3233637Z. The separate timeout case passed
in 101/85 ms. [Attempt 3](https://github.com/dnstld/spendspacey/actions/runs/39474487087/attempts/3)
passed 448/448 in 12.44 s; unchanged local verification also passed. Neither rerun
establishes correctness. Historical logs lack abort/selection/persistence event
traces, so they cannot disambiguate the actual failing ordering.

There are two established defects: the test gave cancellation only a 20 ms deadline
while awaiting multiple status/metadata operations, and production classified from
a mutable `timed` flag after awaiting a terminal snapshot. An already effective
cancellation could therefore become a persisted timeout while storage was slow.
The unchanged engine reproduced cancellation-first/timeout-classified 30/30 times
with a delayed terminal read and 20/20 with explicit deadline control. Moving that
same deadline into the finish write preserved cancellation. Ordinary failure could
also become timeout during its terminal snapshot.

### Corrected behavior and regression method

Private worker-owned sentinel identities classify `signal.reason`. Both abort
paths check prior abort and frozen decision, and cancellation repeats the checks
after authorization write/read-back. First actual abort wins, without cancellation
preference. Catch entry freezes failure synchronously before awaited work. Success
is selected at the existing final abort check, after validated completion and the
final writer-locked snapshot. Selection immediately disarms the timer; stale
callbacks remain guarded. Persistence never changes selection or retries with a
replacement outcome. A failed/unvalidated finish returns unknown immediately;
later STATUS/restart may validate an existing finish. Cancellation evidence alone
remains unknown. The repair lock spans persistence settlement and final result
determination. Attempt spending, staging retention, cleanup and adoption are unchanged.

`src/pwa/repairOutcome.test.ts` exercises 40 cases under both ordinary and constrained
scheduling: **80 cases per matrix**, each repeated **10 times by `pnpm test:repair`**.
Constrained mode yields metadata work to later scheduling turns; explicit barriers
and an injected deadline determine ordering, rather than elapsed time. The original
cancellation/timeout and replayed-cancellation tests now use these controls.

Coverage includes both stop orderings, callbacks in the same turn, cancellation
write/read-back, persisted requests before abort, slow authorization, final terminal
snapshot, finish write/read-back/lineage, prior ordinary failure, success selected
with pending persistence, rejected writes, uncertain successful writes, missing
finish, independent STATUS/restart resolution, identity-only classification, stale
callbacks, lock retention through publication, one spent attempt, no automatic
additional fetch, partial staging and no adoption without validated success.
Every failure emits ordered diagnostics for authorization, actual abort, selection
via deadline disarm, writes/read-back/lineage, status publication and lock release.

Real-worker Chromium checks both locales and prove zero page SDK imports and zero
Supabase/Google/OAuth/Auth/user/session/profile/API requests through cold recovery
and repair. The only downloaded repair file is the approved same-origin static SDK
asset, fetched as bytes. Browser tests also retain update, rollback, cutover and
cleanup coverage; production/phone behavior is not inferred from these fixtures.

### Verification on the correction

Node **24.21.0**, pnpm **10.27.0**, Playwright **1.64.1**; dependency lockfile unchanged.

| Check                                                   | Result                                                                                         |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Frozen installation                                     | Passed with pinned Node/pnpm                                                                   |
| Focused deterministic repetition                        | **800/800 executions passed**, 80 cases × 10, ordinary/constrained; 13.74 s locally            |
| Full unit/component suite                               | **528 passed in 21 files**                                                                     |
| Full Chromium suite                                     | **57 passed**, including 26 PWA/update/recovery/cutover cases; no retries                      |
| Application and worker types / lint                     | Passed                                                                                         |
| Configuration rejection                                 | Passed, including 46 unsafe URL/Pages metadata builds                                          |
| Builds                                                  | Local test plus production, preview and unclassified Pages variants passed                     |
| Manifest / inventory / integrity / recovery             | Passed, 11 exact assets per build; exact CSP and worker implementation identity                |
| Versioned worker fixtures                               | Corrected v1/v2 and actual 069dbc50 predecessor built successfully                             |
| Strict OpenSpec                                         | **7 passed, 0 failed**; existing informational notices unchanged                               |
| Formatting / secrets / exact-head Linux / Pages preview | Formatting and pinned Gitleaks inventory/build/history scans passed; CI/preview evidence below |

The pinned Ubuntu 24.04 job runs the repeated deterministic matrix before the
full unit/browser/build checks. Implementation commit
`0bc021e1eb6fb10233b052c851390739de29a128` passed the complete
[Linux run 39648317658](https://github.com/dnstld/spendspacey/actions/runs/39648317658)
on its first attempt: 800 matrix executions, 528 unit/component tests, 57 Chromium
tests, frozen install, formatting/lint/types, all configuration/build/inventory/
recovery/update/rollback/cutover/cleanup checks, secret scanning and strict OpenSpec.
Tasks **2.2 and 3.1 were reopened and re-completed only after this evidence passed**.
Progress is **6/9**; **3.2, 3.3 and 3.4 remain unchecked**. The change remains
unarchived and later changes planning-only.

The final follow-up changes only this record and task evidence; runtime, tests,
workflow, lockfile and builds remain those of the validated implementation commit.
[Draft PR #5 exact-head checks](https://github.com/dnstld/spendspacey/pull/5/checks)
identify the final head, its complete rerun and corresponding Pages deployment.
The final review handoff records the full head SHA, run and deployment URL after
those checks finish. These checks must match that head before reviewer approval;
no merge is authorized. Production and external settings are unchanged.

### Hosted preview evidence

Implementation commit `0bc021e1eb6fb10233b052c851390739de29a128` deployed successfully to
[Pages preview 5cf9acfa](https://5cf9acfa.spendspacey.pages.dev).
Independent HTTP/isolated Chromium verification passed: 11 exact asset byte lengths,
MIME and integrity hashes; manifest identity; canonical entry 308; worker scope and
headers; callback no-store/no-referrer; preparation/control; offline reload;
Portuguese cold recovery; deliberate static repair and reload adoption; disabled
preview sign-in; **0 page SDK imports and 0 cross-origin requests**.
This is preview evidence only; Task 3.2 production evidence stays in the paused
acceptance branch and is not copied here.

## Original ownership correction evidence (historical)

Historical branch: `feat/installable-offline-shell`, [PR #4](https://github.com/dnstld/spendspacey/pull/4).
Correction baseline: `069dbc50f4a34b76fefd2a3eb934388d452a8b5a`.
Original clean/main baseline: `d786441215a1c9e6fb2d048262fc4d09b5d79e44`.
Node `24.21.0`, pnpm `10.27.0`. Dependencies and lockfile are unchanged.
The archived/synchronized/accepted predecessor remains satisfied; see
[deployment acceptance](deploy-auth-shell-acceptance.md).

## Local verification

| Check                                               | Result                                                                                                                                                                                            |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frozen dependency installation                      | Passed, `CI=true pnpm install --frozen-lockfile`                                                                                                                                                  |
| Formatting / lint                                   | Passed, Prettier and ESLint with zero warnings                                                                                                                                                    |
| Application / worker types                          | Passed, both TypeScript contexts                                                                                                                                                                  |
| Unit/component tests                                | **448 passed in 20 files**                                                                                                                                                                        |
| Configuration rejection                             | Passed missing/invalid startup/build inputs, Pages toolchain mismatch, unexpected public inputs and **46 unsafe URL/Pages builds**                                                                |
| Local application build                             | Passed, synthetic local configuration                                                                                                                                                             |
| Production / preview / unclassified builds          | Passed all three policy variants and exact delivery/header inventories                                                                                                                            |
| Manifest / icons / canonical inventory              | Passed all corrected builds: root identity/scope/standalone/colors, decoded PNG dimensions/safe-circle checks, **11 exact assets**, revision/MIME/SHA-256, canonical `/` from emitted index bytes |
| Worker / recovery build identity                    | Passed, pre-injection implementation plus inventory/configuration identities and exact embedded script/style CSP hashes                                                                           |
| Real worker build fixtures                          | Passed complete corrected v1/v2 and the actual archived **069dbc50** source/build pipeline                                                                                                        |
| Full Chromium suite                                 | **57 passed**: 26 PWA/update/recovery/cutover tests and 31 inherited Auth/origin/preview tests                                                                                                    |
| Repository / generated builds / Git history secrets | Passed pinned Gitleaks scans with redaction; synthetic artifacts only                                                                                                                             |
| Strict OpenSpec                                     | **7 passed, 0 failed**; existing informational future/superseded delta notices remain                                                                                                             |
| Git whitespace                                      | Passed                                                                                                                                                                                            |

Exact-head Actions and Pages preview status/URLs are recorded in the PR checks and
implementation handoff, after pushing this correction. Local evidence is not
presented as hosted production or physical iPhone acceptance. Review/merge remains
blocked until the reviewer accepts the code and exact-head evidence.

## Behavioral evidence

The real engine's 100 generation cases use Cache Storage/Web Lock adapters with
fault injection. They exercise durable reservations, joint selection/binding
write/read-back, response and evidence boundaries, immutable document pins,
restarts, complete and damaged activation, neither usable, v1 → v2 → v1 rollback,
reversed metadata enumeration, writer/epoch/head fencing, forks/missing/corrupt or
unsupported records, configuration/deployment mismatch, write/quota/metadata-bound
failure, eviction, staging and cutover interruptions, callback binding and exact
asset routing before confirmation. Responses establish behavior; metadata flags or
cache names alone do not establish delivery/readiness.

Both confirmed and never-confirmed potentially delivered documents remain pinned.
Hidden, uncontrolled, unresponsive, newly navigating and frozen/BFCache clients
never lose ownership through absence. No browser lookup is necessary for delivery;
a hanging enumeration occurs outside the decision lock and cannot block a fresh
navigation. Empty/duplicate/conflicting resulting identities give guidance only;
later valid WebKit-style navigation can adopt a verified repair after restart.
No `isReload`, `replacesClientId`, unload/pagehide or elapsed-time closure evidence
is required. Physical iPhone behavior remains unclaimed.

Sealing cases cover unreferenced historical generations, three-generation
retention, binding/source/waiting/import/callback protection, restart before/during
delete, idempotent sealed deletion, and rejection of new sealed references.
Ambiguous ownership protects every possible generation indefinitely, rather than
vetoing new document selection. Retention can exceed two caches and consume storage
indefinitely. Exhaustion reports unavailable; ownership is never expired for quota.

Repair cases cover deliberate success/failure/timeout/cancellation/offline and
unknown/interrupted outcomes, single flight, persisted attempt before requests,
replay rejection, cancellation replay, interrupted outcomes remaining spent,
verified copy/download in separate staging, and corruption after completion but
before adoption. Failed/interrupted work remains unselected. New deliberate repair
can replace corrupt completed staging. Existing application/recovery documents
never switch; a new navigation/reload adopts only after full validation and joint
commit. Page timeout does not release the worker flight lock.

The embedded page has 31 isolated script/localization cases, including exact
English/Portuguese statuses, supported locale validation, device-language ordering,
denied storage, fixed text rendering, forged reply IDs, metadata unavailability,
guidance-only missing bindings and deliberate action. CSP hashes are independently
recomputed in unit/build checks. Chromium enforces the hash policy against an
injected script and confirms no Auth SDK execution or Auth/API requests during
cold recovery/repair. Verified static SDK download is allowed; execution in the
recovery page is not.

Chromium disables/clears ordinary HTTP caching and emulates both network loss and
navigator state. It proves Pages' `/index.html` 308 canonicalization, first online
preparation followed by controlled next load offline, both locales, hard reload and
cold reopen, missing/corrupt root/bootstrap/lazy SDK, exact no-store/no-referrer
recovery policy, failed/timed-out/cancelled repair and reload adoption while another
old document retains its unusable original pin. No network document request occurs
just because the selected shell is damaged. The unchanged callback/Auth regression
checks include synthetic PKCE, session restoration, expired/offline initialization,
logout-500 and localization/races.

Existing router-recognized callback forms (case, trailing slashes and decoded
segments) receive a selected verified clone with their own binding before bytes.
No callback can promote, receive recovery HTML, cache a callback response or persist
OAuth input. Unknown native Pages documents remain unbound; their application
assets fail closed instead of borrowing global selection. Denied-origin tests
continue proving zero page SDK import/client construction or Auth/API traffic,
including callback cleanup. This callback-only recognition is not static URL/key
expansion or a generic navigation fallback.

Cutover is exercised twice: the exact frozen 069dbc50 writer creates unit metadata,
and Chromium installs an actual build of that Git revision before a normal waiting
upgrade. Validated legacy descriptors, lineage, build/configuration identities and
repair history are imported into new-owned resource storage with independent byte
verification. Legacy caches/SDK/locale remain untouched. Attempts made while the
corrected worker waits are merged at activation/startup/before repair under the
shared old/new repair lock; spent/unknown history cannot reset. Old privileged
messages and unprovable pre-pin clients cannot acquire authority. Imported older
static bytes are distinct from redeploying the old worker: an obsolete v2 UI uses
the embedded canonical recovery entry while its verified rollback remains
selected/protected and can provide a safely bound callback clone.

## Changed file areas

- `build/pwa.ts`, `scripts/check-pwa.mjs`, `scripts/prepare-pwa-versions.mjs`:
  separate corrected/legacy compatibility digests, exact recovery CSP/build checks,
  corrected versions and actual predecessor artifact construction.
- `worker/schema.ts`, `worker/generations.ts`, `worker/policy.ts`, `worker/sw.ts`:
  strict v3 ownership ledger, joint delivery, fencing, per-client routing, callback
  ownership, lifecycle evidence, bounded repair, sealed conservative cleanup and
  event wiring without claim/forced activation/reload.
- `worker/recovery.ts`, `worker/legacy-schema.ts`, `worker/legacy.ts`:
  self-contained localized hashed recovery and explicit read-only old-schema
  validation/cutover.
- `src/pwa/lifecycle.ts`, `src/i18n/en.ts`, `src/i18n/pt-BR.ts`:
  correlated v3 control, guarded independent recovery entry and reopen/reload text.
- `src/pwa/generations.test.ts`, `src/pwa/recovery.test.ts`,
  `src/pwa/policy.test.ts`, `src/pwa/PwaFeedback.test.tsx`:
  behavior, interruption, concurrency, security, callback and localization evidence.
- `test/staticGenerations.ts`, `test/legacy-v2/generations.ts`,
  `test/legacy-v2/schema.ts`, `test/legacy-v2/policy.ts`:
  faults and exact predecessor writer fixtures, never bundled in the application.
- `e2e/pwa.spec.ts`, `e2e/origin.spec.ts`: real worker/offline/update/cold recovery,
  actual upgrade, no-Auth recovery and strict unbound-document regression coverage.
- Active `proposal.md`, `design.md`, `specs/installable-app/spec.md`,
  `specs/user-auth/spec.md`, `tasks.md`: approved ownership/recovery lifecycle.
- This record and [installation/rollback runbook](installable-offline-shell.md):
  state/evidence and interruption tables, truthful cold recovery and acceptance gates.

## Task treatment and remaining gates

Tasks **1.3 and 2.2 were reopened**, then re-completed only after the representative
corrected engine/browser behavior passed. **1.2 and 3.1 evidence is refreshed**;
**2.1 Auth/localization safeguards were retested**. **6/9 tasks complete**.
Exact remaining unchecked tasks:

- [ ] 3.2 After review/CI and the accepted merge to `main`, publish through the existing Pages GitHub integration at the predecessor's production origin. Verify actual worker/manifest bytes/MIME, root scope, revalidation, native SPA fallback without top-level `404.html` or catch-all rewrites, callback no-store/no-referrer, and CSP compatibility. Check required assets exist and reject fallback HTML as a valid worker/chunk; do not require arbitrary missing paths to return 404 or add Cloudflare runtime/storage products. Record version/URL/header outcomes without claiming local preview proves host behavior.
- [ ] 3.3 Have the PM record the iPhone model and tested iOS/Google Chrome versions, open the production Pages URL in Chrome, use Share → Add to Home Screen, confirm the Spendspacey name/intended icon, and launch from the Home Screen. Verify standalone web-app presentation rather than an ordinary browser bookmark/tab. From that installed app, complete online sign-in/identity/sign-out, reach static readiness, and verify airplane-mode reload and full close/reopen, both languages, safe areas, touch controls, avatar fallbacks, and reconnect guidance. Record sanitized versions/URL/revision/pass-fail evidence; desktop Chromium cannot replace this manual PM gate and Safari-specific manual acceptance is not required.
- [ ] 3.4 Publish a compatible accepted replacement merged into `main`, or identify a previously accepted complete production replacement, at that same origin and verify the waiting notice plus close-all-windows/reopen transition in the same installed iPhone Home Screen app added through Chrome; verify worker-aware recovery/rollback against complete builds. Record tested iOS/Chrome versions and sanitized update evidence without adding any application data feature.

PR #4 was merged at the correction baseline. The change remains unarchived and later changes planning-only.
Production publication, iPhone installation/offline acceptance and installed-iPhone
update/rollback are deliberately outstanding. No production, Cloudflare, Supabase,
Google, DNS or GitHub setting or production data is changed. The non-required
orphan `Workers Builds: spendspacey` trigger remains untouched. No profile access,
transaction/CRUD, migration, private storage, queue/outbox or runtime infrastructure
is introduced. There is no approved-scope deviation; conservative indefinite
retention and fail-closed legacy/unprovable documents are explicit limitations.
