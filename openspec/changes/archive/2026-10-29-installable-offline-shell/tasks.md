# Tasks

Change 2/4. No profiles query, IndexedDB/Dexie, private application snapshot, backend mutation, or database change belongs here.

## 1. Predecessor and static PWA

- [x] 1.1 Verify `deploy-auth-shell` is integrated, published on Cloudflare Pages Free at its assigned production `*.pages.dev` origin, accepted online on the phone, and its specs synchronized. Retain GitHub/main delivery, exact toolchain pins, only two public application variables, disabled new-user signups, exact local/production callbacks, and restricted preview authentication. Compare that actual baseline with this proposal and preserve existing callback/access controls; stop dependent implementation if the prerequisite is unmet.
- [x] 1.2 Pin compatible PWA/Workbox dependencies and worker type checking, then add stable manifest identity, ordinary/maskable/Apple icons, matching metadata/colors, and standalone presentation. Add build checks for values, actual dimensions, required chunks/assets, and output types; verify frozen install/types/build and document iPhone/Google Chrome Share → Add to Home Screen installation with no profile dependency. Use standards/feature detection without browser or user-agent detection; verify supported/unavailable-feature behavior and review that no browser sniffing was introduced.
- [x] 1.3 Implement production-only registration, the explicit static precache/routing allowlist, generic root/callback document handling, sensitive-request bypass, and honest readiness. Verify Chromium activation/control followed by offline reload and new-page launch in both locales without ordinary HTTP-cache assistance; inspect all worker caches after synthetic auth/avatar traffic for private markers and sensitive URL keys. Document first-ever offline/eviction/unsupported-worker limits.

## 2. Offline auth feedback and worker lifecycle

- [x] 2.1 Keep shell/language controls usable while SDK restoration needs unavailable network; add typed localized sign-in/sign-out connection guidance and offline callback recovery without queued/replayed operations. Verify component and browser cases for expired/offline initialization, query/fragment scrubbing, duplicate exchange protection, actual SDK failure states, and preserved Phase 1 race/localization safeguards.
- [x] 2.2 Add normal waiting-update guidance, owned cache revision/cleanup, coalesced update checks, and bounded missing-chunk recovery. Verify a focused two-version worker test with open clients, complete offline replacement, failed installation retaining the old version, and recovery without loops or deleting SDK/locale/unrelated data. Document normal waiting-worker close/reopen separately from repaired-file adoption on a new document navigation or reload, and worker-aware rollback in this group.

## 3. CI, publication, and installation acceptance

- [x] 3.1 Extend the existing Linux job with manifest/Chromium installability diagnostics and the focused offline/cache/update suite. Verify the documented full synthetic checks plus strict OpenSpec validation pass with pinned actions, sanitized failure artifacts, no live-account/host credentials, no Lighthouse PWA score gate, and no browser-matrix expansion.
- [x] 3.2 After review/CI and the accepted merge to `main`, publish through the existing Pages GitHub integration at the predecessor's production origin. Verify actual worker/manifest bytes/MIME, root scope, revalidation, native SPA fallback without top-level `404.html` or catch-all rewrites, callback no-store/no-referrer, and CSP compatibility. Check required assets exist and reject fallback HTML as a valid worker/chunk; do not require arbitrary missing paths to return 404 or add Cloudflare runtime/storage products. Record version/URL/header outcomes without claiming local preview proves host behavior.
- [x] 3.3 Have the PM record the iPhone model and tested iOS/Google Chrome versions, open the production Pages URL in Chrome, use Share → Add to Home Screen, confirm the Spendspacey name/intended icon, and launch from the Home Screen. Verify standalone web-app presentation rather than an ordinary browser bookmark/tab. From that installed app, complete online sign-in/identity/sign-out, reach static readiness, and verify airplane-mode reload and full close/reopen, both languages, safe areas, touch controls, avatar fallbacks, and reconnect guidance. Record sanitized versions/URL/revision/pass-fail evidence; desktop Chromium cannot replace this manual PM gate and Safari-specific manual acceptance is not required.
- [x] 3.4 Complete the approved fresh-install bootstrap acceptance on 2026-10-29: approved reset recorded; legacy development installation deleted through iOS confirmation with local state/session relinquished (not provider logout or recovery, no browser website-data clearing, no offline business data per PM); canonical PR #8 baseline installed fresh through iPhone Chrome with correct name/icon and standalone launch; reauthentication and stable shell confirmed with booleans only; English and Portuguese online/offline full close/reopen and reconnect passed with the supplied 60-second observations. Physical reload is unavailable/not tested because no safe normal control exists; the approved combined route uses the physical bilingual cold-reopen passes plus existing automated/real-worker reload evidence, never a physical reload pass. Representative technical lifecycle evidence remains accepted; the future ordinary-update PM smoke is non-blocking. See the exact sanitized 2026-10-29 results in the verification record. No legacy recovery/migration or exact phone worker/controller identity is claimed.

