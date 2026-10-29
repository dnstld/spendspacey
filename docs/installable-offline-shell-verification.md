# Installable offline shell verification

## Deterministic repair-outcome correction (2026-10-21)

Historical correction branch: `fix/repair-outcome-ordering`, clean main baseline
`fae9f51b489db95d672a4761cbd9ecef80b53de6`. The separate paused
`docs/accept-installable-offline-shell` worktree and its uncommitted production
acceptance evidence were not imported or modified by PR #5. Its isolated branch
left Task 3.2 unchecked. This acceptance reconciliation now retains that evidence
and Task 3.3 below; current progress is 8/9, with only Task 3.4 pending.

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
At that isolated correction handoff progress was **6/9**, with **3.2–3.4 unchecked**;
this is historical, superseded by the reconciled 8/9 acceptance state below. The change remains
unarchived and later changes planning-only.

The final follow-up changes only this record and task evidence; runtime, tests,
workflow, lockfile and builds remain those of the validated implementation commit.
[PR #5 exact-head checks](https://github.com/dnstld/spendspacey/pull/5/checks)
identify the final head, its complete rerun and corresponding Pages deployment.
Final head `79dbbd485a922b560fc92f0cc1ef4c1b362c9286` passed
[Linux run 39649446414](https://github.com/dnstld/spendspacey/actions/runs/39649446414)
on its first attempt (800 matrix executions, 528 unit/component, 57 Chromium).
Exact-head preview `0b2ca09b-4a6a-4599-b609-8cb19f7f1e5a` passed independent
recovery/repair/adoption, 11-resource integrity and zero SDK/provider execution.
PR #5 is now merged as `611994f4e0cae15b4b4ef4ada6659d10ac059a55`.
The implementation code commit is `0bc021e1eb6fb10233b052c851390739de29a128`;
`79dbbd48…` is the accepted PR head, including documentation evidence.
PR #5 itself did not change external settings. Corrected production verification
is recorded separately from that preview below.

### Hosted preview evidence

Implementation commit `0bc021e1eb6fb10233b052c851390739de29a128` deployed successfully to
[Pages preview 5cf9acfa](https://5cf9acfa.spendspacey.pages.dev).
Independent HTTP/isolated Chromium verification passed: 11 exact asset byte lengths,
MIME and integrity hashes; manifest identity; canonical entry 308; worker scope and
headers; callback no-store/no-referrer; preparation/control; offline reload;
Portuguese cold recovery; deliberate static repair and reload adoption; disabled
preview sign-in; **0 page SDK imports and 0 cross-origin requests**.
This remains preview evidence only; the baseline production and physical-device
acceptance records have now been reconciled separately below.

## Original ownership correction evidence (historical)

Implementation: merged [PR #4](https://github.com/dnstld/spendspacey/pull/4).
Closure branch: `docs/accept-installable-offline-shell` (documentation only, uncommitted).
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

The local results above are implementation evidence. The distinct post-merge hosted
production evidence below completes Task 3.2. PM-reported physical iPhone
installation/online/offline acceptance completes Task 3.3 below; Task 3.4 remains
pending. The implementation PR is merged; this closure branch has no PR.

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
is required. These engine checks do not establish physical iPhone behavior; the
PM-reported Task 3.3 evidence is recorded separately below.

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

## Production verification — Task 3.2 accepted

**Historical baseline production**, verified on **2026-10-20 UTC**, canonical hostname **spendspacey.pages.dev**, origin
**https://spendspacey.pages.dev**. Merge:
`fae9f51b489db95d672a4761cbd9ecef80b53de6` (PR #4, merged 18:24:41 UTC).
The existing Cloudflare Pages check for that exact merge reports successful delivery
at `https://90a2be8a.spendspacey.pages.dev`. Its document and entry hashes match the
canonical production origin. This deployment-status evidence is supplemented by
actual canonical-origin bytes, not used as proof on its own.

The accepted head `9e3571e5fefe9a0591bc7e3f1e30721421ddd347` and merge have the
identical Git tree `a2b76d38849f03f65a7ae975b4ea879902083158`.
[Accepted-head CI](https://github.com/dnstld/spendspacey/actions/runs/39473059167)
passed. The merge workflow history is preserved separately:

| Attempt                                                                        | Outcome                             | Sanitized evidence                                                                                                                                                             |
| ------------------------------------------------------------------------------ | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [1](https://github.com/dnstld/spendspacey/actions/runs/39474487087/attempts/1) | Failed                              | 447/448 unit tests passed; cancellation expected `cancelled`, received `timed-out` at `src/pwa/generations.test.ts:366`; later checks skipped                                  |
| [2](https://github.com/dnstld/spendspacey/actions/runs/39474487087/attempts/2) | Cancelled overall; unit step failed | Pre-existing attempt discovered before this session's rerun; logs confirm the same assertion, 447/448 unit tests; later checks skipped                                         |
| [3](https://github.com/dnstld/spendspacey/actions/runs/39474487087/attempts/3) | **Success**                         | One failed-job rerun requested in this session, unchanged merge; 448/448 unit tests in 20 files, 57/57 Chromium tests, secret scan passed, strict OpenSpec 7 passed / 0 failed |

**Successful rerun evidence (2026-10-20):** workflow **Application checks**, URL
**https://github.com/dnstld/spendspacey/actions/runs/39474487087**, attempt **3**,
exact commit **`fae9f51b489db95d672a4761cbd9ecef80b53de6`**. Workflow started
**18:46:40 UTC**, completed/updated **18:51:40 UTC**. The sole quality job
(`118817860553`) succeeded, **18:46:45–18:51:39 UTC**. Formatting, lint, types,
configuration checks, local/Pages builds and delivery inventories, manifest/static
integrity, version fixtures, Chromium, secret scanning and strict specs all passed.
No code was changed and no further rerun was triggered. A prior diagnostic local
rerun on the same merge also passed 448/448 in 20 files.

The repeated assertion in attempts 1/2 is **not dismissed as flaky or fixed by
attempt 3**. Read-only source diagnosis identifies two concrete timing races to
investigate: the cancellation test assigns a real **20 ms** deadline, then awaits
another repair's busy/status checks and the RPC helper's status validation before
sending `CANCEL` (`src/pwa/generations.test.ts:355–363`, helper at line 49).
The worker deadline is already armed, so timeout can win before cancellation.
Also, the timer remains armed during asynchronous finish persistence; it sets
`timed = true` even if cancellation already aborted the controller, and the outcome
expression gives that flag precedence (`worker/generations.ts:1382–1385`,
`1413–1432`). That creates a possible cancellation-first classification race.
The logs establish the repeated result, but do not establish which ordering
occurred. No implementation/test fix or diagnostic instrumentation was applied during that
baseline verification. PR #5 subsequently supplied the deterministic regression
and correction described above. Passing attempt 3 does not erase the historical failures.

At the time of this baseline rerun, Tasks 3.3/3.4 were unchecked. The later PM
Task 3.3 acceptance below supersedes that task state. This baseline diagnosis is
historical: PR #5 subsequently established and corrected both defects as recorded
above; the old failures and unchanged attempt 3 remain part of the record.

### HTTP and build results

**44/44 HTTP check cases passed**: 38 responses with status 200, two 308 redirects,
and four conditional 304 responses. Discovery/build-bootstrap and alternate-origin
fetches are additional and excluded from that case count. Requests used no cookie
jar, account, authorization, or OAuth exchange. Raw configuration/response bodies
were used locally for comparisons and never included in this record.

A fresh production build from the merge used pinned Node **24.21.0**, pnpm
**10.27.0**, the existing two public inputs held in memory, and the canonical Pages
production policy. Every deployed inventory entry and worker matched the generated
build byte-for-byte. Generated inventory, MIME, sizes, SHA-256 integrity, emitted
MD5 revisions, worker implementation digest, and inventory-bound worker identity
all passed. `/index.html` is not a precache key. The generated deployment has no
`404.html`, `_redirects`, `_worker.js`, Functions, source maps, or test files.
The additional published font license also matched its source bytes.

- Manifest: 200, `application/manifest+json`, `no-cache`; `id`, `start_url`, `scope`
  all `/`; `name`/`short_name` both `Spendspacey`; `display: standalone`;
  `lang: en`, no explicit `dir` (default direction); both colors `#f6f7f2`;
  `prefer_related_applications: false`. Three PNG declarations: ordinary 192/512
  and maskable 512. HTML links the manifest and 180px Apple icon, starts with
  `lang=en`, and has matching mobile title, theme and zoom-capable safe-area metadata.
- Worker: 200, `application/javascript`, `no-cache`,
  `Service-Worker-Allowed: /`; actual browser registration/control scope is `/`.
  The live worker status reports the same generated build identity below.
- `/` and its benign query variant: exact generated HTML, `no-cache`.
  `/index.html` and its query variant: 308 to canonical `/`, preserving the query.
- All 11 inventory entries, worker and font license were checked both query-free
  and with a benign query. Stable files/icons/font/license revalidate with
  `no-cache`; the three fingerprinted JS/CSS assets alone receive
  `public, max-age=31536000, immutable`.
- `/auth/callback`, with and without a benign query: generic HTML, `no-store`,
  `no-referrer`. A controlled offline synthetic callback independently retained
  these headers, scrubbed its input and showed offline recovery without exchange.
- `/closure-unknown`, `/assets/missing.js`, `/assets/missing-abcdefgh.js`,
  `/404.html` and `/_redirects`, each with/without a query: native SPA 200 fallback,
  exact root HTML, `public, max-age=0, must-revalidate`, never immutable.
  Missing paths are not required to return 404. Fallback HTML did not satisfy the
  browser repair's required JavaScript MIME/integrity check.
- Every 200 response matched the **exact** repository CSP template with its one
  validated backend substitution; the backend also matched the generated entry.
  All had `nosniff`, `X-Frame-Options: DENY`, and `Referrer-Policy: no-referrer`.
  Root, worker, manifest and entry JavaScript ETags returned empty-body 304 on
  `If-None-Match`, proving actual conditional revalidation.

Sanitized exact application CSP (the placeholder represents the validated value,
which is intentionally omitted):

```text
default-src 'none'; script-src 'self'; worker-src 'self'; manifest-src 'self'; style-src 'self'; style-src-attr 'unsafe-inline'; img-src 'self' https:; font-src 'self'; connect-src 'self' <validated-backend-origin>; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'none'
```

### Deployed bytes and identity

The first 11 rows are the exact generated precache inventory. Icons were decoded
as real PNG streams; dimensions are 192×192, 512×512, 180×180 Apple, and 512×512
maskable respectively. Hashes cover the full uncompressed response bytes.

| Resource                          | MIME                        |  Bytes | SHA-256                                                            |
| --------------------------------- | --------------------------- | -----: | ------------------------------------------------------------------ |
| `/`                               | `text/html`                 |    827 | `8acc41986271fba2797f0fd59b2829f9146d89757e2d7208ad13a87688f95765` |
| `/assets/index-CrdK32_I.css`      | `text/css`                  |  15905 | `381def3e8f7d2db1a9e7dff65cb8fa47a46d797e8b9809038a9b46bfb17235c3` |
| `/assets/index-obx4hvYc.js`       | `application/javascript`    | 364372 | `4deb7c3f9cc39c50bb62572452e476f0ea2fca187125424d390e280c4ff7df00` |
| `/assets/supabase-C1L6covB.js`    | `application/javascript`    | 214621 | `eb282572084287642aaa793a0b489e3c562a50829009cf04b7e944e90194addb` |
| `/fonts/google-sans-medium.woff2` | `font/woff2`                |  23196 | `4d71eed21cc1dc806f17ef26749c5376980b27bed7996c0546de5a9e54688b81` |
| `/google-g.png`                   | `image/png`                 |  33661 | `d1ce9c2af0b10a7333abc99bc706f9a6a199e5b65bf3e3009624f076b8638e6a` |
| `/icons/app-192.png`              | `image/png`                 |   3859 | `39a87432d4a5f05e2f789b09490ecdc0e5c0fb9b312d44bf289589f7b3481e47` |
| `/icons/app-512.png`              | `image/png`                 |  10937 | `2ac10264c7e53ad1f465768646437df3e56fca6ad813fd57f9c42c0ce87421f2` |
| `/icons/apple-touch-icon.png`     | `image/png`                 |   3604 | `6b4a4c21e4f0175e9a381fa0a2992c4162a5f464517be9a70bd775e79b06fb42` |
| `/icons/maskable-512.png`         | `image/png`                 |   8795 | `e5f2f5db80901c745592e77b33fd71c7b0b4076e1a8645ecc22e3181397f5ec7` |
| `/manifest.webmanifest`           | `application/manifest+json` |    477 | `1f6fc322c913ffba54525e3d5e8ca9c9f62440c61442cac3d93ed601e1f6bf47` |
| `/fonts/OFL.txt`                  | `text/plain`                |   4394 | `54c290753de0b8a368e9438005a69b878596e24d902dbbc0ff300291d6db2389` |
| `/sw.js`                          | `application/javascript`    |  59956 | `5f8032f516a897446a6e6a9278fbc1b0a99f78401a4d3fc2249116049543f044` |

Inventory-bound worker identity: `b412fb85d9b7df20db717f84dc30d6021880dcd07f61fa1f8216c2ed026117ca`.

Pre-injection worker implementation: `8563222a14951b6dc150d6fda5c548171123dc4894a925070403ec8d91044fe5`.

Compatibility digest: `c2ca46b7b90c80cc4c03b5de5db5aad5a832f5f2f0a74675ea791dee36885fb9`.

### Hosted browser results

**19/19 scenario groups passed in seven fresh isolated contexts**, Playwright
**1.64.1**, headless desktop Chromium **156.0.8078.4**, macOS arm64, Node **24.21.0**.
Ordinary HTTP cache was disabled/cleared; network failure and navigator offline
state were both emulated. All ordinary application/static preparation and successful
repair bytes came from the live host. Sensitive responses and one intentionally
invalid repair response were intercepted only inside the disposable contexts.
No live provider request or account sign-in was needed.

| Group                                               | Sanitized outcome                                                                                                                                                                                             |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| First online preparation → ordinary next navigation | Complete preparation while uncontrolled, then root control/readiness; no forced reload/claim                                                                                                                  |
| Canonical Auth availability                         | Google sign-in enabled; no click or real authentication                                                                                                                                                       |
| Chromium manifest/installability diagnostics        | Zero errors; desktop diagnostics only                                                                                                                                                                         |
| English offline reload and new page                 | Passed, correct document language                                                                                                                                                                             |
| Portuguese offline reload and new page              | Passed, persisted locale and correct document language                                                                                                                                                        |
| Sensitive traffic/cache audit                       | 16 probes: 14 intercepted network bypasses and 2 CSP-blocked fetches, plus worker-served offline callback; 11 static responses retained, 27 bounded ownership records, zero forbidden keys or private markers |
| Native unknown-route document                       | Host fallback remains unbound; no application-resource cache entry or borrowed application chunks                                                                                                             |
| Missing canonical HTML cold offline launch          | Exact worker-embedded English recovery                                                                                                                                                                        |
| Corrupt bootstrap JavaScript cold offline launch    | Exact worker-embedded English recovery                                                                                                                                                                        |
| Missing lazy SDK cold offline launch                | Exact worker-embedded Portuguese recovery                                                                                                                                                                     |
| Online damaged-shell recovery                       | No automatic missing-file download/network HTML fallback                                                                                                                                                      |
| Deliberate offline repair                           | Truthful offline outcome, no download                                                                                                                                                                         |
| Reload/reconnect/worker restart                     | No automatic repair                                                                                                                                                                                           |
| Deliberate invalid-response repair                  | Fallback HTML rejected; previous generation/binding protected                                                                                                                                                 |
| Failed repair reload/restart                        | Attempt stays spent; no automatic replay                                                                                                                                                                      |
| Deliberate successful repair                        | Verified static staging; recovery page unchanged, old binding remains unusable, unrelated cache/local sentinel preserved                                                                                      |
| New canonical reload after repair                   | Verified adoption and subsequent offline reload pass                                                                                                                                                          |
| Deployment-specific origin                          | `https://90a2be8a.spendspacey.pages.dev`: sign-in/callback disabled, zero page SDK imports or cross-origin requests                                                                                           |
| Accepted feature preview                            | `https://6206b334.spendspacey.pages.dev`: sign-in/callback disabled, zero page SDK imports or cross-origin requests                                                                                           |

The 16 negative probes covered authorization-bearing static GET, arbitrary asset
query, POST, PUT, API/profiles, OAuth, token, session, user/profile, intercepted
backend/cross-origin traffic, an actual opaque response, an avatar image, and a
mock Google navigation. Two fetches were blocked by the real CSP; the avatar and
Google navigation were separately intercepted and exercised. No fixture reached a
real provider. Every worker cache was inspected in the fresh context: resource
responses independently matched the static allowlist, MIME, size and SHA-256;
metadata stayed in the reserved namespace. No callback/query key, sensitive URL,
non-GET response, opaque/cross-origin response or synthetic private marker was saved.
No production account/session storage was read.

For each cold recovery, response bytes matched the independent embedded document,
with exact hashed CSP, HTML UTF-8, no-store/no-referrer, nosniff and frame denial.
An injected unapproved inline script was blocked. Recovery had **zero page JS/SDK
imports, zero unexpected Supabase/Google/OAuth/Auth/API/cross-origin requests**;
repair could download the approved same-origin SDK file as static bytes without
executing it. Missing/corrupt static entries alone were manipulated in isolated
browser Cache Storage. SDK/locale storage and ownership metadata were not cleared
or edited; unrelated sentinel storage survived repair.

Exact recovery CSP:

```text
default-src 'none'; script-src 'sha256-9rDaVaYQHJYGp9JyySAuBHXX3MqAwRcOeeqZ9SCMzcQ='; style-src 'sha256-IcTmMrKaexzyGX5iX1RnpBrPm+pHnbh+2KWv0JW1swQ='; connect-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'
```

## PM physical iPhone acceptance — Task 3.3 accepted

Source: PM-reported behavioral outcomes supplied on 2026-10-21. This records the
PM's installed-device acceptance, separately from automated verification.

| Evidence field               | PM-reported value                          |
| ---------------------------- | ------------------------------------------ |
| Date/time                    | 2026-10-21, approximately 22:38 CEST       |
| Timezone                     | Europe/Berlin                              |
| Device                       | iPhone 16 Pro                              |
| iOS                          | 26.6.2                                     |
| Chrome                       | 155.0.8059.37                              |
| First preferred language     | English                                    |
| Canonical URL                | https://spendspacey.pages.dev              |
| Baseline production revision | `fae9f51b489db95d672a4761cbd9ecef80b53de6` |

| Area           | Behavioral outcome                                    | Result |
| -------------- | ----------------------------------------------------- | ------ |
| Installation   | Fresh Add to Home Screen installation                 | Passed |
| Installation   | Spendspacey name and icon                             | Passed |
| Installation   | Standalone Home Screen launch without Chrome controls | Passed |
| Authentication | Google sign-in                                        | Passed |
| Authentication | Minimal authenticated identity/avatar display         | Passed |
| Authentication | Return to installed experience                        | Passed |
| Authentication | Sign-out                                              | Passed |
| Authentication | Google-login screen restored                          | Passed |
| Offline        | Online preparation and subsequent controlled reopen   | Passed |
| Offline        | Airplane-mode close/reopen                            | Passed |
| Offline        | Airplane-mode reload                                  | Passed |
| Offline        | English offline shell                                 | Passed |
| Offline        | No browser/network error page                         | Passed |
| Offline        | Offline guidance                                      | Passed |
| Offline        | Touch, layout, safe areas, zoom, and readability      | Passed |
| Localization   | Brazilian Portuguese displayed offline                | Passed |
| Localization   | Portuguese persisted after offline close/reopen       | Passed |
| Localization   | English restored and persisted                        | Passed |
| Reconnect      | Normal behavior after restoring connectivity          | Passed |
| Reconnect      | No unexpected automatic repair                        | Passed |
| Reconnect      | No forced reload or persistent recovery/error screen  | Passed |

**Task 3.3 passed on this baseline production revision.** These are only the
supplied behavioral outcomes; no account identity or private Auth/storage details
are recorded. This acceptance does not establish Task 3.4 replacement/update/
recovery/rollback behavior.

## Task treatment and remaining gates

Tasks 1.3/2.2 and earlier implementation evidence above are preserved.
**Tasks 3.2 and 3.3 passed; 8/9 tasks complete.** Task 3.2 production evidence
is preserved above; Task 3.3 is the separate PM-reported physical-device record.
The failed/cancelled merge attempts,
read-only race diagnosis and successful unchanged-commit attempt 3 are recorded
above; CI and hosted checks remain separate from physical-device acceptance.

- [x] 3.2 Post-merge canonical production delivery, bytes, headers, PWA, offline,
      recovery, cache privacy and origin restrictions verified as detailed above.
- [x] 3.3 PM physical iPhone/Chrome Share installation, standalone online Auth,
      offline reload/cold reopen, both languages, safe-area/touch and reconnect acceptance.
- [ ] 3.4 PM-only observable waiting/usability, same-installation close-all/reopen,
      online/offline operation in both languages, absence of unexpected retry/forced
      reload/installation loss, and separately authorized compatible rollback/restoration;
      technical lifecycle guarantees use the representative evidence mapped below.

The [PM checklists and safe procedure](installable-offline-shell.md#pending-pm-acceptance)
retain the pending Task 3.4 procedure. Task 3.3 physical-device acceptance is recorded
above; installed-app behavioral replacement/update and rollback/restoration
acceptance remain pending. PR #5 is merged and corrected production is verified below. Keep this
branch uncommitted and unpushed until Task 3.4 is completed in the same installation. Synthetic
v1 → v2 → v1 evidence cannot complete 3.4.

Leave the change unarchived and later changes planning-only. This branch remains
uncommitted and unpushed with no closure PR. No production data or Cloudflare,
Supabase, Google, GitHub, DNS or other service configuration was changed. The
non-required orphan Workers Builds trigger remains untouched. No profiles,
transactions, CRUD, migrations, private persistence, queues or runtime products
were introduced. Automated verification did not use or inspect a live account;
the PM's authentication results are recorded only as behavioral outcomes. Evidence
contains no backend project values, keys, OAuth inputs, tokens, sessions, cookies
or account identities.

PR #4 was merged at the correction baseline. Conservative indefinite retention
and fail-closed legacy/unprovable documents remain explicit limitations; there is
no approved-scope deviation.

## Acceptance recovery and reconciliation (2026-10-21)

Before Git mutation, the repository was `/Users/denistoledo/Documents/projects/spendspacey`,
branch `docs/accept-installable-offline-shell`, HEAD
`fae9f51b489db95d672a4761cbd9ecef80b53de6`. Exactly this verification record,
`docs/installable-offline-shell.md` and the active change's `tasks.md` were modified,
all unstaged; there were no staged/untracked files. Original diff: **464 insertions,
35 deletions**, 3 files. Task checkboxes were **8/9**, only 3.4 unchecked.

Reproducible original diff command:

```sh
git diff --binary --full-index --no-ext-diff --no-color -- docs/installable-offline-shell-verification.md docs/installable-offline-shell.md openspec/changes/installable-offline-shell/tasks.md
```

Original diff SHA-256:
`142e7b6d6b69ddbf8ee799d7eaf7b824e92f872a2f3caa4500a73252699eca53`.
Safety directory: `/private/tmp/spendspacey-acceptance-safety-20261021T205024Z`,
containing `acceptance.patch`, original full files under `files/`, and a manifest
with original HEAD/status/statistics and per-file SHA-256 values. A second persistent
Git recovery point is the retained named stash
`91a7f395ed8b61e4a7a2c775a8f97cbb7398e24e`
(`acceptance-safety-before-611994f`). Neither copy is dropped at this handoff.

Recovery must use a **separate** directory/worktree, preserving the current work.
Create a detached worktree at `fae9f51b489db95d672a4761cbd9ecef80b53de6`, check
then apply the saved patch there, or apply the retained stash there. Do not apply
both. Verify the patch SHA-256 first; the manifest supplies original file hashes.
The full-file copy can be compared independently without modifying either worktree.
Keep the stash and safety files until final accepted closure is committed.

Reconciliation used a retained stash, a fast-forward to fetched `origin/main`
`611994f4e0cae15b4b4ef4ada6659d10ac059a55`, then stash **apply**, retaining it.
Two documentation conflicts were combined manually: the correction evidence and
acceptance evidence both remain; historical task states are explicitly historical.
The index was returned to HEAD with index-only `git read-tree HEAD`, leaving all
working files untouched and unstaged. No reset, clean, file restoration, acceptance
commit, push, archive, PR or production/settings mutation occurred.

HEAD and merge base with `origin/main` are corrected merge `611994f4…`, containing
accepted PR #5 head `79dbbd485a922b560fc92f0cc1ef4c1b362c9286` and implementation
commit `0bc021e1eb6fb10233b052c851390739de29a128`. The merge and accepted head have
identical trees. PR #5 design/specification/implementation/test/workflow files remain
exactly main's versions. The change remains active/unarchived; later changes are
unchanged and planning-only. Current acceptance remains **8/9**, only Task 3.4 pending.

## Corrected production replacement verification (2026-10-21)

This supplements the historical Task 3.2 baseline above and does not replace the
PM's baseline Task 3.3 acceptance. Checks began **20:51:49 UTC** on canonical
**https://spendspacey.pages.dev**, corrected main
`611994f4e0cae15b4b4ef4ada6659d10ac059a55`, accepted PR #5 head
`79dbbd485a922b560fc92f0cc1ef4c1b362c9286`. Corrected merge
[Linux CI 39672565878](https://github.com/dnstld/spendspacey/actions/runs/39672565878)
succeeded; the Pages exact-merge check identifies corrected deployment
**`a52aaac4-aa23-4417-8084-0183cf249c11`**, successful **20:42:40 UTC**.
Its immutable URL is **https://a52aaac4.spendspacey.pages.dev**. Status alone was
not used as delivery proof. After the overnight interruption, all 44 HTTP checks
and the byte-identical corrected-main comparison passed again on **2026-10-22**,
starting **06:34:41 UTC**; remote main still points to the same full merge.

| Release                    | Production commit                                                      | Cloudflare production deployment       |
| -------------------------- | ---------------------------------------------------------------------- | -------------------------------------- |
| Baseline accepted on phone | `fae9f51b489db95d672a4761cbd9ecef80b53de6`                             | `90a2be8a-7daf-42b0-a5d1-344ed81cfae3` |
| Corrected replacement      | `611994f4e0cae15b4b4ef4ada6659d10ac059a55` / accepted head `79dbbd48…` | `a52aaac4-aa23-4417-8084-0183cf249c11` |

**44/44 HTTP cases passed** again: 38 × 200, 2 × 308, 4 × 304. A fresh corrected-main
production build used pinned Node 24.21.0/pnpm 10.27.0 and the two public inputs
in memory, never printed or recorded. Every worker and inventory byte matched it.
The **same 11 inventory paths, MIME types, sizes and SHA-256 hashes** listed in
[baseline deployed bytes](#deployed-bytes-and-identity) apply to the corrected
release: all 11 were independently fetched/rechecked, including benign queries,
MD5 revisions, SHA-256 integrity, decoded PNG dimensions, manifest and font license.
The application HTML, CSS and JavaScript are intentionally byte-identical; the
worker is different. `/index.html` remains outside the inventory. No source maps,
404/rewrite/runtime/test/private files were introduced into output.

| Corrected worker field                        | Exact value                                                        |
| --------------------------------------------- | ------------------------------------------------------------------ |
| `/sw.js` MIME / size                          | `application/javascript` / **60,410 bytes**                        |
| `/sw.js` SHA-256                              | `5f5981de031458f56348048a1a375f797461538eccc70a9088ea5e4928494d3a` |
| Inventory-bound worker identity               | `a2c2c03c7f95d45e9f9b5a33cf89ea9ab9a2f05de84bcd0c81dbe850a046af30` |
| Pre-injection implementation SHA-256          | `5107318910885772c72050dec382ad2a07cc71d1bdf0c60a434db5920870c78b` |
| Compatibility digest, unchanged from baseline | `c2ca46b7b90c80cc4c03b5de5db5aad5a832f5f2f0a74675ea791dee36885fb9` |

Canonical `/` and benign-query `/` return exact generated HTML with `no-cache`;
`/index.html` variants return 308 to `/`, preserving query. Worker is `no-cache`,
`Service-Worker-Allowed: /`, with actual browser root scope/control. Stable
manifest/icons/font/license revalidate; exactly three fingerprinted assets are
`public, max-age=31536000, immutable`. Callback variants are `no-store` and
`no-referrer`. Unknown paths retain native SPA fallback, never immutable;
fallback HTML is rejected as a repair JavaScript response. Root, worker, manifest
and entry ETag requests return empty-body 304.

Every checked 200 has the **exact application CSP already printed above**, with
its validated backend substitution compared in memory, plus `nosniff`, frame denial
and `no-referrer`. Embedded recovery bytes and the **exact recovery CSP printed
above** also remain identical and passed browser comparison. Neither raw backend
values nor keys appear in this record.

**19/19 browser scenario groups passed in seven new isolated contexts**, plus
**2/2 hosted stop-order scenarios in two further contexts**. Environment: Node
24.21.0, Playwright 1.64.1, desktop Chromium 156.0.8078.4, macOS arm64. Ordinary
HTTP cache was disabled/cleared. The original iPhone installation was never opened
or touched. All cache faults, network controls and synthetic probes were confined
to disposable local browser contexts; no production file or configuration changed.

- Initial online preparation was uncontrolled, followed by ordinary controlled
  navigation/readiness, with exact corrected worker identity and no forced claim.
- Canonical offline reload/new page passed in English and Portuguese. Real manifest
  diagnostics reported zero errors. Canonical Google sign-in was enabled, never clicked.
- The same 16 explicitly intercepted synthetic privacy probes passed (14 bypasses,
  2 CSP blocks), plus scrubbed offline callback with no-store/no-referrer. The audit
  retained 11 verified static resources and 27 bounded ownership records with zero
  forbidden cache keys/private markers. Synthetic probes are expected test traffic;
  they are not unexplained application/provider requests.
- Missing canonical HTML, corrupt bootstrap and missing lazy SDK produced exact
  localized worker-embedded cold recovery. It imported zero page SDK/application
  scripts and made zero cross-origin requests; exact CSP blocked injected script.
- Online damage did not trigger a missing-file fetch. Offline deliberate repair
  reported offline without download; reload/reconnect/worker restart did not repair.
- A deliberate repair given HTML for the exact static SDK request failed. Its
  attempt remained spent across reload/restart; existing document binding stayed
  unchanged, failed/incomplete staging was not adopted, and there was no automatic retry.
- Removing the context-only block then deliberately repairing verified completion,
  preserved recovery/old-document bindings and unrelated synthetic storage, and
  made no automatic transition. A new canonical reload adopted verified repair;
  the adopted shell reloaded offline.
- Throughout recovery/repair: **zero page SDK execution/imports and zero unexpected
  Supabase, Google, OAuth, Auth, user/session/profile/API or cross-origin requests**.
  Only the approved same-origin SDK asset was fetched as static repair bytes.
- Corrected deployment-specific host `a52aaac4.spendspacey.pages.dev` and accepted
  preview `0b2ca09b.spendspacey.pages.dev` denied Auth on root and callback, with
  zero page SDK imports and zero cross-origin requests. No sign-in/session inspection.
- Separate held-static-response scenarios demonstrated cancellation first remains
  `cancelled` after waiting beyond the worker's 12-second deadline, and deadline
  first remains `timed-out` after a later authorized cancellation. Both outcomes
  survived reload/worker restart, retained recovery authority and did not select
  incomplete staging or fetch again automatically. Each made exactly one static
  worker fetch, zero page SDK imports and zero Auth/API/cross-origin requests.

Hosted stop checks establish those observable orderings, not injected persistence
boundaries. The unchanged corrected-main deterministic matrix was independently
rerun: **80 cases × 10 = 800 executions passed**, ordinary/constrained scheduling,
14.39 s, with explicit authorization/selection/persistence barriers. Historical
PR #5 full-suite and exact-head evidence remains separate above.

Both immutable **production** deployments were additionally read-only verified:
11/11 resources, MIME/bytes/integrity, exact worker SHA-256/size/identity, shared v3
compatibility, and all application bytes identical to canonical. Baseline worker
is 59,956 bytes / `5f8032f5…`; corrected is 60,410 bytes / `5f5981de…`.
Canonical `/sw.js` matches the corrected immutable deployment. This makes the
replacement observable without any visible product-content change.

Sanitized machine evidence is retained locally under `.cache/` as
`corrected-production-http.json`, `corrected-production-browser.json`,
`corrected-production-stops.json`, `corrected-production-deployments.json`, with
the corresponding reviewed scripts in `/private/tmp/spendspacey-corrected-production-*.mjs`.
These contain static identities/results, not project keys/account data. They are
supplemental local artifacts; the reproducible outcomes and identities are recorded
here. Production rollback and PM behavioral waiting/update/rollback/restoration
acceptance remain unperformed. Phone-internal fault/repair inspection is not a
manual gate under the revised contract below. Only Task **3.4** remains unchecked.

## Task 3.4 evidence contract revision (2026-10-22)

**Proposed contract in the uncommitted working tree; reviewer approval and PM
behavioral acceptance remain pending.** The PM confirms the existing installation
has remained unopened since corrected `611994f` was deployed, reserves all testing
and approval on the personal iPhone, and prohibits agent inspection of phone
Auth/session storage, service-worker internals or manual cache mutation. No new
phone action or physical-device result is recorded here. Task 3.4 stays unchecked;
progress remains **8/9**.

The active specification required physical online/offline/update acceptance, but
did not explicitly assign fault injection to the phone. The superseded runbook
expanded that gate to tooling/internal proof. The revised installable-app
acceptance requirement, design, Task 3.4 and runbook consistently separate PM-only
observable behavior from technical evidence. All product requirements for complete
generations, immutable ownership, deterministic repair, bounded staging, privacy
and rollback remain unchanged. The evidence source changes; no runtime behavior,
implementation, dependency or physical-device result changes. Task 3.2 production
and Task 3.3 PM acceptance records above are preserved without reclassification.
The previous complete acceptance work is also saved under
`/private/tmp/spendspacey-acceptance-contract-before-20261022T070147Z`, original
patch SHA-256 `ad4c5730078f8eb877ed60ce54e2b685703f73aebfaaaaebc4a8491b1015060c`.
Earlier safety files and retained stash remain recoverable.

### Evidence mapping for every Task 3.4 subcase

Sources: **D** = [deterministic correction evidence](#deterministic-repair-outcome-correction-2026-10-21),
including the 800-execution matrix and generation-engine suite;
**B** = [real-worker Chromium coverage](../e2e/pwa.spec.ts), 57 passing tests at the
accepted correction, plus localized [feedback tests](../src/pwa/PwaFeedback.test.tsx)
and [update lifecycle tests](../src/pwa/lifecycle.test.ts). The acceptance working
tree adds two passing exact rendered waiting-notice cases, including a real
English → Brazilian Portuguese language-selection change and polite live-region
assertions, closing the previously identified rendered-notice gap;
**H** = [corrected hosted/production evidence](#corrected-production-replacement-verification-2026-10-21),
44 HTTP cases, 19 browser groups, two stop-order cases and exact build/deployment
comparisons. These are existing representative results, not physical-iPhone results.

| User-observable subcase                                            | Evidence required/source                                                                                                                                                                                                                 | Current physical status                                                                                                                                        |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Waiting notice without forced reload                               | PM observation if visible; B exact rendered English/Portuguese notice/live-region tests, waiting-worker retention and update coalescing                                                                                                  | Pending PM observation; not observed does not alone block 3.4 after rendered-notice, waiting-worker and retention evidence passes; never a phone pass          |
| Existing document remains usable while waiting                     | PM use of normal controls/languages; D/B immutable old-document coverage supports the mechanism                                                                                                                                          | Pending PM behavior                                                                                                                                            |
| Same Home Screen installation, close-all/reopen adoption           | PM confirms retained installation and normal reopen behavior; B complete replacement; H verified published release                                                                                                                       | Pending PM behavior; no phone controller claim                                                                                                                 |
| Online shell operation                                             | PM observes responsive shell/controls/readiness; H canonical delivery/Auth availability without sign-in                                                                                                                                  | Pending PM behavior; Task 3.3 Auth acceptance remains unchanged                                                                                                |
| Complete offline reload and cold reopen                            | PM tests safe normal reload when available and offline close-all/cold reopen in both languages. Without a safe reload control, mapped B/H offline reload cases supply separate reload behavior, combined with the PM cold-reopen results | Pending PM cold-reopen behavior; unavailable physical reload is recorded unavailable/not tested, never passed; combined evidence route is explicitly permitted |
| English and Brazilian Portuguese                                   | PM offline close-all/cold reopen and persisted language in both; safe physical reload when available, otherwise B/H mapped English/Portuguese reload evidence                                                                            | Pending PM behavior under the explicit reload evidence route                                                                                                   |
| Compatible production rollback                                     | Separately authorized operator switches exact verified B deployment; PM repeats observable lifecycle/online/offline checks; D/B whole-generation rollback, H exact compatible release inventories                                        | Pending authorization and PM behavior; synthetic rollback alone cannot complete it                                                                             |
| Restoration to corrected production                                | Separately authorized operator restores verified C; PM repeats observable lifecycle/online/offline checks in the same installation                                                                                                       | Pending authorization and PM behavior                                                                                                                          |
| No unexpected automatic retry, forced reload or installed-app loss | PM observes UI during wait/reopen/offline/reconnect/rollback/restoration; D/B/H cover underlying no-auto-repair/no-incomplete-adoption rules                                                                                             | Pending PM behavior; internal request counts are not demanded from the phone                                                                                   |

A broken notice, forced navigation/reload, unusable UI or lost installation is a
failure requiring investigation. Not-observed waiting and unavailable safe reload
are evidence routes, not exceptions for broken behavior. No phone developer
tooling, cache mutation or Auth/session/private-data inspection is allowed.

Every technical row below has the physical record **“not manually executed on the
physical iPhone; covered by representative automated/hosted evidence”**. This
classification replaces the superseded phone-internal/fault gate; none is a
physical-device pass or a pending requirement to obtain phone developer tooling.

| Technical subcase                                              | Existing representative evidence                                                                                                                                                                       |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Missing/corrupt-resource injection and localized cold recovery | D/B missing/corrupt root, bootstrap and lazy SDK plus damaged waiting replacement; H three cold-recovery groups with exact embedded bytes/CSP                                                          |
| Exact generation ownership and existing-document pinning       | D immutable binding/interruption/absent-client regressions; B repair and versioned rollback preserve old documents; H failed/successful repair binding checks                                          |
| Repair ordering and durable outcome uncertainty                | D 80 cases × 10 ordinary/constrained executions with explicit barriers; H cancellation-first/deadline-first cases and restart persistence                                                              |
| Offline repair                                                 | B/H deliberate offline guidance, no repair download and no automatic reconnect attempt                                                                                                                 |
| Controlled failed repair, timeout and cancellation             | D/B stop/failure/spent-attempt coverage; H rejection of HTML as the static chunk and held-response stop cases, durable no-retry checks                                                                 |
| Deliberate successful repair                                   | D/B exact static fill/completion; H verified deliberate repair with no automatic transition and zero recovery SDK/provider execution                                                                   |
| Staging isolation and incomplete-generation exclusion          | D interruption, frozen-outcome and corrupt-completion tests; B failed/timed-out/cancelled/spent cases; H failed staging remains unadopted across reload/restart                                        |
| Repaired-file adoption and subsequent complete offline use     | D new-document-only ownership selection; B/H repair followed by canonical reload/offline readiness while old bindings remain unchanged                                                                 |
| Controller/build identity and exact resource inventory         | H first preparation/subsequent control reports exact C identity, reproducible worker bytes, all 11 resource hashes/MIME/sizes and canonical/immutable-deployment agreement; verified outside the phone |

Privacy applies to all evidence. No phone cookies, tokens, sessions, account
storage, callback inputs, API responses, private data, service-worker internals or
cache contents are inspected/exported; no phone fault or cache mutation is
performed. Synthetic/private-marker fixtures already documented in D/B/H remain
isolated representative checks and do not authorize access to the personal phone.

### Production recheck and remaining limits

The contract handoff reverified canonical **https://spendspacey.pages.dev** on
**2026-10-22 starting 07:01:47 UTC**: **44/44 HTTP cases passed**, all
11 inventory resources and `/sw.js` matched a fresh corrected-main build, including
MIME, bytes, integrity, manifest/icons, exact CSP/security/cache/callback policy and
canonical entry/conditional behavior. Corrected production remains
`611994f4e0cae15b4b4ef4ada6659d10ac059a55`, accepted PR #5 head
`79dbbd485a922b560fc92f0cc1ef4c1b362c9286`, deployment
`a52aaac4-aa23-4417-8084-0183cf249c11`.
Worker identity remains
`a2c2c03c7f95d45e9f9b5a33cf89ea9ab9a2f05de84bcd0c81dbe850a046af30`;
`/sw.js` remains 60,410 bytes, SHA-256
`5f5981de031458f56348048a1a375f797461538eccc70a9088ea5e4928494d3a`.
No production deployment/configuration or phone state was changed.

Two observational limits remain explicit: a waiting notice may not appear if
normal activation already happened; unchanged application content cannot identify
the phone's exact controller. Record waiting as **not observed**; it does not alone
block Task 3.4 after rendered-notice, waiting-worker and retention evidence passes.
Keep exact controller identity under representative/production evidence only.
Neither limit authorizes phone-internal inspection or invents a PM pass.

An available safe normal reload control must be tested normally. When no such
control exists, explicitly permit the combined route: physical reload is recorded
**unavailable/not tested**, never passed; the PM performs offline close-all/cold
reopen in **both English and Brazilian Portuguese**; and mapped automated/browser
reload evidence supplies the separate reload behavior. The mapped B tests
`prepared offline hard reload and new page: en` / `pt-BR`, plus the H English and
Portuguese canonical offline-reload groups, supply that behavior. This route applies
to forward update, rollback and corrected restoration. Cold reopen alone is not a
physical reload pass. A broken notice, forced navigation/reload, unusable UI or lost
installation remains a failure requiring investigation. Required PM behavior and
separately authorized production rollback/restoration are still pending.

After reviewer approval and an external current-production check, the first single
PM action is: **while online, tap the existing Spendspacey Home Screen icon once
and leave it open; do not reload yet.** No further action is pre-authorized here.
No commit, push, archive or closure PR is made.

### Reviewer P2 corrections (2026-10-22)

Both findings are accepted. The previous rendered-notice gap is closed by the
smallest representative addition to `src/pwa/PwaFeedback.test.tsx`, with no runtime
change: `waiting: true` renders the exact English guidance, the real LanguageSelect
changes it to the exact Brazilian Portuguese guidance, and both remain visible
inside the same complementary region with `aria-live="polite"`. Rendering/selecting
language starts no repair. Existing no-forced-activation/reload behavior is retained
and the lifecycle/waiting/retention regressions pass.

Focused test names:

- `renders exact accessible waiting guidance after selecting en`
- `renders exact accessible waiting guidance after selecting pt-BR`
- `coalesces launch, foreground and reconnect updates and never forces activation/reload`

The focused feedback/lifecycle run passed **11/11** (including the two new notice
cases); the full unit/component run passed **530 tests in 21 files**. The six focused
real-worker Chromium checks passed, with no retries:

- `damaged waiting v2 (missing) activates offline with intact v1 and survives worker restart`
- `damaged waiting v2 (bytes) activates offline with intact v1 and survives worker restart`
- `complete v1 → v2 → v1 rollback preserves whole offline generations and SDK/locale storage`
- `failed replacement (redirect) retains the previous complete worker`
- `failed replacement (fallback HTML) retains the previous complete worker`
- `actual 069dbc50 worker installs, cuts over through normal waiting, imports static bytes and preserves SDK/locale storage`

These are local synthetic browser checks, not a Cloudflare rollback or phone action.
The spec, design, tasks, runbook and this mapping explicitly permit unavailable safe
physical reload to be recorded **unavailable/not tested**, paired with required PM
offline close-all/cold reopen in both languages and mapped B/H reload evidence.
An available safe reload control is still tested. Not-observed waiting does not
alone block 3.4 once rendered-notice, waiting-worker and retention evidence passes;
broken notices, forced navigation/reload, unusable UI and lost installation remain
failures requiring investigation. Phone developer tooling, cache mutation and
Auth/session/private-data inspection remain forbidden.

Node 24.21.0/pnpm 10.27.0 were used. Full formatting, lint, application/worker
types and Git whitespace checks passed; strict OpenSpec passed **7/7** with the
existing informational future/superseded-delta notices unchanged.
Detailed local logs are `.cache/p2-full-unit.log`, `.cache/p2-lint.log`,
`.cache/p2-types.log`, `.cache/p2-version-fixtures.log` and
`.cache/p2-waiting-browser.log`. Earlier evidence and safety copies are retained.
Task 3.4 remains unchecked, **8/9**; no installed-app launch, production change,
rollback authorization, commit, push, archive or closure PR occurred.

## Task 3.4 physical recovery follow-up (recorded 2026-10-24; incomplete)

This append-only entry records the PM's reported sequence and a fresh public-delivery
check. Exact physical-event timestamps were not supplied. The current app is open
and untouched. It does not revise Task 3.2/3.3, erase the original Task 3.4 failure,
retroactively authorize the unplanned action, or mark any task complete. Earlier
dated references to an unopened installation describe the state at those earlier
handoffs; they are not the current device state.

### Separate physical outcomes and authorization boundary

| Attempt / observation                                                                        | PM-reported result                                                                                                                                                                                                                      | Evidence classification                                                                                                                                                                                                                                                                 |
| -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Initial Task 3.4 online cold launch after `611994f` publication                              | The same Home Screen installation opened directly into Portuguese embedded recovery, with no application or waiting notice first. It reported no verified document binding; repair/cancel were disabled and status/reload enabled.      | **Failed launch, retained as a failed attempt.** The original application document did not remain usable. Later recovery does not turn this attempt into a pass.                                                                                                                        |
| One authorized online “Recarregar Spendspacey” action after corrected production publication | Pressed exactly once. After the full **60-second** observation, identical Portuguese unbound recovery content remained: repair/cancel disabled, status/reload enabled. No loop, error, blank screen or unexpected closure was observed. | **Inconclusive recovery/adoption result.** The visible recovery screen remained stable. Identical content does not establish that the browser retained the same Document object or controller. This was an online recovery-page reload, not a complete application/offline reload pass. |
| Unplanned app-switcher close                                                                 | The PM then fully closed Spendspacey via the iPhone app switcher, without prior authorization for that additional step.                                                                                                                 | **Procedural deviation:** this exceeded the single-reload authorization. Retain the observation without retroactive authorization or exclusion of relevant evidence. OS process termination and release of every service-worker client were not inspected/proven.                       |
| Reopen of the same installed Home Screen icon                                                | The normal signed-in application appeared directly. No waiting notice, recovery screen, blank screen, repeated navigation or visible error appeared first.                                                                              | **Successful observed online same-installation reopen/recovery.** No installation loss was observed. Exact release adoption, generation ownership and controller identity are not established by the unchanged product screen.                                                          |
| Session restoration                                                                          | PM reports **passed / true**, as a boolean only. No identifying account information, token, cookie, session contents or other private data was captured or shared.                                                                      | **Boolean session-restoration outcome only.** No fresh sign-in, backend session validity, token refresh, sign-out or private-storage inspection is claimed. This is separate from the preserved Task 3.3 baseline acceptance.                                                           |
| Current state                                                                                | The normal application is open and untouched.                                                                                                                                                                                           | No further phone action is requested or authorized by this record.                                                                                                                                                                                                                      |

### Fresh external production follow-up

Read-only check began **2026-10-24T06:07:49.371Z**. Remote main and the successful Cloudflare
Pages check still identify the following production release:

| External identity           | Verified value                                                     |
| --------------------------- | ------------------------------------------------------------------ |
| Canonical origin            | `https://spendspacey.pages.dev`                                    |
| Merge                       | `fabde5f3e7c35bae4dcf6b5fc8981e2d7f74a940`                         |
| Reviewed implementation     | `4e80bee83d99dfcc4e72c632c1b87b924815967b`                         |
| Production deployment       | `ae4e9dd4-aa24-41bf-bff3-768891d6e3c5`                             |
| Cloudflare success reported | `2026-10-23T14:18:28Z`                                             |
| Generated worker identity   | `30623ba9256d19a9075a807ba450f9ffffdbb30b59772441ae40c203915b7046` |
| Delivered worker SHA-256    | `a7cd628b782cb877256bbf179a36de284602e348499e80eae865aa21f34433ad` |

Canonical and immutable deployment-specific delivery both matched the fresh merge
build retained from the post-merge verification: exact worker bytes plus all **11**
inventory resources, MIME, sizes and integrity; exact CSP and cache/security
headers; callback `no-store`/`no-referrer`; and `/index.html` canonical redirection.
The merge's Cloudflare Pages check remains completed/successful. These are public
availability results, **not measurements of the installed phone's controller,
selected generation or cached files**. The full sanitized follow-up output is
`/private/tmp/spendspacey-recovery-followup-http-20261024.json`; the earlier complete
post-merge source/build/browser evidence remains retained separately.

### Assessment and limits

The sequence is **consistent with**, but does not prove, the old recovery document
remaining under the previous controller while a corrected replacement waited;
closing/reopening may then have released the relevant client and allowed normal
activation, restart-resumable ownership reconciliation and new-document delivery.
This matches the representative historical-production mirror behavior, including
an ordinary Portuguese recovery reload that staged a waiting replacement without
creating a binding for the unbound recovery document. No phone worker/controller,
installation time, activation event, reconciliation write or exact revision was
observed. The old/new application content has no useful visible revision marker.
Other compatible cached-generation/lifecycle explanations therefore remain possible.

**No new defect is indicated by these observations.** The unchanged recovery screen
after one reload is compatible with a normal waiting transition; lack of a waiting
notice is recorded as **not observed**, not as a notice pass or a broken notice.
This does not erase the original failed cold launch or make the single reload
conclusive. The activation-persistence defect remains the leading hypothesis for
the original trigger rather than a proven phone diagnosis. Recovery here means
observable return to the application; no manual static-cache repair was performed
or proven, and no phone-internal technical case is reclassified as a physical pass.

### Remaining Task 3.4 acceptance matrix

This dated matrix updates the current physical status of the earlier evidence
mapping without rewriting its historical pending-state rows. No task checkbox
changes. Task **3.4 remains unchecked; progress remains 8/9**.

| Subcase                                                                                                                                               | Evidence now supported                                                                                                                                               | Remaining limit / gate                                                                                                                                                                                                                                                                                           |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Initial launch / old-document usability while waiting                                                                                                 | Original first cold launch **failed**; recovery UI was stable during the later 60-second observation.                                                                | Normal application usability while a replacement waits was not demonstrated on that attempt and has not been retested after correction. Representative retention evidence remains separate.                                                                                                                      |
| Waiting-update notice                                                                                                                                 | **Not observed** during the reported reload/reopen sequence.                                                                                                         | Not a physical notice pass. Absence alone does not block under the accepted contract after rendered-notice, waiting-worker and retention evidence pass.                                                                                                                                                          |
| Same Home Screen installation, close/reopen                                                                                                           | Observed reopen into the normal application without installation loss or intervening failure UI.                                                                     | The extra action exceeded authorization; physical behavior is recorded, while corrected-build adoption/controller identity remain unproven.                                                                                                                                                                      |
| Online operation                                                                                                                                      | The normal application loaded; session restoration reported **true**.                                                                                                | Responsive controls, readiness feedback and sustained online usability on this recovered document are not yet reported. No fresh Auth/account/backend-validity claim.                                                                                                                                            |
| English / Brazilian Portuguese                                                                                                                        | Portuguese recovery was observed.                                                                                                                                    | Normal application behavior and offline cold reopen in **both** languages remain pending; the current normal application's language was not reported.                                                                                                                                                            |
| Complete offline reload                                                                                                                               | Not executed in this recovery sequence.                                                                                                                              | Test a safe normal application reload control if available. The recovery-page reload button does not establish that a safe reload control is available in the normal installed application. If unavailable there, record **unavailable/not tested**, never passed, and use the accepted combined evidence route. |
| Complete offline close-all / cold reopen                                                                                                              | Not executed after this recovery.                                                                                                                                    | PM physical cold reopen in English and Brazilian Portuguese remains pending; prior Task 3.3 baseline evidence is not a substitute for this recovered release.                                                                                                                                                    |
| No unexpected retry / forced reload / installation loss                                                                                               | No visible loop, error, blank screen or unexpected closure during 60 seconds; direct reopen had no visible repeated navigation/error and preserved the installation. | Limited to those observed intervals. No internal network/request-count claim; offline/reconnect and later lifecycle phases remain pending. The app-switcher close was manual, not a forced app closure.                                                                                                          |
| Compatible production rollback                                                                                                                        | No rollback occurred or is authorized.                                                                                                                               | Separate authorization, exact compatible deployment verification, and PM observable lifecycle/online/offline evidence remain pending.                                                                                                                                                                            |
| Restoration after rollback                                                                                                                            | Corrected production remains live externally; no rollback/restoration sequence occurred.                                                                             | Restoration and final installed-state checks after any separately approved rollback remain pending.                                                                                                                                                                                                              |
| Fault injection, exact ownership/controller identity, repair ordering, failed/offline/successful repair, staging isolation and repaired-file adoption | **Not manually executed on the physical iPhone; covered by representative automated/hosted evidence.**                                                               | The visible successful reopen supplies none of these internal passes. Existing mapped evidence and sanitization boundaries remain unchanged.                                                                                                                                                                     |

### Proposed next action — independent review required

The smallest proposed next behavioral step is **one online language-selector change
to the other bundled language**, with only language-change and continued-shell-
usability booleans recorded. This checks a normal control without requiring another
navigation or an authentication operation. It is a proposal for independent review,
**not an instruction or authorization to act now**. The current application must
remain untouched until that review. No account details, phone developer tooling,
cache mutation, private-data inspection, rollback, task completion or external
configuration change is requested.

## Task 3.4 recovery recurrence after language check (recorded 2026-10-24; unresolved)

A subsequent PM report supplied three facts: **language changed = true**;
**shell remained visible and usable = true**; and **closing/reopening then
returned to a recovery page**. The latest reported visible state is therefore
recovery, superseding the earlier entry's then-current normal-open-application
state. Exact event times, language direction, reopening connectivity, recovery
wording/button state and the precise close/reopen method were not supplied in
this new report; do not fill them from the earlier attempt.

| New observation                          | Assessment / boundary                                                                                                                                                                                                                                                                           |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Language changed: true                   | One language-control interaction succeeded in the loaded application document. Which language was selected is not established by this report. This does not demonstrate both locales or offline localization.                                                                                   |
| Shell remained visible and usable: true  | Immediate shell usability during that interaction is supported. Static readiness, complete offline resources and durable subsequent launch are not established.                                                                                                                                 |
| Recovery page after another close/reopen | **Renewed launch/recovery failure requiring investigation.** Stable same-installation close/reopen recovery has not passed. The exact recovery subtype, controller and installed revision are not proven.                                                                                       |
| Scope of the additional close/reopen     | The preceding proposal concerned only a language-selector change, subject to independent review. The additional close/reopen was beyond that proposed step; no expanded authorization or intervening review is inferred from the report. Relevant behavioral evidence is nevertheless retained. |
| Session/account state on this recurrence | Unknown and not inspected. A recovery page does not establish sign-out or loss of session data. The earlier boolean session-restoration result remains a separate observation.                                                                                                                  |

The preceding assessment **“No new defect is indicated by these observations”**
was limited to the facts available at that earlier handoff. It is not the current
assessment: a recurrence is now reported after an apparently working application
document. This is unresolved acceptance failure, although it does **not** prove a
new defect in worker `30623ba9…`, successful prior adoption of that worker, or a
specific phone trigger. The original failed cold launch, inconclusive single
reload, temporary successful reopen and boolean session restoration all remain
recorded independently; none is erased or reclassified as a sustained pass.

### Read-only external recurrence check

Check began **2026-10-24T06:25:06.057Z**. Remote main remains
`fabde5f3e7c35bae4dcf6b5fc8981e2d7f74a940`, with successful Cloudflare production
deployment `ae4e9dd4-aa24-41bf-bff3-768891d6e3c5`. Canonical and deployment-specific
origins both serve worker
`30623ba9256d19a9075a807ba450f9ffffdbb30b59772441ae40c203915b7046`, SHA-256
`a7cd628b782cb877256bbf179a36de284602e348499e80eae865aa21f34433ad`, matching
the verified merge build. All **11** resources still match bytes/MIME/sizes/
integrity and cache/security/CSP headers; callback no-store/no-referrer and index
canonicalization pass. No public-delivery mismatch was found from this external
check. This does not measure the phone's delivered/cached revision or local state.
Sanitized evidence: `/private/tmp/spendspacey-recovery-recurrence-http-20261024.json`.

### Acceptance consequence and investigation boundary

| Area                                                  | Current position                                                                                                             |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Online language control / immediate usability         | Positive observation for one loaded document, retained separately from later launch failure.                                 |
| Reliable close/reopen                                 | **Unresolved: recovery returned.** Earlier successful reopening is a temporary recovery observation.                         |
| Waiting notice, readiness, exact adoption/controller  | Not established by the latest report; no phone-internal proof is requested.                                                  |
| Complete offline reload/cold reopen in both languages | Pending; no connectivity or offline pass is inferred. The accepted safe-reload/combined-evidence contract remains unchanged. |
| Rollback/restoration                                  | Not performed or authorized.                                                                                                 |
| Technical ownership/repair/fault cases                | Representative evidence remains separate; no physical technical pass is claimed.                                             |

Code review still permits several distinct paths to recovery: failed activation
reconciliation, missing/reused navigation identity, unavailable ownership metadata,
or unusable resources. The current sparse observation cannot select among them.
No binding relaxation, invented client identity, storage reset, cache mutation,
automatic repair, implementation change or rollout is authorized by this entry.

Clarification is limited to facts already observed: connectivity at reopening,
whether this was the same Home Screen installation, and the recovery wording/
button state. Unknowns remain unknown; no new phone interaction or internal/private
data inspection is requested. The previous proposed next phone step is superseded
by this recurrence assessment; **no further phone action is proposed or authorized
here**. Task **3.4 remains unchecked at 8/9**. Task status, Task 3.2/3.3 evidence,
prior observations and all other acceptance artifacts remain unchanged.

## Second physical cold-reopen failure — exact report and read-only diagnosis (2026-10-24)

This is **Attempt B**, the same recurrence provisionally recorded immediately
above, now clarified by the PM's exact sequence. It is a separate failed physical
cold-reopen attempt from the initial pre-fix launch, **not a third phone attempt**.
All earlier observations remain byte-for-byte historical evidence. Task 3.4 stays
paused/incomplete and unchecked at **8/9**; no task-status or checkbox change is made.

### Confirmed physical sequence

1. The recovered normal application was **online, signed in, stable and in Brazilian
   Portuguese**. Only this boolean state is recorded; no identifying account data.
2. The PM selected **English once**. `language changed = true` and
   `continued shell usability = true`. No immediate navigation, reload, recovery,
   error or closure occurred. This is positive evidence for that loaded document,
   not for subsequent cold-launch reliability.
3. The PM then **exceeded the authorized language-only step**: fully closed
   Spendspacey via the iPhone app switcher and reopened **the same Home Screen
   installation while online**. This is a procedural deviation, not retroactively
   authorized; the resulting observation remains relevant evidence.
4. The next launch went directly to recovery, with **no application or waiting
   notice first**. The locale was English. Exact static text reported:
   - Title: **“Spendspacey recovery.”**
   - Introduction: **“Spendspacey cannot currently verify a usable saved application.
     This recovery page does not sign in or load your account.”**
   - Guidance: **“Recovery cannot safely access its saved state or verify activation.
     This does not establish missing or corrupt files. Repair is unavailable.
     Reopen Spendspacey to try a new document.”**
   - **Repair online / Cancel repair disabled; Check status / Reload Spendspacey
     enabled.**
5. The recovery document remains **open and untouched**. Screenshot time was
   approximately **08:27 Europe/Berlin**, as reported, not an independently measured
   execution timestamp. No account information was captured.

**P1 / high-severity acceptance blocker:** corrected production availability has
not produced reliable physical cold launch in this installation. This is a new
reported failure manifestation; whether its cause is a newly introduced defect,
a remaining old defect or an unhandled registration/storage lifecycle remains
unproven. Do not infer session/account-data loss, exact phone controller identity,
or successful earlier adoption of worker `30623ba9…` from the visible application.
The corrected wording shows corrected recovery code participated somewhere in the
lifecycle; it does not identify the serving/current controller on the phone.

Affected requirements are complete-shell next-load availability, complete working
updates, restart-safe document/generation ownership and honest recovery. The
findings concern implementation/verification areas 1.3, 2.2 and 3.1 and the physical
3.4 gate; **no existing task status or checkbox is changed**.

### Exact state mapping and hypotheses ranked by representative evidence

Production references below are to the reviewed/merged source, not the older
implementation still checked out under this dirty acceptance branch.

The neutral introduction plus the reported **unavailable** guidance is narrower
than generic unbound guidance. In `worker/sw.ts:29` and `:70`, failed reconciliation
returns neutral embedded recovery and overrides HELLO to `authority: none`, null
binding and `repair: unavailable`. `worker/generations.ts:1187` also defaults to
unavailable when initialization or saved-state reads cannot be validated.
`worker/recovery.ts:13` renders that state. A missing controller/reply or a missing/
reused resulting ID with otherwise healthy ownership instead reaches the different
**“This page has no verified document binding…”** text in the diagnostic controls.
This mapping is strong evidence for unavailable ownership/activation access, not
proof of which underlying rejection occurred on the phone.

| Rank                       | Hypothesis / code                                                                                                                                                                                                                              | Evidence and limit                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1                          | **Transient startup metadata-read failure permanently poisons one worker global.** `worker/generations.ts:136`, `:170`, `:173` cache initialization and latch `unavailable` on any exception; `:926` refuses later reconciliation.             | **Full lifecycle/locale sequence and exact final English state reproduced in real disposable Chromium**, with one synthetic Cache Storage read rejection on the later corrected-worker cold startup. The prior corrected application had a durable binding; current worker identity proof was true; ledger, all 11 resources, old epoch and predecessor pins remained intact and independently readable afterward. This demonstrates a global-lifetime liveness defect. The injection is a representative fault model, not an observed phone exception.                                                                                                                                                                                                                                                                                                      |
| 2                          | **Same-build browser registration recreation over an existing committed owner.** `worker/generations.ts:943` rejects an eligible same-build reservation even when the browser-active instance is proven and the existing owner/epoch is valid. | **Real disposable Chromium reproduction**: recreate only the registration, retaining caches and locale. An uncontrolled network application document is usable; the identical worker installs/activates while that document is uncontrolled. The next controlled cold launch has the exact unavailable screen, intact old binding/resources and native active proof true. The earlier deterministic test explicitly expected this rejection; it covered safety but did not establish product liveness. A paired real-browser control using prior worker `611994f` passes this same registration-recreation sequence and records a second valid activation; corrected `fabde5f3` fails. Thus the new same-build guard introduces a demonstrated liveness regression in this representative case. No phone unregister/reinstall/registration loss is asserted. |
| 3                          | **Native active-instance proof unavailable or delayed on the target engine.** `worker/authority.ts:4`, `worker/generations.ts:930`, `worker/sw.ts:29`/`:70`.                                                                                   | A simulated false proof produces the exact unavailable state with healthy committed metadata. The two browser failure models above had native proof **true**, so this is not required for recurrence. Supplemental WebKit 27.2 passed four persistent-browser lifetimes with locale changes and true native identity; no spontaneous recurrence was seen there. Physical iOS timing/support remains unmeasured.                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 4                          | **Persistent ownership metadata absent, corrupt, unsupported or otherwise unreadable.** `worker/generations.ts:176` onward, `:1187`.                                                                                                           | Ledger-loss-with-resource-caches-retained reproduces unavailable in a disposable engine model. There is no evidence that this happened on the phone. Locale continuity does not prove Cache Storage accessibility or registration continuity; do not infer whole-site or account-data loss.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Lower / insufficient alone | **Missing/reused `resultingClientId`, delayed page controller, or resource loss alone.** `worker/generations.ts:1024`, `:1031`, `worker/recovery.ts:10`/`:13`.                                                                                 | Empty/reused identities are genuine fail-closed liveness limits, but healthy-state controls produced **different guidance**, not this unavailable message. A missing page controller/reply likewise differs. Proven resource loss has a separate introduction and normally a bound repair path. These can coexist with a higher-level failure but do not independently explain this exact state.                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

The ranking reflects evidence from the models, **not estimated probabilities of
the physical trigger**. No exact phone root cause has been established.

### What the earlier successful application can and cannot establish

| Possible path                                                                  | Finding                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Before corrected control / uncontrolled network document                       | Possible and directly reproduced by the same-build registration model. The ordinary application starts PWA registration independently (`src/pwa/lifecycle.ts:127`/`:151`); its normal UI does not require a successful document binding or ready worker first.              |
| Still-old controller or restored earlier live document                         | Possible; old/new app content is indistinguishable. Later corrected recovery does not retroactively identify the earlier controller. A working language control establishes live UI behavior, not worker revision.                                                          |
| Network fallback inside the corrected canonical worker handler                 | **No such fallback exists** for an eligible canonical root in `worker/generations.ts:1006`: it returns verified bound bytes or embedded recovery. Ordinary uncontrolled HTTP delivery is a different possible path.                                                         |
| Corrected controlled application without a durable binding                     | **Not an intended delivery path.** `worker/generations.ts:1110` persists and reads back the joint delivery binding before `:1131` releases application bytes; `:566` validates commit lineage. Later storage failure/eviction is not proof the original commit was skipped. |
| Corrected control with a durable binding, followed by later cold-start failure | **Directly reproduced** by the one-read-rejection model, including the language change and exact final screen.                                                                                                                                                              |

Ownership is therefore **not merely in-memory**: a healthy committed epoch restored
across ten fresh engine globals with one activation record; WebKit 27.2 restored
valid bindings/native identity across four persistent browser lifetimes. Those
successes do not guarantee every future Cache Storage read succeeds, browser
registration remains available, or the same-build restoration guard permits use.
Read-back establishes API-visible persistence, not immunity to later unavailability.

`clientId` identifies the initiating client and may be empty on top-level loads;
`resultingClientId` depends on a reserved client and may be empty without one.
Initial replacement navigation may reuse a client. These are distinct identities;
borrowing `clientId`, inventing an ID or changing an existing binding is unsafe.
The standards allow these distinctions, but do not prove an iPhone-specific empty/
reused-ID bug. See [Service Workers](https://www.w3.org/TR/service-workers/).
Persisted English is evidence of locale/preference continuity only, not ownership,
controller identity, readiness, session validity or complete resource integrity.

### Why prior checks missed this lifecycle failure

- The 12 prior disposable scenarios faulted activation **writes**, repaired files,
  and tested healthy restart/adoption. They did not inject a transient **startup
  metadata read rejection after a successful corrected controlled document and
  locale change**.
- The supplemental WebKit identity test covered initial preparation/control, not
  personal iPhone Home Screen force-close lifecycle. Desktop persistent-profile
  closing is not an exact model of iOS process/app-switcher restoration.
- Same-build reinstallation existed as an intentionally **fail-closed** deterministic
  test (`src/pwa/activation.test.ts:138`). Its oracle accepted unavailability and
  did not test the preceding apparently usable uncontrolled document and later
  controlled-launch failure. This is a liveness-coverage gap, not absence of all
  same-build coverage.
- Fresh browser IDs and intact/readable metadata in healthy restart tests cannot
  validate behavior under missing identities, delayed native authority, transient
  storage reads or registration recreation merely because those tests pass.

### Proposed correction design — review required; no implementation

1. **Separate retryable access failure from invalid persisted state.** Replace the
   catch-all lifetime poison with explicit initialization outcomes and bounded,
   coalesced revalidation under the existing writer lock. A one-shot storage-access
   failure must not permanently defeat a later complete valid read in the same
   global. Re-read all schema/build/lineage/parent/epoch/selection evidence before
   any authority is restored. Structural corruption, incompatible/unsupported
   namespaces and persistent failure remain fail-closed. No repair-budget reset,
   resource reconstruction, automatic network repair, cleanup or reload loop.
2. **Separate restoration of an already committed owner from selecting a fresh
   installation.** Review whether a natively proven active identical build can
   restore its existing validated epoch/selection without consuming, selecting or
   claiming any ambiguous pending reservation. Preserve repaired/adopted selection,
   immutable bindings, predecessor resources and spent history; retain uncertain
   reservations and defer cleanup. Transfers from a different owner still require
   one uniquely eligible installation and current fences. This refines the earlier
   deliberately fail-closed same-build policy and needs explicit design review;
   do not simply remove the guard or substitute a build hash for instance proof.
   If safe restoration cannot be proved, a durable installation-association and
   migration design is needed before changing authority.
3. **Keep native authority proof, with bounded pending-state handling.** Test true,
   false, absent and late native reflection across activation/restoration; never
   replace native instance identity with URL/build matching. Missing/reused incoming
   document identity still cannot borrow a pin or gain retroactive authority. If
   target-engine IDs prevent progress, a separate safe bootstrap-before-application-
   delivery design is required, not relaxed binding rules or invented IDs.
4. **Make unavailable guidance honest and reason-specific.** “Reopen Spendspacey
   to try a new document” is inadequate as the sole remedy: same-build ambiguity
   can survive every reopen, and a storage-read failure can recur. Distinguish
   unavailable verification from proven loss and avoid implying that repeated
   reopen will recover. Preserve both locales, exact restrictive CSP, no Auth/API
   initialization in recovery and current-controller/fresh-handshake protections. Normal application
   feedback must also distinguish prepared resources from unavailable activation;
   a usable uncontrolled shell is not evidence that reopening will finish control.

### Required regression sequence and assertions before any later fix approval

Use the exact order: **unbound recovery → one normal reload still recovery → full
close/reopen shows application → Portuguese-to-English change with no immediate
navigation → full close/reopen**. Under intact eligible saved state and a recoverable
transient read, the future corrected expectation is **a usable application**, not
another accepted fail-closed pass. Include:

- One startup rejection at Cache Storage enumeration, metadata keys/read and
  read-back; successful later revalidation; repeated failure; global restart and
  actual owned disposable browser termination, including a second cold lifetime.
- Registration retained, missing/recreated with caches retained, same-build fresh
  reservation, duplicates, waiting/stale workers and conflicting owner/epoch.
- Native identity true/absent/delayed; empty/reused/fresh navigation IDs without
  optional hints; post-response controller arrival and obsolete replies.
- Positive and negative assertions for complete candidate/predecessor integrity,
  immutable old pins, exact durable selection, no additional activation when only
  restoring ownership, no automatic repair/reload and no unsafe cleanup.
- Language persistence, online and complete offline launch in both locales;
  native Chromium and representative WebKit persistent profiles; clearly separate
  graceful shutdown from forced termination. Personal-iPhone acceptance remains
  PM-only and cannot be inferred from either desktop engine.
- No real sign-in, account/session/private-storage inspection, page SDK execution
  in recovery, Auth/API/provider/cross-origin requests or local-data clearing as a
  remedy. Registration recreation in this diagnosis was **disposable-only**.

### Evidence, production hold and next PM action

Diagnosis evidence: **7 deterministic cases** and **4 real-browser groups** passed
as diagnostic assertions, including two reproduced failure models, the paired prior-version control and four healthy
WebKit 27.2 profile lifetimes. They reproduce lifecycle/locale/recovery behavior;
signed-in/session restoration is intentionally **not simulated or inspected**.
There was no spontaneous reproduction of the personal iPhone trigger in an
unmodified healthy desktop profile. Artifacts:
`/private/tmp/spendspacey-second-cold-engine.json` and
`/private/tmp/spendspacey-second-cold-browser.json`, with the paired
`/private/tmp/spendspacey-second-cold-baseline-control.json`.

Read-only public recheck at **2026-10-24T06:37:32.910Z** still matches merge `fabde5f3…`, deployment
`ae4e9dd4-aa24-41bf-bff3-768891d6e3c5`, worker `30623ba9…`, and all 11 resources on
canonical and immutable deployment origins, including headers/CSP/callback caching.
No delivery mismatch was found. Evidence: `/private/tmp/spendspacey-second-cold-http.json`.
**Keep production as-is during diagnosis.** No rollback or configuration/deployment
change is authorized, and an old worker is not a demonstrated repair for this state.

**Exact next PM action: none.** The supplied static wording, button states, locale,
sequence and approximate time are sufficient for this diagnosis. No further useful
non-interactive observation is necessary to select a safe next step, and a screen
alone cannot expose the hidden rejection cause. Preserve the open recovery document;
no controls, reload/reopen, phone tooling, cache or Auth/private-data inspection is
requested. No implementation, commit, push, archive, rollback or task-status change
was performed. **Task 3.4 remains unchecked at 8/9.**

## Task 3.4 latest single-reload observation (recorded 2026-10-26)

This is a PM-reported observation from the same existing Home Screen installation.
The phone event's exact time was not supplied. This entry appends evidence without
revising any earlier production, Task 3.2/3.3, failed-launch or recovery record.

### Reported sequence

1. Connectivity was enabled, and the existing English recovery page was stable.
2. The PM pressed **“Reload Spendspacey” exactly once**.
3. A very brief visual change occurred in the text/buttons area. It was too fast
   to read; no wording, application screen, waiting notice or error can be
   identified from that change.
4. The same English recovery screen then returned, and the app remained open.
5. No continuing navigation loop, unexpected closure, blank screen or separately
   visible error occurred.
6. No other control or phone action was performed.

### Classification and limits

**Inconclusive recovery/adoption — not passed and not a new confirmed defect.**
The brief unreadable change and return to the same recovery screen do not establish
worker identity, release adoption, generation ownership, session state or offline
readiness. One reported button press does not establish the number or identity of
internal lifecycle events. No account/session details are included in this report.
Earlier failed cold launches remain recorded as failed attempts; this observation
does not erase or reinterpret them. Separate public-delivery and representative
browser verification cannot supply a physical-phone adoption result.

**Task 3.4 remains unchecked at 8/9.** No task status, production setting or
production deployment changes accompany this record. No commit, push or archive
is authorized. No further phone action is authorized by this entry: the app remains
open on the recovery page and must stay untouched pending independent review.

## Task 3.4 failed online same-installation close/reopen (recorded 2026-10-26)

This is the latest PM-reported phone result after the corrected production release
was published. “After publication” is chronological context, not evidence that this
installation adopted that release. The phone event's exact time was not supplied.

### Reported sequence and result

1. Connectivity remained enabled and unchanged.
2. The PM identified and closed the existing Spendspacey app through the iOS app
   switcher, then tapped the same existing Home Screen icon exactly once.
3. Recovery appeared immediately as the **first recognizable screen**.
4. Observation ended at this defined failure condition. This is not an incomplete
   observation and does not require waiting out the rest of an observation period.
5. No second launch, reload, status/repair action, language/connectivity change,
   sign-in/out, clearing or reinstall occurred.

**Failed online same-installation close/reopen after the corrected production
release. Not incomplete or inconclusive.** The observable launch criterion failed.
Worker/controller identity, release adoption, session state, generation ownership
and offline readiness remain unestablished. App-switcher closure is a user-visible
action; it does not itself prove that browser clients, worker globals or controllers
were terminated or replaced.

Every earlier result is retained exactly, including failed launches and the
separately classified inconclusive single reload. This failure does not retroactively
change those classifications. It is an acceptance blocker requiring read-only
investigation; no phone tooling or private/session data is requested.

**Task 3.4 remains unchecked at 8/9.** No further phone action is authorized. Preserve
the open recovery document untouched. No production change, commit, push or archive
accompanies this record.

## Read-only diagnosis after the latest failed close/reopen (2026-10-26)

**Classification: P1 DEFECT.** The phone's online same-installation launch criterion
failed, and a separate current-production implementation defect was reproduced in
an ordinary failed-install/retry lifecycle. Its presence on the phone is not proved.
No acceptance-environment blocker has been established, and uncertainty about the
hidden trigger does not reclassify the observed phone failure as inconclusive.

### Current delivery and implementation

A fresh public check at 2026-10-26T13:23:06.095Z still matched merge
`967a2b627c695af1a49119609ab56aeb16c7049c`, deployment
`184d14f4-ec73-45d0-acc2-32402ef569a6`, worker
`b8ea03bbde13d8c05edc1a313d0a19fcf3af5e7c29615a8274009db3f6c997f6`,
and all 11 resources/MIME/bytes/revisions/integrity. No public-delivery mismatch
was found. This does not identify the phone's controller or adopted release.
Code references below are to that merge, not this older acceptance checkout.

### Confirmed representative defect and controls

- `worker/generations.ts:1022–1047` persists an installation reservation before
  filling resources. A failed fill leaves its uncompleted reservation protected.
- `:1065–1072` includes all matching unconsumed installation reservations in
  `eligible`, without requiring a completion. For different-owner transfer,
  `:1095` requires exactly one reservation **before** `:1101–1104` checks completion.
- In a real disposable Chromium 156.0.8078.4 context, the prior accepted worker
  installed normally. One current-build installation failed because the fixture
  served HTML for its exact CSS resource. The unchanged current worker then
  installed successfully on retry. The valid lineage contained **two reservations,
  one completed installation, and a completed latest reservation**. The candidate
  and predecessor each retained all 11 verified resources and the old document pin.
- The browser activated the current worker, with native instance/scope proof true.
  Its ownership reconciliation still rejected transfer; the ledger owner remained
  the predecessor. Canonical navigation returned the exact current embedded
  recovery document with no binding, and repair/cancel were disabled. A fresh
  worker-global restart repeated the failure. No metadata corruption or missing
  candidate resource was needed.
- The healthy single-attempt update control reached the normal application. A
  distinct compatible **disposable test build**, with unchanged worker logic,
  also recovered the stranded valid lineage while retaining prior reservations,
  resources and pins, without clearing/reinstalling or a ledger-format migration.
  This control is not a production release or a phone recovery authorization.

Six diagnostic assertions passed, including these reproduced failures and controls;
this is not a set of physical-device passes. No product implementation was changed.
Evidence: `/private/tmp/spendspacey-task34-failed-reopen-diagnosis-20261026.json`.
The exact failure path is also absent from the existing browser failed-replacement
checks (`e2e/pwa.spec.ts:604–639`), which verify that the old worker survives but do
not retry that same failed replacement successfully. The already-committed
same-build restoration cases do not exercise this different-owner transfer.

### Other routes to the same visible outcome — not phone findings

A second disposable model retained one old controlled document while closing and
reopening another. The corrected worker remained installed/waiting and the old
controller still served recovery. Releasing all fixture clients allowed normal
adoption. App-switcher closure therefore cannot alone establish which lifecycle
path the phone followed. The standard distinguishes installation failure, waiting
activation, and activation that can complete despite unsuccessful handlers:
[Service Workers specification](https://www.w3.org/TR/service-workers/).

A third model kept all resource bytes intact but supplied invalid durable metadata.
Current validation (`worker/generations.ts:152–156`, `:284–301`) failed closed across
restart; recovery remained unbound and repair disabled. That behavior is intentional
for untrusted state, not evidence that the phone has corrupt metadata. Unsupported
native identity proof (`worker/authority.ts:3–14`) is another unmeasured phone limit.

These paths differ: a replacement may never control the document, or it may be
browser-active but unable to establish ledger authority. `worker/sw.ts:31–36`
returns recovery on failed reconciliation. `worker/recovery.ts:8–14` correctly
requires recovery-document authority for repair; status/reload cannot consume or
retire an uncompleted installation reservation, invent a binding, or repair invalid
ownership history. The current static wording does not expose which cause applies.

### Smallest safe next work — design/review, not implementation

A **new implementation PR is required** for the confirmed installation-retry defect.
First review eligibility derived from uniquely completed, fully verified installation
provenance in the current lineage, while retaining incomplete reservations and all
protected resources. Preserve native active-instance/origin/scope proof, the writer
lock, current parent/head/epoch fencing, latest/supersession rules, immutable pins,
repair/spent history and complete verification/read-back before delivery. Do not
remove the uniqueness guard, choose an arbitrary/latest same-build reservation,
enable unbound repair, reconstruct from bytes, or add network HTML fallback.

Add exact failed-fill → identical-build successful-retry → activation → cold-reopen
coverage, including interruptions before/after completion persistence and read-back,
genuinely multiple completed candidates, concurrency and restart. Uncertain completed
installation provenance still requires a safe design; it must not be guessed away.
A format migration is not demonstrated necessary for the reproduced valid-lineage
case. If durable installation association or handling genuinely ambiguous/invalid
historical state requires a format change, return an explicit migration design for
review before implementation. Existing invalid/forked/unsupported state must remain
fail-closed, with no trust/budget reset or data clearing to force progress.

Review privacy-safe public build/waiting/authority reason diagnostics separately
from Auth/private data, so unavailable storage, waiting control and ownership
provenance rejection can be distinguished without phone tooling or raw exceptions.
Only after an approved correction/migration design, regression verification and a
separately authorized release should a same-installation recovery procedure be
reviewed. Clearing data, reinstalling, rollback, repeated phone trials or bypassing
binding/activation fences are not accepted fixes.

**Next phone action: none.** Preserve the open recovery document untouched. No
phone interaction, account/session inspection, product-code change, production
mutation, commit, push, archive or task-status change was performed in diagnosis.
**Task 3.4 remains unchecked at 8/9.**

## Task 3.4 PR #8 single-reload result (recorded 2026-10-28)

This append records the PM's latest observation from the existing Home Screen
installation after PR #8 publication. The phone event's exact time was not
supplied. Publication chronology does not establish adoption on the phone.
All preceding Task 3.2/3.3 and Task 3.4 evidence remains byte-for-byte unchanged.

### PM-reported sequence

1. Connectivity remained enabled and unchanged. The stable English recovery
   page showed an enabled **“Reload Spendspacey”** control.
2. The PM pressed that control **exactly once**.
3. The content/buttons area briefly blinked. The transition was too fast to read;
   its text, buttons and intermediate document cannot be identified.
4. The same English recovery screen remained afterward, and the app stayed open.
5. No waiting notice, repeated navigation, loop, prompt, visible error, persistent
   blank screen or closure occurred.
6. The PM completed an uninterrupted **60-second passive observation**.
7. No other control or phone action was performed.

### Classification and evidence limits

**Recovery not achieved; adoption inconclusive.**

This is not a pass, completed recovery, or proof that PR #8 failed to execute.
The unreadable transition is preserved as unreadable. No worker/controller
identity, release adoption, generation ownership, session validity or offline
readiness is inferred. The same visible screen does not establish whether the
same document/controller remained or a new document returned equivalent recovery.
Earlier failed launches remain failed attempts, and earlier inconclusive reloads
remain inconclusive. The successful language change does not establish cold-launch
reliability. The unresolved Task 3.4 acceptance failure is not downgraded.

### Read-only assessment and independent-review candidate

The 2026-10-27 post-merge verification separately recorded merge
`2acaa960863024419cb1f22166cd1d9c66e8640b`, deployment
`7e9a7ae8-0035-4cf6-88f0-31390c010835`, 44 HTTP checks and 22 public/disposable
browser scenarios passing. A limited public `/sw.js` byte check on 2026-10-28 at
15:30:08 UTC still matched that verified build: worker
`124f91385e65e2db4091059a230ae9ccb2991cebff01d3047e29015269c1086b`, response
SHA-256 `6425860b68046c457281fe52c0ec6e8019cf916a8493fbfebc0ec62fec2fd6b5`.
This follow-up was not a new 44-check/browser run and does not identify the phone's
worker. Sanitized evidence is in
`/private/tmp/spendspacey-pr8-phone-reload-20261028-public-worker.json` and
`/private/tmp/spendspacey-pr8-postmerge-evidence-20261027.json`.

The reviewed source deliberately has no `skipWaiting`, client claim or forced
reload (`worker/sw.ts:26`). Its disposable stranded-old-worker case keeps recovery
open while a replacement waits, then allows normal adoption after fixture clients
close (`e2e/pwa.spec.ts`, stranded-old-implementation lifecycle case). Conversely,
failed activation/state validation intentionally returns unbound recovery; a new
document still needs independently validated authority and its exact browser-issued
binding before application bytes. PR #8 does not make ambiguous or invalid durable
history eligible. These are alternative explanations, not phone findings.

Therefore **one separately reviewed online app-switcher close/reopen cycle** is
the smallest meaningful next candidate. It tests a lifecycle transition that this
single reload did not establish. App-switcher closure itself cannot prove release
of every browser client/process or worker adoption. Earlier close/reopen failures
remain relevant; this proposal is one bounded observation after PR #8 publication,
not permission to repeat trials until success. The repeated recovery on this reload
alone does not require another product change before reviewing that candidate.

Proposed conditions for independent review only:

- **Preconditions:** explicit separate approval; unchanged enabled connectivity;
  the PM can identify the existing Spendspacey app and the same Home Screen icon.
  Without these conditions, stop before interaction.
- **Candidate scope:** one app-switcher close of Spendspacey and one tap of the
  same existing Home Screen icon. No second launch, reload, status/repair control,
  language/connectivity change, sign-in/out, tooling, clearing or reinstalling.
- **Pass for this narrow observable case:** the normal application is the first
  recognizable screen and remains visibly usable through 60 seconds of passive
  observation without recovery, forced navigation, loop, visible error, unexpected
  prompt, persistent blank screen or closure. Record any waiting notice separately;
  its absence alone is not failure. This would support online same-installation
  launch availability only, not exact adoption/identity, session validity, offline
  readiness, or completion of Task 3.4. No account details should be recorded.
- **Fail:** recovery is the first recognizable screen. End observation at that
  condition, record a failed online same-installation close/reopen after PR #8
  publication, and require fresh read-only diagnosis before another phone action.
  This still would not prove which worker executed or the hidden cause.
- **Stop:** inability to identify the app/icon, changed connectivity, an unexpected
  prompt, error, repeated navigation/loop, persistent blank screen or closure.
  Record only sanitized observable behavior; do not press another control, sign in,
  troubleshoot on the phone or infer private/session state.

**No further phone action is authorized by this record.** The phone must remain
open on the English recovery screen and untouched pending independent review and
separate authorization. No production, Cloudflare, rollback, commit, push, archive
or task-status change accompanies this append. **Task 3.4 remains unchecked at 8/9.**

## Task 3.4 PR #8 failed online close/reopen (recorded 2026-10-28)

This is a separate PM-reported attempt in the same existing Home Screen
installation after PR #8 publication. The event's exact time was not supplied.
Every preceding observation and verification byte is preserved, including the
PR #8 single reload classified “Recovery not achieved; adoption inconclusive.”

### PM-reported sequence

1. Connectivity remained enabled and unchanged.
2. The existing Spendspacey app was closed **once** through the iOS app switcher.
3. The same existing Home Screen icon was tapped **once**.
4. The **English recovery page appeared immediately as the first recognizable
   screen**. The app remained open.
5. No prompt, loop, persistent blank screen, visible error or unexpected closure
   occurred.
6. No further phone action occurred.

### Classification and limits

**Failed online same-installation close/reopen after PR #8 publication.**

This attempt is not inconclusive: it fails the proposed observable online-launch
acceptance criterion. It does not establish the phone's controller, exact worker,
generation, durable state, session validity or specific root cause. The absence of
other visible errors does not turn recovery into an application-launch pass.
Earlier failed launches remain failed; inconclusive reloads remain inconclusive.
No account/session information is requested or recorded.

**Next phone action: none.** The app must remain open on the English recovery
screen and untouched during read-only diagnosis. No further lifecycle, status,
repair, sign-in/out, connectivity, tooling, clearing or reinstall action is
authorized. No production/Cloudflare/rollback change, commit, push or archive
accompanies this record. **Task 3.4 remains unchecked at 8/9.**

## Read-only historical-state diagnosis after PR #8 close/reopen failure (2026-10-28)

**Classification: INSUFFICIENT EVIDENCE to identify the remaining mechanism.**
The physical close/reopen result above is a definite failed acceptance attempt and
continues to block Task 3.4 at P1 severity. Insufficient evidence describes causal
attribution only; it does not reclassify the phone result as inconclusive. No new
PR #8 implementation defect, migration-required phone state, unsupported phone
API, hidden client, or exact controller/build has been established.

### Historical observations retained and considered

The chronology includes accepted baseline installation/Task 3.3; the first cold
launch into Portuguese unbound recovery after `611994f`; a single reload that
retained recovery; the unplanned close/reopen that displayed the application and
boolean-only session restoration; a successful Portuguese-to-English language
change followed by an unplanned cold reopen into corrected English unavailable
recovery; the later inconclusive reload and failed close/reopen after PR #7; and
the separate PR #8 reload and failed close/reopen above. Those results are not
merged, erased or relabeled. Locale continuity proves only the reported locale
behavior, not ledger, controller, session or offline continuity. The latest report
does not repeat the exact current guidance text, so it cannot identify the serving
release from its wording. A prior recognizable new recovery payload similarly
establishes no current controller or current committed selection.

### Public delivery and sources examined

A fresh public `/sw.js` check at 2026-10-28 15:43:46 UTC returned HTTP 200 and
matched the verified PR #8 bytes: worker
`124f91385e65e2db4091059a230ae9ccb2991cebff01d3047e29015269c1086b`, SHA-256
`6425860b68046c457281fe52c0ec6e8019cf916a8493fbfebc0ec62fec2fd6b5`.
This is a worker-byte follow-up, not a new full 44-check delivery/deployment audit.
The separately preserved 2026-10-27 post-merge evidence associates those bytes with
merge `2acaa960863024419cb1f22166cd1d9c66e8640b` and deployment
`7e9a7ae8-0035-4cf6-88f0-31390c010835`. Public delivery does not prove phone control.

Read-only source exports cover `fae9f51`, `611994f`, `fabde5f` and PR #8 merge
`2acaa960`; the PR #7 delivered build `b8ea03bb…` is also exercised. Fresh archived
611/fab builds reproduce worker identities `a2c2c03c…` and `30623ba9…`; historical
builds are source-derived controls, not a blanket claim of historical byte equality.
All archived source files and the original PR #8 verification copy's tracked files
remain unchanged. No implementation/planning artifact is edited in this diagnosis.

### Fresh disposable reproductions — not physical-device passes

All **149 focused deterministic tests passed**: 50 activation, 19 startup and 80
repair-outcome tests. These include uncertain writes/read-back, delayed settlement,
lock/deadline/cooldown/coalescing, authority/head/epoch/provenance fences, missing or
reused browser identities, multiple completed candidates with differing resource
health, protected reservations/pins and spent repair/seal history.

**Eight Chromium 156.0.8078.4 historical/lifecycle diagnostic cases plus one
separate real-worker repair/seal-retention case passed their assertions:**

1. Same disposable persistent installation: source-derived `fae9f51` → `611994f`
   → `fabde5f` with rejected activation persistence. The fab browser still activated;
   navigation and one reload returned unbound recovery. An ordinary-navigation
   update to PR #7 adopted a complete unique installation. English remained after
   a transient cold-start storage-read rejection. Three failed PR #8 installs,
   followed by a successful retry of the identical unmodified PR #8 worker,
   activated successfully. After an actual browser-process restart and worker
   restarts, application documents had exact bindings and passed English/Portuguese
   online/offline cold launches. Four activations total (the failed fab transfer
   created none); earliest resources/pins and every staged record were retained.
2. Source-derived `611994f` → `fabde5f` → delivered PR #7 → PR #8: inject a completion
   rejection **after persistence**, then retry the same PR #8 build successfully.
   The valid lineage contains two completed current-build/current-epoch pairs.
   The current worker is browser-active but cannot transfer from the predecessor.
   Exact current unbound recovery, disabled repair/cancel, intact candidate and
   predecessor resources/pins, and no history/binding/activation mutation persist
   after closing/relaunching the disposable browser process.
3. Repeat case 2 with a **completion read-back rejection**: same intentional block.
   An unacknowledged durable completion still counts; it cannot be discarded.
4. Delivered PR #7 → one completed waiting PR #8 install → newer failed PR #8
   installation. The original waiting worker activates natively, but its unique
   completed reservation is superseded by the newer incomplete reservation.
   Recovery persists across worker restart; all records and predecessor pins remain.
5. Retain another old controlled disposable document while publishing PR #8. A
   reload and a close/reopen of the visible fixture still receive old recovery;
   PR #8 remains waiting. This reproduces inability to gain control without any
   PR #8 ledger-validation failure; a hidden document on the phone is not proved.
6. Positive control for case 5: releasing all disposable old clients permits normal
   PR #8 activation and bound application delivery without clearing/reinstallation.
7. Recreate the same-build registration with caches and English locale retained.
   Existing committed owner/epoch/selection restore without another activation;
   unrelated installation reservations remain quarantined. Cold navigation works
   and the old document pin/resources remain intact. Registration recreation alone
   is not demonstrated to cause permanent refusal under healthy retained state.
8. Insert invalid durable metadata while retaining verified pinned resources.
   Cold worker restart still returns unbound, blocked recovery. Intact bytes do
   not authorize metadata reconstruction or prove ownership.
9. Separate full-history control retains an existing repair attempt, successful
   finish/adoption, spent history, cleanup seal, predecessor pins and incomplete
   reservations through failed PR #8 installation → identical-build successful
   retry → activation. Every prior record body is byte-for-byte retained, no extra
   repair/seal is created and no unsafe cleanup occurs.

Faults, cache/ledger inspection, registration recreation and process controls above
are exclusively disposable fixture actions. No real account/session fixture is
used or inspected. Local alternate-origin Auth is denied; all nine browser cases
assert zero page Auth SDK imports and zero unexpected Auth/API/provider/cross-origin
requests. Worker verification downloads of the allowlisted static SDK chunk are
bytes, not SDK execution. No automatic repair/reload or unsafe cleanup was observed.
The only browser implementation freshly exercised here is disposable Chromium;
previous supplemental WebKit evidence is not a fresh exact-iPhone reproduction.

Harness qualifications: the initial sandbox denied browser launch; two intermediate
runs stopped because the copied driver invoked `registration.update()` from a
restrictive recovery page. The corrected final run uses ordinary navigation for
browser soft update and passes all eight cases. These harness failures are not
product/phone findings. A copied retention driver's output path also overwrote one
older auxiliary `/private/tmp/spendspacey-pr8-tail-browser-20261027.json` report.
Its exact earlier auxiliary bytes were not recovered. The original consolidated
22-case post-merge JSON retains those historical results, and every preceding byte
of this repository verification record remains unchanged. The new retention result
is isolated under the current diagnostic directory and its driver path is corrected.

### Intentionally unavailable states and code boundaries

- `worker/generations.ts:1062–1085`: validated committed same-build ownership restores
  its existing epoch/selection without associating or consuming pending reservations.
  Multiple quarantined reservations alone do not block this path.
- `:1087–1108`: different-owner transfer requires exactly one durable completed pair
  for this build/current epoch, then independently requires its reservation to be
  the latest installation reservation across all workers, including incomplete ones.
  Zero completions, two or more eligible completed pairs, old-epoch provenance and
  a superseded unique pair remain blocked. Resource health does not resolve identity.
- `:284–348` and `:350–640`: the entire durable record set/lineage is validated; missing
  established metadata, malformed/forked/unsupported/incompatible state cannot be
  filtered, reset or rebuilt from cached bytes. Unacknowledged persisted writes
  remain facts after validation. Already sealed generations remain ineligible.
- `:180–280`: transient access rejection is retryable through the bounded shared
  flight. Persistent/hanging failures grant no authority; a deadline does not
  release the underlying writer. Reopening alone cannot guarantee healthy storage.
- `:1158–1319`: missing/reused browser-issued incoming identity, failed joint binding
  persistence/read-back, resource validation failure or authority loss can return
  recovery even after ownership reconciliation. No invented pin or network HTML
  fallback is allowed. These are additional possibilities, not phone observations.
- `worker/sw.ts:20–36` and `worker/authority.ts:3–14`: no skipWaiting/claim/forced reload;
  a retained old client can hold an update waiting, and unsupported or absent native
  active-instance proof fails closed. App-switcher closure does not measure these.
- `worker/recovery.ts:9–14`: controller/correlation checks cannot retroactively bind
  an unbound document. Disabled repair is intentional without authority. No safe
  migration or repair command for ambiguous provenance is currently exposed there.
- `worker/generations.ts:1711–1810`: unconsumed installations defer cleanup; document
  bindings and protected predecessors are not unpinned by disappearance or timeout.
  Repair outcomes/adopted selection and seals must survive any future recovery.

### What can safely be concluded and smallest next design

The successful full upgrade control shows that earlier releases and interruptions
alone do not make this installation class permanently unrecoverable. Conversely,
valid ambiguous/superseded histories can remain non-actionable indefinitely under
PR #8 while every resource is intact. The current schema contains no durable native
registration-to-reservation identity that selects one of two completed candidates.
Choosing the newest/healthiest, discarding an unacknowledged completion, ignoring
supersession, repairing automatically or reconstructing from bytes is not a safe
interpretation. The phone sequence does not distinguish those histories from old
control, unavailable storage/native proof or missing/reused navigation identity.

**Whether this particular installation can ever pass without another change is
unknown.** Healthy unique history or valid committed ownership may already recover
under the existing rules; the deterministic multiple-completion test also shows a
fresh distinct, uniquely completed compatible worker can transfer while retaining
older ambiguous history. This is a control/possible future recovery design, not a
release recommendation or permission to use a distinct-build escape on the phone.
PR #8 will not itself resolve a stable ambiguous/superseded/invalid history merely
through repeated launches. Invalid/forked state may not admit a safe migration at
all without new independent trustworthy provenance; availability cannot override it.

Stop behavioral phone trials. The smallest useful next work is independent review
of a bounded, privacy-safe **diagnostic/recovery design**, before another release
or phone action. A proposed diagnostic would expose only the serving public build
and a typed, coarse refusal category (native authority, temporary storage access,
invalid lineage, no/multiple completed candidates, supersession or document binding).
Do not expose raw exceptions, identifiers, ledger contents, cache keys, URLs, account
or session data, and do not weaken the strict handshake. Unsupported/unknown remains
unknown. A new diagnostic release can itself change activation/lineage and conceal
the prior state; this evidence limitation must be reviewed before any deployment.
No interaction with the currently open document is needed or requested now.

Only after a trusted failure category is established should review select ordinary
fresh unique-installation transfer, an explicit additive migration/recovery design,
an engine-compatible lifecycle correction, or an environment limitation. Any new
provenance format/association requires an explicit migration design and regression
review first. Preserve native authority, lock/head/parent/epoch fences, immutable
bindings, read-back, history, quarantines, seals and private-data boundaries. No
arbitrary selection, clearing or reinstallation is an acceptable shortcut.

A **new functional correction PR is not yet justified by a newly confirmed PR #8
bug**. Implementing the proposed diagnostic capability or a migration/recovery path
would require a new reviewed implementation PR and separately authorized release;
no such implementation or publication is authorized here. Add end-to-end historical
and same-installation regression evidence for the selected design, including all
blocked controls above, real-worker/process restart, bilingual bound online/offline
application availability and representative WebKit, before a future phone procedure.

Evidence directory: `/private/tmp/spendspacey-pr8-history-diagnosis-20261028/`
(`source-before.json`, `builds.json`, `public-worker.json`, `focused-tests.json`,
`browser.json`, `retention-browser.json`, intermediate driver reports and
`artifact-handling-note.json`). All causal claims above are representative, not
proof of the phone's hidden trigger. **Next PM action: none.** Keep the installed
app open on the English recovery screen and untouched. **Task 3.4 remains unchecked
at 8/9.** Production, rollback and all task checkboxes remain unchanged.

## PM-approved bootstrap acceptance-scope reset (2026-10-28)

**Decision date: 2026-10-28. PM scope decision approved; independent contract approval remains pending.** The current iPhone installation was created across multiple experimental releases containing confirmed service-worker defects. The PM now classifies it as a **legacy development installation with unrecoverable/indeterminate internal state** and removes it as the release-acceptance baseline. This is a deliberate acceptance-scope decision, not new forensic proof of a particular internal state. It is not successful recovery, a claim that the defects were harmless, or a reinterpretation of any failed/inconclusive attempt. Every preceding phone observation, diagnosis and production/Task 3.2/3.3 result remains byte-for-byte preserved. Earlier procedures and recommendations remain historical; this dated contract supersedes their physical legacy-recovery/update/rollback gates.

### Designated fresh-install baseline

- Canonical URL: **https://spendspacey.pages.dev**, installed through Chrome on the existing iPhone.
- Main merge: `2acaa960863024419cb1f22166cd1d9c66e8640b`.
- Worker: `124f91385e65e2db4091059a230ae9ccb2991cebff01d3047e29015269c1086b`.
- Identity source: the prior verified PR #8 production evidence and subsequent public worker-byte checks, not a phone inspection or inference. This planning-only revision performs no new production audit and does not change production.

The PM may remove the legacy installation **only after independent approval of the revised contract**. Removal clears that installation's local app state and authentication session; reauthentication may be required. The PM states Spendspacey currently contains no user-entered transactions or other offline business data. These consequences must be recorded honestly when removal occurs. Removal is not proof that legacy recovery, migration or repair works. No removal, reauthentication, fresh installation or phone action has occurred as part of this revision.

### Revised physical Task 3.4 contract and pending evidence

| Gate                                    | Required physical evidence                                                                                                                 | Current state                                       |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| Independent contract approval           | Reviewer approves this reset before legacy removal                                                                                         | Pending; PM decision is not that independent review |
| Legacy removal                          | Removal recorded with local-state/session consequences and possible reauthentication; no offline business data currently exists per PM     | Not performed                                       |
| Fresh baseline installation             | Chrome canonical URL → Share → Add to Home Screen; intended Spendspacey name/icon; standalone Home Screen launch                           | Pending                                             |
| Online shell/Auth                       | Normal usable shell; sign-in/sign-out only if needed to confirm the existing Auth shell, boolean outcomes only                             | Pending                                             |
| English online                          | Select English; usable controls; language persists through safe normal reload and full close/reopen                                        | Pending                                             |
| Portuguese online                       | Select Brazilian Portuguese; usable controls; language persists through safe normal reload and full close/reopen                           | Pending                                             |
| English offline                         | Complete online preparation in the installed context, then offline reload and full close/reopen; complete usable localized shell           | Pending                                             |
| Portuguese offline                      | Complete online preparation in the installed context, then offline reload and full close/reopen; complete usable localized shell           | Pending                                             |
| Reconnect                               | Usable shell, language/installation retained; no loop, recovery, unexpected automatic retry, installation loss or forced navigation/reload | Pending                                             |
| Exact sanitized results and PM approval | Actual date/time/timezone and device/iOS/Chrome versions, canonical URL/external release identity, per-case outcomes and PM acceptance     | Pending                                             |

Use the [review checklist](installable-offline-shell.md#task-34--fresh-install-bootstrap-acceptance-2026-10-28). Only safe normal reload controls may be used. If unavailable, record unavailable/not tested, never passed, and keep completion pending reviewer resolution; do not use phone developer tooling. A recovery page, loop, unusable shell, lost installation, forced navigation or visible error is a failure requiring investigation, not permission for repeated trials or another reset. No screenshot, account/session details, storage inspection, controller/generation proof, cache mutation or fault injection is required. Record no cookies, tokens, callback inputs, API responses or private data.

Task 3.4 no longer requires physical recovery, migration, repair, fault injection or rollback of installations created by pre-baseline experimental builds. Production rollback is not a physical bootstrap acceptance requirement. Existing applicable deterministic, real-worker, Chromium, supplemental WebKit, hosted and production evidence may satisfy update, interrupted activation, repair, rollback, ownership, retention, integrity and privacy requirements; their actual coverage/limitations remain authoritative. Keep the prior technical evidence mapping and label these **not manually executed on the physical iPhone; covered by representative automated/hosted evidence**, never new physical passes. Product technical guarantees and all prior failed-device evidence are retained.

A future ordinary production update receives a normal PM smoke check when it naturally occurs; it does not block bootstrap completion or require a deliberate update/rollback now. Task 3.4 may be completed only after independent contract approval, legacy removal, fresh current-baseline installation, the required physical checklist passing and exact results recorded. No existing Task 3.3 pass is imported as a fresh-install result. Until those conditions hold, **Task 3.4 remains unchecked at 8/9**; the change remains unarchived and later phases planning-only.

### Forward requirement for later transaction/offline-data work

User-entered transactions and synchronization state must not be stored in or depend on service-worker Cache Storage. The later offline-data phase must use durable application storage such as IndexedDB, versioned schema migrations, per-user isolation and an outbox/synchronization design. Tests must prove worker update/replacement does not delete or alter financial data or synchronization state. Once user-entered offline data exists, clearing or reinstalling must never be presented as an acceptable recovery mechanism. This requirement belongs to later transaction/offline-data work; no transactions, new application storage, synchronization, runtime code or tests are added to this shell phase by the revision. The present legacy-removal exception must not be generalized to data-bearing installations.

**No phone action is authorized during this planning revision.** The phone remains open on English recovery and untouched. No runtime/test, production/Cloudflare, rollback, stage, commit, push, closure PR, archive or task-status action accompanies the reset. The prior P1 failures remain failed attempts in the preserved record.

## Reconciled historical implementation evidence from current main (2026-10-29)

The following implementation-stage records are retained from merged PR #6–#8. Their 6/9 and untouched-phone statements describe those branches at their recorded dates; they are not the closure state. The full acceptance history above is preserved verbatim.

<!-- prettier-ignore-start -->

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

## Completion-first activation eligibility implementation (2026-10-26)

Base: freshly fetched and remotely verified `origin/main` at `967a2b627c695af1a49119609ab56aeb16c7049c`. Work is isolated on `fix/completion-first-activation-eligibility`. This main-derived record contains no imported production or physical-phone results. Progress remains **6/9**, with **3.2–3.4 unchecked**. The independent acceptance checkout retains its own **8/9**, with **3.4 unchecked**.

Only production-code change: `Generations.restoreActivation` derives different-owner candidates from validated completion/reservation pairs under the existing writer lock. Exactly one completed pair must exist before the separate latest-reservation veto (including incomplete reservations) and resource verification. Activation uses its reservation ID; candidate selection uses its completion ID. Committed-owner restoration, native authority/fences, exact-client binding/read-back, quarantine/retention, repair/spent history, cleanup seals and Auth/privacy boundaries are unchanged. No schema/protocol/migration/dependency/Auth/recovery-UI/CSP/cleanup-policy change.

| Subcase                                                                                    | Representative evidence and expected result                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One/three older incomplete reservations, one completed latest pair; identical worker retry | `activation.test.ts` positive bound application assertions, epoch/selection/restoration checks; native Chromium failed-install/retry with byte-identical worker response, bilingual online/offline cold navigation; archived `967a2b6` negative controls fail as expected                                                                                                                                   |
| Candidate uniqueness versus supersession                                                   | Private-method error observation through real public lock-held reconciliation distinguishes `No unique fenced installation` from `Superseded installation`; older completion plus newer incomplete same/other-build reservation remains blocked, including completion arriving after the newer reservation; native worker supersession regression retains all records                                       |
| Multiple completed candidates, including unequal resource health                           | Count all validated completed pairs before resource verification; deterministic cases remain ambiguous with healthy/damaged resources; native persisted-but-unacknowledged completion plus successful retry remains blocked                                                                                                                                                                                 |
| Missing versus unacknowledged completion                                                   | Before-write rejection creates no pair; after-write, read-back and lineage-acknowledgement interruption preserve durable completion after full revalidation; no completion is synthesized from intact bytes. Native before-write retry adopts; native after-write/read-back retry remains ambiguous                                                                                                         |
| Delayed/uncertain writes and concurrency                                                   | Hanging completion retains the exclusive writer lock until settlement; activation caller deadline does not release pending mutation authority; late commit restores without duplicate activation; concurrent navigation/status/cleanup coalesces and binds before bytes                                                                                                                                     |
| Invalid provenance/lineage and fencing                                                     | Full snapshot includes malformed/incomplete records; unsupported namespace, fork, incompatible/invalid parent and duplicate completion fail closed; stale epoch, changed head/parent and lost native authority cannot claim accepted ownership                                                                                                                                                              |
| Same-build owner restoration and safety history                                            | Existing startup matrix remains unchanged: one/multiple unrelated reservations do not block a validated committed owner; no association/new activation. New transfer regression preserves predecessor pins, successful repair/adoption history, spent outcomes and deletion seals; cleanup remains deferred                                                                                                 |
| Worker/process restart and whole-generation adoption                                       | Native worker stop/restart, all documents absent, graceful/abrupt dedicated disposable browser termination, online/offline positive working application assertions; locale is established in a prior normal lifetime before the abrupt completion-first probe so it tests ledger durability separately from Chromium preference flushing                                                                    |
| Recovery, Auth/cache privacy and absent navigation hints                                   | Existing full unit/browser suites cover exact missing/reused browser identities without substitution, controller replacement/fresh handshake, recovery CSP and zero Auth SDK execution, canonical/alternate-origin Auth boundaries and static cache inventory. New representative cases observe no unexpected Auth/API/provider/cross-origin requests, repair/cleanup records or automatic navigation loops |

Local final results (all test runners configured without retries):

| Verification                            | Result                                                                                                                                                                                                                                                                                   |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full unit/component suite               | 613 passed across 23 files, including 50 activation cases and 19 startup cases                                                                                                                                                                                                           |
| Activation/startup deterministic matrix | 69 cases × 10 repetitions × ordinary/constrained scheduling = **1,380 executions**, all passed                                                                                                                                                                                           |
| Repair-ordering matrix                  | 40 scenarios × ordinary/constrained scheduling × 10 repetitions = **800 executions**, all passed                                                                                                                                                                                         |
| Full Chromium/Auth/origin/PWA suite     | **79 passed**, retries **0**; ten new real-worker candidate/completion/supersession/persistent-process regressions                                                                                                                                                                       |
| Supplemental disposable WebKit          | **27.2**: original four persistent-profile lifetimes plus three lifetimes per locale for completion-first failed-install/retry, online adoption and offline cold launch; working bound application, predecessor binding retained, zero unexpected requests; not physical iPhone evidence |
| Build/configuration/delivery            | Local development, production, preview and unclassified builds; 46 unsafe URL/Pages configurations rejected; 17 exact published entries per variant, manifest/icons and 11-resource inventory/MIME/bytes/integrity, delivery/cache/security/CSP checks passed                            |
| Static quality                          | Formatting, lint, application/worker types, whitespace and strict OpenSpec validation passed (7 items; existing unrelated archive advisories remain informational)                                                                                                                       |
| Secrets                                 | Pinned checksum-verified Gitleaks 8.30.1: repository candidates, local/Pages/version builds and Git history, no leaks                                                                                                                                                                    |

Prototype failures were investigated, not retried into acceptance: the test hook’s asynchronous injection was made single-shot; the repair-history fixture damages both usable generations to request an actual repair; the Portuguese repair button uses its existing exact localized label. An abrupt-process fixture first establishes locale durably through a prior normal lifetime. A separate overlapping local browser run encountered the shared port already in use; Chromium and WebKit were subsequently executed sequentially. The final full Chromium suite and deterministic matrices passed without retries.

Before/after preservation proof: the acceptance checkout remains on `docs/accept-installable-offline-shell` at `611994f4e0cae15b4b4ef4ada6659d10ac059a55`, with the same six unstaged paths, no staged/untracked paths, 1,513 insertions/56 deletions. All **170 tracked-file SHA-256 hashes**, status and HEAD/branch match exactly. SHA-256 of `git diff --binary --no-ext-diff` remains `98fc63897b06ccd696e6b39563fac140775c95507f54c7b2c846eb12e144a91d`. Full before/after manifests and a recoverable safety patch are retained outside the repository in `/private/tmp/spendspacey-completion-first-acceptance-{before,after}.json` and `/private/tmp/spendspacey-completion-first-acceptance-safety.patch`. This records preservation only, not acceptance results.

Exact-head CI and branch Pages preview are publication checks after the implementation commit; their identities/results belong to the draft PR and implementation report. No production deployment, Cloudflare setting/rollback action, physical phone interaction, account/session inspection or acceptance completion follows from this implementation. Incomplete-after-completed supersession, multiple completed candidates and invalid histories remain deliberately fail-closed. The representative defect and correction do not establish the phone’s hidden trigger or resolve every historical durable state. Task 3.4 remains unchecked.

<!-- prettier-ignore-end -->

## Task 3.4 fresh-install PM acceptance — approved reset completed (2026-10-29)

**Result: PASSED under the approved fresh-install bootstrap contract. Progress:
9/9; Task 3.4 complete.** The PM supplies the following sanitized results and
confirms the approved reset/evidence route. No agent phone interaction, account
inspection, production change or Cloudflare change was used to obtain them.
All preceding failures, diagnoses, inconclusive reloads, temporary successes and
implementation-stage records remain historical and unchanged. The abandoned
experimental installation was not recovered and is not migration evidence.

### Baseline, device and evidence scope

| Field                                     | Recorded value                                                                                                                        |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Date / approximate local time / timezone  | 2026-10-29; approximately 11:30–12:30 local; Europe/Berlin (PM-reconfirmed metadata; no retest)                                       |
| Device                                    | iPhone 16 Pro                                                                                                                         |
| PM-reconfirmed tested OS/browser versions | iOS 26.6.2 / Chrome 155.0.8059.37 (PM-reconfirmed tested versions)                                                                    |
| Canonical installation URL                | https://spendspacey.pages.dev                                                                                                         |
| Production merge                          | `2acaa960863024419cb1f22166cd1d9c66e8640b`                                                                                            |
| Production worker                         | `124f91385e65e2db4091059a230ae9ccb2991cebff01d3047e29015269c1086b`                                                                    |
| Release identity basis                    | Previously verified production build/delivery evidence supplied outside the phone; no phone worker/controller inspection or inference |
| Contract                                  | PM-approved 2026-10-28 reset, with the approved unavailable-physical-reload plus automated/real-worker reload evidence route          |
| Evidence source                           | PM-reported user-observable behavior; technical lifecycle guarantees use their separately mapped representative evidence              |

### Legacy installation removal — not recovery or provider logout

- Deleted using the iOS deletion confirmation; Home Screen icon confirmed gone.
- Local installation state/session relinquished. This was **not** server/provider
  logout, proof of remote revocation, successful recovery or migration.
- No browser website data was cleared.
- The PM attested that no user-entered offline business data existed.
- No claim is made that historical experimental installations are migratable.
  The reset does not make earlier confirmed service-worker defects harmless or
  convert any earlier failed launch into a pass.

### Fresh installation and authentication — sanitized outcomes only

Installed from the canonical production URL through iPhone Chrome. Spendspacey
name/icon: **passed**. Standalone launch: **passed**. The first launch showed the
stable normal login screen.

| Outcome                                      | PM result |
| -------------------------------------------- | --------- |
| Sign-in succeeded                            | `true`    |
| Returned to the installed standalone context | `true`    |
| Stable authenticated shell appeared          | `true`    |
| Reauthentication required                    | `true`    |
| Non-account error                            | None      |

No account, token, session, cookie or provider details are included. No new sign-out
result is inferred: the fresh Auth check was needed for reauthentication, and the
supplied sign-in/standalone-return booleans confirm the existing shell. Earlier
Task 3.3 Auth results remain separate historical evidence.

### English online

- English visible and persisted: **passed**. Normal shell usable: **passed**.
- No recovery, error, waiting notice, forced navigation, loop, prompt or closure.
- No safe reload control exists in the normal shell. Physical reload:
  **unavailable/not tested**, never passed. Existing automated/real-worker evidence
  supplies the approved separate reload coverage; no phone tooling was used.
- App-switcher close/reopen: **normal app appeared first**; English persisted;
  shell remained usable for **60 seconds**; app remained open.

### Brazilian Portuguese online

- Portuguese selection and translated shell: **passed**; stable for **60 seconds**.
- App-switcher close/reopen: **normal app appeared first**; Portuguese persisted;
  shell remained usable for **60 seconds**.
- No recovery, error, waiting notice, loop, forced navigation, prompt or closure.
- The normal shell has no safe reload control; no physical Portuguese reload pass
  is invented. Physical reload remains **unavailable/not tested**, with the same
  approved separate representative reload coverage.

### English offline and reconnect

- Prepared online in the installed context. Airplane Mode enabled; Wi-Fi and
  mobile data disabled.
- App-switcher close/reopen: **normal app appeared first**; English persisted;
  complete shell remained usable for **60 seconds**.
- Exact displayed guidance: `The app shell is ready for offline use. Fresh sign-in and sign-out need a connection.`
- No loop, forced navigation, prompt, recovery, error or closure.
- Reconnect: **passed** — normal usable shell; English retained; no automatic
  retry, forced navigation, recovery, loop, prompt or closure.
- Readiness guidance remained visible. It is **static readiness guidance, not a
  live connectivity indicator**. Physical reload remains **unavailable/not tested**;
  this is a cold-reopen pass combined with separate approved reload evidence.

### Brazilian Portuguese offline and final reconnect

- Prepared online in the installed context. Exact displayed readiness guidance: `A estrutura do aplicativo está pronta para uso offline. Entrar e sair precisam de conexão.`
- Airplane Mode enabled; Wi-Fi and mobile data disabled.
- App-switcher close/reopen: **normal app appeared first**; Portuguese persisted;
  complete shell remained usable for **60 seconds**; guidance remained visible.
- No loop, forced navigation, prompt, recovery, error or closure.
- Final reconnect: **passed** — normal usable shell; Portuguese retained;
  connectivity restored; no automatic retry, forced navigation, recovery, loop,
  prompt or closure; **app left open**.
- Guidance is the same static readiness message, not a live connection indicator.
  Physical reload remains **unavailable/not tested**; no reload pass is inferred.

### Completion and evidence mapping

| Acceptance area                                                                               | Accepted evidence and limits                                                                                                                                                                                                          |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contract/reset and legacy removal                                                             | Approved PM scope reset and deletion observations above; no browser website-data clearing; no legacy recovery/migration pass                                                                                                          |
| Fresh install/name/icon/standalone/online shell                                               | PM passes above on the canonical installation; exact release identity remains external evidence                                                                                                                                       |
| Existing Auth shell                                                                           | Supplied boolean-only sign-in/standalone-return/usable-shell results; reauthentication required; no private-data inspection                                                                                                           |
| Bilingual online/offline cold reopen and reconnect                                            | PM physical passes above, each reported 60-second stability observation retained; final Portuguese/connectivity/app-open state recorded                                                                                               |
| Physical online/offline reload                                                                | **Unavailable/not tested**, never passed; approved combined route uses bilingual physical cold-reopen passes plus separately mapped automated/real-worker reload evidence                                                             |
| Waiting update notice                                                                         | Not observed on the fresh phone; no physical waiting-update pass is invented; representative rendered-notice/waiting-worker/retention evidence remains the basis                                                                      |
| Update, interrupted activation, repair, rollback, ownership, retention, integrity and privacy | Existing applicable deterministic, real-worker, Chromium, supplemental WebKit, hosted and production evidence remains accepted; **not manually executed on the physical iPhone; covered by representative automated/hosted evidence** |
| Future ordinary production update                                                             | Normal PM smoke when one naturally occurs; non-blocking for this bootstrap completion; no artificial update/rollback required                                                                                                         |
| Historical experimental installation                                                          | Abandoned legacy development installation with indeterminate internal state; no recovery or migratability claim                                                                                                                       |

The clean baseline **passed the approved physical checklist**. The absent safe normal
reload control uses the PM-approved combined evidence route and is not an unresolved
physical-reload blocker. Task 3.4 is marked complete only after these exact results
are recorded; the original dirty acceptance checkout remains an untouched 8/9 backup.
The current closure branch is **9/9**. Synchronize final requirements and archive
this change; leave successor phases planning-only and the review PR unmerged.

### Forward financial-data requirement retained

User-entered transactions and synchronization state must not be stored in or depend
on service-worker Cache Storage. Later transaction/offline-data work must use durable
application storage such as IndexedDB, versioned schema migrations, per-user isolation
and an outbox/synchronization design, with tests proving worker update/replacement
does not delete or alter financial data or synchronization state. Once such offline
data exists, clearing or reinstalling must never be presented as acceptable recovery.
This shell closure adds no transactions, storage implementation or synchronization.

No additional phone action is requested or authorized by this closure. Production,
Cloudflare settings, rollback controls and the phone remain unchanged by the agent;
the PM's reported final state is online, Portuguese selected and app left open.

## Closure verification and source preservation (2026-10-29)

The closure worktree is `docs/complete-installable-offline-shell`, based on freshly
fetched/remotely verified main `2acaa960863024419cb1f22166cd1d9c66e8640b`.
The original dirty `docs/accept-installable-offline-shell` checkout remains an
untouched source/backup at `611994f4e0cae15b4b4ef4ada6659d10ac059a55` and 8/9.
Its HEAD, branch, seven unstaged paths, all **170 tracked-file SHA-256 hashes**,
complete diff bytes/statistics, and absence of staged/untracked files match the
pre-work snapshot. Diff SHA-256 remains
`e8c65aa620361b5b97f8dd70c53f5587e0c2a1f817dac28ff6858e70b49d69e6`.
The complete binary patch, seven source files and before/after manifests are held
outside the repository in `/private/tmp/spendspacey-closure-preservation-20261029/`.
All accumulated acceptance-verification bytes are preserved as an exact
**164,160-byte prefix**, SHA-256
`cb7c61c63aa3e3306849ab2b64b47fa1fca38b2407a1098489c0add2c1464289`.
PR #6–#8 implementation records above are also retained verbatim; their historical
6/9 and untouched-phone statements do not describe final acceptance. Archive-relative
links are relocated without changing the historical phone observations.

Final local verification uses Node **24.21.0**, pnpm **10.27.0**, Playwright **1.64.1**
and synthetic/disposable contexts only:

| Verification                                            | Result                                                                                                                                                                                                               |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Complete unit/component suite                           | **615 passed**, 23 files; includes both existing and ported exact bilingual accessible waiting-notice coverage                                                                                                       |
| Full Chromium/Auth/origin/PWA suite                     | **79 passed**, retries **0**                                                                                                                                                                                         |
| Activation/startup matrix                               | 69 cases × 10 repetitions × ordinary/constrained scheduling = **1,380 executions**, passed                                                                                                                           |
| Repair-ordering matrix                                  | 80 ordinary/constrained cases × 10 repetitions = **800 executions**, passed                                                                                                                                          |
| Supplemental disposable WebKit                          | **27.2** native identity/timing plus four persistent-profile rounds and three lifetimes per locale for failed-install/identical-build retry/adoption/offline launch; zero unexpected requests; not phone evidence    |
| Formatting / lint / types                               | Repository formatting, ESLint, application and worker types passed                                                                                                                                                   |
| Build/configuration/delivery                            | Development test and production/preview/unclassified Pages variants passed; **46** unsafe configuration cases rejected; exact header/delivery inventory, canonical/callback/CSP and Auth-origin policy checks passed |
| Manifest/inventory/integrity                            | Manifest and icons, all **11** static resources, MIME/bytes/revisions/integrity and worker identity checks passed                                                                                                    |
| Recovery/update/repair/rollback/cutover/cleanup/privacy | Full deterministic and disposable browser coverage passed; no new physical fault or controller-identity pass inferred                                                                                                |
| Secret scanning                                         | Checksum-verified Gitleaks **8.30.1**: proposed file inventory, local/Pages/version build artifacts and Git history, no leaks                                                                                        |
| Links / whitespace / OpenSpec                           | All local documentation links resolve; whitespace clean; strict validation **7 passed / 0 failed**, with only existing superseded-plan advisories                                                                    |

A supplemental identity-probe failure was investigated and retained: the probe
received a message while the native active worker was still `activating`, a state
the runtime correctly accepts. `registration.ready` was not an activation-completion
barrier. The verification-only `check-worker-identity.mjs` now waits for that exact
native worker to reach `activated`, with a 10-second deadline and authority-loss
rejection, before its separate post-activation assertion. Install/activate identity
observations remain unchanged and the corrected probe plus startup WebKit checks
passed. This is a test-harness timing correction, not a product or phone fix.

Production runtime source is unchanged from main: no application/worker/build/public
code, dependencies, production configuration or CI workflow changes. The only code
changes are the ported component tests and the supplemental identity verification
script. Successor plans remain unstarted; two newly synchronized recovery/callback
scenarios were retained in the offline-profile delta so it cannot later drop them.
The durable specs contain all **16 installable-app requirements** and the two
modified/two added user-auth requirements; its existing Purpose and unrelated
requirements are preserved. All **9/9** tasks are archived at
[2026-10-29-installable-offline-shell](../openspec/changes/archive/2026-10-29-installable-offline-shell/tasks.md).
Spec synchronization was verified before the archive CLI used `--skip-specs` to
avoid applying an already-completed sync twice.

Exact closure commit/PR and remote CI identities/results belong to the review PR
and final handoff; this local record does not invent them before publication.
The PR must remain unmerged. No further production, Cloudflare/settings/rollback,
phone interaction or next-phase implementation is authorized by closure.
