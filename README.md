# Attendance Bunk Planner

Attendance Bunk Planner helps college students calculate how many future periods they can bunk while still finishing the semester at their target attendance.

The app uses a configured semester calendar and timetable instead of asking students to enter period counts manually.

## Features

- Public calculator at `/`
- Protected admin workspace at `/admin`
- Admin sign-in at `/admin/login`
- Section-specific timetables and exams
- Optimistic locking so concurrent admin saves cannot silently overwrite each other
- Universal holidays and special Saturdays
- Mid 1 and Mid 2 exam ranges with per-day overrides
- IST calendar calculations using `Asia/Kolkata`
- Mobile-first interface

## Run locally

Requirements: Node.js 20 or newer.

```powershell
cd c:\Website
npm install
npm run dev
```

Open http://localhost:3000.

Validation commands:

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

## Calculation rules

Students enter current attendance and a desired final target. The engine estimates attended periods from the entered percentage and known periods held through yesterday.

Future planning starts tomorrow. Today is excluded because today's attendance may not be reliable yet.

Calendar precedence:

1. Holiday: 0 periods
2. Exam day: configured exam periods
3. Special Saturday: copied weekday timetable
4. Normal weekday: section timetable
5. Other weekend: 0 periods

Results include maximum safe bunks, mathematical bunks per week, practical distribution, recovery periods, minimum consecutive college days, and best achievable attendance.

## Admin configuration

Administrators can manage section name, semester dates, weekday periods, Mid 1, Mid 2, individual exam-day overrides, universal holidays, and universal special Saturdays.

Timetables and exams are section-specific. Holidays and special Saturdays are universal across sections. Changing the section name and saving copies the current configuration into a new section.

All admin date fields use `dd/mm/yyyy` display format and are converted to ISO format for storage.

## Supabase setup

Create a Supabase project and copy the Project URL and anon public key from **Project Settings -> API**.

Create `c:\Website\.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
```

In Supabase **SQL Editor**, run these files in order:

1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_exam_day_overrides.sql`
3. `supabase/migrations/003_universal_calendar.sql`
4. `supabase/migrations/004_security_hardening.sql`
5. `supabase/migrations/005_atomic_save.sql`
6. `supabase/migrations/006_drop_legacy_calendar_tables.sql`
7. `supabase/migrations/007_optimistic_locking.sql`

Create an admin user in **Authentication -> Users**, then grant access:

```sql
insert into public.admin_profiles (user_id)
select id from auth.users
where email = 'your-admin-email@example.com';
```

Never commit `.env.local` or share your database password.

## Deploy to Vercel

1. Push this repository to GitHub.
2. Import it at https://vercel.com.
3. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` under **Project Settings -> Environment Variables** for Production, Preview, and Development.
4. Deploy the project.
5. Run all seven migrations in the production Supabase project.
6. In Supabase **Authentication -> URL Configuration**, set the Site URL to your Vercel URL and add `https://your-domain.vercel.app/**` as a redirect URL.
7. Create or grant the production admin user, then test `/`, `/admin/login`, and `/admin`.

Vercel detects the Next.js build settings automatically.
