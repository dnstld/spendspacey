# Installable offline shell verification

## Historical PR #6 restart-resumable activation correction (2026-10-22)

Base: `611994f4e0cae15b4b4ef4ada6659d10ac059a55`. This implementation branch
preserves main-derived **6/9** with Tasks **3.2–3.4 unchecked**. It imports no
production/phone acceptance results from the separate dirty acceptance checkout.
The interrupted-activation defect is reproduced in disposable contexts and is the
leading hypothesis, not proof of the physical phone's exact trigger. The phone
remains untouched; no production deployment or rollback is authorized.

The [Service Worker activation algorithm](https://www.w3.org/TR/service-workers/#activation-algorithm)
allows browser activation despite unsuccessful handlers. Native running-instance
proof compares `self.serviceWorker === self.registration.active` plus lifecycle
state. Real Chromium and supplemental disposable WebKit 27.2 report false during
install, true while activating and true after activation. WebKit 27.2 evidence does
not establish support on the untouched physical iOS/Chrome versions.

`activation.test.ts` covers write rejection, persisted-but-unacknowledged writes,
read-back/lineage interruption, restart without activate, same-global resumption,
repeated/concurrent reconciliation, navigation/status/cleanup, missing completion,
waiting/stale/superseded/ambiguous candidates, repeated build identity, compatible
rollback, identical assets/different workers, corrupt/forked/incompatible/unsupported
metadata, predecessor pins and repair/adoption history. `pnpm test:activation` runs
the complete activation matrix ten times under ordinary and constrained execution;
no retries are used. Existing deterministic repair ordering remains separately
required, with ten repetitions and both scheduling modes.

The Chromium PWA suite injects faults only into disposable worker activation-record
writes. It observes intact-but-unbound recovery before permitting persistence, then
verifies same-global, worker restart and persistent-profile browser restart. A
separate transition uses an actual archived build of corrected main `611994f` to
strand the predecessor ledger, then normally installs the corrected worker while
the recovery document stays open. The old recovery CSP rejects script-initiated `registration.update()`; the successful
regression uses ordinary navigation-triggered browser soft update. No CSP relaxation,
unregister, site-data clearing or reinstall is used. Bilingual offline reload, immutable old pins, no repair attempts/seals,
and no external/private requests are checked after adoption.

Recovery tests cover delayed/replaced controllers, missing/obsolete replies, fresh
handshake before deliberate interactions, no replay, exact English/Portuguese
unbound guidance and proven-resource-loss copy, only locale storage access, zero
fetch/import/Auth execution and no forced reload. Resource-loss copy is selected
only from successful checks proving missing/corrupt files; storage exceptions,
activation/binding unavailability and intact unbound resources use neutral copy.
Both responses contain only fixed build-owned HTML and the same exact CSP hashes;
no schema/protocol migration or private payload is added.

Rendered waiting guidance is asserted exactly in English and after changing to
Brazilian Portuguese, inside the intended polite live region. Existing waiting
worker, retention and no-forced-reload tests remain required. The physical-device
contract below permits `not observed` and unavailable physical reload without
misrepresenting either as a pass.

Local final verification passed with Node 24.21.0 / pnpm 10.27.0:

| Verification                                    | Result                                                                                                                                                   |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full unit/component suite                       | 563/563, 22 files                                                                                                                                        |
| Activation interruption/concurrency             | 23 cases × 10 repetitions × 2 execution modes = 460 executions                                                                                           |
| Deterministic first-effective repair ordering   | 80 cases × 10 repetitions = 800 executions, both scheduling modes                                                                                        |
| Full Chromium/origin/PWA suite                  | 61/61, retries 0; includes actual-611994f stranded-installation update                                                                                   |
| Supplemental disposable WebKit                  | 27.2: native identity/timing, actual preparation and controlled navigation; zero external requests                                                       |
| Formatting, lint, application/worker types      | Passed                                                                                                                                                   |
| Configuration rejection                         | Passed, including 46 unsafe URL/Pages metadata variants                                                                                                  |
| Build/delivery                                  | Local test plus production/preview/unclassified Pages variants passed; manifest/icons, exact 11-resource inventory/integrity, routing/headers/CSP passed |
| Recovery/update/repair/rollback/cutover/cleanup | Passed in mapped deterministic/component/browser suites; no physical-device pass inferred                                                                |
| Secret scan                                     | Proposed source inventory, all local/Pages artifacts and Git history passed                                                                              |
| Strict OpenSpec / whitespace                    | 7/7 items; `git diff --check` passed                                                                                                                     |

CI and deployed-preview results belong to the implementation draft PR's exact-head
checks and review report. A preview check is authorized only after the local gates
above; preview authentication must remain denied. No production deployment,
rollback or physical-phone action is authorized. The historical evidence below
remains historical, not evidence for this release.

---

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
- [ ] 3.4 Complete the PM-only observable lifecycle acceptance using the combined evidence contract below; separately authorize compatible production rollback/restoration. Do not claim representative internal/fault tests as physical-device passes.

PR #4 was merged at the correction baseline. The change remains unarchived and later changes planning-only.
Production publication, iPhone installation/offline acceptance and installed-iPhone
update/rollback are deliberately outstanding. No production, Cloudflare, Supabase,
Google, DNS or GitHub setting or production data is changed. The non-required
orphan `Workers Builds: spendspacey` trigger remains untouched. No profile access,
transaction/CRUD, migration, private storage, queue/outbox or runtime infrastructure
is introduced. There is no approved-scope deviation; conservative indefinite
retention and fail-closed legacy/unprovable documents are explicit limitations.

## Task 3.4 evidence contract

Physical Task 3.4 covers only PM-observed behavior in the same Home Screen installation: waiting notice if observable, usable existing document, close-all/reopen adoption, online use, complete offline close-all/cold reopen in English and Brazilian Portuguese, and absence of unexpected retry, forced reload or installation loss. Test an available safe normal reload control normally. If none exists, record physical reload as `unavailable/not tested`, never passed; combine bilingual physical offline cold-reopen evidence with the separate mapped automated/browser reload evidence. A waiting notice `not observed` does not alone block acceptance after rendered bilingual notice, waiting-worker and retention evidence pass. A broken notice, forced navigation/reload, unusable UI or lost installation is a failure requiring investigation.

Fault injection, exact generation/controller ownership, repair ordering, failed/offline/successful repair, staging isolation and repaired-file adoption are **not manually executed on the physical iPhone; covered by representative automated/hosted evidence**. The product guarantees remain unchanged; only these subcases' evidence source changes. No phone developer tooling, cache mutation, cookies/tokens/sessions/account-storage inspection, callback inputs, API responses or private-data inspection/export is permitted. Compatible production rollback/restoration require separate explicit authorization and exact release verification outside the phone. Neither deployment nor phone interaction is authorized by this implementation.

## Retryable startup/restoration correction — isolated implementation evidence

Base: `fabde5f3e7c35bae4dcf6b5fc8981e2d7f74a940`. This branch contains no imported Task 3.2/3.3 or physical-device results. Main-derived progress remains 6/9 with 3.2–3.4 unchecked. The independent dirty acceptance checkout remains the authority for its 8/9 progress and physical/production observations.

Representative source-confirmed defects: one rejected startup storage read permanently latched unavailability in the previous global; a healthy committed same-build owner was refused restoration when an unrelated same-build reservation existed. These defects can reproduce cold-launch failure but neither proves the phone's hidden trigger. The correction separates immutable/build, temporary access, and invalid durable outcomes, shares bounded lock-held validation, restores committed ownership without transfer, and quarantines unrelated reservations. No schema/protocol migration, automatic repair/reload, network HTML fallback or private-data access is introduced.

| Subcase                                                                                                                                                           | Evidence source and required result                                                                                                                              |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Transient startup, same-global/restart, failure/cooldown bounds, concurrent coalescing, hangs/late/stale continuations                                            | `src/pwa/startup.test.ts`; positive working application after complete validation; no authority before it                                                        |
| Before/after activation persistence/read-back/local restoration; uncertain commit, native authority, predecessor pins, identical assets/different workers         | `src/pwa/activation.test.ts`, repeated ordinary/constrained activation/startup matrix                                                                            |
| Committed owner with one/multiple unrelated same-build reservations; repaired/adopted selection and old pins unchanged; ambiguous different-owner transfer denied | `src/pwa/startup.test.ts`, split activation test; no new activation/association or cleanup                                                                       |
| Exact bilingual unbound → one reload still recovery → close/reopen application → locale change → second cold reopen                                               | `e2e/pwa.spec.ts`; immutable pre-correction build reproduces failure with synthetic access rejection, corrected build requires working app/offline reload        |
| Same-build registration recreation, persistent process restarts                                                                                                   | Disposable browser profiles only; retained locale/cache/epoch and working bound application; never personal-phone storage                                        |
| Missing/reused browser-issued IDs, joint binding/read-back, interrupted delivery/repair, rollback/cutover/seals                                                   | Existing generation/repair/browser matrix; no invented identity, mixed selection, replay or unsafe cleanup                                                       |
| Recovery controller changes/late or missing replies; exact temporary/invalid/resource-loss wording; waiting notice/live region                                    | Recovery and rendered component tests in English/PT-BR; no unauthorized repair, automatic reload, Auth SDK or private-data reads                                 |
| Reload on physical devices without a safe reload control                                                                                                          | `unavailable/not tested`, never a physical pass; PM bilingual offline close-all/cold reopen plus separate automated/browser reload evidence                      |
| Physical waiting notice not observed                                                                                                                              | May remain `not observed` after rendered notice/waiting/retention evidence pass; broken notice, forced reload/navigation, unusable UI or lost installation fails |

All internal/fault subcases are **not manually executed on the physical iPhone; covered by representative automated/hosted evidence**. No phone developer tooling, cache mutation, Auth/session/private-data inspection or account details are permitted. Task 3.4 remains unchecked; preview verification cannot complete the physical gate. Production/rollback/restoration require separate authorization.

Verification results for this correction are recorded below after execution.

### Executed final correction checks (2026-10-25)

| Check                                                                                       | Final result                                                                                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit/component suite, including exact EN/PT waiting live region and readiness/recovery copy | 586 passed, 23 files                                                                                                                                                                                                                                       |
| Focused activation/startup matrix                                                           | 42 cases × 10 repetitions × 2 scheduling modes = 840 executions, no retries                                                                                                                                                                                |
| Deterministic repair ordering                                                               | 80 cases × 10 repetitions = 800 executions, ordinary/constrained modes, no retries                                                                                                                                                                         |
| Full Chromium authentication/origin/PWA suite                                               | 69 passed, retries 0; bilingual before/after lifecycle, same-build registration recreation, graceful and abrupt disposable process termination, retained pins and offline application availability                                                         |
| Supplemental WebKit                                                                         | 27.2, four disposable persistent-profile lifetimes; three cold-read injections, unchanged committed epoch, native identity/scope, same-build registration recreation and final offline application; zero unexpected requests; not physical iPhone evidence |
| Types/format/lint                                                                           | Application and worker types, Prettier and ESLint passed                                                                                                                                                                                                   |
| Builds/configuration                                                                        | Separate development test plus local, production, preview and unclassified Pages variants; 46 unsafe configuration builds rejected; v1/v2 and actual 069dbc50/611994f/fabde5f archived baselines built                                                     |
| Static delivery                                                                             | All 11 inventory resources, MIME/size/revision/SHA-256, manifest/decoded icons, worker identity, headers/CSP/callback, update/repair/rollback/cutover/cleanup checks passed                                                                                |
| Secrets                                                                                     | 177 candidate files, local/Pages build outputs and Git history scanned; no leaks                                                                                                                                                                           |
| OpenSpec/whitespace                                                                         | Strict validation 7 passed/0 failed; existing archive-advisory information is not archive approval; whitespace clean                                                                                                                                       |

Prototype test failures were investigated rather than retried into a pass: native worker stopped-state and observed activation-persistence rejection replaced lifecycle timing guesses; the same-global fixture explicitly advances its virtual cooldown; hanging-operation tests await actual lock settlement and explicitly fire deadlines rather than using elapsed CPU time. The final matrix and full browser suite each completed with no retries.

The acceptance checkout was independently rehashed: HEAD `611994f4e0cae15b4b4ef4ada6659d10ac059a55`, branch `docs/accept-installable-offline-shell`, six unstaged files, 1338 insertions/56 deletions. Its SHA-256 of `git diff --binary --no-ext-diff` remains `c0b07d4305a84a6e5908239f8d2685ebe283157a1833256eacaf601bbfc4a993`; all 170 tracked-file hashes and status match the pre-implementation snapshot. This is preservation proof only, not imported acceptance evidence. Its 8/9 state is unchanged; this implementation retains main-derived 6/9 and unchecked Task 3.4.

Automatic branch-preview delivery and CI will be recorded on the draft PR after the locally verified branch is pushed. No merge, production deployment/settings change, rollback, archive or phone action is authorized. Both representative defects remain hypotheses for the physical trigger; no exact phone controller/worker identity or session/account conclusion is inferred.
