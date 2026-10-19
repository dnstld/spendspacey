# deploy-auth-shell deployment acceptance

Read-only hosted verification passed at `2026-10-19T07:25:33.897Z` against **https://spendspacey.pages.dev**. This closure starts from clean `main` at `6fd9c012d41eba53d366b0ac950b4d76cea826e8`; GitHub independently confirms [PR #2](https://github.com/dnstld/spendspacey/pull/2) merged at that commit on 2026-10-18.

## Evidence boundaries

Public HTTP delivery was independently checked using credential-free HTTPS GET requests with certificate verification, no cookie jar, no Authorization header, and only same-origin redirects. No real login, OAuth provider, Supabase API, dashboard, or external configuration action was initiated. Production HTML/bundles and the resolved CSP/backend value were inspected only in memory; only sanitized results, public asset names, byte counts, and hashes are retained. No environment-variable values, raw production bundles/headers, cookies, account payloads, or private identifiers are stored.

The deployed revision is the PM-reported merged revision; public HTTP responses do not independently prove Cloudflare build provenance. Cloudflare project/build settings, provider allowlists, disabled signups, accidental Worker removal, and real-account smoke results below are **PM attestations**, not independent dashboard or account verification. No deployment-specific/preview hostname was supplied or probed; its restrictions retain the automated same-artifact evidence.

## Independently observed hosted delivery

All 22 requested variants completed with final HTTP 200. `/index.html` and its query variant returned a same-origin 308 to `/` before the final 200; other requests had no redirect. HTML, callback, unknown-route, and missing-asset responses shared the 497-byte entry body. Missing scripts returning generic HTML are native SPA fallback, not valid script delivery.

Every final response had the exact repository CSP template with its marker replaced by one validated concrete HTTPS backend origin; `connect-src` contained only self and that origin. An in-memory comparison confirmed that backend matched the served entry artifact and that the artifact contained the canonical production origin. The backend value is intentionally omitted. Every final response also had `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, and `Referrer-Policy: no-referrer`; CSP prohibited framing, forms, objects, arbitrary inline scripts, and foreign script/style/font sources.

Query variants used only a synthetic non-authentication verification query. Query parameter names and values are not retained; no authorization code/token was used. Fingerprinted resources retained identical bytes/MIME/cache policy with and without the query. Entry, callback, and missing/fallback paths also retained their respective policies with and without it.

| Requested path                                     | Final status | Content-Type               | Cache-Control                         |
| -------------------------------------------------- | ------------ | -------------------------- | ------------------------------------- |
| `/`                                                | 200          | `text/html; charset=utf-8` | `no-cache`                            |
| `/` (query variant)                                | 200          | `text/html; charset=utf-8` | `no-cache`                            |
| `/index.html`                                      | 200          | `text/html; charset=utf-8` | `no-cache`                            |
| `/index.html` (query variant)                      | 200          | `text/html; charset=utf-8` | `no-cache`                            |
| `/deployment-acceptance-spa-check`                 | 200          | `text/html; charset=utf-8` | `public, max-age=0, must-revalidate`  |
| `/deployment-acceptance-spa-check` (query variant) | 200          | `text/html; charset=utf-8` | `public, max-age=0, must-revalidate`  |
| `/auth/callback`                                   | 200          | `text/html; charset=utf-8` | `no-store`                            |
| `/auth/callback` (query variant)                   | 200          | `text/html; charset=utf-8` | `no-store`                            |
| `/assets/missing.js`                               | 200          | `text/html; charset=utf-8` | `public, max-age=0, must-revalidate`  |
| `/assets/missing.js` (query variant)               | 200          | `text/html; charset=utf-8` | `public, max-age=0, must-revalidate`  |
| `/assets/missing-abcdefgh.js`                      | 200          | `text/html; charset=utf-8` | `public, max-age=0, must-revalidate`  |
| `/assets/missing-abcdefgh.js` (query variant)      | 200          | `text/html; charset=utf-8` | `public, max-age=0, must-revalidate`  |
| `/assets/index-BDlNlHaH.js`                        | 200          | `application/javascript`   | `public, max-age=31536000, immutable` |
| `/assets/index-BDlNlHaH.js` (query variant)        | 200          | `application/javascript`   | `public, max-age=31536000, immutable` |
| `/assets/index-Cu2_gOaQ.css`                       | 200          | `text/css; charset=utf-8`  | `public, max-age=31536000, immutable` |
| `/assets/index-Cu2_gOaQ.css` (query variant)       | 200          | `text/css; charset=utf-8`  | `public, max-age=31536000, immutable` |
| `/assets/supabase-BBdL3OFL.js`                     | 200          | `application/javascript`   | `public, max-age=31536000, immutable` |
| `/assets/supabase-BBdL3OFL.js` (query variant)     | 200          | `application/javascript`   | `public, max-age=31536000, immutable` |
| `/google-g.png`                                    | 200          | `image/png`                | `no-cache`                            |
| `/google-g.png` (query variant)                    | 200          | `image/png`                | `no-cache`                            |
| `/fonts/google-sans-medium.woff2`                  | 200          | `font/woff2`               | `no-cache`                            |
| `/fonts/google-sans-medium.woff2` (query variant)  | 200          | `font/woff2`               | `no-cache`                            |

## Byte inventory

The script and stylesheet were discovered from the served entry HTML; the lazy Supabase SDK chunk was discovered from the entry script. The icon and font matched the checked-out public files byte for byte. Production JS was never saved.

| Resource                          | Bytes  | SHA-256                                                            |
| --------------------------------- | ------ | ------------------------------------------------------------------ |
| `/`                               | 497    | `0e93d180668aa67e518f5b65978b62e4f5e73d9e6c3ce296d712e7721358661f` |
| `/assets/index-BDlNlHaH.js`       | 357491 | `d30328de2e26e5a9ef64518c20a815fd725876c294d431cb7ebf45037190512a` |
| `/assets/index-Cu2_gOaQ.css`      | 14884  | `cc8c94c197cd7525337e512371b7703204026991f1d949ce1acfff4d54cff708` |
| `/assets/supabase-BBdL3OFL.js`    | 214621 | `3767c0da68ccc4bd053765016cf052aa91fdfad4b9a6ba0cf888ffa46c507fa9` |
| `/google-g.png`                   | 33661  | `d1ce9c2af0b10a7333abc99bc706f9a6a199e5b65bf3e3009624f076b8638e6a` |
| `/fonts/google-sans-medium.woff2` | 23196  | `4d71eed21cc1dc806f17ef26749c5376980b27bed7996c0546de5a9e54688b81` |

## PM-attested deployment and authentication

- Cloudflare Pages Free project `spendspacey`, production branch `main`, canonical origin `https://spendspacey.pages.dev`; production is Pages only. The PM identified and removed an accidental Workers deployment. This closure did not create/remove/configure a Worker or independently audit the account.
- Production and preview builds have only the two public Supabase application variables and pinned Node `24.21.0`/pnpm `10.27.0`; no variable values are recorded. No `CF_PAGES_*` override was added. Actual dashboard/build-log settings were not independently inspected.
- Google authorized JavaScript origin is exactly the canonical Pages origin. Its redirect URI remains the Supabase Auth callback; the Pages callback was not added to Google redirects. No real Supabase identifier is recorded.
- Supabase Site URL is the canonical origin. Redirect allowlist includes its exact `/auth/callback` and the approved local callback, without preview/wildcard entries. New-user signups remain disabled.
- PM reports pass: production login screen, Google sign-in with the enrolled identity, clean canonical return URL, authenticated identity screen, authenticated hard reload, sign-out, returned login screen, and signed-out hard reload. No account/user values, codes, tokens, or real-account traces were supplied or retained.

