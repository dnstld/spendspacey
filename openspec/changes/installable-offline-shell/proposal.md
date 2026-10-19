# Proposal

## Why

After the existing auth shell is published, the PM should be able to install it from Chrome on an iPhone and reopen it from the Home Screen in airplane mode. This is the mobile-installation milestone and must not depend on profile queries or private offline storage.

## What Changes

- Sequence **2 of 4**; requires [deploy-auth-shell](../archive/2026-10-19-deploy-auth-shell/proposal.md) implemented, accepted on the phone, and its durable specs synchronized before apply.
- Add stable manifest identity, ordinary/maskable/Apple icons, matching colors, standalone display, and mobile metadata.
- Precache only reviewed static build assets, including all required chunks, the local font/button image, and both bundled languages; register the worker only in production.
- Keep Supabase/API/OAuth/avatar responses, authentication parameters, and user information out of service-worker caches. A controlled callback can receive generic static shell bytes without caching its URL or response.
- Define offline authentication/connection guidance, first-ever offline limits, normal waiting updates, owned cache versioning, and bounded online recovery.
- Retain Cloudflare Pages Free static delivery, native SPA fallback, exact production/local callbacks, disabled new-user signups, and restricted preview authentication. Publish only accepted changes merged into `main` at the assigned production `*.pages.dev` origin.
- Extend focused Chromium/build/CI checks and publish at that existing origin. Require manual PM evidence on an iPhone: open the production Pages URL in Google Chrome, use Share → Add to Home Screen, confirm Spendspacey name/icon, and launch from the Home Screen as a standalone web app. Complete the online/offline/update checks in that installed app and record tested iOS and Chrome versions; desktop Chromium automation cannot replace this evidence.

Use standards and feature detection without browser detection. Safari-specific manual acceptance is not required.

No profiles query, IndexedDB/Dexie, private data snapshot, mutation, sync queue, background execution, or database change is included. Existing SDK session persistence remains; expired sessions can show reconnect guidance, with no new offline identity guarantee.

## Capabilities

### New Capabilities

- `installable-app`: Installable static shell, offline launch, static cache privacy, worker update/recovery, and real-phone installation acceptance.

### Modified Capabilities

- `user-auth`: Permit essential PWA feedback in the minimal shell, preserve callback safety offline, and make fresh sign-in/sign-out connectivity requirements explicit.

The existing localization contract applies to all new application text without a separate delta. Delivery remains owned by `web-delivery`; this change adds worker/manifest delivery checks in `installable-app`.

## Impact

Vite/build configuration, browser service-worker registration, icons/manifest, small auth/feedback integration, Cloudflare Pages static worker/manifest headers, tests, and installation/worker-aware rollback documentation. Proposed tooling is pinned compatible `vite-plugin-pwa` plus directly imported Workbox modules; no data library is needed.

This split is the installation portion of [the preserved combined plan](../ship-installable-offline-profiles/proposal.md). Completion unblocks [online-profiles](../online-profiles/proposal.md); the iPhone/Chrome installation milestone is accepted before that query work begins. Changes 3/4 inherit the installed Home Screen context and versioned manual evidence.
