# Design

## Context

See [proposal.md](proposal.md), [installable-app](specs/installable-app/spec.md), and [auth delta](specs/user-auth/spec.md). This is change 2/4. Apply only after `deploy-auth-shell` is implemented, published, accepted on the phone, and its durable specs synchronized. Today's source has no PWA; that predecessor supplies Cloudflare Pages Free static delivery at its assigned production `*.pages.dev` origin, not a browser worker or profile query. Inherit GitHub integration, exact Node/pnpm pins, the two public application variables, production only from accepted changes merged into `main`, disabled new-user signups, exact local/production callbacks, and disabled preview authentication. No Cloudflare Functions, Workers, server runtime, Wrangler application, or Cloudflare database/storage products are introduced.

## Goals / Non-Goals

**Goals:** Make the hosted auth shell installable and launchable offline, with strict static caching and safe worker lifecycle.

**Non-Goals:** Current-user profile query, new private persistence, Dexie/IndexedDB, offline authentication, backend mutations, or synchronization. Existing SDK session storage is not replaced or copied.

## Decisions

### 1. Build-generated static precache with a custom worker

Use pinned `vite-plugin-pwa` 2.0.0 and Workbox 7.4.1 build discovery in `injectManifest` mode with an authored generation engine. Workbox supplies emitted revisions; the engine owns strict fetching, metadata, routing and isolated caches rather than Workbox's shared runtime precache. Avoid handwritten revision discovery.

Include canonical `/` generated from emitted `index.html`, every required hashed JS/CSS chunk (including the dynamically imported Supabase module), local font/Google button image, manifest, and named app icons. Use a reviewed build allowlist rather than unrestricted public globs; exclude maps, fixtures, environment files, worker script, API paths, and user data. Static fetches carry no application authorization.

Guard sensitive traffic before convenience precache routes. Exact approved static GETs use revisioned precache; same-origin root navigation uses the generic entry. Exact callback navigation can receive an uncached clone of that generic entry with no-store/no-referrer, never a stored callback response or callback-URL cache key. Supabase/API/OAuth, images from other origins, non-GET, and authorization-bearing requests use network without runtime cache writes. Other URLs/query variants use normal network behavior. Disable broad query ignoring/clean-URL expansion that widens the static allowlist. Fragments are scrubbed by the app, not the worker.

