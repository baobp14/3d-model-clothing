-- Run after inventory.sql. Safe to apply repeatedly.
begin;
alter table public.products add column if not exists description text not null default '';
-- ADD COLUMN IF NOT EXISTS does not repair an existing nullable column.
update public.products set description = '' where description is null;
alter table public.products alter column description set default '';
alter table public.products alter column description set not null;
create or replace function public.update_inventory_product(
  p_id bigint, p_name text, p_price bigint, p_stock integer, p_description text, p_expected jsonb
) returns public.products language plpgsql security definer set search_path = '' as $$
declare product public.products;
begin
  if auth.uid() is null or coalesce(auth.jwt()->'app_metadata'->>'role', '') <> 'admin' then
    raise exception 'NB_ADMIN_REQUIRED' using errcode = '42501';
  end if;
  if p_name is null or length(trim(p_name)) not between 1 and 160 or p_price is null or p_price < 0
    or p_stock is null or p_stock < 0 or p_description is null or length(p_description) > 5000 then
    raise exception 'NB_INVALID_PRODUCT';
  end if;
  select * into product from public.products where id = p_id for update;
  if not found then raise exception 'NB_PRODUCT_NOT_FOUND'; end if;
  if p_expected is distinct from jsonb_build_object('name', product.name_vi, 'price', product.price, 'stock', product.stock, 'description', product.description) then
    raise exception 'NB_PRODUCT_CONFLICT';
  end if;
  update public.products set name_vi = trim(p_name), price = p_price, stock = p_stock, description = trim(p_description)
    where id = p_id returning * into product;
  return product;
end $$;
revoke all on function public.update_inventory_product(bigint,text,bigint,integer,text,jsonb) from public, anon;
grant execute on function public.update_inventory_product(bigint,text,bigint,integer,text,jsonb) to authenticated;
notify pgrst, 'reload schema';
commit;
