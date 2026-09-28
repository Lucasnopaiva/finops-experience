import { createClient } from '@libsql/client';
import { api } from '../worker/index.js';

let dbAdapter;

export function createDatabaseAdapter(client) {
  let schemaReady;
  return {
    async ready() {
      schemaReady ??= client.batch([
    'CREATE TABLE IF NOT EXISTS app_state (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)',
    'CREATE TABLE IF NOT EXISTS guests (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL, company_id TEXT, company TEXT, photo TEXT NOT NULL, present TEXT NOT NULL)',
    'CREATE TABLE IF NOT EXISTS company_profiles (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, description TEXT NOT NULL, photo TEXT NOT NULL)',
    'CREATE TABLE IF NOT EXISTS linkedin_links (participant_id TEXT PRIMARY KEY NOT NULL, url TEXT NOT NULL, updated_at TEXT NOT NULL)',
      ], 'write').catch((error) => { schemaReady = null; throw error; });
      await schemaReady;
    },
    prepare(sql) {
      const statement = (args = []) => ({
        sql,
        args,
        bind(...values) { return statement(values); },
        async first() { return (await client.execute({ sql, args })).rows[0] || null; },
        async all() { return { results: (await client.execute({ sql, args })).rows }; },
        async run() { return client.execute({ sql, args }); },
      });
      return statement();
    },
    batch(statements) {
      return client.batch(statements.map(({ sql, args }) => ({ sql, args })), 'write');
    },
  };
}

function database() {
  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) return null;
  dbAdapter ??= createDatabaseAdapter(createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  }));
  return dbAdapter;
}

export async function handleApi(request) {
  const url = new URL(request.url);
  const path = url.searchParams.get('path');
  if (!path || !/^[a-z0-9/.-]+$/i.test(path)) {
    return Response.json({ error: 'Não encontrado.' }, { status: 404 });
  }
  url.pathname = `/api/${path}`;
  url.search = '';
  const DB = database();
  try {
    if (DB) await DB.ready();
    return api(request, { DB, ADMIN_PASSWORD: process.env.ADMIN_PASSWORD }, url);
  } catch {
    return Response.json({ error: 'Dados indisponíveis no momento.' }, { status: 503 });
  }
}
