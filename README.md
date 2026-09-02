# Attendance Bunk Planner

A timetable-aware attendance calculator for college students. Choose your section, enter your current attendance and target, and see how many future periods you can miss while still reaching that target.

The project includes a protected admin workspace for semester dates, timetables, exams, holidays and working Saturdays.

## Features

- Branch-organized section picker
- Safe bunk count, weekly planning and recovery calculations
- IST-aware calendar calculations using `Asia/Kolkata`
- Universal holidays and working Saturdays
- Section-specific timetables and exams
- Custom exams, including duplicate display names
- Per-day exam overrides
- Supabase authentication, Postgres, RLS and atomic saves
- Optimistic locking for concurrent admin edits
- Mobile-first interface

## Requirements

- Node.js 22 or newer
- npm
- A Supabase project

## Local Development

```powershell
git clone <your-repository-url>
cd Website
npm install
npm run dev
```

Open http://localhost:3000.

## Environment Variables

Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Never commit `.env.local`, database passwords or service-role keys.

## Supabase Setup

Run migrations `001` through `013` in order in the Supabase SQL Editor. Then create an administrator in **Authentication > Users** and grant access:

```sql
insert into public.admin_profiles (user_id)
select id from auth.users
where email = 'your-admin-email@example.com';
```

Migration 011 adds safe section saves, shared-calendar locking, atomic renames and stable exam IDs. Migration 012 enforces exam/semester integrity, adds foreign-key indexes and makes the RPC the write path for schedule data. Migrations 013 and 014 add admin-only section workflows and database-side validation. Migration 013 adds admin-only section workflows.

## Calculation Rules

Calendar precedence:

1. Holiday: zero periods
2. Exam day: configured exam periods
3. Working Saturday: copied weekday timetable
4. Normal weekday: section timetable
5. Other weekend: zero periods

Today is excluded because attendance may not be final. Planning starts tomorrow and continues through semester end.

## Admin Workspace

Open `/admin/login` and sign in with an approved administrator account. The workspace manages sections, semester dates, weekday periods, exams, overrides, holidays and working Saturdays. Exams may have identical display names.

## Project Structure

```text
src/app/             Pages and UI components
src/domain/          Calendar and attendance business logic
src/lib/             Configuration, validation and Supabase clients
supabase/migrations/ Database schema, RLS and RPC migrations
```

## Validation

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

## Deployment

1. Import the repository into Vercel.
2. Set the three environment variables in Vercel.
3. Run all 13 migrations in the production Supabase project.
4. Configure the Vercel URL in Supabase Authentication URL Configuration.
5. Create or grant the production administrator.
6. Test `/`, `/admin/login` and `/admin`.

## Security

Public users can read schedule data but cannot write it. RLS and the save RPC enforce administrator access. Never expose service-role keys in browser code.

## License

This project is private unless a license is added by the repository owner.
