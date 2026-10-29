# Installable offline shell

This is change 2/4, `installable-offline-shell`, on top of the archived, synchronized
and accepted `deploy-auth-shell`. The original production/main baseline was
`d786441215a1c9e6fb2d048262fc4d09b5d79e44`.
[Predecessor acceptance](deploy-auth-shell-acceptance.md) remains authoritative for
provider configuration, disabled signups and canonical authentication. This change
adds only a static PWA shell. There are no profile requests, database changes,
private offline stores, queues, Functions, Workers, domains or runtime services.

> **Accepted bootstrap contract — PM decision 2026-10-28; completed 2026-10-29 (9/9).** Use the [fresh-install Task 3.4 checklist](#task-34--fresh-install-bootstrap-acceptance-2026-10-28), baseline merge `2acaa960863024419cb1f22166cd1d9c66e8640b`, worker `124f91385e65e2db4091059a230ae9ccb2991cebff01d3047e29015269c1086b`. Earlier same-installation recovery/update/rollback procedures are retained as superseded history, not current instructions. No phone action is authorized during this planning revision.

## Install and prepare

After accepted review, CI and merge/publication through the existing Pages
integration, open **https://spendspacey.pages.dev** using **Google Chrome on an
iPhone**. Choose **Share → Add to Home Screen**, confirm **Spendspacey** and its
green s-dot icon, then launch from the Home Screen. Confirm standalone presentation.
Prime that installed context itself online: a Chrome tab may use separate storage.

“Prepared for offline verification” means saved files were verified but this
document is not confirmed ready. Only a controlled document with a verified
persisted binding can report readiness. A later navigation must independently
verify control, ownership and resources; preparation alone does not guarantee
that reload or reopening will succeed. There is no `clients.claim()`, forced activation or
automatic reload. Controlled readiness requires persisted document ownership and a
verified complete inventory. For the fresh-install checklist, test offline reload
with a safe normal control and full cold reopen in both English and Brazilian Portuguese.
If no safe reload control exists, record unavailable/not tested and use the approved
combined route: bilingual physical cold reopen plus separate automated/real-worker
reload evidence. Do not use phone developer tooling or invent a physical reload pass. Locale detection/preference/fallback, zoom,
safe areas and existing authentication feedback remain available.

The stable manifest id/start/scope are `/`. Ordinary 192/512 PNGs, an opaque maskable
512 PNG with its mark inside the central 80% circle, and a 180 PNG Apple icon derive
from the existing mark. `node scripts/generate-icons.mjs` reproduces the icons.
There is no custom installation prompt or user-agent detection.

A first-ever offline visit has no installed worker and may show a browser network
error. Evicted/unavailable Cache Storage, unsupported service workers, missing
origin-wide serialization and exhausted metadata bounds cannot promise readiness.
The existing ordinary online application works without worker support. A worker
that can run still supplies independent recovery guidance for eligible `/` even
when saved application code cannot execute. Storage loss is unavailable state,
not permission to reset a repair budget or guess ownership.

## Document ownership and static routing

The contract is **document-generation ownership**. An eligible new canonical
navigation or reload can adopt repaired files. Every existing or possibly delivered
document retains its immutable generation binding. “Reload or reopen” creates a new
eligible document; physical OS-window closure is not claimed as browser-verifiable.
Frozen/BFCache-restored documents keep their original binding. Selection affects
future documents only. No current window is automatically reloaded or switched.

`index.html` supplies emitted revision, SHA-256, size and MIME for canonical `/`.
`/index.html` is not an inventory URL. Pages-style 308 canonicalization is emulated
by the browser fixture. Downloads use exact URLs, `credentials: omit`,
`redirect: error`, expected MIME and integrity. There is no query ignoring,
clean-URL expansion, arbitrary HTML fallback or runtime cache.

Application asset requests require their browser-issued `clientId` and a persisted
usable generation binding. Missing, unsupported, conflicting or unusable ownership
fails closed, without network/global-selection fallback or borrowing another
version's chunks. Only the bound generation's exact verified inventory is routed.
Same-origin static SDK bytes may be prepared/repaired; that does not execute Auth.

Non-GET, cross-origin, authorization-bearing, API, Supabase, Google, OAuth, token,
session/user/profile and sensitive requests bypass caching. Query variants and
unknown paths have no worker fallback. Router-recognized `/auth/callback` navigation (including its existing case, trailing-slash and encoded-segment forms) can receive
only a verified selected `/` clone, with its own committed binding before bytes and
first subresource, `no-store` and `no-referrer`. It cannot promote selection or
receive recovery HTML. The callback URL and OAuth query/fragment are never persisted
or cached. Without a safe document/binding it fails closed; application callback
cleanup is not claimed unless the application actually executes.

`/sw.js` remains stable/root scoped, JavaScript, revalidated and delivered with
`Service-Worker-Allowed: /`; registration uses `updateViaCache: none`. Existing
Pages exact immutable asset rules, callback headers, manifest MIME, CSP, native SPA
fallback and absence of a top-level 404/catch-all rewrite are retained. Update
checks coalesce launch/online foreground/reconnect with one flight and a 30-second
floor. A newly installed worker waits normally; close other app documents and
reopen to permit the browser's normal activation. Reloading alone is not a promise
to activate a waiting worker. Once active, repair adoption can occur on reload.

## Ledger, evidence and interruptions

Resources live in `spendspacey-static-resource-v3-<instance>`. Discovery reads only
the reserved `spendspacey-static-ownership-v3` namespace (plus the explicit v2
cutover validator). Cache iteration order/timestamps/prefix guesses never select a
generation. Unsupported newer ownership namespaces stop mutation. Bounded strict
schemas validate origin/scope, compatibility, producer/build identity, mappings,
MIME, integrity, completions and immutable lineage. Configuration identity is a
digest; no public keys, credentials or private values appear in metadata. Hashes
are identity/corruption checks, not authentication or durability guarantees.
Metadata is never fetched, routed as a response or used as a repair URL.

All writers share the origin-wide `spendspacey-static-v2` Web Lock, including the
old worker during explicit copy. No worker-local lock fallback is authoritative.
Resources precede verified completion. Selection and incoming ownership then form
**one immutable joint delivery commit**, awaited, read back and lineage-validated
before independently revalidating inventory/exact bytes and releasing application
code. Immutable parent/sequence/epoch/owner fencing rejects forks, missing links,
duplicate ownership and stale continuations. There is no authoritative mutable
head pointer. Restart restores the committed selection, never the worker's own
build by default. Selected static generation and worker build identity are separate.

| State              | Durable evidence and service                                                                                     | Protection and progress                                                                                                               |
| ------------------ | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Reserved           | Browser resulting-client ID, random navigation ID, mode and references; no application delivery commit yet       | References protected. A durable abandonment fence can prevent every stale continuation; a later valid navigation can progress.        |
| Bound for delivery | One joint entry includes reservation, exact client, generation, prior selection revision and resulting selection | Persistence/read-back/full verification must precede bytes. Binding is immutable and already routes subresources before confirmation. |
| Recovery-bound     | Joint entry binds the exact client to embedded recovery, not a resource generation                               | Only validated messages from that client can deliberately repair. No application chunk is routed for it.                              |
| Confirmed          | Actual bound client sends a schema/correlation/source-validated confirmation                                     | Adds positive execution evidence, never rebinding or retirement.                                                                      |
| Delivery failed    | Never-bound reservation receives a durable pre-delivery abandonment fence                                        | No application bytes could have been released through that reservation. References can be released; stale commits remain forbidden.   |
| Ambiguous          | A bound delivery has no positive execution confirmation, or response handling/restart leaves receipt unknown     | Potentially delivered forever. Protect its generation; do not veto other new documents. `handled` failure is not proof of zero bytes. |
| Retired/abandoned  | Only never-bound reservations have authoritative durable abandonment                                             | Possibly delivered documents have no portable retirement certificate here and remain protected indefinitely.                          |

Missing `clients.get`, enumeration or replies, elapsed time, visibility, unload,
pagehide and `FetchEvent.handled` are never closure evidence. A confirmed client
missing from enumeration can be frozen or in BFCache. No lookup is needed to
release a correctly bound response. Cleanup observations occur outside the decision
lock and carry a head/version recheck before mutation; a hanging observation cannot
block navigation/status/repair. No optional Chromium navigation hints are used.

| Interruption boundary                      | Durable state and restart behavior                                                                                                   |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| Before reservation                         | No new ownership, no application bytes; a new valid navigation proceeds.                                                             |
| Reservation → joint commit                 | Never-bound references remain protected until a durable fence; later navigation fences and proceeds.                                 |
| Joint commit → returning/handling response | Binding is potentially delivered, even on read-back/storage failure; retain it and fail delivery safely.                             |
| Handling → confirmation                    | No readiness/closure inferred from `handled`; exact persisted pin routes assets or fails closed.                                     |
| Confirmation / subresource                 | Ownership stays fixed across restart, visibility and BFCache changes. Damaged pinned resources fail closed.                          |
| Selection promotion                        | The joint entry either exists/read-validates or conveys no authority. A later navigation restores the unique lineage.                |
| Repair completion/outcome                  | A completion without a durable successful finish stays unselected. A missing outcome is unknown/interrupted and spent.               |
| Cutover/copy                               | Validated history persists; interrupted copies are unusable and legacy caches remain untouched.                                      |
| Seal/delete                                | The persisted exact exclusion survives restart. Resume idempotently only while a retained usable generation independently validates. |

Activation revalidates the entire candidate. A damaged waiting build retains/selects
an independently complete predecessor; neither usable means recovery, deleting
neither. A fresh root navigation may select an intact rollback generation; existing
pins remain unchanged. Normal worker waiting rules still apply to actual releases.

## Recovery from a cold start

If any required selected resource is missing/corrupt, including the lazy SDK,
canonical document or primary bootstrap, navigate/reload **exact query-free `/`**.
Online and offline it can show the worker-embedded recovery surface without a
network HTML request or damaged application dependency. If an intact fallback is
selected, the application stays usable; its guarded **Open recovery / Abrir
recuperação** action persists a request for an independent recovery document on the
next canonical navigation. That request cannot start repair. Callback/Auth-pending
application UI does not expose it; callback-bound clients cannot request it.

Recovery reads only `spendspacey.locale`, accepts `en`/`pt-BR`, catches storage
failures and uses the existing device-language/English fallback rules. It never
imports the SDK, constructs an Auth client, reads SDK/session storage or displays
identity. Its literal HTML/translations/scripts/styles and exact CSP hashes are
part of the worker implementation identity. It is not in any generation cache.
Policy is HTML UTF-8, no-store, no-referrer, nosniff, frame denial, default-src none,
hashed script/style only, connect-src none, base-uri none, form-action none and
frame-ancestors none. No external dependency, inline handler or reporting endpoint
exists. Only fixed translations/`textContent` render status.

1. Read the offline hint. Reconnect if needed; this never starts repair.
2. Choose **Repair online / Reparar com conexão** deliberately. Before network
   activity the worker persists a unique spent attempt and protected staging owner.
3. The page distinguishes running/busy, failed, deadline cancellation, deliberate
   cancellation, unknown/interrupted, spent and verified pending adoption. Read-only
   status polling does not reset a budget. Page timeout does not release the worker
   lock. Cancellation is offered after a persisted attempt is observed running;
   replayed cancellation IDs cannot cancel a later attempt.
4. On success, **reload or reopen Spendspacey**. A new canonical document revalidates
   staging, then atomically commits its selection and binding. Other documents keep
   their files. Success never reloads or mutates the recovery page automatically.
5. Failure/interruption leaves staging unselected and current/fallback protected.
   Only another deliberate action creates another attempt. Duplicate delivery,
   reload, restart, status or reconnect never retries automatically.

Repair has one origin-wide flight and a cancelling 12-second deadline. It copies or
downloads only approved same-origin static inventory, with exact MIME/integrity and
no credentials/redirects. It cannot fetch Auth/API/Google/Supabase endpoints; an
approved lazy SDK chunk may be downloaded only as verified bytes. Corrupt completed
staging cannot be adopted and may be replaced by a new deliberate attempt. Missing
browser identity gives guidance only, with no repair/confirmation/selection/cleanup
authority. Missing/unsupported/corrupt metadata disables repair rather than guessing.

## Cleanup and upgrade

Selected plus one independently verified compatible fallback is a retention target,
not a cache limit. Every confirmed, unconfirmed or ambiguous binding protects its
resources indefinitely. Inclusive window enumeration adds deferral for controlled,
uncontrolled, hidden, unknown and newly navigating clients. Installation, waiting,
import, staging and repair reservations also protect references. No ownership expires
for cache count or quota. Bounds are 4,096 records, 64 KiB per record, 8 MiB metadata,
and 11–128 inventory entries with 2 MiB/resource and 8 MiB/inventory. Exhaustion is
unavailable state. Conservative retention can consume storage indefinitely.

Before deleting an exact proven-unreferenced set, persist and read-validate a seal.
Sealed generations can never receive selection, document bindings, new reservation,
repair-source or import references. Seal/reference races serialize. Restart resumes
only sealed deletion idempotently; it does not guess ownership or sweep prefixes.
Legacy cutover evidence conservatively prevents new cleanup seals. SDK/locale and
unrelated caches are untouched. Automatic destructive quota recovery does not exist.

The actual `069dbc50` v2 validator checks descriptors, immutable selection lineage,
producer/build/configuration identity, completion and repair history. A validated
cutover records spent/unknown attempts before copying required older resources into
new-owned caches outside old deletion authority. Copies independently verify every
byte before usable completion. Interrupted/damaged copies remain unusable. Original
legacy caches, including untrusted `b9c61fe` shared caches, remain untouched.
Pre-pin clients receive no manufactured bindings and legacy privileged messages are
rejected. New eligible navigation establishes corrected ownership; unprovable old
subresources fail closed. When rollback uses imported v2 bytes, canonical entry
uses embedded recovery because that old UI cannot speak the corrected control
protocol. Its verified static rollback remains selected/protected and may supply
a safely bound callback clone; deliberate repair prepares the corrected UI.
Legacy repair history is refreshed at ownership transfer and before repair under
the shared old/new repair lock, including attempts created while a worker waited. Unsupported newer metadata is not reinterpreted. Serving
verified older static bytes under corrected worker policy is different from
redeploying an older worker implementation.

## Worker-aware rollback and remaining acceptance

After reviewer acceptance, merge only a complete compatible replacement through the
existing Pages workflow. Roll back static content only with a worker implementing
the corrected ownership/security policy and full compatible inventory. Do not
redeploy the obsolete `069dbc50`/`b9c61fe` worker or manually clear SDK/locale/cache
storage to simulate success. Preserve normal waiting activation. The automated
v1 → v2 → v1 test uses complete synthetic builds under the corrected implementation;
it is not production or physical iPhone rollback evidence.

## Historical implementation runbook notes from merged PR #6–#8

These notes describe the implementation handoffs; their physical-device restrictions and unchecked-task statements are historical. The fresh-install acceptance and closure record below govern completion. Technical safety rules remain unchanged.

## Task 3.4 evidence contract

Physical Task 3.4 covers only PM-observed behavior in the same Home Screen installation: waiting notice if observable, usable existing document, close-all/reopen adoption, online use, complete offline close-all/cold reopen in English and Brazilian Portuguese, and absence of unexpected retry, forced reload or installation loss. Test an available safe normal reload control normally. If none exists, record physical reload as `unavailable/not tested`, never passed; combine bilingual physical offline cold-reopen evidence with the separate mapped automated/browser reload evidence. A waiting notice `not observed` does not alone block acceptance after rendered bilingual notice, waiting-worker and retention evidence pass. A broken notice, forced navigation/reload, unusable UI or lost installation is a failure requiring investigation.

Fault injection, exact generation/controller ownership, repair ordering, failed/offline/successful repair, staging isolation and repaired-file adoption are **not manually executed on the physical iPhone; covered by representative automated/hosted evidence**. The product guarantees remain unchanged; only these subcases' evidence source changes. No phone developer tooling, cache mutation, cookies/tokens/sessions/account-storage inspection, callback inputs, API responses or private-data inspection/export is permitted. Compatible production rollback/restoration require separate explicit authorization and exact release verification outside the phone. Neither deployment nor phone interaction is authorized by this implementation.

## Interrupted activation and later installation recovery

Activation-event completion is not a durability guarantee. The corrected worker independently reconciles native browser-active instance identity with the existing v3 ledger before functional events, under the original writer lock and parent/epoch fence. It restores an existing commit or transfers one uniquely eligible completed installation after complete candidate/predecessor verification. It never assigns a binding to an already unbound recovery document. Ambiguous different-owner transfer, unsupported native proof or invalid durable metadata remains unavailable; valid committed same-build restoration is permitted without transferring ownership or associating reservations; do not clear storage to bypass these checks.

For a later separately authorized recovery, first review/verify a distinct corrected worker release and its complete compatible inventory. Preserve the installed app and all origin data. A normal browser update can install that worker while an existing recovery document stays open; normal activation still waits for safe lifecycle conditions. New authorized document navigation can then acquire a fresh binding. No exact sequence or one-reload success is promised before representative migration and hosted checks pass. The old embedded document cannot acquire new script code in place; controller refresh in this correction applies to newly delivered recovery documents. No site-data clearing, reinstall, cache mutation or automatic repair is a recovery mechanism.

The physical document remains untouched pending separate PM authorization. A production rollback to either previous revision is not a demonstrated repair for stranded ownership and is not authorized.

The old recovery document's hash-only `script-src` also blocks script-initiated
`registration.update()` through CSP's worker-source fallback. Do not use developer
script execution or relax that policy to recover an existing installation.
The disposable archived-611994f regression instead demonstrates the browser's
normal navigation-triggered soft update while the original recovery stays open,
followed by normal activation and new-document adoption after all clients close.
Update scheduling remains browser-owned; this evidence is not a physical-phone
pass or permission to interact with the currently preserved document.

## Retryable startup and same-build owner restoration

Storage-access rejection is temporary unavailability, distinct from invalid build/configuration and invalid durable metadata. There is one validation flight per worker global under the exclusive writer lock. At most two failed attempts run before a five-second cooldown; only a later eligible event can retry. A two-second response deadline does not cancel the storage operation or release its lock/flight. Hanging/late continuations cannot publish authority or start parallel mutation. No background retry, repair, reload, trust reset, or metadata reconstruction occurs.

A native browser-active worker at the expected origin/root scope can restore its completely validated committed same-build owner epoch/selection without another activation or any reservation association. Independently verify saved resources before application delivery. One/multiple pending same-build reservations are quarantined, retained and protected; cleanup defers. Different-owner transfer still requires unique completed/latest eligible provenance with current parent/head/epoch and immediate native-instance fencing. Repair/adoption selections, document pins/bindings, attempts/spent outcomes and rollback/cutover history remain intact. Missing/corrupt resource bytes never authorize application delivery; valid bound recovery retains deliberate repair eligibility. No schema/protocol migration occurs.

Temporary and invalid saved-state guidance is distinct in English and Brazilian Portuguese; proven resource loss has its own introduction. None promises reopening as a general remedy. Uncontrolled preparation cannot claim offline readiness. This implementation does not authorize any phone action, site-data clearing/reinstallation, production publication or rollback. Preserve the open phone document for independent recovery review. Representative startup/same-build reproductions do not prove the hidden physical trigger.

## Completion-first transfer diagnosis and verification

For a different committed owner, validate the entire ledger under the existing exclusive writer lock before constructing completion/reservation pairs for the running build/current epoch. Require exactly one unconsumed completed pair, independently of resource health. Then apply the separate latest-installation-reservation veto across all workers, including incomplete reservations. Use the pair’s reservation ID for activation and completion ID for resources; revalidate candidate/predecessor, current parent/head/epoch/native authority and activation read-back before any exact-client bound delivery. Existing committed-owner restoration is unchanged.

A resource-fill failure followed by a successful identical-worker retry may leave several incomplete older reservations and one completed latest pair: this is eligible. Preserve every reservation/resource and defer cleanup. An older completion followed by a newer incomplete reservation stays superseded, even if the older completion was persisted last. Two completed candidates stay ambiguous regardless of resource health. A persisted completion whose acknowledgement/read-back failed still counts after authoritative revalidation; no persisted completion means no pair. Do not infer completion from intact bytes, select the newest reservation, delete ambiguous history, clear data or reinstall.

Disposable regression fixtures cover these distinct gates and uncertain/delayed writes, lock retention, concurrency, authority/head/epoch loss, predecessor pins, repair history and cleanup seals. Positive English/Portuguese checks require working bound online and offline application documents after adoption and worker restart. Recovery executes no Auth SDK and requests no Auth/API/provider/cross-origin resources. Existing schema/protocol, dependencies, Auth policy, recovery wording/CSP and cleanup policy are unchanged.

This narrow correction does not demonstrate the cause of the physical phone failure or recover every historical durable state. Task 3.4 stays unchecked. Do not interact with the preserved phone, change production/rollback/settings or treat automated success as device acceptance; a later recovery procedure requires independent review and authorization.

Task **3.2 passed on the baseline** on 2026-10-20 at **https://spendspacey.pages.dev**, merge
`fae9f51b489db95d672a4761cbd9ecef80b53de6`, Pages deployment `90a2be8a`.
[Production verification](installable-offline-shell-verification.md#production-verification--task-32-accepted)
records exact generated/live resource hashes, 44 HTTP cases and 19 hosted desktop
Chromium scenario groups. It also discloses the failed merge CI cancellation case,
the passing accepted identical-tree CI and passing diagnostic local unit rerun.
These automated results are separate from the PM's Task **3.3** acceptance below
and do not complete Task **3.4**.

## Pending PM acceptance

> **Historical acceptance handoff.** The following Task 3.3 and PR #5 progress statements retain their original dates/results. The completed fresh-install Task 3.4 and final 9/9 state are recorded below; these historical 8/9 statements are not current blockers.

Task **3.3 is accepted** from PM-reported behavior on **2026-10-21 at approximately
22:38 CEST (Europe/Berlin)**: **iPhone 16 Pro**, **iOS 26.6.2**,
**Chrome 155.0.8059.37**, **English first** in preferred languages, canonical
**https://spendspacey.pages.dev**, baseline production revision
`fae9f51b489db95d672a4761cbd9ecef80b53de6`.
The [PM behavioral record](installable-offline-shell-verification.md#pm-physical-iphone-acceptance--task-33-accepted)
contains only the supplied installation, authentication, offline, localization and
reconnect outcomes. Progress is **8/9**; only **Task 3.4 remains unchecked**.

**Historical PR #5 handoff — superseded by the 2026-10-28 reset below.** The
following handoff is preserved as history, not a current instruction.

The corrected [PR #5](https://github.com/dnstld/spendspacey/pull/5) replacement is
merged, published and independently verified in the corrected-production record.
Keep `docs/accept-installable-offline-shell` uncommitted and unpushed, with no closure
PR, until Task 3.4 is completed. Retain the same installed app, unopened until the
PM has reviewed the sequence below and coordinated the supervised session.

### Task 3.3 — accepted baseline installation, online and offline smoke

The checklist below is the procedure; the separate PM record above states the
actual supplied outcomes. No additional subcase is inferred as passed.

1. Record model, actual iOS/Chrome versions, date/time, English-first language order,
   canonical URL and deployed merge. In iPhone Chrome open
   **https://spendspacey.pages.dev**; choose **Share → Add to Home Screen** and
   confirm **Spendspacey** with the intended green s-dot icon.
2. Launch from that Home Screen icon. Confirm standalone web-app presentation,
   rather than an ordinary Chrome tab/bookmark. Prime this installed context online.
3. From the installed app, use the PM's existing authorized Google account for
   online sign-in, return to the installed app, verify identity/avatar privately,
   and sign out. A successful separate Chrome tab is insufficient. Report pass/fail
   only; no identity screenshot or Auth trace. Complete this on the phone; the
   automated work did not attempt a real sign-in.
4. Wait for complete offline preparation, then ordinarily reload/reopen to acquire
   control/readiness. With airplane mode on **and Wi-Fi/mobile data disabled**,
   reload and fully close/reopen the Home Screen app. Confirm the complete shell
   loads in English; switch to Brazilian Portuguese and repeat reload/cold reopen.
5. Check document/language preference, narrow-screen and safe-area layout, touch,
   zoom, readable controls and avatar fallback. Check offline Auth connection
   guidance and reconnect behavior: no automatic sign-in/out/exchange, no indefinite
   shell-blocking spinner, and no fresh authentication claim while offline. Restore
   connectivity and confirm normal deliberate online actions remain usable.

### Task 3.4 — fresh-install bootstrap acceptance (2026-10-28)

**Approved contract; PM fresh-install checklist completed on 2026-10-29 at 9/9.** This procedure is retained as the accepted checklist, not a request for further phone action. See the [exact final PM results](installable-offline-shell-verification.md#task-34-fresh-install-pm-acceptance--approved-reset-completed-2026-10-29). The old installation spans experimental releases with confirmed service-worker defects. The PM classifies it as a **legacy development installation with unrecoverable/indeterminate internal state** and abandons it as the release-acceptance baseline. All earlier failures, inconclusive results, temporary successes and diagnoses remain exactly recorded in the [verification record](installable-offline-shell-verification.md#pm-approved-bootstrap-acceptance-scope-reset-2026-10-28); this is not successful recovery or evidence that the defects were harmless.

Fresh baseline: **https://spendspacey.pages.dev**, merge `2acaa960863024419cb1f22166cd1d9c66e8640b`, worker `124f91385e65e2db4091059a230ae9ccb2991cebff01d3047e29015269c1086b`. Exact release identity comes from external verification, not phone appearance or internals. These are the already verified release identities; this documentation revision does not run another production audit. If the intended baseline changes before execution, stop for reviewer resolution rather than silently substituting it.

The following is the accepted checklist. The supplied results—not this procedure—record what the PM actually performed; no additional phone action is requested:

1. **Review prerequisite.** Record independent approval of this revised contract before any legacy-removal or fresh-install action. Record actual device/iOS/Chrome versions, date/time/timezone, canonical URL and externally supplied baseline identity using sanitized text only.
2. **Remove the legacy development installation only after that review.** Record that removal clears that installation's local app state and authentication session; reauthentication may be required. The PM states Spendspacey currently contains no user-entered transactions or other offline business data. Record removal as removal, never recovery/migration/repair. Do not inspect storage or account/session details to demonstrate it.
3. **Install fresh online.** Open the canonical production URL in Chrome on the existing iPhone, choose Share → Add to Home Screen, confirm Spendspacey and the intended icon, then launch from that new Home Screen installation. Confirm standalone presentation and the normal usable online shell. Stop if recovery appears, the shell is unusable or the icon only opens an ordinary browser tab.
4. **Confirm the existing Auth shell only if needed.** Online sign-in/sign-out may be used to confirm it; reauthentication may be necessary after removal. Record boolean outcomes only, with no account details, identity screenshots, callback inputs or Auth/session traces. This adds no new authentication or account-data acceptance scope.
5. **English and Portuguese online.** Select English and Brazilian Portuguese in turn. For each, confirm usable controls and persisted language through a safe normal online reload and full app close/reopen. Prime the installed context itself online and wait for complete offline readiness; preparing a separate Chrome tab is insufficient.
6. **English and Portuguese offline.** For each language, prepare that selection online, disable connectivity, then test safe normal offline reload and full app close/reopen from the fresh Home Screen icon. Confirm the complete shell, controls, connection guidance and language persistence. Do not attempt offline sign-in/out. If a safe normal reload control is unavailable, record unavailable/not tested, never passed, and use the approved combined evidence route: physical bilingual cold-reopen passes plus separately mapped automated/real-worker reload evidence. Do not invent a physical reload pass or use developer tooling/cache mutation.
7. **Reconnect.** Restore connectivity and confirm a normal usable shell and retained language/installation without loops, recovery, unexpected automatic retry or forced navigation/reload. Do not infer exact worker/controller identity, generation ownership, session validity or internal durability from a visible shell.
8. **Record and review.** Record exact per-language online reload/close-reopen, offline reload/full close-reopen and reconnect outcomes, with all unexecuted cases labeled pending/not tested. Any recovery page, loop, unusable shell, installation loss, forced navigation or visible error is a failure requiring investigation; stop rather than repeating trials or clearing/reinstalling again. Only after independent contract approval, recorded removal, fresh installation and all required physical passes may the PM approve Task 3.4 completion. The PM has supplied those approved results on 2026-10-29; Task 3.4 is complete at **9/9**, with physical reload still unavailable/not tested.

No physical recovery, migration, repair, deliberate corruption/fault injection or rollback of pre-baseline experimental installations is required. No phone developer tooling, cache mutation, controller/worker inspection, production rollback or private-data inspection/export is required or authorized. Applicable deterministic, real-worker, Chromium, supplemental WebKit, hosted and production evidence may satisfy update, interrupted activation, repair, rollback, ownership, retention, integrity and privacy requirements. Retain the existing [technical evidence mapping](installable-offline-shell-verification.md#task-34-evidence-contract-revision-2026-10-22) with its coverage limits; record these as **not manually executed on the physical iPhone; covered by representative automated/hosted evidence**, not phone passes. The prior mapping's physical same-installation/rollback completion gates are superseded by this reset.

A normal PM smoke check belongs to the next ordinary production update when one naturally occurs. It does not block this bootstrap phase or authorize an artificial update/production rollback now. After acceptance, later phases inherit the fresh installation context. The completed evidence authorizes sync/archive and an unmerged closure review PR; it authorizes no production/Cloudflare change, additional phone action or next product phase.

### Task 3.4 — same-installed-app lifecycle acceptance

> **Historical procedure — superseded 2026-10-28. Do not execute.** Retained verbatim below as the earlier contract; it does not authorize recovery, phone actions or rollback. The current gate is the fresh-install checklist above.

**Revised evidence contract, pending reviewer approval and PM execution.** The PM
confirms the existing Home Screen installation has remained unopened since corrected
production `611994f` was deployed. Only the PM performs and approves behavior on
the personal iPhone. No developer tooling, service-worker/controller or generation
inspection, request blocking, fault injection or cache mutation on that phone is
required or authorized. Do not inspect/export cookies, tokens, sessions, account
storage, callback inputs, API responses or other private data. Do not reinstall,
clear site data or repeat Task 3.3 authentication to satisfy this gate.

The product's complete-generation, recovery, ownership, repair-ordering and privacy
guarantees remain mandatory. Their evidence comes from the existing representative
automated/hosted checks, as mapped in the
[verification record](installable-offline-shell-verification.md#task-34-evidence-contract-revision-2026-10-22).
For each technical subcase record **“not manually executed on the physical iPhone;
covered by representative automated/hosted evidence”**. Those are not phone passes
or missing phone-tooling blockers. Actual phone behavior remains a separate PM gate.

| Target                | Baseline B                                                         | Corrected C                                                        |
| --------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| Merge                 | `fae9f51b489db95d672a4761cbd9ecef80b53de6`                         | `611994f4e0cae15b4b4ef4ada6659d10ac059a55`                         |
| Accepted PR #5 head   | —                                                                  | `79dbbd485a922b560fc92f0cc1ef4c1b362c9286`                         |
| Production deployment | `90a2be8a-7daf-42b0-a5d1-344ed81cfae3`                             | `a52aaac4-aa23-4417-8084-0183cf249c11`                             |
| Immutable host        | `90a2be8a.spendspacey.pages.dev`                                   | `a52aaac4.spendspacey.pages.dev`                                   |
| Worker identity       | `b412fb85d9b7df20db717f84dc30d6021880dcd07f61fa1f8216c2ed026117ca` | `a2c2c03c7f95d45e9f9b5a33cf89ea9ab9a2f05de84bcd0c81dbe850a046af30` |
| `/sw.js` bytes        | 59,956                                                             | 60,410                                                             |
| `/sw.js` SHA-256      | `5f8032f516a897446a6e6a9278fbc1b0a99f78401a4d3fc2249116049543f044` | `5f5981de031458f56348048a1a375f797461538eccc70a9088ea5e4928494d3a` |

Canonical phone origin is **https://spendspacey.pages.dev**. The immutable hosts,
worker identities and hashes above are for verification **outside the phone**.
Both releases share v3 compatibility digest
`c2ca46b7b90c80cc4c03b5de5db5aad5a832f5f2f0a74675ea791dee36885fb9`.
All 11 application resources are byte-identical, so product appearance cannot
identify the controlling worker. Record PM-observed close/reopen behavior separately
from exact release/controller identity established by production and representative
browser evidence; do not claim phone-internal revision proof. B retains the known
repair-order defect and is only the temporary compatible rollback target. C is the
required final production release; do not redeploy obsolete v2 workers.

Before PM execution, obtain reviewer approval of this revised evidence contract,
reverify canonical C externally, and supply the PM with the verified deployment
revision. Record actual current device/iOS/Chrome versions, date/time/timezone and
preferred language from PM-supplied text, without inspecting the phone. No production
switch is authorized by this procedure or by approval of the contract alone.

1. **First single PM action after reviewer approval:** while online, tap the existing
   Spendspacey Home Screen icon once and leave the app open. Do not reload yet.
2. **Observe waiting and usability.** If a waiting-update notice appears, report its
   language and wording without account content. Keep that document open and check
   that ordinary controls and language selection remain usable, with no forced
   reload. If no notice appears, record **not observed**, not a phone pass or failure
   of the underlying waiting requirement; normal activation may already have occurred.
   A not-observed notice does not alone block Task 3.4 after rendered-notice,
   waiting-worker and retention evidence passes. A broken notice, forced navigation/
   reload, unusable UI or lost installation is a failure requiring investigation.
3. **Close-all/reopen in the same installation.** Close all Spendspacey Home Screen
   windows and Spendspacey browser tabs, then reopen the same icon online. Confirm
   standalone launch, responsive shell/language controls, readiness guidance and no
   unexpected retry/reload or loss of the installation. This is behavioral adoption
   evidence, not an independent measurement of the phone's exact controller revision.
4. **Complete offline reload and cold reopen.** Wait for offline readiness; enable
   airplane mode and explicitly disable Wi-Fi/mobile data. Test a safe normal reload
   control if available. If the installed app has no safe normal reload control,
   record physical reload as **unavailable/not tested**, never passed. In either
   case, perform offline **close-all and cold reopen** using the same Home Screen
   icon in English and Brazilian Portuguese; confirm the complete shell, readable
   controls/offline guidance and persisted language in both. For an unavailable
   reload control, these PM cold-reopen results **plus the mapped automated/browser
   reload evidence** form the accepted combined route for separate reload behavior.
   This route applies to the corrected update, rollback and restoration checks.
   Do not invent a physical reload pass or use developer tooling to obtain one.
5. **Reconnect behavior.** Restore connectivity and confirm normal online shell
   operation, retained language/installation, and no visible automatic repair retry,
   forced reload or loop. Online operation here means the existing shell and normal
   controls; accepted Task 3.3 Auth outcomes remain unchanged. Do not sign in or inspect
   account data for this gate. Report any spontaneous recovery/error, without inducing it.
6. **Compatible rollback, only after separate production authorization.** Keep the
   installed app open. The authorized Cloudflare operator first verifies C and both
   immutable production deployments outside the phone: full deployment ID/commit,
   worker/hash, all 11 resources, compatibility, manifest and security/cache/callback
   policy. In **Workers & Pages → spendspacey → Deployments → All deployments**,
   identify successful **Production/main** deployment
   **`90a2be8a-7daf-42b0-a5d1-344ed81cfae3`**, commit **`fae9f51…`**. Use that row's
   **⋯ → Rollback to this deployment** only after separate approval and confirmation
   of the exact target. Reverify canonical B externally before the PM continues.
   The PM then repeats observable waiting/usability, close-all/reopen, online operation
   and both-language offline reload/cold reopen checks using the same installation.
   Record a missing notice as not observed. Do not induce faults or run repair tests.
7. **Restore corrected production, separately authorized with the rollback plan.**
   The operator selects successful **Production/main** deployment
   **`a52aaac4-aa23-4417-8084-0183cf249c11`**, commit **`611994f…`**, using the same
   **⋯ → Rollback to this deployment** action after checking its confirmation target.
   Verify canonical C worker/hash, all 11 resources, manifest, exact CSP, cache/security/
   callback headers and canonical/alternate-origin Auth policy outside the phone,
   without signing in. The PM repeats steps 2–5, including close-all/reopen and offline
   checks in both languages. Leave production on C and the same installed app usable
   after the normal reopen path, with connectivity and preferred language restored.
8. **Return behavioral outcomes.** Only the PM approves the phone results. Record
   pass/fail/not-tested for steps 2–7, with waiting marked not observed when applicable.
   Use step 4's combined route when physical reload is unavailable, retaining its
   unavailable/not-tested label. Keep technical checks under their automated/hosted
   classification. Task 3.4 remains
   unchecked until review and all required behavioral checks, including separately
   authorized rollback/restoration, have accepted evidence.

The [official Pages rollback documentation](https://developers.cloudflare.com/pages/configuration/rollbacks/)
describes selection of a prior or newer successful production deployment. Only the
selected production deployment may change during separately authorized steps 6–7.
Do not change configuration, environment variables, Auth allowlists/callbacks, domains,
project/build settings, integrations, DNS or external services. Preview deployment
`0b2ca09b-4a6a-4599-b609-8cb19f7f1e5a` is not a rollback target. Stop before any
switch if the exact full deployment/commit/environment is uncertain, the action is
unavailable, another release appears or external verification fails. Do not select
an approximate target or improvise settings. If restoration to C cannot be selected
with certainty, pause and report the actual production state without guessing.

### Evidence the PM must return

- Date/time/timezone, actual current iPhone/iOS/Chrome versions, preferred languages,
  canonical URL and confirmation that the same Home Screen installation was retained.
- For Task 3.4, only observable waiting/usability, close-all/reopen, online operation,
  English/Portuguese offline reload/cold reopen, reconnect, rollback/restoration and
  absence of unexpected retry/forced reload/installation loss. Record waiting as
  not observed when unavailable. Record physical reload as unavailable/not tested
  when no safe control exists, paired with PM offline close-all/cold reopen in both
  languages and the mapped automated/browser reload evidence. Other unexecuted
  checks remain not tested; an available safe reload control is tested normally.
- Deployment revisions/IDs supplied from external verification, labeled as such;
  no claim that unchanged product content identifies the phone's controller.
- Sanitized text or optional cropped non-account UI screenshots only. No identities,
  keys, provider/callback inputs, tokens, sessions, cookies, account storage, API
  responses, private dashboards or network/storage exports. Task 3.2/3.3 evidence
  remains accepted and is not reclassified or expanded by this procedure.

Task **3.3 is complete** with the PM evidence recorded above. Keep **Task 3.4
unchecked** until its actual installed-app evidence is documented. Corrected PR #5
production is verified; the device lifecycle gate remains pending. Keep this branch
uncommitted and the change unarchived; later changes remain planning-only. Do not
commit, push, open the closure PR or archive until Task 3.4 is complete.

## Forward requirement — later offline financial data

User-entered transactions and synchronization state must not be stored in or depend on service-worker Cache Storage. Later transaction/offline-data work must use durable application storage such as IndexedDB, versioned schema migrations, per-user isolation and an outbox/synchronization design. Its tests must prove worker update/replacement does not delete or alter financial data or synchronization state. Once user-entered offline data exists, clearing data or reinstalling must never be presented as an acceptable recovery mechanism. This is a forward requirement, not transactions, new storage or synchronization in this shell phase. The legacy-removal exception above relies on the current absence of user-entered offline business data.

The current result is the completed approved fresh-install contract, not the historical procedure above. **Task 3.4 is complete at 9/9. No additional phone action is authorized.**

## Final bootstrap acceptance (2026-10-29)

The PM's [fresh-install results](installable-offline-shell-verification.md#task-34-fresh-install-pm-acceptance--approved-reset-completed-2026-10-29)
complete Task 3.4 and this change at **9/9** on production merge
`2acaa960863024419cb1f22166cd1d9c66e8640b`, worker
`124f91385e65e2db4091059a230ae9ccb2991cebff01d3047e29015269c1086b`.
English/Portuguese physical online/offline cold reopen and reconnect passed; safe
physical reload is unavailable/not tested and uses the approved separate automated/
real-worker evidence. Readiness text is static guidance, not a live connectivity
indicator. The final PM state is online, Portuguese retained and app left open.
Legacy deletion relinquished local installation state/session; it was not provider
logout or recovery, and no browser website data was cleared. No migratability claim
is made for historical experimental states. All earlier failed/inconclusive records
remain historical. Technical lifecycle guarantees and the forward financial-data
requirement remain explicit. The next ordinary-update PM smoke is non-blocking.
Archive/sync and open the closure PR for independent review; do not merge it,
change production/Cloudflare/phone state or begin the next product phase.