Register only in production; use a separate worker TypeScript context. Offline readiness requires complete precaching and an activated/controlling launch path, not just a visible page. Public Supabase URL/key in compiled static code are allowed public configuration, not cached private API responses. [Worker modes](https://vite-pwa-org.netlify.app/guide/inject-manifest), [Workbox revisions](https://developer.chrome.com/docs/workbox/modules/workbox-precaching)

### 2. Minimal installation identity

Use stable manifest id, root scope/start URL, Spendspacey name, standalone display, matching colors, 192/512 ordinary PNGs, a safe-padded maskable icon, and Apple touch icon/mobile metadata. Reuse the existing brand and keep zoom/safe areas usable. Use web standards and feature detection for service workers, storage, and standalone presentation; do not detect browsers or user-agent strings. Browser installation UI is enough; no custom install-prompt framework, screenshots, splash-image matrix, orientation lock, or app-store work. The app's guidance is localized; browser/OS UI is external. [Installability guidance](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable)

### 3. Authentication cannot block the offline shell

Render language selection and connection/retry feedback independently of an SDK restoration that needs network refresh. Keep subscribe-before-read, revision ordering, synchronous auth callbacks, URL scrubbing, and single-exchange ownership. An SDK-restored usable session can display its existing identity, but expired/unavailable restoration has no new offline identity guarantee.

Known-offline sign-in/sign-out show connection guidance; explicit retry remains possible because connectivity signals are hints. Do not queue or automatically replay OAuth, exchanges, or logout. Controlled offline callbacks scrub inputs and offer return/fresh-online-login recovery; callback failure alone does not erase a valid SDK session. Do not copy auth identity into an application store merely to fill the offline screen.

### 4. Document-generation ownership and independent recovery

The technical contract is document ownership, not observable physical window closure. An eligible new canonical navigation or reload can adopt repaired files. Every existing or possibly delivered document retains its immutable browser-client binding, including frozen/BFCache clients. Subresources use only that binding; missing/conflicting bindings fail closed with no network/global-selection substitution. Callback clones for the existing router-recognized callback forms also require binding before bytes, never promote, and never receive recovery HTML. This callback-only recognition never expands static cache URLs/keys; unknown native Pages documents remain unbound and their application assets fail closed.

Use a new v3 ownership namespace and isolated resource caches outside v2 deletion authority. Serialize every writer with an origin-wide lock; unavailable coordination means unavailable service. Immutable hash-linked ledger lineage supplies authority; reject forks, missing/corrupt commits, unsupported schemas and inconsistent revisions. Hashes detect corruption/identity, not authentication. Every writer checks epoch, parent, head and reservation revision immediately before persistence.

Persist a navigation reservation before application delivery. A single immutable logical commit contains the selection and incoming binding. Await its write, read it back, validate lineage/binding and revalidate the complete generation/exact response before releasing bytes. Confirmation adds evidence, never changes ownership. Reserved operations can be abandoned only by a durable fence. Bound operations remain possibly delivered regardless of confirmation/handled; ambiguity protects all referenced generations indefinitely but does not veto a different new document.

States are Reserved, Bound for delivery, Recovery-bound, Confirmed, Delivery failed (positive pre-release evidence only), Ambiguous and Retired/abandoned. Never infer retirement from time, absence, missing replies, visibility, unload, pagehide or handled. Browser lookups/enumeration happen outside the selection lock; delayed observations carry epoch/head/binding checks. Status is read-only after the functional event's bounded activation reconciliation. No optional navigation hints, claim, forced activation or automatic reload.

Embed the recovery document, both locales and exact CSP hashes in worker implementation identity. Only exact query-free same-origin authorization-free GET navigation to `/` can receive it. It has no generation-cache entry or external dependency and never fetches HTML, initializes Auth, reads session storage or executes the SDK. Use no-store/no-referrer/nosniff/frame denial, default-src none, hashed script/style, connect-src none, base-uri/form-action/frame-ancestors none. Only the established locale key is read, with supported-value validation and storage-failure handling. Messages use strict bounded schemas, actual event.source/origin, request/worker/binding correlation; caller IDs, URLs and status claims confer no authority. Missing identity/durability gives guidance-only recovery.

Persist deliberate repair attempts before static network requests. One shared flight, separate staging, exact canonical inventory, independent MIME/integrity checks and a cancelling deadline apply. Page timeout does not release the worker lock. Duplicate/spent IDs do not restart work; reload/restart/reconnect/status never repair. Outcomes distinguish offline hint, running/busy, failed, timed out, cancelled, unknown/interrupted, spent and verified pending adoption. Missing durable outcome is unknown. Revalidate completed staging at the next eligible navigation; never switch the existing document. Guidance says reopen or reload; physical observable behavior remains 3.4 while exact repaired-file ownership/adoption is representative evidence.

Repair terminal decisions use first-effective authorized-stop ordering. Each flight has
private worker-owned cancellation/deadline sentinel identities and an immutable terminal
decision. Both abort paths reject an already-aborted signal or frozen decision; cancellation
repeats these checks after its awaited request append/read-back, immediately before abort.
Only the actual first abort establishes stop priority, including callbacks runnable in one
turn. A persisted cancellation record authorizes a request; it is not a terminal outcome.
Classify only by identity of `controller.signal.reason`, never thrown error names.

At catch entry, synchronously freeze cancellation, timeout or ordinary failure before any
awaited lock, snapshot or persistence. Ordinary failure priority starts at that observation,
not an inferred earlier network event. On success, retain fill → persisted/validated
completion → completion read-back/lineage → writer lock → final snapshot → abort check.
At that check freeze complete only if no authorized abort won. Disarm the deadline at
selection and again in finally; stale callbacks still check both guards. A deadline during
the final snapshot can win; one during finish persistence cannot replace selected success.

Selection and persistence success are separate. Persist only the frozen decision once;
failed success persistence cannot fall through into a failed replacement finish. If finish
write/read-back/lineage cannot be validated, this operation returns unknown even if bytes
might have been written. Later STATUS/restart can independently validate the existing finish.
Missing finish remains unknown, including when cancellation evidence exists. Never infer a
definitive outcome from transient memory or reconstruct a replacement record. Keep the
outer repair Web Lock through persistence/read-back settlement and final result determination;
hanging persistence retains the lock, rejection may settle unknown, and the attempt stays
spent. Incomplete staging retention, cleanup and adoption rules are unchanged.

Before cleanup persist a deletion seal for exact proven-unreferenced generations. Sealed resources cannot gain any selection, binding, repair/import source or reservation reference. Resume deletion idempotently after restart. All pins (including unconfirmed/ambiguous), selected/fallback, legacy, staging and in-flight references protect resources; inclusive browser observations only add conservative deferral. Never expire ownership for quota/cache-count targets.

Cut over actual 069dbc50 v2 data only through its explicit validator: descriptors, worker/configuration identities, lineage, completions and repair history. Preserve spent/unknown history and persist a validated cutover. Copy older generations into new-owned caches and independently verify them before usable completion; interrupted imports are unselected. Leave legacy caches untouched. Do not guess bindings for pre-pin clients; fail their unbound subresources closed and require new navigation. Reject legacy privileged messages and unsupported newer metadata. Older static bytes under the corrected worker are distinct from redeploying an obsolete worker implementation. An imported v2 UI cannot speak the corrected control protocol: keep its verified rollback selected/protected, but use embedded recovery for canonical entry and a safely bound selected clone for callbacks. Refresh legacy repair history at ownership transfer and before repair, sharing the old/new single-flight lock so waiting-period attempts remain spent.

### 5. Tests and phone acceptance belong here

Add build checks for manifest/icon dimensions and required precache chunks, plus Chromium manifest/installability diagnostics. Wait explicitly for worker activation/control, disable ordinary HTTP-cache assistance, then test offline reload and new page in both locales. Audit every worker cache after synthetic auth/avatar traffic for private markers and sensitive URL keys. Do not use Lighthouse's deprecated PWA score or an install-prompt event as the gate.

Use the actual generation engine with Cache Storage/Web Lock adapters for interruption, three-generation retention, concurrency, untrusted metadata and bounded repair tests. Use real two-build Chromium workers for Pages canonicalization, waiting corruption, restart, complete replacement, repair pinning and v1 → v2 → v1 rollback. Update installation/worker-aware rollback docs without a new browser matrix or host secrets in PR CI.

The required manual target is **iPhone with Google Chrome**. The PM records the iPhone model, tested iOS and Chrome versions, production Pages URL, and deployed/update revisions. Open that production URL in Chrome, use its Share menu → Add to Home Screen, confirm the Spendspacey name and intended icon, then launch from the Home Screen. Confirm standalone web-app presentation; an icon that opens an ordinary browser tab/bookmark does not pass. [Chrome's iPhone installation guidance](https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DiOS&hl=en)

### PM acceptance-scope reset — 2026-10-28

The PM approved a bootstrap acceptance reset because the existing installation spans experimental releases with confirmed service-worker defects. Classify it as a **legacy development installation with unrecoverable/indeterminate internal state**, outside the release-acceptance baseline. This is an acceptance-scope decision, not proof of a specific hidden state, successful recovery, or a claim that the defects were harmless. Preserve every historical phone observation/diagnosis and Task 3.2/3.3 result exactly in the [verification record](../../../../docs/installable-offline-shell-verification.md#pm-approved-bootstrap-acceptance-scope-reset-2026-10-28).

Task 3.4 instead uses a **fresh installation** from canonical `https://spendspacey.pages.dev` through Chrome on the existing iPhone, baseline merge `2acaa960863024419cb1f22166cd1d9c66e8640b`, worker `124f91385e65e2db4091059a230ae9ccb2991cebff01d3047e29015269c1086b`. Verify release identity outside the phone; do not infer it from appearance or inspect phone internals. This planning revision does not reverify production or authorize a phone action.

Independent approval of this revised contract is required before the PM may remove the legacy installation. Removal clears that installation's local app state and authentication session; reauthentication may be required. The PM states that Spendspacey currently contains no user-entered transactions or other offline business data. Record removal and its data/session consequences honestly, never as evidence of legacy recovery. No migration, physical repair, corruption/fault injection or rollback of pre-baseline experimental installations is required for Task 3.4.

Only the PM performs and approves the fresh physical checklist: correct name/icon and standalone launch; normal online shell; sign-in/sign-out only if needed to confirm the existing Auth shell; English/Brazilian Portuguese selection and persistence; online reload and close/reopen; offline reload and full close/reopen in both languages after complete online preparation; and reconnect without loops, recovery, installation loss or forced navigation. Prime the fresh installed context itself. Use only safe normal reload controls; if unavailable, record unavailable/not tested, never passed, and use the approved combined route: physical bilingual cold-reopen passes plus separate automated/real-worker reload evidence. Do not use developer tooling to manufacture a reload result. Safari-specific manual acceptance is not required, and no profiles are required.

Existing applicable deterministic, real-worker, Chromium, supplemental WebKit, hosted and production evidence may satisfy update, interrupted activation, repair, rollback, ownership, retention, integrity and privacy requirements. Keep their coverage/limitations explicit and record technical subcases as **not manually executed on the physical iPhone; covered by representative automated/hosted evidence**, never as phone passes. Technical product guarantees remain mandatory. No phone developer tooling, cache mutation, worker/controller identity inspection, deliberate corruption, repair fault injection, production rollback or abandoned-installation migration is required. No Auth/session/private-data inspection or export is allowed.

A future ordinary production update receives a normal PM smoke check when it naturally occurs; waiting/update behavior remains covered by representative evidence for this bootstrap phase. That future smoke does not block bootstrap completion or require an artificial release/rollback now. Task 3.4 may complete only after independent contract approval, recorded legacy removal, fresh baseline installation, all required physical checks passing and exact sanitized results recorded. The PM supplied the completed fresh-install results on 2026-10-29, including the approved unavailable-reload route; final progress is **9/9**, with no physical reload pass inferred. Changes 3/4 inherit the newly accepted installation context, not the abandoned experimental one.

## Risks / Trade-offs

- A Home Screen icon is only a browser shortcut -> explicitly verify standalone launch on the iPhone installed through Chrome; keep desktop Chromium offline checks as supplemental evidence.
- Auth opens outside the installed context and loses PKCE state -> start the online smoke from the Home Screen app and verify successful return there on the actual device; do not accept a separate signed-in Chrome tab as installed-app success.
- Worker caches accidentally capture auth/avatars -> allowlist and negative cache inspection rather than broad runtime recipes.
- Mixed build chunks or forced updates interrupt PKCE -> complete precache, waiting activation, correct hosted headers, and no forced reload.
- Browser eviction or unsupported workers remove readiness -> honest online-only fallback and documented reconnect/recovery.

## Migration Plan

Verify predecessor acceptance/spec synchronization, implement/test/review the PWA slice, merge accepted changes into `main`, and let the existing Pages GitHub integration deploy at the same assigned production URL. Verify actual Pages worker headers/native fallback and complete the revised fresh-install phone acceptance, with representative technical lifecycle evidence. A naturally occurring future-update PM smoke is not a bootstrap gate. Optional previews retain disabled Google sign-in/callback exchange; production signups remain disabled. This plan itself changes no app code or host.

Rollback must serve a compatible recovery worker at the same URL and restore a complete build; reverting files alone does not unregister installed workers. Do not delete SDK/locale storage during static repair. Only after this milestone passes should [online-profiles](../../online-profiles/proposal.md) begin.

## Execution prerequisites and evidence

The iPhone/Google Chrome manual target and installation flow are decided. Record actual iOS/Chrome versions, iPhone model, production URL, deployed/update revisions, and sanitized PM outcomes during execution. Cloudflare/GitHub access and the assigned hostname are inherited execution prerequisites. No unresolved product decision remains; Safari-specific manual acceptance is not required.

## Restart-resumable activation correction

Browser activation may complete without a successful activation handler. On eligible functional fetch/message events, use bounded coalesced validation under the existing writer lock, independently of the activation-event promise. Compare native `self.serviceWorker` with `self.registration.active`, accepting only activating/activated states. Unsupported identity proof fails closed; matching URLs/build hashes are insufficient. Installing/waiting workers may answer read-only HELLO with preparation status but no document authority.

For different-owner transfer, derive candidates completion-first from the entire validated snapshot under the exclusive writer lock: pair each durable completion with its installation reservation for this worker/current epoch, excluding consumed reservations. Require exactly one pair before checking resource health. Separately require that pair’s reservation to be the latest installation reservation in the epoch, including incomplete reservations and other workers. Multiple completed pairs and superseded reservations fail closed; older incomplete reservations alone do not make the unique completed latest pair ambiguous. Revalidate candidate and compatible predecessor bytes completely. Append the existing activation record only after full parent/head/epoch validation, checking native active authority again immediately before Cache.put. Under persistent failure the shared validation budget and cooldown bound attempts; no network repair or destructive cleanup occurs.

An already committed owner restores its durable epoch without another activation or selection change. When native active authority and the committed same-build owner, epoch, lineage, selection and resources independently validate, restore the existing owner without transferring ownership. Unconsumed same-build installations are unrelated quarantined reservations, not evidence of registration identity. One or multiple reservations must not block valid owner restoration; retain them and their resources and defer cleanup. Never consume, associate or select one during restoration. A genuine rollback uses a fresh reservation from the current epoch and a distinct replacement build. No v3 schema/protocol change or migration is introduced. Existing lineage, immutable bindings, repair attempts, spent outcomes, cleanup seals and legacy cutover history remain authoritative; absent/corrupt/forked/incompatible/unsupported metadata cannot be reconstructed from resource bytes.

Recovery reacquires the current controller and freshly handshakes before deliberate status/repair/cancel; controller changes invalidate correlations and obsolete replies. No mutation is replayed and unbound documents remain unbound. Neutral bilingual copy distinguishes unavailable verification/activation from resource-verification failure without asserting unproven resource loss. Keep exact script/style CSP hashes and no external code, Auth or private storage access.

The activation interruption is a confirmed representative defect and leading hypothesis for the phone failure, not proof of its exact trigger. Preserve the open phone document; implementation and preview verification authorize no phone or production action.

**Historical implementation evidence contract, superseded by the 2026-10-28 reset above:**

Physical Task 3.4 covers only PM-observed behavior in the same Home Screen installation: waiting notice if observable, usable existing document, close-all/reopen adoption, online use, complete offline close-all/cold reopen in English and Brazilian Portuguese, and absence of unexpected retry, forced reload or installation loss. Test an available safe normal reload control normally. If none exists, record physical reload as `unavailable/not tested`, never passed; combine bilingual physical offline cold-reopen evidence with the separate mapped automated/browser reload evidence. A waiting notice `not observed` does not alone block acceptance after rendered bilingual notice, waiting-worker and retention evidence pass. A broken notice, forced navigation/reload, unusable UI or lost installation is a failure requiring investigation.

Fault injection, exact generation/controller ownership, repair ordering, failed/offline/successful repair, staging isolation and repaired-file adoption are **not manually executed on the physical iPhone; covered by representative automated/hosted evidence**. The product guarantees remain unchanged; only these subcases' evidence source changes. No phone developer tooling, cache mutation, cookies/tokens/sessions/account-storage inspection, callback inputs, API responses or private-data inspection/export is permitted. Compatible production rollback/restoration require separate explicit authorization and exact release verification outside the phone. Neither deployment nor phone interaction is authorized by this implementation.

## Retryable startup and committed-owner restoration correction

Immutable inventory/configuration validation is cached separately from mutable-state validation. Rejected CacheStorage/Cache operations and response-stream reads are typed at the access boundary, not classified by exception messages. A complete subsequent validation is required before authority. Invalid durable metadata (missing established ledger, malformed/oversized records, unsupported namespace/schema, incompatible configuration, forked lineage) latches fail-closed for this global; resource bytes cannot reconstruct metadata. Missing/corrupt resources are independently detected: they cannot authorize application delivery but must preserve existing safely bound recovery/repair eligibility.

One shared validation flight per global holds the existing exclusive writer lock, covering metadata, legacy lineage and active-owner/transfer/resource revalidation. Two failed flights are allowed per burst; a later eligible event may begin a new burst after a five-second cooldown. There is no timer-driven retry, recursive failure retry, polling, per-resource fanout, trust reset or automatic repair/reload. A two-second caller deadline returns neutral unavailable recovery, but retains the original flight and lock until the underlying operation settles. Late success cannot publish authority; stale deadline callbacks cannot revoke a completed newer flight. Guards immediately before writes and before application delivery fence expired continuations and native authority loss. An uncertain activation write is resolved by a fresh full read: committed ownership restores the same epoch, never appends a duplicate activation or reverts repair/adoption.

Native authority additionally requires the expected origin/root registration scope. `self.registration.active === self.serviceWorker` compares native same-realm instances in activating/activated states. URLs and build equality remain insufficient. A restored committed owner creates no registration/reservation association and consumes no reservation. Different-owner transfer retains the unique completed/latest current-epoch installation rule plus immediate head/epoch/authority fencing. No schema, protocol or ledger migration is needed. Existing bindings, document pins, repair/spent history, seals, retained generations and rollback/cutover records survive unchanged. Cleanup defers while any unconsumed installation remains quarantined.

Recovery distinguishes temporary access/activation unavailability from invalid durable validation and positively verified resource loss in exact English and Brazilian Portuguese. Existing v3 `unavailable` and unbound `blocked` statuses convey these distinctions without a wire-format change; bound `blocked` remains unauthorized. No copy promises that reopening generally fixes unavailable state. Uncontrolled preparation is explicitly unconfirmed; only the current controller with an independently verified application binding can report ready. Recovery's fresh-controller handshake, no replay, disabled unauthorized repair, restrictive hashed CSP and zero Auth/private-data access are unchanged.

Representative regressions require application availability after healthy retained-state restoration, not merely another recovery page. The bilingual unbound → reload still unbound → close/reopen application → locale change → second cold reopen sequence is tested against the immutable pre-correction build and the corrected build with one synthetic startup-read rejection. These reproduce defects, not the phone's hidden trigger. Physical evidence remains outside this implementation; no production change or phone action follows from automated success.

## Completion-first activation eligibility correction

A failed install followed by an identical-build successful retry leaves older incomplete reservations and one completed latest installation. The earlier reservation-first uniqueness check incorrectly refused this valid transfer. Use the pair’s reservation ID for the activation association and its completion ID for candidate resource selection. All records, including incomplete or malformed records, remain subject to full-lineage validation before candidate construction; never omit invalid history to obtain uniqueness.

A persisted-but-unacknowledged completion is a durable fact after authoritative full revalidation. A failed write with no persisted completion adds no candidate; a written completion whose read-back/acknowledgement failed does. A later retry producing a second completed pair remains ambiguous, even if one candidate’s resources are damaged. Never synthesize completion from resource bytes or choose the newest/healthiest completion. An older completed candidate followed by a newer incomplete reservation remains superseded, including a delayed older completion written after the newer reservation. These states are outside this narrow availability correction.

Keep incomplete reservations and their protected resources quarantined and defer cleanup. Committed-owner restoration remains independent and unchanged; it neither transfers ownership nor consumes/associates reservations. Preserve native active-instance proof, lock and immediate head/parent/epoch fences, activation read-back, candidate/predecessor verification and retention, exact browser-issued binding before application bytes, repair/spent history, deletion seals, rollback/cutover history and all Auth/cache privacy boundaries. No schema, protocol, migration, dependency, Auth, recovery copy/CSP or cleanup-policy change is required.

Regression evidence separates candidate count from supersession and durable completion from acknowledgement, then checks authority loss, concurrent/uncertain commits, restart and bilingual online/offline bound application availability. Archived `967a2b6` provides the negative real-worker control for failed-install → identical-worker retry → cold launch. This representative defect does not establish the phone’s hidden cause or solve every historical durable state. No production or phone action is authorized.

## Forward requirement — later transaction/offline-data work

User-entered transactions and synchronization state must not be stored in or depend on service-worker Cache Storage. The later transaction/offline-data phase must use durable application storage such as IndexedDB, versioned schema migrations, per-user isolation and an outbox/synchronization design. Its tests must prove that service-worker update/replacement does not delete or alter financial data or synchronization state. Once user-entered offline data exists, clearing or reinstalling must never be presented as an acceptable recovery mechanism. This is a handoff requirement for that later work, not transactions, new storage, synchronization or implementation tasks in the current shell phase. The legacy-removal exception above relies on the present absence of such data.

## Accepted bootstrap closure (2026-10-29)

The PM supplies the approved reset and fresh-install passes in the verification record:
legacy deletion/local-state-session relinquishment (not provider logout or recovery),
canonical installation/name/icon/standalone launch, boolean-only reauthentication,
bilingual online/offline cold reopen and reconnect. No safe normal reload control exists;
physical reload remains unavailable/not tested and the approved combined evidence route
supplies separate reload coverage. All nine tasks are complete. Historical failed and
inconclusive attempts remain unchanged; no experimental-installation migration is claimed.
Archive and synchronize this completed change without changing runtime production code,
production/Cloudflare settings or the phone, and without starting the next product phase.
