import { after, before, beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

let db
const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'
const address = { name: 'Nguyễn An', email: 'an@example.com', phone: '0901234567', city: 'Hồ Chí Minh', address: '12 Nguyễn Huệ', notes: '' }

async function identity(id, anonymous = false) {
  await db.query("select set_config('request.jwt.claim.sub', $1, false), set_config('request.jwt.claims', $2, false)", [id || '', JSON.stringify({ is_anonymous: anonymous })])
}
async function change(action, { id = null, values = address, makeDefault = false, revision = 0 } = {}) {
  const result = await db.query('select public.manage_customer_address($1, $2::jsonb, $3::uuid, $4, $5::bigint) as book', [action, JSON.stringify(values), id, makeDefault, revision])
  return result.rows[0].book
}

before(async () => {
  db = new PGlite()
  await db.exec(`
    create role anon;
    create role authenticated;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb) $$;
    grant usage on schema auth to authenticated;
    insert into auth.users values ('${A}'), ('${B}');
  `)
  const migration = await readFile(new URL('./customer-addresses.sql', import.meta.url), 'utf8')
  await db.exec(migration)
  await db.exec(migration) // Applying the migration a second time is safe.
})
beforeEach(async () => {
  await db.exec('reset role; truncate public.customer_address_books;')
  await identity(A)
  await db.exec('set role authenticated;')
})
after(async () => { await db?.close() })

test('SQL: guests and anonymous accounts cannot save addresses', async () => {
  await identity(null)
  await assert.rejects(change('save'), /NB_AUTH_REQUIRED/)
  await identity(A, true)
  await assert.rejects(change('save'), /NB_AUTH_REQUIRED/)
  await db.exec('reset role; set role anon;')
  await assert.rejects(change('save'), /permission denied/)
})

test('SQL: first address is default and a sixth address is rejected atomically', async () => {
  let book = await change('save')
  const first = book.saved_address_id
  assert.equal(book.default_address_id, first)
  for (let i = 1; i < 5; i++) book = await change('save', { revision: book.revision })
  assert.equal(book.addresses.length, 5)
  await assert.rejects(change('save', { revision: book.revision }), /NB_ADDRESS_LIMIT/)
  const stored = (await db.query('select * from public.customer_address_books')).rows[0]
  assert.equal(stored.addresses.length, 5)
  assert.equal(stored.default_address_id, first)
  assert.equal(Number(stored.revision), 5)
  book = await change('save', { id: first, values: { ...address, address: '99 Lê Lợi' }, revision: book.revision })
  assert.equal(book.addresses.length, 5)
  assert.equal(book.default_address_id, first)
  assert.equal(book.addresses.find(a => a.id === first).address, '99 Lê Lợi')
})

test('SQL: switch default, edit and delete a default without losing the invariant', async () => {
  let book = await change('save')
  const first = book.saved_address_id
  book = await change('save', { revision: book.revision })
  const second = book.saved_address_id
  book = await change('default', { id: second, revision: book.revision })
  assert.equal(book.default_address_id, second)
  assert.equal(book.addresses.length, 2)
  book = await change('save', { id: second, values: { ...address, address: '99 Lê Lợi' }, revision: book.revision })
  assert.equal(book.default_address_id, second)
  assert.equal(book.addresses.find(a => a.id === second).address, '99 Lê Lợi')
  book = await change('delete', { id: second, revision: book.revision })
  assert.equal(book.default_address_id, first)
  book = await change('delete', { id: first, revision: book.revision })
  assert.deepEqual(book.addresses, [])
  assert.equal(book.default_address_id, null)
})

test('SQL: a newly saved default replaces the old default in the same transaction', async () => {
  let book = await change('save')
  const old = book.default_address_id
  book = await change('save', { makeDefault: true, revision: book.revision })
  assert.equal(book.default_address_id, book.saved_address_id)
  assert.notEqual(book.default_address_id, old)
  assert.equal(book.addresses.length, 2)
  assert.ok(book.addresses.some(a => a.id === old))
})

test('SQL: stale writes and simultaneous saves require a fresh confirmation', async () => {
  const first = await change('save')
  const results = await Promise.allSettled([
    change('save', { makeDefault: true, revision: first.revision }),
    change('save', { makeDefault: true, revision: first.revision }),
  ])
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1)
  assert.match(results.find(r => r.status === 'rejected').reason.message, /NB_ADDRESS_CONFLICT/)
  const stored = (await db.query('select * from public.customer_address_books')).rows[0]
  assert.equal(stored.addresses.length, 2)
  await assert.rejects(change('default', { id: first.default_address_id, revision: first.revision }), /NB_ADDRESS_CONFLICT/)
})

test('SQL: customers cannot see, edit, make default or delete another account address', async () => {
  const a = await change('save')
  await identity(B)
  assert.deepEqual((await db.query('select * from public.customer_address_books')).rows, [])
  for (const action of ['save', 'default', 'delete']) await assert.rejects(change(action, { id: a.saved_address_id }), /NB_ADDRESS_NOT_FOUND/)
  const b = await change('save')
  assert.notEqual(b.saved_address_id, a.saved_address_id)
  const visible = (await db.query('select * from public.customer_address_books')).rows
  assert.equal(visible.length, 1)
  assert.equal(visible[0].user_id, B)
})

test('SQL: direct writes cannot bypass RPC ownership or five-address limits', async () => {
  await change('save')
  await assert.rejects(db.query('update public.customer_address_books set addresses = $1', ['[]']), /permission denied/)
  await assert.rejects(db.query('insert into public.customer_address_books(user_id) values ($1)', [B]), /permission denied/)
})

test('SQL: invalid address saves roll back without changing the current default', async () => {
  const book = await change('save')
  for (const values of [{ ...address, phone: '.........' }, ...['090123456', '09012345678', '1901234567', '+84901234567', '09012a4567'].map(phone => ({ ...address, phone })), { ...address, email: 'invalid' }, { ...address, name: '' }, { ...address, address: 'x'.repeat(301) }, { ...address, notes: {} }]) {
    await assert.rejects(change('save', { values, makeDefault: true, revision: book.revision }), /NB_INVALID_ADDRESS/)
  }
  const stored = (await db.query('select * from public.customer_address_books')).rows[0]
  assert.equal(stored.default_address_id, book.default_address_id)
  assert.equal(stored.addresses.length, 1)
  assert.equal(Number(stored.revision), 1)
})
