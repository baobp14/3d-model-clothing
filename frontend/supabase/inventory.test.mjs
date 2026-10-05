import { before, after, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
let db
const user = '11111111-1111-4111-8111-111111111111'
const address = '22222222-2222-4222-8222-222222222222'
const request = '33333333-3333-4333-8333-333333333333'
async function order(items, key = request) {
  return (await db.query('select public.place_shop_order($1::jsonb,$2::uuid,$3,$4::uuid) result', [JSON.stringify(items),address,'cod',key])).rows[0].result
}
const line = quantity => ({ product_id: 1000, quantity, color: 'white', size: 'M', price: 1 })
before(async () => {
  db = new PGlite()
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    insert into auth.users values ('${user}');`)
  await db.exec(await readFile(new URL('./schema.sql', import.meta.url), 'utf8'))
  await db.exec(await readFile(new URL('./customer-addresses.sql', import.meta.url), 'utf8'))
  const migration = await readFile(new URL('./inventory.sql', import.meta.url), 'utf8')
  await db.exec(migration)
  await db.exec(migration)
  // Existing catalogs may already have a nullable description column.
  await db.exec('alter table public.products add column if not exists description text; alter table public.products alter column description drop not null; update public.products set description = null where id = 1001;')
  const details = await readFile(new URL('./inventory-details.sql', import.meta.url), 'utf8')
  await db.exec(details)
  await db.exec(details)
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user])
  await db.query('insert into public.customer_address_books(user_id,addresses,default_address_id) values($1,$2::jsonb,$3)', [user,JSON.stringify([{ id: address, name: 'An' }]),address])
})
after(async () => { await db?.close() })
test('product edits require admin, persist fields, and reject stale stock or invalid values', async () => {
  await db.query("select set_config('request.jwt.claims','{}',false)")
  const p = (await db.query('select * from products where id=1001')).rows[0]
  assert.equal(p.description, '')
  const expected = { name: p.name_vi, price: Number(p.price), stock: p.stock, description: p.description }
  const sql = 'select * from public.update_inventory_product($1,$2,$3,$4,$5,$6::jsonb)'
  const args = [1001, 'Updated polo', 100000, 30, 'New description', JSON.stringify(expected)]
  await db.exec('set role authenticated')
  await assert.rejects(db.query(sql, args), /NB_ADMIN_REQUIRED/)
  await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({app_metadata:{role:'admin'}})])
  const updated = (await db.query(sql, args)).rows[0]
  assert.equal(updated.name_vi,'Updated polo')
  assert.equal(Number(updated.price),100000)
  assert.equal(updated.stock,30)
  assert.equal(updated.description,'New description')
  assert.equal(updated.name_en,p.name_en)
  await assert.rejects(db.query(sql, args), /NB_PRODUCT_CONFLICT/)
  await assert.rejects(db.query(sql, [1001,'Updated polo',-1,30,'',JSON.stringify(expected)]), /NB_INVALID_PRODUCT/)
  // A purchase after opening the editor must not be overwritten by the admin.
  const fresh = { name: updated.name_vi, price: Number(updated.price), stock: updated.stock, description: updated.description }
  await db.exec('reset role; update products set stock=29 where id=1001; set role authenticated;')
  await assert.rejects(db.query(sql, [1001,'Updated polo',100000,30,'New description',JSON.stringify(fresh)]), /NB_PRODUCT_CONFLICT/)
  assert.equal((await db.query('select stock from products where id=1001')).rows[0].stock,29)
  await db.query("select set_config('request.jwt.claims','{}',false)")
  await db.exec('reset role')
})
test('inventory starts at 500; order aggregates variants, uses database prices and retries once', async () => {
  assert.equal((await db.query('select stock from products where id=1000')).rows[0].stock,500)
  await db.exec('set role authenticated')
  const result = await order([line(2),line(3)])
  assert.equal(Number(result.total),14700000 * 5)
  assert.equal((await db.query('select stock from products where id=1000')).rows[0].stock,495)
  assert.equal((await order([line(2),line(3)])).id,result.id)
  assert.equal((await db.query('select stock from products where id=1000')).rows[0].stock,495)
})
test('insufficient stock and invalid variants roll back the entire order', async () => {
  await assert.rejects(order(Array.from({length:6},()=>line(99)), '44444444-4444-4444-8444-444444444444'), /NB_INSUFFICIENT_STOCK/)
  await assert.rejects(order([{...line(1),size:'INVALID'}], '55555555-5555-4555-8555-555555555555'), /NB_INVALID_ORDER/)
  assert.equal((await db.query('select stock from products where id=1000')).rows[0].stock,495)
})
test('only admins can add products; new product is visible and keeps supplied inventory', async () => {
  const sql = "select * from public.add_inventory_product('New shirt','m-shirts',120000,42,'/img/test.webp')"
  await assert.rejects(db.query(sql), /NB_ADMIN_REQUIRED/)
  await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({app_metadata:{role:'admin'}})])
  const {rows} = await db.query(sql)
  assert.equal(rows[0].stock,42)
  assert.equal(rows[0].department,'men')
  await assert.rejects(db.query('update products set stock=999 where id=1000'), /permission denied/)
  await db.query("select set_config('request.jwt.claim.sub','',false)")
  await assert.rejects(order([line(1)]), /NB_AUTH_REQUIRED/)
})
