# dontbunk

Can I bunk today? dontbunk signs in to the CampX student portal as the student, reads their attendance and timetable, and works out how many periods they can still miss and finish the semester at 75%, the college minimum.

Built for MGIT's CampX workspace.

## Features

- One sign-in with the CampX roll number and password; the student stays signed in on that device until they log out
- Safe bunk count, days you can miss, bunks per week, and how many classes in a row get you back to 75%
- Asks about past periods the portal hasn't marked yet, so the number is exact
- Per-subject attendance against 75%
- Semester calendar with attendance marks, holidays, exams and working Saturdays
- Holidays, exams and special Saturdays the portal hasn't published yet, added by hand (see below)
- Switches itself off with an "under maintenance" notice if the portal's responses change shape
- IST-aware date logic (`Asia/Kolkata`); today is never counted, because its attendance isn't final

## Requirements

- Node.js 22 or newer
- npm

## Local development

```bash
npm install
npm run dev
```

Open http://localhost:3000. Signing in needs a real CampX account.

## Environment variables

| Variable | Needed | What it does |
| --- | --- | --- |
| `SESSION_SECRET` | Production | Long random string used to encrypt the sign-in cookie. Without it, sign-in still works but students are asked again on every visit. Changing it signs everyone out. |
| `NEXT_PUBLIC_SITE_URL` | Optional | Public URL for metadata, `robots.txt` and the sitemap. Defaults to `https://dontbunk.vercel.app`. |
| `MAINTENANCE_MODE` | Optional | `off` lets a deployment through while the maintenance switch is on; `on` forces maintenance. See below. |
| `NEXT_PUBLIC_SHOW_DATA_CHECK` | Optional | `1` shows the "Data check" panel and per-call portal timings, for debugging against the portal. |
| `PORTAL_TIMING_LOG` | Optional | `1` (or `true`) logs each portal call's status and duration in production (always on in development). |

Locally, put them in `.env.local`. Never commit it. On Vercel, environment changes apply on the next deploy.

## Maintenance switch

`src/lib/maintenance.ts` turns the whole site off: every page shows "dontbunk will be back soon" and sign-in is refused on the server. It is **on** right now. To reopen the site, set `ON_BY_DEFAULT` to `false` and push. `MAINTENANCE_MODE` overrides it per deployment, as above.

Separately, the site switches itself off for a student whose portal responses no longer match what dontbunk expects (`src/lib/portal/contract.ts`), so a changed portal shows a maintenance notice instead of a wrong number. The server logs which endpoint and field failed, never any student data.

## Updating the calendar

The portal is often late to publish a holiday, a special Saturday or the next exam's dates. Add them to `src/lib/portal/calendar-overrides.json`, keyed by year of study (semesters 3 and 4 are year `"2"`), and push:

```json
"holidays": [{ "name": "Dussehra vacation", "start": "2026-10-19", "end": "2026-10-23" }],
"specialSaturdays": [{ "date": "2026-10-10", "copiedWeekday": 5 }],
"exams": [{ "name": "Mid 2", "start": "2026-11-02", "end": "2026-11-07", "periodsPerDay": 2 }],
"ignoredSessions": [{ "date": "2026-07-18", "subjectName": "Node JS/React JS/Django", "fromTime": "11:15", "reason": "Portal bug" }]
```

Dates are `YYYY-MM-DD`; `copiedWeekday` is 1 (Monday) to 5 (Friday). The portal always wins once it publishes the same thing, so stale entries are harmless.

## Calculation rules

Calendar precedence for each day:

1. Holiday: zero periods
2. Exam day: the exam's periods
3. Working Saturday: copies another weekday's timetable
4. Normal weekday: the student's own timetable from the portal
5. Other weekend: zero periods

Today is excluded. Planning starts tomorrow and runs to the end of the semester.

## Security

- The CampX password is used for exactly one request to the portal and is never stored or logged.
- What keeps a student signed in is the portal's own session token, encrypted (AES-256-GCM) in an httpOnly cookie on their device. Log out revokes it at the portal and deletes it.
- Failed sign-ins are rate limited per roll number and per address. This lives in each server instance's memory, so it slows guessing rather than stopping it.
- Answers to "did you attend?" questions stay in the student's browser.

## Project structure

```text
src/app/                 Pages and UI components
src/app/portal-sync/     Sign-in, server actions, session cookie, result screens
src/domain/              Calendar and attendance business logic (framework-free)
src/lib/portal/          CampX client, response checks, calendar overrides, portal-to-domain mapping
src/lib/maintenance.ts   Site-wide maintenance switch
```

## Validation

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

CI runs the same steps on every push to `main` and on pull requests.

## Deployment

Vercel, in the Mumbai region (`bom1`, see `vercel.json`). Set `SESSION_SECRET` for Production and Preview.

`vercel.json` also redirects every other address a deployment answers on (its own URL, the branch and team URLs) to the same path on `dontbunk.vercel.app`, so students only ever use the production site. It applies to deployments built from this code; previews of other branches follow their own `vercel.json`.

## Branches

- `main`: this app.
- `portal`: the previous `main`, the section-picker calculator with a Supabase admin panel.

## License

This project is private unless a license is added by the repository owner.
