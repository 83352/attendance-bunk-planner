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

CI (`.github/workflows/ci.yml`) runs, in order: `next typegen` → `lint` → `typecheck` → `test` → `build`, plus a separate `migrations` job that replays every file in `supabase/migrations/` against a throwaway Postgres container via `supabase/rehearse.sh` — a broken migration fails CI instead of failing during a manual dashboard apply. Run `bash supabase/rehearse.sh` locally against a scratch Postgres to reproduce that job.

## Architecture

**Domain layer is framework-free.** `src/domain/schedule/` (calendar math) and `src/domain/attendance/` (bunk/recovery calculations) have no React or Supabase imports and are the most heavily unit-tested part of the repo (`*.test.ts` next to the source). Business rule changes belong here first; UI just renders `AttendanceResult`/`ScheduleConfig` shapes.

**Calendar day-type precedence** (`src/domain/schedule/calendar.ts`, `periodsForDate`): holiday (zero periods) > exam (exam periods, with optional per-day overrides) > working/special Saturday (copies another weekday's timetable) > normal weekday timetable > other weekend (zero periods). Any calendar-affecting UI (the public `MonthGrid`/`MonthCalendar` and the admin calendar) must respect this same order or the two will visually disagree.

**All "today" logic goes through IST, not wall-clock time.** `currentIstDate()`/`istDate()` in `calendar.ts` convert via `Intl.DateTimeFormat` with `Asia/Kolkata`; `buildCalendar()` buckets periods into `heldThroughYesterday` / `today` / `future` using that IST date string, not `Date` comparisons. Today itself is always excluded from calculations (attendance for today isn't final yet).

**Read path vs. write path are asymmetric.** Reads go straight through `@supabase/supabase-js` `.from(table).select(...)` calls (`src/lib/load-config.ts`), gated by permissive public-read RLS policies. Writes never touch tables directly — `015_lock_down_sections_writes.sql` removed the last direct-write RLS policies, so every mutation goes through a `SECURITY DEFINER` RPC (`save_semester_config_with_id` / `save_semester_config` / `delete_section`, defined across `supabase/migrations/005`, `011`–`013`, `016`) called from `src/app/admin/actions.ts`. Those RPCs re-check `public.is_admin()` themselves — RLS alone is not the enforcement boundary. Config is validated client+server-side against `src/lib/validation/config.ts` (a Zod schema) before the RPC call, then re-validated by DB constraints/triggers as defense in depth.

**One `ScheduleConfig` shape, two writers into it.** `loadSectionConfig`/`loadAllSectionConfigs` (`src/lib/load-config.ts`) assemble the domain's `ScheduleConfig` (camelCase) from several snake_case DB tables (`sections`, `semesters`, `timetable_periods`, `exam_periods`, `exam_period_days`, plus the *universal* — i.e. shared across all sections — `universal_holidays`/`universal_special_saturdays`). The public calculator (`src/app/page.tsx` → `SectionCalculator`/`Calculator`) and the admin editor (`src/app/admin/page.tsx` → `ConfigEditor`) both consume this exact shape, and admin saves serialize it back to the RPC's `jsonb` parameters — keep both directions in sync when changing the shape.

**Shared presentational components prevent drift.** `MonthGrid`/`MonthCalendar`/`CalendarLegend` (`src/app/MonthGrid.tsx`, `MonthCalendar.tsx`) render the semester calendar for both the public calculator and the admin editor's `SemesterCalendar`, backed by the pure `monthCalendarData()` function in `calendar.ts`. Don't fork calendar-rendering logic per surface.

**`src/proxy.ts`, not `middleware.ts`.** Next.js 16 renamed the middleware entry point to `proxy.ts` / `export function proxy()` — this is a real breaking change from earlier Next versions' `middleware.ts` convention, not a typo in this repo. It refreshes the Supabase auth cookie on matched routes.

**Tailwind v4 tokens, one CSS-first theme.** `src/app/styles/tokens.css` defines the whole design system via `@theme` (colors, shadows, animations) and `@utility` blocks — there's no `tailwind.config.js`. The custom `phone:` breakpoint (`--breakpoint-phone: 650px`) is a `min-width` variant like any standard Tailwind breakpoint, i.e. `phone:*` classes apply at **≥650px** (wide screens), while unprefixed classes are the baseline that also covers real small phones. This reads backwards from the name — verify with a real narrow-viewport check before assuming a `phone:` override is mobile-specific.

**Admin auth boundary.** `/admin/*` requires a Supabase-authenticated user present in `public.admin_profiles`; `public.is_admin()` (`SECURITY DEFINER`) is the single source of truth checked both by RLS policies and inside every write RPC. `src/app/admin/layout.tsx` sets `noindex` metadata; `/admin/login` is the only unauthenticated admin route.

**Migrations are sequential and additive.** Files in `supabase/migrations/` are numbered (`001`...`016`) and must be applied in order on a fresh project; later files frequently `create or replace` functions defined earlier rather than editing old migration files in place. When fixing a bug in an existing RPC, add a new numbered migration that replaces the function — don't rewrite history.
