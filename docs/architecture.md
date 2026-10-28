# Architecture and release checklist

## Runtime and routes

Next.js App Router / React / TypeScript. Hebrew Heebo font files are bundled locally. All story content is data in `lib/content.ts`; confidential role text is in the server-only `lib/private.ts`. `lib/engine.ts` is a deterministic, side-effect-free command reducer shared by the live service and browser demonstration.

- `/`: landing, room creation, join requests, host recovery.
- `/room/demo`: self-contained browser simulation with selectable roles and local persistence. Once loaded, no backend is needed to play; an offline reload is not a supported PWA capability.
- `/room/:id`: role-specific interface. Projector capability lives in the URL fragment, never the join QR. Requests transmit it in a dedicated header.
- `POST /api/session`: create, join, recover. The host capability and team identity use per-room HttpOnly SameSite cookies. Only the one-time recovery and projector capability are returned to the creating host; store the recovery code privately.
- `GET /api/room/:id`: server-authorized snapshot. A supplied projector capability always takes precedence over an existing host cookie. Projector snapshots exclude secrets, drafts, unpublished clauses and team submissions.
- `POST /api/room/:id`: `{ commandId, revision, action }`. The server authorizes and validates every command. Snapshots are fetched every two seconds; the timer interpolates locally from a server timestamp.

Room storage in Vercel is shared PostgreSQL. `lib/store.ts` selects the PostgreSQL adapter lazily from DATABASE_URL / POSTGRES_URL; a configured Vercel instance never falls back to SQLite. Local development can retain the SQLite adapter. No database connection is needed at build time.

PostgreSQL room changes use row-level `FOR UPDATE` locks and a command receipt table. A committed command, journal entry and revision update are one transaction across any number of function processes. Duplicate retries are scoped to their authenticated actor; a stale new command is rejected. Approved memberships have a partial unique index. The schema initializes under a PostgreSQL advisory transaction lock. Remote database TLS verifies the server certificate. Raw database diagnostics never reach the browser.

Authorized snapshots and presence are read through the server every two seconds, with immediate recovery reads on foreground/online events. No WebSocket or direct browser-to-database access is required. Superseded requests cannot restore stale screens, and revocation clears private screen content. Draft versioning rejects out-of-order autosaves in the PostgreSQL adapter. Unknown command responses can be retried with the same command ID instead of creating duplicate decisions.

The journal retains historical versions. Consents refer to an exact clause version and cannot confer execution authority. Execution status requires simulated authority, funding, readiness and written evidence. School coverage is structured rather than inferred from prose. The government accepts one joint counteroffer. The final amendment is limited atomically to one clause. Publication to the projector is explicit; edits invalidate publication.

## Timing

The eight active phases total 60 minutes: 6 + 11 + 10 + 10 + 9 + 6 + 5 + 3. Only the host advances phases. The clock can pause and resume; exceeding a planned boundary warns but does not delete input. An extension is continued discussion beyond the planned time. A phase can be passed with an unresolved agreement. Only one depth intervention per phase is recorded. Active elapsed time does not auto-reset to planned time when the host skips ahead.

## Recovery and retention

Team forms save locally during input and to the server after a short debounce. A reconnect retrieves the current authorized snapshot. Drafts from previous phases remain in local storage; they are never silently submitted into a different phase. A stale write leaves the visible draft intact and asks the user to retry. Team replacement revokes the previous device and requires host approval.

Room deletion removes room state and memberships. Room data expires after 30 days: reads deny expired rooms and cleanup physically removes expired data on the next create/join action. Operators should schedule cleanup for installations requiring deletion at an exact wall-clock instant. Server backups must follow the same retention policy. Browser demo and draft storage can be cleared using browser site-data controls; do not use personal or child information.

## Deployment

Use Node 24 and HTTPS. Vercel uses the full Next.js build plus a pooled Neon/PostgreSQL DATABASE_URL; schema creation is automatic. See live-vercel.md for integration and deployment settings. Local SQLite remains supported on one persistent server, but must not be deployed as ephemeral serverless storage. Protect database backups and follow the same retention policy; provider backup retention is separate from application deletion.

No AI calls, external analytics, third-party fonts or source retrieval occur during a session. The app does not send private gameplay data to third-party services. Content is not editable by participants; no freeform AI-generated regulation or outcome is used.

## Milestones / release gates

- M0: source specification archived; architecture, roles, screen inventory and engine rules documented.
- M1: responsive landing, host/team/projector shell, accessible forms, local fonts and offline-capable demo workflow implemented.
- M2: persistent rooms, scoped capabilities, approval, timer, revision checks, idempotency, polling and draft recovery implemented.
- M3: four crises, role rotation, options, negotiation, budget, counteroffer, authority investigation, research comparison and voices implemented. **Professional content validation remains a release gate.**
- M4: versioned three-clause agreement, explicit publication, advisor, outcome selection, single amendment, reflection and printable report implemented.
- M5: automated tests included; **manual screen-reader audit, real projector check, educator usability pilot and full 60-minute rehearsal remain required.** Passing axe does not establish WCAG conformance.

## Manual acceptance checklist

1. Play the full 60 minutes with ten teachers, one device per pair. Check reading load and whether authority concepts become clear through action.
2. Use keyboard only, then VoiceOver, TalkBack and NVDA. Check dialogs, return focus, navigation, alerts, phase announcement and timers (never announced every second).
3. Test 200% zoom, 400% reflow, 320/360/390 px, tablet landscape, mobile keyboard and reduced motion.
4. Open projector from the host's browser: it must remain public-only. Verify low-contrast physical projection and distance readability.
5. Disconnect a team while typing/submitting, change phase, reconnect and confirm the draft remains unsubmitted and the current phase is restored.
6. Try stale simultaneous writes and device replacement; the old device must lose access and current data must not be overwritten.
7. Have a qualified education-administration reviewer verify all authority descriptions against current primary sources and scope; have an editor validate research summaries and original party sources. Keep unverified material labeled and do not invent citations.
8. Confirm all source types, dates, limitations and fiction labels. Print a partial and completed report and verify that no confidential card, token or draft appears.