## Correction verification refinements

Tasks 1.3 and 2.2 were reopened after independent reproduction of Pages' entry redirect and destructive activation of a damaged waiting generation. Re-complete only with canonical-entry and durable-generation regressions. Refresh 1.2/3.1 evidence with the full suite. Required behavior includes offline next-load control after one complete online preparation; restart-safe committed selection; independently validated rollback lineage; no switching live windows; persisted, cancellable, bounded staging repair; uncertain-client and cross-worker-safe cleanup; corrupted/incompatible metadata rejection; three-generation retention and v1 → v2 → v1 rollback. Task 3.2 hosted and Task 3.3 PM physical-device evidence are recorded below; Task 3.4 remains pending.

## Workflow follow-up

- Review/accept the deployed installation milestone and synchronize its specs through the appropriate sync/archive workflow.
- Begin `online-profiles` only after the revised fresh-install iPhone/Chrome Home Screen online/offline acceptance and representative technical lifecycle evidence; a future ordinary-update PM smoke is not a bootstrap gate. Profile availability is not an acceptance condition for this shell change.

## Approved document ownership correction

Implement immutable browser-client generation bindings and joint selection/delivery commits, writer fencing and read-back verification in a new namespace. Embed the independent localized recovery document with exact CSP hashes. Cover all interruption boundaries, explicit v2 cutover, conservative indefinite ownership retention, sealed cleanup, callback binding, bounded deliberate repair and absent-hint navigation. Re-complete 1.3/2.2 only with representative engine/browser evidence; refresh 1.2/3.1 and retest 2.1. Tasks 3.2 and 3.3 are verified below; Task 3.4 remains unchecked.

## Deterministic repair-outcome correction

