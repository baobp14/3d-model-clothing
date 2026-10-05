-- Run this migration in Supabase SQL Editor. It does not change the catalog.
begin;

-- One locked row per customer makes the five-address limit and default switch atomic.
create table if not exists public.customer_address_books (
  user_id uuid primary key references auth.users(id) on delete cascade,
  addresses jsonb not null default '[]'::jsonb,
  default_address_id uuid,
  revision bigint not null default 0,
  updated_at timestamptz not null default now(),
  constraint customer_address_count check (
    jsonb_typeof(addresses) = 'array' and jsonb_array_length(addresses) <= 5
  ),
  constraint customer_address_default check (
    (jsonb_array_length(addresses) = 0 and default_address_id is null)
    or (jsonb_array_length(addresses) > 0 and default_address_id is not null
      and addresses @> jsonb_build_array(jsonb_build_object('id', default_address_id::text)))
  )
);

alter table public.customer_address_books enable row level security;
drop policy if exists "read own addresses" on public.customer_address_books;
create policy "read own addresses" on public.customer_address_books
  for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.customer_address_books from public, anon, authenticated;
grant select on public.customer_address_books to authenticated;

create or replace function public.manage_customer_address(
  p_action text,
  p_address jsonb default null,
  p_address_id uuid default null,
  p_make_default boolean default false,
  p_expected_revision bigint default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  customer_id uuid := auth.uid();
  book public.customer_address_books%rowtype;
  clean jsonb;
  address_id uuid;
  field text;
  field_value text;
  field_limit int;
begin
  if customer_id is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) then
    raise exception 'NB_AUTH_REQUIRED' using errcode = '42501';
  end if;
  if p_action not in ('save', 'default', 'delete') or p_action is null then
    raise exception 'NB_INVALID_ACTION';
  end if;

  insert into public.customer_address_books(user_id) values(customer_id)
    on conflict (user_id) do nothing;
  select * into book from public.customer_address_books where user_id = customer_id for update;
  if p_expected_revision is null or p_expected_revision <> book.revision then
    raise exception 'NB_ADDRESS_CONFLICT';
  end if;

  if p_action = 'save' then
    if p_address is null or jsonb_typeof(p_address) <> 'object' then
      raise exception 'NB_INVALID_ADDRESS';
    end if;
    clean := '{}'::jsonb;
    foreach field in array array['name', 'email', 'phone', 'city', 'address', 'notes'] loop
      if p_address ? field and jsonb_typeof(p_address->field) <> 'string' then
        raise exception 'NB_INVALID_ADDRESS';
      end if;
      field_value := btrim(regexp_replace(
        regexp_replace(coalesce(p_address->>field, ''), '[[:blank:]]+', ' ', 'g'),
        '(^|\n) +', '\1', 'g'
      ));
      field_limit := case field when 'phone' then 10 when 'address' then 300 when 'notes' then 500 else 120 end;
      if (field <> 'notes' and field_value = '') or char_length(field_value) > field_limit then
        raise exception 'NB_INVALID_ADDRESS';
      end if;
      clean := clean || jsonb_build_object(field, field_value);
    end loop;
    if clean->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
      or clean->>'phone' !~ '^0[0-9]{9}$' then
      raise exception 'NB_INVALID_ADDRESS';
    end if;

    if p_address_id is null then
      if jsonb_array_length(book.addresses) >= 5 then raise exception 'NB_ADDRESS_LIMIT'; end if;
      address_id := gen_random_uuid();
      clean := clean || jsonb_build_object('id', address_id::text);
      book.addresses := book.addresses || jsonb_build_array(clean);
    else
      address_id := p_address_id;
      if not book.addresses @> jsonb_build_array(jsonb_build_object('id', address_id::text)) then
        raise exception 'NB_ADDRESS_NOT_FOUND';
      end if;
      clean := clean || jsonb_build_object('id', address_id::text);
      select jsonb_agg(case when value->>'id' = address_id::text then clean else value end order by ordinality)
        into book.addresses from jsonb_array_elements(book.addresses) with ordinality;
    end if;
    if book.default_address_id is null or p_make_default then book.default_address_id := address_id; end if;
  else
    if p_address_id is null or not book.addresses @> jsonb_build_array(jsonb_build_object('id', p_address_id::text)) then
      raise exception 'NB_ADDRESS_NOT_FOUND';
    end if;
    if p_action = 'default' then
      book.default_address_id := p_address_id;
    else
      select coalesce(jsonb_agg(value order by ordinality), '[]'::jsonb) into book.addresses
        from jsonb_array_elements(book.addresses) with ordinality where value->>'id' <> p_address_id::text;
      if book.default_address_id = p_address_id then
        book.default_address_id := (book.addresses->0->>'id')::uuid;
      end if;
    end if;
  end if;

  update public.customer_address_books set addresses = book.addresses,
    default_address_id = book.default_address_id, revision = revision + 1, updated_at = now()
    where user_id = customer_id returning * into book;
  return jsonb_build_object('addresses', book.addresses, 'default_address_id', book.default_address_id,
    'revision', book.revision, 'saved_address_id', address_id);
end;
$$;

revoke all on function public.manage_customer_address(text, jsonb, uuid, boolean, bigint) from public, anon;
grant execute on function public.manage_customer_address(text, jsonb, uuid, boolean, bigint) to authenticated;
commit;
