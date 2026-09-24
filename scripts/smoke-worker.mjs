import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker from '../dist/server/index.js';

const sqlite = new DatabaseSync(':memory:');
sqlite.exec(readFileSync(new URL('../drizzle/0000_tiresome_penance.sql', import.meta.url), 'utf8'));
sqlite.exec(readFileSync(new URL('../drizzle/0001_demonic_sentry.sql', import.meta.url), 'utf8'));

function query(sql, values = []) {
  return {
    bind(...args) { return query(sql, args); },
    first: async () => sqlite.prepare(sql).get(...values),
    all: async () => ({ results: sqlite.prepare(sql).all(...values) }),
    run: async () => sqlite.prepare(sql).run(...values),
  };
}

const env = {
  ADMIN_PASSWORD: 'example-only',
  DB: {
    prepare: (sql) => query(sql),
    batch: async (statements) => {
      sqlite.exec('BEGIN');
      try { for (const statement of statements) await statement.run(); sqlite.exec('COMMIT'); }
      catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
  },
  BUCKET: { put: async () => {}, get: async () => null },
};

async function request(path, options = {}) {
  return worker.fetch(new Request(`https://example.test${path}`, options), env);
}

assert.equal((await request('/')).status, 200);
const mobile = await request('/conexoes/');
assert.equal(mobile.status, 200);
assert.match(await mobile.text(), /Conexões · FinOps Experience/);
assert.equal((await request('/conexoes')).status, 308);
assert.equal((await request('/api/admin/verify', { method: 'POST', body: JSON.stringify({ password: 'wrong' }) })).status, 401);
assert.equal((await request('/api/admin/verify', { method: 'POST', body: JSON.stringify({ password: 'example-only' }) })).status, 204);
const guests = await (await request('/api/participants')).json();
assert.equal(guests.length, 12);
assert.equal((await request('/api/linkedin/amanda-lima', { method: 'PUT', body: JSON.stringify({ url: 'https://www.linkedin.com/in/amanda-lima/' }) })).status, 401);
const authorized = { 'x-admin-password': 'example-only', 'content-type': 'application/json' };
assert.equal((await request('/api/linkedin/amanda-lima', { method: 'PUT', headers: authorized, body: JSON.stringify({ url: 'https://www.linkedin.com/in/amanda-lima/' }) })).status, 200);
assert.equal((await (await request('/api/linkedin')).json())['amanda-lima'], 'https://www.linkedin.com/in/amanda-lima/');
assert.equal((await request('/api/linkedin/amanda-lima', { method: 'DELETE', headers: authorized })).status, 200);
assert.equal((await (await request('/api/linkedin')).json())['amanda-lima'], '');

const guest = { id: 'teste-123', name: 'Teste Pessoa', role: 'Diretora', company: 'Teste Co', photo: 'https://example.com/foto.jpg', present: false };
assert.equal((await request('/api/admin/guests', { method: 'POST', body: JSON.stringify(guest) })).status, 401);
assert.equal((await request('/api/admin/guests', { method: 'POST', headers: authorized, body: JSON.stringify(guest) })).status, 200);
assert.equal((await (await request('/api/participants')).json()).length, 13);
assert.equal((await request('/api/admin/guests/teste-123', { method: 'PUT', headers: authorized, body: JSON.stringify({ ...guest, company: '' }) })).status, 200);
assert.equal((await (await request('/api/participants')).json()).find((item) => item.id === guest.id).company, '');
assert.equal((await request('/api/admin/guests/teste-123', { method: 'DELETE', headers: authorized })).status, 200);
assert.equal((await (await request('/api/participants')).json()).length, 12);
console.log('Worker: página mobile, convidados, autenticação e links verificados.');