Tasks 2.2 and 3.1 were reopened for the approved first-effective authorized-stop
ordering and durable uncertainty correction, then re-completed after local and
pinned Ubuntu verification: 80 deterministic cases × 10 repetitions (800 executions
per matrix), 528 unit/component tests, 57 Chromium tests, all build/configuration/
inventory/recovery/update/rollback/cutover/cleanup checks, secrets and strict
OpenSpec validation. Implementation commit `0bc021e1eb6fb10233b052c851390739de29a128`
passed [Linux CI](https://github.com/dnstld/spendspacey/actions/runs/39648317658)
and its Pages preview passed recovery/repair/adoption with zero SDK execution or
provider traffic. Final exact-head checks are linked from
[PR #5](https://github.com/dnstld/spendspacey/pull/5/checks); see the
[verification record](../../../../docs/installable-offline-shell-verification.md).

## Historical main-derived correction handoffs (PR #6–#8)

The following main-derived progress and untouched-phone statements are historical implementation handoffs; current reconciled acceptance is recorded below.

Progress returns to **6/9**. Task 3.2 stays unchecked here; its production evidence
belongs only to the separate paused acceptance work until post-fix reconciliation.
Tasks 3.3/3.4 remain unchecked; the change is unarchived and later changes remain
planning-only. No production/external settings changed; reviewer approval is
required before merge.

## Task 3.4 evidence contract

Physical Task 3.4 covers only PM-observed behavior in the same Home Screen installation: waiting notice if observable, usable existing document, close-all/reopen adoption, online use, complete offline close-all/cold reopen in English and Brazilian Portuguese, and absence of unexpected retry, forced reload or installation loss. Test an available safe normal reload control normally. If none exists, record physical reload as `unavailable/not tested`, never passed; combine bilingual physical offline cold-reopen evidence with the separate mapped automated/browser reload evidence. A waiting notice `not observed` does not alone block acceptance after rendered bilingual notice, waiting-worker and retention evidence pass. A broken notice, forced navigation/reload, unusable UI or lost installation is a failure requiring investigation.

Fault injection, exact generation/controller ownership, repair ordering, failed/offline/successful repair, staging isolation and repaired-file adoption are **not manually executed on the physical iPhone; covered by representative automated/hosted evidence**. The product guarantees remain unchanged; only these subcases' evidence source changes. No phone developer tooling, cache mutation, cookies/tokens/sessions/account-storage inspection, callback inputs, API responses or private-data inspection/export is permitted. Compatible production rollback/restoration require separate explicit authorization and exact release verification outside the phone. Neither deployment nor phone interaction is authorized by this implementation.

## Restart-resumable activation implementation

Implement the approved native-instance reconciliation, idempotent uncertain-write recovery and fresh-controller recovery protocol. Verification belongs to Tasks 1.3/2.2/3.1; external gates 3.2–3.4 remain unchecked at the main-derived **6/9**. No production or physical-phone acceptance results are imported from the separate dirty acceptance worktree. Keep the open phone recovery document untouched and later changes planning-only.

Local correction verification passed: 563 unit/component tests; 460 deterministic
activation case executions; 800 deterministic repair-ordering executions; 61
Chromium/origin/PWA tests with zero retries; supplemental disposable WebKit 27.2
native identity/activation timing; all build/inventory/integrity/delivery/CSP,
configuration, format/lint/types, secret and strict OpenSpec checks. Exact-head
Linux CI and deployed preview are reported on the implementation draft PR.
This does not complete external Tasks 3.2–3.4 or import their separate acceptance
results. Progress remains **6/9** on this implementation branch.

## Retryable-startup restoration implementation verification

Apply the design/specification correction to completed implementation tasks 1.3, 2.2 and 3.1 without importing external acceptance results. Replace the former blanket same-build refusal: restore a fully validated committed owner without transfer; quarantine unrelated reservations and defer cleanup. Preserve the strict unique-provenance rule for different-owner transfer, native identity/scope fences, immutable document binding, legacy/repair/spent history and fail-closed durable corruption. No ledger/protocol migration is introduced.

Verify source-typed storage rejection, coalesced bounded attempts/cooldown, hangs retaining flight/lock, stale/late continuations, same-global and restarted recovery, uncertain commits, one/multiple quarantined reservations, unchanged repaired/adopted selection, exact missing/reused identities and bilingual recovery/readiness. Require positive application availability in the bilingual representative lifecycle and disposable persistent-process tests. Run the activation/startup and repair-ordering matrices, complete unit/component and no-retry Chromium suites, supplemental WebKit separately, all build/config/integrity/delivery/CSP/Auth-boundary/secret checks and strict OpenSpec validation. Record actual results in verification evidence.

Task 3.4 remains unchecked. This main-derived implementation branch retains 6/9, with external 3.2–3.4 unchecked; the separate acceptance checkout owns its 8/9 state and all production/phone evidence. Do not import or modify it. Neither representative reproduction proves the phone's hidden trigger. Production and the open phone recovery document remain untouched; further recovery needs independent review and authorization.

## Completion-first activation eligibility correction

Refine completed implementation tasks 1.3/2.2/3.1 only: construct unique validated completion/reservation pairs under the writer lock, then apply the unchanged latest-reservation supersession veto including incomplete reservations. Use reservation ID for activation and completion ID for resource selection. Count persisted-but-unacknowledged completions after authoritative revalidation; never reconstruct them from bytes. Preserve committed-owner restoration and all authority, fences, binding/read-back, retention/quarantine, repair/history, cleanup-seal and privacy safeguards. No schema/protocol/migration/dependency/Auth/recovery-UI/CSP/cleanup-policy change.

Verify the deterministic ordinary/constrained activation/startup and repair-ordering matrices, full unit/component and Chromium/PWA suites without retries, real-worker identical-build failed-install/retry/restart and bilingual online/offline adoption, uncertain completion persistence, supersession/multiple completed candidates, retained pins/history/seals, supplemental disposable WebKit, all build/config/inventory/integrity/delivery/CSP/secret checks and strict OpenSpec validation. Require exact-head CI/tree proof and a preview with Auth denied and recovery/network isolation. Results belong in implementation verification evidence, not physical acceptance.

Keep external 3.2–3.4 unchecked at main-derived **6/9** on this implementation branch. Preserve the separate acceptance checkout’s **8/9** and all evidence exactly. Task 3.4 remains unchecked in both. The representative fix proves neither the phone’s hidden trigger nor recovery of superseded/multiple-completion/invalid histories. No production, rollback, phone or clearing/reinstallation action is authorized.

## Reconciled acceptance source history

The correction branch's 6/9 handoff deliberately excluded acceptance evidence.
It is now reconciled below: current progress is **8/9**, only Task 3.4 unchecked.
PR #5 merged as `611994f4e0cae15b4b4ef4ada6659d10ac059a55`, accepted PR head
`79dbbd485a922b560fc92f0cc1ef4c1b362c9286`; exact-head
[Linux run 39649446414](https://github.com/dnstld/spendspacey/actions/runs/39649446414)
and preview `0b2ca09b` passed. The change remains unarchived, later changes planning-only.

## Task 3.2 production evidence (2026-10-20)

Baseline merge `fae9f51b489db95d672a4761cbd9ecef80b53de6` was verified at
`https://spendspacey.pages.dev`; Pages deployment `90a2be8a` succeeded.
[Production verification](../../../../docs/installable-offline-shell-verification.md#production-verification--task-32-accepted)
records 44/44 HTTP cases, byte-identical reproducible production worker and 11-entry
inventory, 19/19 hosted Chromium scenario groups in seven isolated contexts,
16 sensitive-traffic probes with zero forbidden cache entries, and canonical-only
Auth availability without sign-in. Node 24.21.0, pnpm 10.27.0, Playwright 1.64.1,
desktop Chromium 156.0.8078.4. The accepted head and merge share an identical tree
and accepted-head CI passed; the separate merge CI cancellation/deadline failure
(447/448), unchanged successful attempt 3 and diagnostic local rerun (448/448)
remain historical evidence. PR #5 separately supplies the deterministic correction
above; the baseline reruns are not claimed to establish correctness.

## Task 3.3 PM acceptance (2026-10-21)

The PM reports acceptance at approximately **22:38 CEST**, **Europe/Berlin**, on
**iPhone 16 Pro**, **iOS 26.6.2**, **Chrome 155.0.8059.37**, with **English first**
in preferred languages, at **https://spendspacey.pages.dev**, baseline production
revision `fae9f51b489db95d672a4761cbd9ecef80b53de6`.
[PM behavioral evidence](../../../../docs/installable-offline-shell-verification.md#pm-physical-iphone-acceptance--task-33-accepted)
records the supplied installation/standalone, authentication, offline, localization
and reconnect passes without private account or Auth/storage details. Task 3.3 is
complete on this baseline; Task 3.2 evidence above is preserved.

## Corrected production and pending Task 3.4 (2026-10-21; rechecked 2026-10-22)

> **Historical acceptance contract, superseded 2026-10-28.** The following prior handoff is retained unchanged as history. It is not the current phone procedure or completion gate; use the fresh-install Task 3.4 above and the reset below.

Corrected merge `611994f4e0cae15b4b4ef4ada6659d10ac059a55`, accepted PR #5 head
`79dbbd485a922b560fc92f0cc1ef4c1b362c9286`, is verified at canonical production,
Pages deployment `a52aaac4-aa23-4417-8084-0183cf249c11`.
[Corrected production evidence](../../../../docs/installable-offline-shell-verification.md#corrected-production-replacement-verification-2026-10-21)
records 44/44 HTTP cases, exact corrected-main build/worker and 11-resource
inventory, 19/19 isolated browser scenario groups plus 2/2 hosted stop-order cases,
zero recovery SDK/provider execution, canonical-only Auth, and compatible immutable
baseline/corrected deployment bytes. The local deterministic matrix also passed
800 executions. Baseline Task 3.2 and PM Task 3.3 results above remain preserved.

The [numbered PM procedure](../../../../docs/installable-offline-shell.md#task-34--same-installed-app-lifecycle-acceptance)
covers only observable behavior in the same unopened installation, with exact
deployment verification outside the phone and separately authorized rollback/
restoration. The [evidence mapping](../../../../docs/installable-offline-shell-verification.md#task-34-evidence-contract-revision-2026-10-22)
assigns technical fault/ownership/repair/controller checks to existing representative
automated/hosted evidence; none is claimed as a physical-device pass. The PM
confirmed the installation remained unopened and reserves all phone testing and
approval. No developer tooling, phone-internal inspection or cache mutation is required.
Task 3.4 tests a safe normal reload control when available. Otherwise the accepted
combined route records physical reload as **unavailable/not tested**, never passed,
requires PM offline close-all/cold reopen in English and Brazilian Portuguese, and
uses mapped automated/browser evidence for separate reload behavior across update,
rollback and restoration. A phone waiting notice recorded **not observed** does not
alone block 3.4 after rendered-notice, waiting-worker and retention evidence passes.
A broken notice, forced navigation/reload, unusable UI or lost installation is a
failure requiring investigation. No phone developer tooling, cache mutation or
Auth/session/private-data inspection is allowed.
No device action, installed-device fault, production rollback or configuration
change was performed.

Progress: **8/9**. Only **Task 3.4 remains unchecked**. Keep this branch uncommitted
and unpushed with no closure PR until Task 3.4 is completed in the same installed
app. Preserve the safety copy/stash until final accepted closure is committed.
The change remains unarchived; later changes remain unchanged and planning-only.

## PM-approved bootstrap acceptance reset (2026-10-28)

The PM classifies the existing cross-experimental installation as a **legacy development installation with unrecoverable/indeterminate internal state**, outside release acceptance. Confirmed defects and all failed/inconclusive phone attempts remain recorded, not harmless or recovered. Historical Task 3.2/3.3 results above remain unchanged. Fresh acceptance is pinned to merge `2acaa960863024419cb1f22166cd1d9c66e8640b` and worker `124f91385e65e2db4091059a230ae9ccb2991cebff01d3047e29015269c1086b`; the contract still needs independent approval before legacy removal. Removal is destructive to that installation's local app state/authentication session, may require reauthentication, and is not a legacy recovery pass. The PM states no user-entered transactions or other offline business data currently exists.

Use the [fresh-install checklist](../../../../docs/installable-offline-shell.md#task-34--fresh-install-bootstrap-acceptance-2026-10-28) and [decision/evidence record](../../../../docs/installable-offline-shell-verification.md#pm-approved-bootstrap-acceptance-scope-reset-2026-10-28). Existing representative evidence may satisfy update, interrupted activation, repair, rollback, ownership, retention, integrity and privacy requirements; preserve its limitations and do not claim phone passes. No production rollback or migration of the abandoned experimental installation is a physical acceptance requirement. The next ordinary production update gets a normal PM smoke when it naturally occurs and does not block bootstrap completion.

Forward handoff to later transaction/offline-data work: user-entered transactions and synchronization state must not be stored in or depend on service-worker Cache Storage. Use durable application storage such as IndexedDB, versioned schema migrations, per-user isolation and an outbox/synchronization design; test that worker update/replacement cannot delete or alter financial data or synchronization state. Once user-entered offline data exists, clearing/reinstallation must never be an acceptable recovery mechanism. This adds no transaction/storage/synchronization implementation or additional checkbox to this shell phase. Later changes remain planning-only.

Progress remains **8/9**, Task **3.4 unchecked**. Independent contract review, legacy removal, fresh installation and exact new physical results are pending. Do not stage, commit, push, open a closure PR or archive. No runtime/test/production/Cloudflare/phone action accompanies this revision.

## Final acceptance and archival handoff (2026-10-29)

The PM approves the reset contract and supplies the completed fresh-install results in
[the final acceptance record](../../../../docs/installable-offline-shell-verification.md#task-34-fresh-install-pm-acceptance--approved-reset-completed-2026-10-29).
The no-safe-reload-control route is approved: physical reload is unavailable/not tested;
existing automated/real-worker reload evidence supplies that separate behavior alongside
physical English/Portuguese online/offline cold-reopen and reconnect passes. No physical
reload, waiting notice, legacy recovery or migration pass is invented. Baseline merge
`2acaa960863024419cb1f22166cd1d9c66e8640b`, worker
`124f91385e65e2db4091059a230ae9ccb2991cebff01d3047e29015269c1086b`.

**Final progress: 9/9. All tasks complete.** Historical 6/9 and 8/9 handoffs above remain
historical; the original dirty acceptance checkout stays untouched at 8/9 as a backup.
Sync the final capability specs and archive this completed change. No successor phase
starts, production/Cloudflare/phone action occurs or closure PR merge is authorized.
The forward financial-data durability/migration/isolation/outbox/preservation requirement
remains explicit. Keep the future ordinary-update PM smoke as a non-blocking follow-up.
