-- Compatibility for existing Supabase catalogs created before the English description column.
-- Applied on 2026-10-04. Existing products and descriptions are preserved.
begin;
set local lock_timeout = '5s';
alter table public.products add column if not exists description_en text not null default '';
commit;
