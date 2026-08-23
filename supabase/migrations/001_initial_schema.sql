create table public.sections (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table public.semesters (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.sections(id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date not null,
  unique (section_id, name),
  check (start_date <= end_date)
);

create table public.timetable_periods (
  id uuid primary key default gen_random_uuid(),
  semester_id uuid not null references public.semesters(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  sequence smallint not null check (sequence > 0),
  start_time time not null,
  end_time time not null,
  unique (semester_id, weekday, sequence),
  check (start_time < end_time)
);

create table public.holidays (
  id uuid primary key default gen_random_uuid(),
  semester_id uuid not null references public.semesters(id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date not null,
  check (start_date <= end_date)
);

create table public.special_saturdays (
  id uuid primary key default gen_random_uuid(),
  semester_id uuid not null references public.semesters(id) on delete cascade,
  date date not null,
  copied_weekday smallint not null check (copied_weekday between 1 and 5),
  unique (semester_id, date)
);

create table public.exam_periods (
  id uuid primary key default gen_random_uuid(),
  semester_id uuid not null references public.semesters(id) on delete cascade,
  name text not null check (name in ('Mid 1', 'Mid 2')),
  start_date date not null,
  end_date date not null,
  periods_per_day smallint not null check (periods_per_day in (2, 4)),
  unique (semester_id, name),
  check (start_date <= end_date)
);

create table public.admin_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role = 'admin')
);

create table public.exam_period_days (
  id uuid primary key default gen_random_uuid(),
  semester_id uuid not null references public.semesters(id) on delete cascade,
  exam_name text not null check (exam_name in ('Mid 1', 'Mid 2')),
  date date not null,
  periods_per_day smallint not null check (periods_per_day in (2, 4)),
  unique (semester_id, exam_name, date)
);

alter table public.sections enable row level security;
alter table public.semesters enable row level security;
alter table public.timetable_periods enable row level security;
alter table public.holidays enable row level security;
alter table public.special_saturdays enable row level security;
alter table public.exam_periods enable row level security;
alter table public.admin_profiles enable row level security;
alter table public.exam_period_days enable row level security;

create policy "Public can read schedule configuration" on public.sections for select using (true);
create policy "Public can read semesters" on public.semesters for select using (true);
create policy "Public can read timetable" on public.timetable_periods for select using (true);
create policy "Public can read holidays" on public.holidays for select using (true);
create policy "Public can read special Saturdays" on public.special_saturdays for select using (true);
create policy "Public can read exams" on public.exam_periods for select using (true);
create policy "Public can read exam day overrides" on public.exam_period_days for select using (true);
create policy "Admins can read profiles" on public.admin_profiles for select using (auth.uid() = user_id);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.admin_profiles where user_id = auth.uid()); $$;

create policy "Admins can modify sections" on public.sections for all using (public.is_admin()) with check (public.is_admin());
create policy "Admins can modify semesters" on public.semesters for all using (public.is_admin()) with check (public.is_admin());
create policy "Admins can modify timetable" on public.timetable_periods for all using (public.is_admin()) with check (public.is_admin());
create policy "Admins can modify holidays" on public.holidays for all using (public.is_admin()) with check (public.is_admin());
create policy "Admins can modify special Saturdays" on public.special_saturdays for all using (public.is_admin()) with check (public.is_admin());
create policy "Admins can modify exams" on public.exam_periods for all using (public.is_admin()) with check (public.is_admin());
create policy "Admins can modify exam day overrides" on public.exam_period_days for all using (public.is_admin()) with check (public.is_admin());
