// ASSETS is inserted by scripts/build-worker.mjs for the static Worker build.
import { companies as SEED_COMPANIES, participants as SEED_GUESTS } from '../src/data.js';
const jsonHeaders = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: jsonHeaders });
}

function hasAdminPassword(request, env) {
  return Boolean(env.ADMIN_PASSWORD) && request.headers.get('x-admin-password') === env.ADMIN_PASSWORD;
}

function normalizeLinkedIn(value) {
  try {
    const parsed = new URL(String(value || '').trim());
    if (parsed.protocol !== 'https:' || !['linkedin.com', 'www.linkedin.com'].includes(parsed.hostname)) return null;
    return /^\/(in|pub)\/[^/]+/.test(parsed.pathname) ? parsed.href : null;
  } catch { return null; }
}

async function ensureGuests(env) {
  const seeded = await env.DB.prepare('SELECT value FROM app_state WHERE key = ?').bind('guests_seeded').first();
  if (seeded) return;
  const statements = SEED_GUESTS.map((person) => env.DB.prepare('INSERT OR IGNORE INTO guests (id, name, role, company_id, company, photo, present) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(person.id, person.name, person.role, person.companyId || null, null, person.photo, person.present ? '1' : '0'));
  statements.push(env.DB.prepare('INSERT OR IGNORE INTO app_state (key, value) VALUES (?, ?)').bind('guests_seeded', '1'));
  await env.DB.batch(statements);
}

async function ensureCompanies(env) {
  const seeded = await env.DB.prepare('SELECT value FROM app_state WHERE key = ?').bind('companies_seeded').first();
  if (seeded) return;
  await ensureGuests(env);
  const existing = await env.DB.prepare("SELECT DISTINCT company FROM guests WHERE company IS NOT NULL AND trim(company) != ''").all();
  const profiles = Object.entries(SEED_COMPANIES).map(([id, company]) => ({ id, name: company.name }));
  for (const row of existing.results || []) {
    if (!profiles.some((company) => company.name.toLocaleLowerCase('pt-BR') === row.company.toLocaleLowerCase('pt-BR'))) {
      profiles.push({ id: `custom-${crypto.randomUUID()}`, name: row.company });
    }
  }
  const statements = profiles.map((company) => env.DB.prepare('INSERT OR IGNORE INTO company_profiles (id, name, description, photo) VALUES (?, ?, ?, ?)')
    .bind(company.id, company.name, '', ''));
  statements.push(env.DB.prepare('INSERT OR IGNORE INTO app_state (key, value) VALUES (?, ?)').bind('companies_seeded', '1'));
  await env.DB.batch(statements);
  await env.DB.batch(profiles.map((company) => env.DB.prepare('UPDATE guests SET company_id = ? WHERE company_id IS NULL AND lower(company) = lower(?)')
    .bind(company.id, company.name)));
}

function guestFromRow(row) {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    ...(row.company_id ? { companyId: row.company_id } : {}),
    ...(row.company !== null ? { company: row.company } : {}),
    photo: row.photo,
    present: row.present === '1',
  };
}

async function imageUrl(photo, env, requestUrl) {
  if (typeof photo !== 'string') return null;
  if (photo === '/guest-avatar.svg') return photo;
  if (/^https:\/\//i.test(photo)) return photo.slice(0, 1000);
  if (/^\/api\/photos\/[a-f0-9-]{36}\.jpg$/.test(photo)) return photo;
  const match = photo.match(/^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/);
  if (!match || match[1].length > 1_100_000) return null;
  // The Vercel SQLite backend stores resized photos in the database when no
  // object bucket is configured. The existing Worker continues to use R2.
  if (!env.BUCKET) return photo;
  const bytes = Uint8Array.from(atob(match[1]), (character) => character.charCodeAt(0));
  const key = `${crypto.randomUUID()}.jpg`;
  await env.BUCKET.put(key, bytes, { httpMetadata: { contentType: 'image/jpeg' } });
  return new URL(`/api/photos/${key}`, requestUrl).pathname;
}

async function saveGuest(request, env, id = null, quick = false) {
  if (!quick && !hasAdminPassword(request, env)) return json({ error: 'Acesso não autorizado.' }, 401);
  const length = Number(request.headers.get('content-length') || '0');
  if (length > (quick ? 2000 : 1_200_000)) return json({ error: 'Requisição grande demais.' }, 413);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Requisição inválida.' }, 400); }
  const guestId = quick ? `rapido-${crypto.randomUUID()}` : id || String(body.id || '');
  const name = String(body.name || '').trim();
  const role = quick ? 'Convidado(a)' : String(body.role || '').trim();
  const company = quick && body.hasCompany === false ? '' : String(body.company || '').trim();
  if (quick && (typeof body.hasCompany !== 'boolean' || (body.hasCompany && !company))) return json({ error: 'Informe se o convidado faz parte de uma empresa e, em caso positivo, o nome dela.' }, 400);
  if (!/^[a-z0-9][a-z0-9-]{1,100}$/i.test(guestId) || !name || !role || name.length > 120 || role.length > 120 || company.length > 120) {
    return json({ error: quick ? 'Confira o nome e a empresa.' : 'Confira os dados da pessoa.' }, 400);
  }
  let photo;
  try { photo = await imageUrl(quick ? '/guest-avatar.svg' : body.photo, env, request.url); }
  catch { return json({ error: 'Não foi possível salvar a foto.' }, 503); }
  if (!photo) return json({ error: 'Envie uma foto válida.' }, 400);
  let companyId = body.companyId && !Object.hasOwn(body, 'company') ? String(body.companyId).slice(0, 100) : null;
  const companyValue = quick || Object.hasOwn(body, 'company') ? company : null;
  const present = quick ? '0' : body.present ? '1' : '0';
  try {
    if (companyValue) {
      await ensureCompanies(env);
      let profile = await env.DB.prepare('SELECT id FROM company_profiles WHERE lower(name) = lower(?) LIMIT 1').bind(companyValue).first();
      if (!profile) {
        const newId = `custom-${crypto.randomUUID()}`;
        await env.DB.prepare('INSERT INTO company_profiles (id, name, description, photo) VALUES (?, ?, ?, ?)').bind(newId, companyValue, '', '').run();
        profile = { id: newId };
      }
      companyId = profile.id;
    } else if (companyValue === '') companyId = null;
    await env.DB.prepare('INSERT INTO guests (id, name, role, company_id, company, photo, present) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, role = excluded.role, company_id = excluded.company_id, company = excluded.company, photo = excluded.photo, present = excluded.present')
      .bind(guestId, name, role, companyId, companyValue, photo, present).run();
    return json({ id: guestId, name, role, ...(companyId ? { companyId } : {}), ...(companyValue !== null ? { company: companyValue } : {}), photo, present: present === '1' });
  } catch { return json({ error: 'Não foi possível salvar o convidado.' }, 503); }
}

export async function api(request, env, url) {
  const photoMatch = url.pathname.match(/^\/api\/photos\/([a-f0-9-]{36}\.jpg)$/);
  if (photoMatch && request.method === 'GET') {
    if (!env.BUCKET) return new Response('Foto indisponível.', { status: 503 });
    const object = await env.BUCKET.get(photoMatch[1]);
    return object ? new Response(object.body, { headers: { 'content-type': 'image/jpeg', 'cache-control': 'public, max-age=3600' } }) : new Response('Foto não encontrada.', { status: 404 });
  }
  if (!env.DB) return json({ error: 'Dados indisponíveis no momento.' }, 503);
  if (url.pathname === '/api/admin/verify' && request.method === 'POST') {
    let body;
    try { body = await request.json(); } catch { return json({ error: 'Requisição inválida.' }, 400); }
    return Boolean(env.ADMIN_PASSWORD) && body.password === env.ADMIN_PASSWORD
      ? new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } })
      : json({ error: 'Senha incorreta.' }, 401);
  }
  if (url.pathname === '/api/linkedin' && request.method === 'GET') {
    try {
      const result = await env.DB.prepare('SELECT participant_id, url FROM linkedin_links').all();
      return json(Object.fromEntries((result.results || []).map((row) => [row.participant_id, row.url])));
    } catch { return json({ error: 'Links indisponíveis no momento.' }, 503); }
  }
  if (url.pathname === '/api/participants' && request.method === 'GET') {
    try {
      await ensureGuests(env);
      const result = await env.DB.prepare('SELECT id, name, role, company_id, company, photo, present FROM guests ORDER BY name COLLATE NOCASE').all();
      return json((result.results || []).map(guestFromRow));
    } catch { return json({ error: 'Participantes indisponíveis no momento.' }, 503); }
  }
  if (url.pathname === '/api/companies' && request.method === 'GET') {
    try {
      await ensureCompanies(env);
      const result = await env.DB.prepare('SELECT id, name, description, photo FROM company_profiles ORDER BY name COLLATE NOCASE').all();
      return json(result.results || []);
    } catch { return json({ error: 'Empresas indisponíveis no momento.' }, 503); }
  }
  if (url.pathname === '/api/quick-guests' && request.method === 'POST') {
    try { await ensureGuests(env); return saveGuest(request, env, null, true); }
    catch { return json({ error: 'Não foi possível adicionar o convidado.' }, 503); }
  }
  const companyMatch = url.pathname.match(/^\/api\/admin\/companies\/([^/]+)$/);
  if (companyMatch && request.method === 'PUT') {
    if (!hasAdminPassword(request, env)) return json({ error: 'Acesso não autorizado.' }, 401);
    let id;
    try { id = decodeURIComponent(companyMatch[1]); } catch { return json({ error: 'Empresa inválida.' }, 400); }
    if (!/^[a-z0-9][a-z0-9-]{1,100}$/i.test(id)) return json({ error: 'Empresa inválida.' }, 400);
    let body;
    try { body = await request.json(); } catch { return json({ error: 'Requisição inválida.' }, 400); }
    const name = String(body.name || '').trim();
    const description = String(body.description || '').trim();
    if (!name || name.length > 120 || description.length > 1000) return json({ error: 'Confira o nome e a descrição da empresa.' }, 400);
    try {
      await ensureCompanies(env);
      const previous = await env.DB.prepare('SELECT name, photo FROM company_profiles WHERE id = ?').bind(id).first();
      if (!previous) return json({ error: 'Empresa não encontrada.' }, 404);
      const duplicate = await env.DB.prepare('SELECT id FROM company_profiles WHERE lower(name) = lower(?) AND id != ? LIMIT 1').bind(name, id).first();
      if (duplicate) return json({ error: 'Já existe uma empresa com este nome.' }, 409);
      const photo = body.photo ? await imageUrl(body.photo, env, request.url) : previous.photo;
      if (!photo && body.photo) return json({ error: 'Escolha uma foto válida.' }, 400);
      await env.DB.batch([
        env.DB.prepare('UPDATE company_profiles SET name = ?, description = ?, photo = ? WHERE id = ?').bind(name, description, photo, id),
        env.DB.prepare('UPDATE guests SET company = ? WHERE company_id = ? AND company IS NOT NULL').bind(name, id),
      ]);
      return json({ id, name, description, photo });
    } catch { return json({ error: 'Não foi possível salvar a empresa.' }, 503); }
  }
  if (url.pathname === '/api/admin/guests' && request.method === 'POST') {
    try { await ensureGuests(env); return saveGuest(request, env); }
    catch { return json({ error: 'Não foi possível salvar o convidado.' }, 503); }
  }
  const guestMatch = url.pathname.match(/^\/api\/admin\/guests\/([^/]+)$/);
  if (guestMatch && ['PUT', 'DELETE'].includes(request.method)) {
    if (!hasAdminPassword(request, env)) return json({ error: 'Acesso não autorizado.' }, 401);
    let id;
    try { id = decodeURIComponent(guestMatch[1]); } catch { return json({ error: 'Convidado inválido.' }, 400); }
    if (!/^[a-z0-9][a-z0-9-]{1,100}$/i.test(id)) return json({ error: 'Convidado inválido.' }, 400);
    if (request.method === 'PUT') return saveGuest(request, env, id);
    try {
      await env.DB.batch([
        env.DB.prepare('DELETE FROM linkedin_links WHERE participant_id = ?').bind(id),
        env.DB.prepare('DELETE FROM guests WHERE id = ?').bind(id),
      ]);
      return json({ id });
    } catch { return json({ error: 'Não foi possível remover o convidado.' }, 503); }
  }
  const match = url.pathname.match(/^\/api\/linkedin\/([^/]+)$/);
  if (match && (request.method === 'PUT' || request.method === 'DELETE')) {
    if (!hasAdminPassword(request, env)) return json({ error: 'Acesso não autorizado.' }, 401);
    let id;
    try { id = decodeURIComponent(match[1]); } catch { return json({ error: 'Convidado inválido.' }, 400); }
    if (!/^[a-z0-9][a-z0-9-]{1,100}$/i.test(id)) return json({ error: 'Convidado inválido.' }, 400);
    let link = '';
    if (request.method === 'PUT') {
      let body;
      try { body = await request.json(); } catch { return json({ error: 'Requisição inválida.' }, 400); }
      link = normalizeLinkedIn(body.url);
      if (!link) return json({ error: 'Informe um perfil pessoal válido do LinkedIn.' }, 400);
    }
    try {
      await env.DB.prepare('INSERT INTO linkedin_links (participant_id, url, updated_at) VALUES (?, ?, ?) ON CONFLICT(participant_id) DO UPDATE SET url = excluded.url, updated_at = excluded.updated_at')
        .bind(id, link, new Date().toISOString()).run();
      return json({ participantId: id, url: link });
    } catch { return json({ error: 'Não foi possível salvar o link.' }, 503); }
  }
  return json({ error: 'Não encontrado.' }, 404);
}

function assetResponse(path) {
  const entry = ASSETS[path];
  if (!entry) return new Response('Não encontrado.', { status: 404 });
  const bytes = Uint8Array.from(atob(entry.base64), (character) => character.charCodeAt(0));
  return new Response(bytes, {
    headers: {
      'content-type': entry.type,
      'cache-control': path.endsWith('.html') ? 'no-cache' : 'public, max-age=31536000, immutable',
      'x-content-type-options': 'nosniff',
    },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) return api(request, env, url);
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Método não permitido.', { status: 405 });
    if (url.pathname === '/conexoes') return Response.redirect(new URL('/conexoes/', url), 308);
    const path = url.pathname === '/' ? '/index.html' : url.pathname === '/conexoes/' ? '/conexoes/index.html' : url.pathname;
    return assetResponse(path);
  },
};
