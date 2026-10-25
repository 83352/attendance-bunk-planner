# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev         # start dev server (http://localhost:3000)
npm run build        # production build
npm run lint          # eslint
npm run typecheck    # tsc --noEmit
npm test              # vitest run (all tests, once)
npx vitest run src/domain/attendance/engine.test.ts   # run a single test file
npx vitest run -t "recovery"                           # run tests matching a name pattern
npx next typegen     # regenerate Next.js route types (CI runs this before typecheck)
```

CI (`.github/workflows/ci.yml`) runs, in order: `next typegen` → `lint` → `typecheck` → `test` → `build`, on pushes to `main` and on pull requests.

## Branches

`main` is the portal-sync app described below. `portal` holds the previous `main`: a section-picker calculator backed by Supabase with an admin panel. They were swapped, so older history and docs may describe the Supabase app.

## Architecture

**The data comes from CampX, not a database.** `src/lib/portal/campx-client.ts` is a thin client for the CampX student portal's unofficial API (MGIT tenant headers). `signIn` uses the password for exactly one request and never stores or logs it; `loadPortalData` fetches the current semester, the primary attendance counts and the classroom timetable; `loadSubjects` fetches the slow per-subject summary, which is loaded only when the student opens Subjects. `resolveOwnSessions` drops the other batch's concurrent lab when a section splits. Callers go through `src/lib/portal/portal-cache.ts`, an in-memory per-session cache: the semester for 12 h, the first screen for 2 min, and subjects for 10 min. Failures are never cached, and `forgetSession` runs on log-out or an expired session.

**Stale tabs after a deploy.** A page loaded before a deploy can't call the new deployment's server actions. Client callers catch that with `actionFailureMessage` / `isStalePage` (`src/lib/action-errors.ts`) and ask the student to reload, rather than showing the error page or a "CampX is slow" notice.

**Every portal response is shape-checked.** `getJson` runs each body through a checker in `src/lib/portal/contract.ts`, which throws `PortalContractError` if a field dontbunk reads is missing or has the wrong type, or if an endpoint is gone (404/405/410). That error becomes `{ status: 'maintenance' }` and the page shows the blocking `MaintenanceNotice`. Only check fields that are actually read: checking an unused field risks locking students out over a harmless portal change.

**Site-wide maintenance switch.** `src/lib/maintenance.ts` exports `SITE_UNDER_MAINTENANCE`, read on the server only. When it's on, `src/app/layout.tsx` renders the notice instead of any page, `portal-sync/page.tsx` skips all portal work, and both server actions refuse. `MAINTENANCE_MODE=off|on` overrides it per deployment.

**Sign-in lifecycle** (`src/app/portal-sync/`). `actions.ts` has one server action, `syncFromPortal`, which handles sign-in and log-out by `intent`, plus `fetchSubjects`. Failed sign-ins are rate limited in memory (`rate-limit.ts`; per instance, so best effort). `session.ts` stores the portal's session token, plus the roll number, as AES-256-GCM-encrypted, deflated JSON split across `dontbunk_portal.0`, `.1`, … cookies (browsers drop a cookie over about 4 KB), keyed from `SESSION_SECRET`. Without the secret in production, nothing is stored and the student is signed in for that visit only. `PortalSyncForm` switches between the login card, the maintenance notice and the result. Issues found later (an expired session, a contract failure in Subjects) are raised through `onLateIssue`.

**Calendar overrides patch the portal.** `src/lib/portal/calendar-overrides.json`, keyed by year of study, holds hand-entered holidays, special Saturdays, exams and buggy sessions to ignore. `patchedTimetable` (`to-calculation-input.ts`) only fills gaps: it drops ungraded sessions on holidays and synthesizes special-Saturday and future exam sessions (flagged `synthetic`). Once the portal publishes the same thing, its rows win. `buildCalculationInput` turns portal data, the student's answers about ungraded past periods (kept in localStorage, `saved-answers.ts`) and the overrides into the domain's `CalculationRequest`.

**Domain layer is framework-free.** `src/domain/schedule/` (calendar math) and `src/domain/attendance/` (bunk/recovery calculations) have no React or portal imports and are the most heavily unit-tested part of the repo (`*.test.ts` next to the source). Business rule changes belong here first; UI just renders `AttendanceResult`.

**Calendar day-type precedence** (`src/domain/schedule/calendar.ts`, `periodsForDate`): holiday (zero periods) > exam (exam periods) > working/special Saturday (copies another weekday's timetable) > normal weekday timetable > other weekend (zero periods). The calendar UI (`MonthGrid`/`MonthCalendar`, fed by `portalMonthData` in `src/lib/portal/month-data.ts`) must respect the same order, or it and the result will disagree.

**All "today" logic goes through IST, not wall-clock time.** `currentIstDate()` in `calendar.ts` converts via `Intl.DateTimeFormat` with `Asia/Kolkata`; `buildCalendar()` buckets periods into `heldThroughYesterday` / `today` / `future` using that IST date string, not `Date` comparisons. Today itself is always excluded from calculations (attendance for today isn't final yet).

**Debug-only UI.** The "Data check" panel (`RawDataDump`) and per-call timings under sync errors are hidden unless `NEXT_PUBLIC_SHOW_DATA_CHECK=1` (`src/lib/data-check.ts`).

**Tailwind v4 tokens, one CSS-first theme.** `src/app/styles/tokens.css` defines the whole design system via `@theme` (colors, shadows, animations) and `@utility` blocks — there's no `tailwind.config.js`. Animations are `--animate-*` theme keys (used as `animate-*` classes). Dialogs and `<details>` dropdowns are animated globally there, and a global `prefers-reduced-motion` rule switches all motion off. Dialog panels animate by transform only, never opacity. The custom `phone:` breakpoint (`--breakpoint-phone: 650px`) is a `min-width` variant like any standard Tailwind breakpoint, i.e. `phone:*` classes apply at **≥650px** (wide screens), while unprefixed classes are the baseline that also covers real small phones. This reads backwards from the name — verify with a real narrow-viewport check before assuming a `phone:` override is mobile-specific.
