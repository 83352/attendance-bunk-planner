create table if not exists public.exam_period_days (
  id uuid primary key default gen_random_uuid(),
  semester_id uuid not null references public.semesters(id) on delete cascade,
  exam_name text not null check (exam_name in ('Mid 1', 'Mid 2')),
  date date not null,
  periods_per_day smallint not null check (periods_per_day in (2, 4)),
  unique (semester_id, exam_name, date)
);

alter table public.exam_period_days enable row level security;

create policy "Public can read exam day overrides" on public.exam_period_days for select using (true);
create policy "Admins can modify exam day overrides" on public.exam_period_days for all using (public.is_admin()) with check (public.is_admin());
