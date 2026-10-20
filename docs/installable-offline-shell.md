# Installable offline shell

This is change 2/4, `installable-offline-shell`, on top of the archived, synchronized
and accepted `deploy-auth-shell`. The production/main baseline was
`d786441215a1c9e6fb2d048262fc4d09b5d79e44`.
[Predecessor acceptance](deploy-auth-shell-acceptance.md) remains authoritative for
provider configuration, disabled signups and canonical authentication. This change
adds only a static PWA shell. There are no profile requests, database changes,
private offline stores, queues, Functions, Workers, domains or runtime services.

## Install and prepare

After accepted review, CI and merge/publication through the existing Pages
integration, open **https://spendspacey.pages.dev** using **Google Chrome on an
iPhone**. Choose **Share → Add to Home Screen**, confirm **Spendspacey** and its
green s-dot icon, then launch from the Home Screen. Confirm standalone presentation.
Prime that installed context itself online: a Chrome tab may use separate storage.

Wait for “Prepared for offline use. Reload or reopen Spendspacey to finish.” All
static files and verified completion/selection already exist at this point. The
next ordinary navigation, reload or installed-app launch acquires control, including
when that next load is offline. There is no `clients.claim()`, forced activation or
automatic reload. Controlled readiness requires persisted document ownership and a
verified complete inventory. Test airplane-mode hard reload and cold reopen in both
English and Brazilian Portuguese. Locale detection/preference/fallback, zoom,
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
Legacy repair history is refreshed at activation/startup and before repair under
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

Tasks **3.2–3.4 stay unchecked**: actual post-merge Pages publication/header/asset
verification; PM iPhone/Chrome Share installation, standalone launch, online Auth,
offline hard reload/cold reopen, both locales and safe-area/touch acceptance; then
same-installed-app waiting update, recovery and compatible rollback. Record iPhone,
iOS/Chrome versions, URL and revisions with sanitized pass/fail, never identity,
tokens, codes, account screenshots or live-account traces. Desktop Chromium and
synthetic WebKit-style absent-hint cases supplement but cannot replace these gates.
Keep this change unarchived and later changes planning-only until acceptance.
