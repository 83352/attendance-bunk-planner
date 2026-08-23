create table if not exists public.universal_holidays (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_date date not null,
  end_date date not null,
  check (start_date <= end_date)
);

create table if not exists public.universal_special_saturdays (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  copied_weekday smallint not null check (copied_weekday between 1 and 5)
);

insert into public.universal_holidays (name, start_date, end_date)
select distinct name, start_date, end_date
from public.holidays
where not exists (
  select 1
  from public.universal_holidays shared
  where shared.name = public.holidays.name
    and shared.start_date = public.holidays.start_date
    and shared.end_date = public.holidays.end_date
);

insert into public.universal_special_saturdays (date, copied_weekday)
select date, min(copied_weekday)
from public.special_saturdays
where not exists (
  select 1
  from public.universal_special_saturdays shared
  where shared.date = public.special_saturdays.date
)
group by date;

alter table public.universal_holidays enable row level security;
alter table public.universal_special_saturdays enable row level security;

drop policy if exists "Public can read universal holidays" on public.universal_holidays;
drop policy if exists "Admins can modify universal holidays" on public.universal_holidays;
drop policy if exists "Public can read universal special Saturdays" on public.universal_special_saturdays;
drop policy if exists "Admins can modify universal special Saturdays" on public.universal_special_saturdays;

create policy "Public can read universal holidays" on public.universal_holidays for select using (true);
create policy "Admins can modify universal holidays" on public.universal_holidays for all using (public.is_admin()) with check (public.is_admin());
create policy "Public can read universal special Saturdays" on public.universal_special_saturdays for select using (true);
create policy "Admins can modify universal special Saturdays" on public.universal_special_saturdays for all using (public.is_admin()) with check (public.is_admin());
