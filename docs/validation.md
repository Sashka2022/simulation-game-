# Validation record

## Open-delegation release — 28 October 2026

Final implementation: Node 24, Next.js 16.4.3, Chromium and isolated PostgreSQL 17. The original pairs/one-device-per-role model is superseded by [open delegations](open-delegations.md).

| Check | Result | Evidence |
| --- | --- | --- |
| Strict TypeScript | Passed | Application, both adapters, UI and test sources |
| Engine, guidance, provenance and HTTP | 26 passed | Four crises, 60-minute schedule, consequence branches, sources and safe errors |
| Membership integration — SQLite | 11 passed | Variable group sizes, ideas, one official proposal, moves, approval, representative elections, functions and reconnect identity |
| Membership integration — PostgreSQL | 11 passed | Same cases using actual concurrent database connections |
| PostgreSQL process integration | 6 passed | Separate server processes, atomic receipts, stale writes, final-amendment race, recovery and rate limiting |
| Legacy-schema migration | 1 passed | Old unique approved-team index, an existing live phase/commitment/member, then 20 new members in that same delegation |
| Vercel database configuration guard | 1 passed | No ephemeral SQLite fallback |
| UI, accessibility, reconnect and HTTP load | 22 passed | 17 UI/browser scenarios plus five HTTP-client load scenarios, all against PostgreSQL |
| Full production build | Passed | `VERCEL=1 npm run build`, with no database binding needed during the build |
| Standalone demo build | Passed | `npm run build:demo` |

A smoke check of the final production bundle also passed for mobile joining, late joining, live membership and the host roster; phone and desktop screenshots were visually reviewed.

78 automated cases passed. Tests cover 5, 10, 20, 40 and 60 individual identities, including uneven groups of N−4 / 1 / 1 / 1 / 1, late joins, independent private drafts, server-side revocation after moves, joining/switching locks, opt-in approval, representative changes, one-person delegations, manual roster entries, disconnected presence and reconnect. Simultaneous official submissions result in exactly one proposal for the delegation and round. Distinct subsequent command IDs and updated revisions do not bypass the rule.

HTTP load tests use independent Playwright API contexts with individual cookies, not 60 rendered Android browsers. Each size includes actual API joins, parallel reads, parallel submission attempts and three subsequent snapshot-read bursts. These are short local development-server observations, not a sustained production benchmark:

| Independent clients | Snapshot p50 | Snapshot p95 | Failed expected-success requests |
| --- | --- | --- | --- |
| 5 | 79 ms | 129 ms | 0 |
| 10 | 143 ms | 199 ms | 0 |
| 20 | 304 ms | 374 ms | 0 |
| 40 | 555 ms | 1,017 ms | 0 |
| 60 | 611 ms | 815 ms | 0 |

Small samples and host scheduling explain non-monotonic timings; no capacity guarantee follows from them. Production Vercel/Neon latency, quotas and billing were not measured. There is no participant-count check in the application; infrastructure and rate limits still apply. At 60 active participants plus host/projector, two-second polling can approach 31 snapshots/second before network/server latency. See open-delegations.md for limits and scaling decisions.

All covered axe checks passed, including the join cards, participant ideas and host roster. Responsive browser checks include 320 px through desktop. Passing automated checks does not establish full WCAG 2.2 AA conformance. Physical Android devices, manual screen readers and a classroom pilot remain outside this validation.


Original live-session validation: 28 October 2026, Node 24, Next.js 16, Chromium and an isolated PostgreSQL 17 container.

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

## Readability update — 28 October 2026

26 unit tests and 13 browser scenarios passed after the readability changes, including all eight existing synchronization/gameplay scenarios. New checks cover large text at narrow widths, retained drafts through disclosures and reloads, keyboard term help, per-phase submission status, highlighted Hebrew revisions, and a full-HD projector with no overflow. The production build and visual production screenshots at phone/desktop/projector sizes were also verified. No backend, permissions, timings or game rules changed. See readability.md for scope and manual audit limits.
