# deploy-auth-shell local verification

Verified on 2026-10-18 from base `3d40fd9`, on `feat/deploy-auth-shell`, with Node 24.21.0 and pnpm 10.27.0. Initial inspection found synchronized `main` and only the approved planning artifacts. Those plans were committed separately as `00fff49` before implementation.

| Local check                     | Result                                                                                                                                                            |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frozen dependency install       | Passed; lockfile current                                                                                                                                          |
| Formatting, lint, type checking | Passed                                                                                                                                                            |
| Unit/component tests            | 78 passed                                                                                                                                                         |
| Configuration validation        | Invalid/extra public inputs and mismatched Pages tooling rejected safely                                                                                          |
| Production build                | Passed through `pnpm build:test`, which invokes `pnpm build` with synthetic public inputs                                                                         |
| Pages delivery builds           | Synthetic `main`, preview, and missing-branch builds passed; complete static inventory, CSP substitution, and disjoint cache directives inspected                 |
| Browser tests                   | 18 Chromium tests passed across those three build environments, including existing PKCE/session/sign-out/localization and blocked preview OAuth/callback exchange |
| Secret scan                     | Proposed file inventory, synthetic production build, and Git history passed Gitleaks                                                                              |
| Strict OpenSpec validation      | 7 items passed, 0 failed                                                                                                                                          |
| Scope/history check             | Future plans, main specs, and Phase 1 archive unchanged from the separate planning commit                                                                         |

All account/URL/session fixtures are synthetic. Generated CSP is enforced by the browser fixtures; these fixtures are not evidence of Cloudflare response behavior. The sandbox initially denied the local preview server's socket; the same browser suite passed with permission to bind local ports. No real Auth account, project configuration, or hosting API was used. The exact pinned OpenSpec CLI is a development-only dependency for the same strict validation in CI; no application dependency was added.

Task status: **3/8 complete**, **5 pending**. Tasks 1.1–1.3 cover local preparation. Task 1.4 remains unchecked because its review/acceptance and merge into `main` are outstanding even though all local checks pass. Tasks 2.1–2.4 remain unchecked: Pages/GitHub integration settings, assigned hostname, Google/Supabase production configuration, actual publication/routing/MIME/headers, optional live previews, and the PM's iPhone/Chrome four-step smoke require later execution. See [the runbook](deployment.md).

GitHub Actions runs the same quality, configuration, build/delivery, Chromium, secret, and strict OpenSpec checks. Its actual result is recorded by the draft PR's check run; this local record does not claim that an unrun workflow passed. The PR is to remain draft, this change unarchived, and all later increments planning-only. No external services/settings are configured by this implementation.

The two informational OpenSpec notices for `offline-profiles` reference its planned predecessors (`user-profile` and the offline-shell auth requirement). They are expected in the approved four-step sequence and are not strict-validation failures. No main specs are synchronized and no change is archived in this implementation.
