# Validation record

Validated in the supplied cloud workspace, 27 October 2026, with Node 24, Next.js 16, local Chromium and SQLite.

| Check                       | Outcome   | Scope                                                                                                                                                                                 |
| --------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript                  | Passed    | Strict type checking across application, domain, API and tests                                                                                                                        |
| Domain and provenance tests | 18 passed | Timing, permissions, alternatives, allocations, counteroffers, versions, outcome priority, one final amendment, publication, phase cues, source integrity                             |
| Browser scenarios           | 6 passed  | Landing/responsive/axe, full offline demo/persistence, five approved teams and isolation/reconnect/draft, agreement/publication/CSRF, mobile research/role/axe, keyboard dialog focus |
| Production build            | Passed    | All application and API routes compile and generate successfully                                                                                                                      |

The final keyboard test was rerun after its focused correction. The remaining five scenarios passed in the preceding full run. Automated axe coverage includes landing, live team negotiation and mobile research/role views; it is not a complete accessibility conformance audit.

Production browser smoke also passed: creation through the UI, authenticated host access, start, persisted OPENING state and room deletion on the built application.

## Not yet established

- No educator pilot or full real-time 60-minute classroom rehearsal has been conducted.
- No physical projector or VoiceOver/TalkBack/NVDA audit has been performed.
- Research summaries and institutional authority explanations remain explicitly marked pending professional validation. No party quotations have been asserted as authentic.
- No deployment, publication, hosted database or fresh-task snapshot restoration is claimed.
- The live adapter uses one persistent SQLite instance and two-second polling, rather than Supabase/Postgres/Realtime. It is not a horizontally scaled or serverless deployment.

Run commands and deployment prerequisites are in the README. Manual acceptance gates are in architecture.md. Content source status must be reviewed before classroom production use.
