# Validation record

Latest live-session validation: 28 October 2026, Node 24, Next.js 16, Chromium and an isolated PostgreSQL 17 container.

| Check                             | Outcome   | Scope                                                                                                                                                    |
| --------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript                        | Passed    | Strict checking across application, PostgreSQL and SQLite adapters and tests                                                                             |
| Domain, provenance and HTTP tests | 21 passed | Engine rules, source integrity, safe error handling and gateway failures                                                                                 |
| PostgreSQL integration            | 6 passed  | Independent server processes, exact-once retry, stale writes, final amendment race, recovery, private isolation, draft ordering and shared rate limiting |
| Multi-browser workflow            | 8 passed  | Five teams, host, projector, QR join, explicit publication, mobile/axe, offline recovery, revocation and a lost response retried without duplicate data  |
| Production build                  | Passed    | Full Next.js app compiled with VERCEL=1 and without requiring database access at build time                                                              |

PostgreSQL tests used only a local, isolated database. Hosted Neon credentials were not copied into the workspace. The database connection inside the user's Vercel account and the public site's updated deployment have not been verified from this environment.

A browser smoke test of the production bundle also passed with VERCEL=1 and PostgreSQL: host creation, team approval, synchronized opening and room deletion.

## Deployment

`vercel.json` now builds the complete Next.js application. `DATABASE_URL` / `POSTGRES_URL` selects shared PostgreSQL. Missing bindings in Vercel fail clearly instead of creating an unreliable temporary SQLite database. Static demo deployment remains available separately through `vercel.demo.json`.

## Limits of validation

- Synchronization uses authorized polling approximately every two seconds, with foreground/reconnect refreshes; it is not a WebSocket implementation.
- Passing axe does not establish complete WCAG conformance. Physical projector and VoiceOver/TalkBack/NVDA audits remain unperformed.
- No educator pilot or complete real-time 60-minute classroom rehearsal has been conducted.
- Research summaries and authority explanations remain marked pending professional validation. No unverified party quotation is presented as authentic.
- No production database contents, credentials, deployment success or fresh-task snapshot restoration is claimed.

Run commands are in README.md; setup and post-deployment checks are in live-vercel.md.
