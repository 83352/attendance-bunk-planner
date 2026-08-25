-- The per-section holidays and special_saturdays tables were superseded by
-- universal_holidays and universal_special_saturdays (migration 003). Their
-- contents were migrated at that point; the tables are now dead weight and
-- still publicly readable, so remove them.

drop table if exists public.holidays cascade;
drop table if exists public.special_saturdays cascade;