## PM-attested target-device acceptance

| Evidence                                        | PM-reported value                                            |
| ----------------------------------------------- | ------------------------------------------------------------ |
| iPhone model                                    | iPhone 16 Pro                                                |
| iOS version                                     | 26.6.2                                                       |
| Chrome version                                  | 155.0.8059.37                                                |
| First preferred language                        | English                                                      |
| Spendspacey displayed language                  | English                                                      |
| Hosted smoke performed in Chrome on this iPhone | Yes                                                          |
| Acceptance result                               | Passed; PM confirms remaining Task 2.4 evidence is satisfied |

These are sanitized PM attestations, not values inferred from desktop automation or independently inspected on the device.

## Closure scope

All eight `deploy-auth-shell` tasks are complete. This branch records acceptance and synchronizes/archives the deployment capability at `openspec/changes/archive/2026-10-19-deploy-auth-shell/`. It changes no application/runtime code or external settings. The three later changes remain planning-only; PWA installation, offline behavior, and profile queries remain out of scope.

## Final closure verification

The final documentation/archive branch uses Node `24.21.0` and pnpm `10.27.0`. The complete synthetic verification suite covers formatting, lint, types, 269 unit/component tests, configuration rejection including 46 unsafe URL/metadata builds, separate local and three Pages build variants, 31 Chromium tests, repository/build/history secret scanning, and strict OpenSpec validation. CI evidence is attached to the closure PR rather than treating local checks as a CI result.

`deploy-auth-shell` is archived with 8/8 tasks checked and its five deployment requirements synchronized to `openspec/specs/web-delivery/spec.md`. Strict validation after archival covers seven active change/spec items. Informational predecessor notices for future offline-profile work and a superseded combined-plan delivery delta do not change the scope or implementation state of those plans. The three later changes and preserved combined planning history are unchanged.
