-- Apply after schema.sql and customer-addresses.sql. Safe to run again.
begin;
alter table public.products add column if not exists stock integer not null default 500 check (stock >= 0);
create sequence if not exists public.product_id_seq start 2000;
select setval('public.product_id_seq', greatest(2000, coalesce((select max(id) + 1 from public.products), 2000)), false);
alter table public.products alter column id set default nextval('public.product_id_seq');
grant select on public.products, public.categories, public.colors to anon, authenticated;

create table if not exists public.shop_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  request_id uuid not null,
  items jsonb not null,
  delivery jsonb not null,
  payment text not null check (payment in ('cod', 'qr')),
  total bigint not null check (total >= 0),
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  unique(user_id, request_id)
);
alter table public.shop_orders enable row level security;
revoke all on public.shop_orders from public, anon, authenticated;
grant select on public.shop_orders to authenticated;
drop policy if exists "read orders" on public.shop_orders;
create policy "read orders" on public.shop_orders for select to authenticated
using (user_id = (select auth.uid()) or (select auth.jwt()->'app_metadata'->>'role') = 'admin');

create or replace function public.add_inventory_product(p_name text, p_category text, p_price bigint, p_stock integer, p_image text)
returns public.products language plpgsql security definer set search_path = '' as $$
declare result public.products; dep text;
begin
  if auth.uid() is null or coalesce(auth.jwt()->'app_metadata'->>'role', '') <> 'admin' then raise exception 'NB_ADMIN_REQUIRED' using errcode = '42501'; end if;
  select department into dep from public.categories where id = p_category;
  if dep is null or p_name is null or length(trim(p_name)) not between 1 and 160 or p_price is null or p_price < 0 or p_stock is null or p_stock < 0
    or p_image is null or length(p_image) > 3000000 or p_image !~ '^(https?://|/img/|data:image/(png|jpeg|webp);base64,)' then raise exception 'NB_INVALID_PRODUCT'; end if;
  insert into public.products(name_vi, name_en, category, department, price, stock, images)
    values(trim(p_name), trim(p_name), p_category, dep, p_price, p_stock, array[p_image]) returning * into result;
  return result;
end $$;

create or replace function public.place_shop_order(p_items jsonb, p_address_id uuid, p_payment text, p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare customer uuid := auth.uid(); result public.shop_orders; line jsonb; product public.products;
  address jsonb; snapshot jsonb := '[]'; amount bigint := 0; qty integer; grouped record;
begin
  if customer is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) or coalesce(auth.jwt()->'app_metadata'->>'role', '') = 'admin' then raise exception 'NB_AUTH_REQUIRED' using errcode = '42501'; end if;
  -- Serialize retries for this customer; the request key prevents a second deduction.
  perform pg_advisory_xact_lock(hashtextextended(customer::text, 0));
  select * into result from public.shop_orders where user_id = customer and request_id = p_request_id;
  if found then return to_jsonb(result); end if;
  if p_request_id is null or p_payment is null or p_payment not in ('cod','qr') or p_items is null or jsonb_typeof(p_items) <> 'array' then raise exception 'NB_INVALID_ORDER'; end if;
  if jsonb_array_length(p_items) not between 1 and 200 then raise exception 'NB_INVALID_ORDER'; end if;
  select a into address from public.customer_address_books b, lateral jsonb_array_elements(b.addresses) a
    where b.user_id = customer and a->>'id' = p_address_id::text;
  if address is null then raise exception 'NB_ADDRESS_NOT_FOUND'; end if;
  for line in select value from jsonb_array_elements(p_items) loop
    if coalesce(line->>'product_id','') !~ '^[0-9]{1,15}$' or coalesce(line->>'quantity','') !~ '^[0-9]{1,2}$' then raise exception 'NB_INVALID_ORDER'; end if;
    qty := (line->>'quantity')::integer;
    if qty < 1 then raise exception 'NB_INVALID_ORDER'; end if;
  end loop;
  -- Lock in product ID order and aggregate all sizes/colors of the same product.
  for grouped in select (value->>'product_id')::bigint id, sum((value->>'quantity')::integer) quantity
    from jsonb_array_elements(p_items) group by 1 order by 1 loop
    select * into product from public.products where id = grouped.id for update;
    if not found then raise exception 'NB_PRODUCT_NOT_FOUND'; end if;
    if product.stock < grouped.quantity then raise exception 'NB_INSUFFICIENT_STOCK: %', product.name_vi; end if;
    update public.products set stock = stock - grouped.quantity where id = product.id;
  end loop;
  for line in select value from jsonb_array_elements(p_items) loop
    select * into product from public.products where id = (line->>'product_id')::bigint;
    if (cardinality(product.colors) > 0 and not coalesce(line->>'color' = any(product.colors), false))
      or (cardinality(product.sizes) > 0 and not coalesce(line->>'size' = any(product.sizes), false)) then raise exception 'NB_INVALID_ORDER'; end if;
    qty := (line->>'quantity')::integer;
    amount := amount + product.price * qty;
    snapshot := snapshot || jsonb_build_array(jsonb_build_object('product_id',product.id,'name',product.name_vi,'price',product.price,'quantity',qty,'color',line->>'color','size',line->>'size'));
  end loop;
  insert into public.shop_orders(user_id, request_id, items, delivery, payment, total)
    values(customer,p_request_id,snapshot,address,p_payment,amount) returning * into result;
  return to_jsonb(result);
end $$;
revoke all on function public.add_inventory_product(text,text,bigint,integer,text) from public, anon;
revoke all on function public.place_shop_order(jsonb,uuid,text,uuid) from public, anon;
grant execute on function public.add_inventory_product(text,text,bigint,integer,text) to authenticated;
grant execute on function public.place_shop_order(jsonb,uuid,text,uuid) to authenticated;
commit;
