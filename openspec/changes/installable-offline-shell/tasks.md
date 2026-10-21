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
- [ ] 3.2 After review/CI and the accepted merge to `main`, publish through the existing Pages GitHub integration at the predecessor's production origin. Verify actual worker/manifest bytes/MIME, root scope, revalidation, native SPA fallback without top-level `404.html` or catch-all rewrites, callback no-store/no-referrer, and CSP compatibility. Check required assets exist and reject fallback HTML as a valid worker/chunk; do not require arbitrary missing paths to return 404 or add Cloudflare runtime/storage products. Record version/URL/header outcomes without claiming local preview proves host behavior.
- [ ] 3.3 Have the PM record the iPhone model and tested iOS/Google Chrome versions, open the production Pages URL in Chrome, use Share → Add to Home Screen, confirm the Spendspacey name/intended icon, and launch from the Home Screen. Verify standalone web-app presentation rather than an ordinary browser bookmark/tab. From that installed app, complete online sign-in/identity/sign-out, reach static readiness, and verify airplane-mode reload and full close/reopen, both languages, safe areas, touch controls, avatar fallbacks, and reconnect guidance. Record sanitized versions/URL/revision/pass-fail evidence; desktop Chromium cannot replace this manual PM gate and Safari-specific manual acceptance is not required.
- [ ] 3.4 Publish a compatible accepted replacement merged into `main`, or identify a previously accepted complete production replacement, at that same origin and verify the waiting notice plus close-all-windows/reopen transition in the same installed iPhone Home Screen app added through Chrome; verify worker-aware recovery/rollback against complete builds. Record tested iOS/Chrome versions and sanitized update evidence without adding any application data feature.

## Correction verification refinements

Tasks 1.3 and 2.2 were reopened after independent reproduction of Pages' entry redirect and destructive activation of a damaged waiting generation. Re-complete only with canonical-entry and durable-generation regressions. Refresh 1.2/3.1 evidence with the full suite. Required behavior includes offline next-load control after one complete online preparation; restart-safe committed selection; independently validated rollback lineage; no switching live windows; persisted, cancellable, bounded staging repair; uncertain-client and cross-worker-safe cleanup; corrupted/incompatible metadata rejection; three-generation retention and v1 → v2 → v1 rollback. Tasks 3.2–3.4 remain external acceptance gates.

## Workflow follow-up

- Review/accept the deployed installation milestone and synchronize its specs through the appropriate sync/archive workflow.
- Begin `online-profiles` only after manual iPhone/Chrome Home Screen installation/online/offline/update acceptance; profile availability is not an acceptance condition for this shell change.

## Approved document ownership correction

Implement immutable browser-client generation bindings and joint selection/delivery commits, writer fencing and read-back verification in a new namespace. Embed the independent localized recovery document with exact CSP hashes. Cover all interruption boundaries, explicit v2 cutover, conservative indefinite ownership retention, sealed cleanup, callback binding, bounded deliberate repair and absent-hint navigation. Re-complete 1.3/2.2 only with representative engine/browser evidence; refresh 1.2/3.1 and retest 2.1. Gates 3.2–3.4 remain unchecked.

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
[draft PR #5](https://github.com/dnstld/spendspacey/pull/5/checks); see the
[verification record](../../../docs/installable-offline-shell-verification.md).

Progress returns to **6/9**. Task 3.2 stays unchecked here; its production evidence
belongs only to the separate paused acceptance work until post-fix reconciliation.
Tasks 3.3/3.4 remain unchecked; the change is unarchived and later changes remain
planning-only. No production/external settings changed; reviewer approval is
required before merge.
