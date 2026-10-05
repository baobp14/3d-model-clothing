// Isolated PostgreSQL/WASM test database for Python's psycopg driver.
// Never reads .env or connects to Supabase.
import { readFile, writeFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { PGLiteSocketServer } from '@electric-sql/pglite-socket'

const [port, readyFile] = process.argv.slice(2)
const db = new PGlite()
await db.exec(`
  create role anon;
  create role authenticated;
  create schema auth;
  create table auth.users(id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
  $$;
  create function auth.jwt() returns jsonb language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb
  $$;
`)
for (const file of ['schema.sql', 'customer-addresses.sql', 'inventory.sql', 'inventory-details.sql']) {
  await db.exec(await readFile(new URL(file, import.meta.url), 'utf8'))
}
const server = new PGLiteSocketServer({ db, port: Number(port), host: '127.0.0.1', maxConnections: 1 })
await server.start()
await writeFile(readyFile, 'ready', 'utf8')
process.stdin.resume()
process.stdin.on('data', async () => {
  await server.stop()
  await db.close()
  process.exit(0)
})
