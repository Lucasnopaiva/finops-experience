import assert from 'node:assert/strict';
import { createClient } from '@libsql/client';
import { createDatabaseAdapter } from '../server/vercel-api.js';
import { api } from '../worker/index.js';

const client = createClient({ url: ':memory:' });
const DB = createDatabaseAdapter(client);
await DB.ready();
const env = { DB, ADMIN_PASSWORD: 'test-only' };

async function request(path, options = {}) {
  const url = new URL(`https://example.test${path}`);
  return api(new Request(url, options), env, url);
}

assert.equal((await request('/api/admin/verify', { method: 'POST', body: JSON.stringify({ password: 'wrong' }) })).status, 401);
assert.equal((await request('/api/admin/verify', { method: 'POST', body: JSON.stringify({ password: 'test-only' }) })).status, 204);
const localUrl = new URL('https://example.test/api/admin/verify');
const localResponse = await api(new Request(localUrl, { method: 'POST', body: JSON.stringify({ password: 'test-only' }) }), { DB: null, ADMIN_PASSWORD: 'test-only' }, localUrl);
assert.equal(localResponse.status, 204);
assert.equal(localResponse.headers.get('x-data-mode'), 'local');
assert.equal((await api(new Request(localUrl, { method: 'POST', body: JSON.stringify({ password: 'wrong' }) }), { DB: null, ADMIN_PASSWORD: 'test-only' }, localUrl)).status, 401);
assert.equal((await api(new Request(localUrl, { method: 'POST', body: JSON.stringify({ password: 'test-only' }) }), { DB: null }, localUrl)).status, 503);
assert.equal((await (await request('/api/participants')).json()).length, 12);
assert.equal((await (await request('/api/companies')).json()).length, 6);

const added = await request('/api/quick-guests', {
  method: 'POST',
  body: JSON.stringify({ name: 'Nova Pessoa', hasCompany: true, company: 'Empresa Teste' }),
});
assert.equal(added.status, 200);
const guest = await added.json();
assert.equal(guest.role, 'Convidado(a)');
assert.equal(guest.company, 'Empresa Teste');
assert.equal((await (await request('/api/participants')).json()).length, 13);

const photo = 'data:image/jpeg;base64,/9j/2Q==';
const updated = await request(`/api/admin/guests/${guest.id}`, {
  method: 'PUT',
  headers: { 'x-admin-password': 'test-only' },
  body: JSON.stringify({ ...guest, role: guest.role, photo }),
});
assert.equal(updated.status, 200);
assert.equal((await updated.json()).photo, photo);
assert.equal((await (await request('/api/participants')).json()).find((person) => person.id === guest.id).photo, photo);

client.close();
console.log('Vercel API: senha, cadastro e persistência SQLite verificados.');
