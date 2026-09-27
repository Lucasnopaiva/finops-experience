import QRCode from 'qrcode';
import './styles.css';
import { companies, event, participants as initialParticipants } from './data.js';

const root = document.querySelector('#app');
const GUESTS_STORAGE_KEY = 'finops-experience-guests-v1';
const NETWORK_PATH = '/conexoes/';
const PUBLIC_NETWORK_ORIGIN = 'https://finops-experience-lucasnopaivas-projects.vercel.app';

const state = {
  totemQuery: '',
  networkQuery: '',
  checkedInId: null,
  raffleOpen: false,
  raffleRunning: false,
  raffleWinner: null,
  adminOpen: false,
  adminAuthenticated: false,
  adminView: 'login',
  adminSection: 'guests',
  adminError: '',
  adminPassword: '',
  adminEditingId: null,
  adminPhoto: '',
  adminCompanyEditingId: null,
  adminCompanyPhoto: '',
  adminTapCount: 0,
  adminLastTap: 0,
  confirmDialog: null,
  quickAddOpen: false,
  networkAdminOpen: false,
  networkAdminAuthenticated: false,
  networkAdminView: 'login',
  networkAdminEditingId: null,
  networkAdminError: '',
  networkAdminPassword: '',
  networkAdminTapCount: 0,
  networkAdminLastTap: 0,
  networkAdminDeleteId: null,
  networkAdminDraft: '',
};

let guestList = loadGuests();
let companyProfiles = Object.fromEntries(Object.entries(companies).map(([id, company]) => [id, { id, ...company, description: '', photo: '' }]));
let keyboardTarget = null;
let keyboardShift = false;
let raffleTimer = null;
let raffleFinishTimer = null;
let linkedinToastTimer = null;

const icons = {
  arrow: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  back: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg>',
  search: '<svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>',
  linkedin: '<svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="5.3" cy="5.5" r="1.75"/><path d="M3.6 9h3.45v11.3H3.6zM9.45 9h3.32v1.55c.47-.87 1.62-1.82 3.33-1.82 3.57 0 4.3 2.3 4.3 5.32v6.25h-3.47v-5.55c0-1.32-.02-3.02-1.86-3.02-1.86 0-2.15 1.45-2.15 2.92v5.65H9.45z"/></svg>',
  home: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m4 11 8-7 8 7v9h-6v-6h-4v6H4z"/></svg>',
  trophy: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M8 4h8v4c0 4-1.8 6-4 6s-4-2-4-6zM8 6H4v2c0 2 1.4 3.5 4 3.5M16 6h4v2c0 2-1.4 3.5-4 3.5M12 14v4M8 20h8"/></svg>',
  check: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></svg>',
  plus: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  edit: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m4 20 4.5-1 10-10-3.5-3.5-10 10zM13.5 7l3.5 3.5"/></svg>',
  trash: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/></svg>',
  lock: '<svg aria-hidden="true" viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>',
  upload: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 16V4M7 9l5-5 5 5M5 16v4h14v-4"/></svg>',
};

function loadGuests() {
  try {
    const saved = JSON.parse(localStorage.getItem(GUESTS_STORAGE_KEY));
    if (Array.isArray(saved) && saved.length) return saved;
  } catch {
    // A lista inicial continua disponível se o armazenamento local estiver indisponível.
  }
  return initialParticipants.map((person) => ({ ...person }));
}

function persistGuests() {
  try {
    localStorage.setItem(GUESTS_STORAGE_KEY, JSON.stringify(guestList));
    return true;
  } catch {
    state.adminError = 'Não foi possível salvar. Tente usar uma foto menor.';
    return false;
  }
}

async function syncGuests() {
  try {
    const response = await fetch('/api/participants', { cache: 'no-store' });
    if (!response.ok) return;
    const serverGuests = await response.json();
    if (!Array.isArray(serverGuests)) return;
    const localById = new Map(guestList.map((person) => [person.id, person]));
    const isTotem = !window.location.pathname.startsWith(NETWORK_PATH) && routeParts()[0] !== 'networking';
    guestList = serverGuests.map((person) => ({
      ...person,
      linkedin: localById.get(person.id)?.linkedin || '',
      present: isTotem ? (localById.get(person.id)?.present ?? person.present) : person.present,
    }));
    if (isTotem) guestList.push(...[...localById.values()].filter((person) => !serverGuests.some((remote) => remote.id === person.id)));
    if (isTotem) persistGuests();
    render();
  } catch { /* Os dados mockados permanecem disponíveis quando a rede falha. */ }
}

async function syncCompanies() {
  try {
    const response = await fetch('/api/companies', { cache: 'no-store' });
    if (!response.ok) return;
    const profiles = await response.json();
    if (!Array.isArray(profiles)) return;
    companyProfiles = Object.fromEntries(profiles.map((company) => [company.id, {
      ...company,
      initials: companies[company.id]?.initials || company.name.split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase(),
      color: companies[company.id]?.color || '#ff5a1f',
    }]));
    render();
  } catch { /* Os nomes iniciais continuam disponíveis se a rede falhar. */ }
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function navigate(route) {
  hideKeyboard();
  if (window.location.hash === route) render();
  else window.location.hash = route;
}

function routeParts() {
  const onNetworkPage = window.location.pathname.startsWith(NETWORK_PATH);
  const raw = window.location.hash.replace(/^#/, '') || (onNetworkPage ? '/networking' : '/totem');
  if (onNetworkPage && !raw.startsWith('/networking')) {
    return ['networking', ...raw.split('?')[0].split('/').filter(Boolean)];
  }
  return raw.split('?')[0].split('/').filter(Boolean);
}

function networkListRoute() {
  return window.location.pathname.startsWith(NETWORK_PATH) ? '#/' : '#/networking';
}

function networkProfileRoute(id) {
  return window.location.pathname.startsWith(NETWORK_PATH) ? `#/perfil/${id}` : `#/networking/perfil/${id}`;
}

function linkedInUrl(person) {
  try {
    const url = new URL(person.linkedin || '');
    if (url.protocol !== 'https:' || !['linkedin.com', 'www.linkedin.com'].includes(url.hostname)) return null;
    return /^\/(in|pub)\/[^/]+/.test(url.pathname) ? url.href : null;
  } catch { return null; }
}

function normalizeLinkedIn(value) {
  const trimmed = value.trim();
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return linkedInUrl({ linkedin: candidate });
}

function findPerson(id) {
  return guestList.find((person) => person.id === id);
}

function personCompany(person) {
  if (person.companyId && companyProfiles[person.companyId]) return companyProfiles[person.companyId];
  if (Object.hasOwn(person, 'company')) {
    const name = person.company?.trim() || '-';
    const profile = Object.values(companyProfiles).find((company) => company.name.toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR'));
    if (profile) return profile;
    return { name, initials: name === '-' ? '—' : name.split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase(), color: '#ff5a1f' };
  }
  return { name: '-', initials: '—', color: '#6e625b' };
}

function companyLogo(person, size = 'md') {
  const company = personCompany(person);
  return `<span class="company-logo company-logo--${size}" style="--company-color:${company.color}">${escapeHtml(company.initials)}</span>`;
}

function companyPeople(person) {
  const profile = personCompany(person);
  const companyName = profile.name.toLocaleLowerCase('pt-BR');
  if (companyName === '-') return [];
  return guestList.filter((candidate) => candidate.id !== person.id && (profile.id && personCompany(candidate).id === profile.id || personCompany(candidate).name.toLocaleLowerCase('pt-BR') === companyName));
}

function personImage(person, className = '') {
  return `<img class="${className}" src="${escapeHtml(person.photo)}" alt="Foto de ${escapeHtml(person.name)}" loading="lazy" />`;
}

function presentCount() {
  return guestList.filter((person) => person.present).length;
}

function confirmedCount() {
  return guestList.length;
}

function totemHeader(step, title, { backRoute = null } = {}) {
  const titleMarkup = title === 'Lista de presença'
    ? `<p class="admin-trigger" data-action="admin-trigger">${title}</p>`
    : `<p>${title}</p>`;
  return `<header class="totem-header">
    ${backRoute ? `<button class="header-back" data-route="${backRoute}">${icons.back} Início</button>` : '<span class="event-wordmark"><i></i>FINOPS EXPERIENCE</span>'}
    <div class="step-indicator"><span>${step}</span><span class="step-line"></span><span>03</span></div>
    ${titleMarkup}
  </header>`;
}

function renderTotemHome() {
  root.innerHTML = `<main class="totem-screen totem-home" data-action="start-checkin" role="button" tabindex="0" aria-label="Iniciar check-in">
    <div class="ambient ambient--one"></div><div class="ambient ambient--two"></div>
    <header class="home-topbar">
      <span class="event-wordmark"><i></i>FINOPS EXPERIENCE</span>
      <div class="edition-badge"><span></span>${event.edition}</div>
    </header>
    <section class="hero-copy" aria-labelledby="event-title">
      <p class="eyebrow">${event.date} · ${event.venue}</p>
      <h1 id="event-title"><span>FinOps</span><em>Experience</em></h1>
      <p class="event-intro">Estratégia financeira, tecnologia<br/>e conexões em um só encontro.</p>
    </section>
    <div class="checkin-prompt" aria-hidden="true">
      <span class="checkin-copy"><small>CHECK-IN</small><strong>Toque em qualquer lugar<br/>para fazer o Check-in</strong></span>
    </div>
    <footer class="home-footer">
      <button class="raffle-button" data-action="open-raffle">${icons.trophy}<span>Realizar sorteio</span></button>
    </footer>
    ${state.raffleOpen ? raffleModal() : ''}
  </main>`;
}

function raffleModal() {
  const eligible = guestList.filter((person) => person.present);
  const display = state.raffleWinner || (state.raffleRunning ? eligible[0] : null);
  return `<div class="modal-backdrop" data-action="noop" role="dialog" aria-modal="true" aria-labelledby="raffle-title">
    <section class="raffle-modal">
      <button class="icon-close" data-action="close-raffle" aria-label="Fechar sorteio">×</button>
      <span class="modal-kicker">SORTEIO · ${eligible.length} ${eligible.length === 1 ? 'PRESENTE ELEGÍVEL' : 'PRESENTES ELEGÍVEIS'}</span>
      <h2 id="raffle-title">Quem leva<br/><em>essa experiência?</em></h2>
      ${eligible.length ? `${display || state.raffleRunning ? `<div class="raffle-stage ${state.raffleRunning ? 'is-running' : ''}">
        <div class="winner-avatar"><img id="raffle-avatar" src="${escapeHtml(display.photo)}" alt="Foto de ${escapeHtml(display.name)}" /></div>
        <div><small>${state.raffleWinner ? 'TEMOS UM VENCEDOR' : 'SORTEANDO ENTRE OS PRESENTES'}</small><strong id="raffle-name">${escapeHtml(display.name)}</strong><span id="raffle-company">${escapeHtml(personCompany(display).name)}</span></div>
      </div>` : `<div class="raffle-stage raffle-stage--ready"><div class="raffle-ready-icon">${icons.trophy}</div><div><small>PRONTO PARA COMEÇAR</small><strong>Nenhum nome revelado</strong><span>Toque no botão abaixo para realizar o sorteio.</span></div></div>`}
      <button class="primary-button primary-button--orange" data-action="run-raffle" ${state.raffleRunning ? 'disabled' : ''}>${state.raffleRunning ? 'Sorteando…' : state.raffleWinner ? 'Sortear novamente' : 'Iniciar sorteio'} ${icons.arrow}</button>`
      : '<div class="empty-raffle">Nenhum convidado presente para o sorteio.</div>'}
    </section>
  </div>`;
}

function renderAttendance() {
  hideKeyboard();
  root.innerHTML = `<main class="totem-screen attendance-screen">
    <div class="attendance-head">
      ${totemHeader('02', 'Lista de presença', { backRoute: '#/totem' })}
      <div class="attendance-title">
        <div><p class="eyebrow eyebrow--dark">FAÇA SEU CHECK-IN</p><h1>Encontre<br/><em>seu nome.</em></h1></div>
        <div class="presence-count"><strong>${presentCount()}</strong><span>pessoas<br/>presentes</span></div>
      </div>
    </div>
    <section class="attendance-panel">
      <div class="attendance-toolbar">
        <p><strong>${confirmedCount()}</strong> convidados confirmados</p>
        <label class="search-field search-field--totem">${icons.search}<input id="totem-search" data-keyboard type="search" placeholder="Busque seu nome" value="${escapeHtml(state.totemQuery)}" autocomplete="off" /></label>
      </div>
      <div id="attendance-list" class="attendance-list">${attendanceRows(state.totemQuery)}</div>
      <p class="privacy-note">Toque no seu nome para confirmar sua presença e acessar seu QR Code.</p>
    </section>
    ${state.adminOpen ? adminOverlay() : ''}
    ${state.confirmDialog ? confirmationOverlay() : ''}
    ${state.quickAddOpen ? quickAddOverlay() : ''}
  </main>`;
}

function attendanceRows(query = '') {
  const normalized = query.trim().toLocaleLowerCase('pt-BR');
  const filtered = guestList.filter((person) => person.name.toLocaleLowerCase('pt-BR').includes(normalized));
  const rows = filtered.length ? filtered.map((person, index) => `<button class="attendance-row" data-person="${person.id}" style="--delay:${index * 28}ms">
    <span class="row-number">${String(index + 1).padStart(2, '0')}</span>
    ${personImage(person, 'row-avatar')}
    <span class="row-person"><strong>${escapeHtml(person.name)}</strong><small>${escapeHtml(person.role)} · ${escapeHtml(personCompany(person).name)}</small></span>
    ${person.present ? `<span class="present-badge">${icons.check} Presente</span>` : '<span class="tap-label">Sou eu</span>'}
    <span class="row-arrow">${icons.arrow}</span>
  </button>`).join('') : `<div class="empty-state"><strong>Nenhum nome encontrado.</strong><span>Confira a busca ou adicione o convidado à lista.</span></div>`;
  return `${rows}<button class="quick-add-row" type="button" data-action="open-quick-add">${icons.plus}<span>Adicionar convidado à lista</span>${icons.arrow}</button>`;
}

function quickAddOverlay() {
  return `<div class="modal-backdrop quick-add-backdrop" role="dialog" aria-modal="true" aria-labelledby="quick-add-title">
    <section class="quick-add-card">
      <button class="icon-close" type="button" data-action="close-quick-add" aria-label="Fechar cadastro rápido">×</button>
      <span class="modal-kicker">CADASTRO RÁPIDO</span>
      <h2 id="quick-add-title">Adicionar convidado</h2>
      <form id="quick-add-form">
        <label>Nome<input data-keyboard name="name" inputmode="none" autocomplete="off" maxlength="120" required placeholder="Nome completo" /></label>
        <fieldset class="quick-company-choice"><legend>Possui empresa?</legend>
          <label><input type="radio" name="hasCompany" value="true" /> Sim</label>
          <label><input type="radio" name="hasCompany" value="false" checked /> Não</label>
        </fieldset>
        <label id="quick-company-field" hidden>Empresa<input data-keyboard name="company" inputmode="none" autocomplete="off" maxlength="120" placeholder="Nome da empresa" /></label>
        <span id="quick-add-error" class="form-error" role="alert"></span>
        <button class="primary-button" type="submit">Adicionar à lista ${icons.arrow}</button>
      </form>
    </section>
  </div>`;
}

function confirmationOverlay() {
  const person = findPerson(state.confirmDialog?.personId);
  if (!person) return '';
  const type = state.confirmDialog.type;
  const isCheckIn = type === 'confirm-presence';
  const isDelete = type === 'delete-guest';
  const title = isCheckIn ? `É você, ${person.name.split(' ')[0]}?` : isDelete ? 'Remover convidado?' : 'Retirar presença?';
  const description = isCheckIn
    ? `Confirme seus dados antes de continuar: ${person.role} · ${personCompany(person).name}.`
    : isDelete
      ? `${person.name} será removido da lista de convidados.`
      : `${person.name} voltará a aparecer como “Sou eu” na lista.`;
  const action = isCheckIn ? 'confirm-checkin' : isDelete ? 'confirm-delete-guest' : 'confirm-remove-presence';
  const label = isCheckIn ? 'Sim, confirmar' : isDelete ? 'Remover convidado' : 'Retirar presença';
  return `<div class="modal-backdrop modal-backdrop--confirm" data-action="noop" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
    <section class="confirm-card">
      <div class="confirm-person">${personImage(person)}<span>${isCheckIn ? icons.check : icons.trash}</span></div>
      <span class="modal-kicker">${isCheckIn ? 'CONFIRMAÇÃO DE CHECK-IN' : isDelete ? 'GERENCIAR CONVIDADOS' : 'PRESENÇA ATUAL'}</span>
      <h2 id="confirm-title">${escapeHtml(title)}</h2>
      <p>${escapeHtml(description)}</p>
      <div class="confirm-actions">
        <button class="secondary-button" data-action="cancel-confirmation">Cancelar</button>
        <button class="primary-button ${isCheckIn ? '' : 'primary-button--danger'}" data-action="${action}">${label}</button>
      </div>
    </section>
  </div>`;
}

function adminOverlay() {
  if (state.adminView === 'choose') return adminChooser();
  if (!state.adminAuthenticated || state.adminView === 'login') return adminLogin();
  if (state.adminView === 'form') return adminGuestForm();
  if (state.adminView === 'companies') return adminCompanyList();
  if (state.adminView === 'company-form') return adminCompanyForm();
  return adminGuestList();
}

function adminShell(content, className = '') {
  return `<div class="modal-backdrop admin-backdrop" data-action="noop" role="dialog" aria-modal="true" aria-label="Administração do evento">
    <section class="admin-modal ${className}">
      <button class="icon-close" data-action="close-admin" aria-label="Fechar administração">×</button>
      ${content}
    </section>
  </div>`;
}

function adminChooser() {
  return adminShell(`<div class="admin-choice-heading"><span class="modal-kicker">ADMINISTRAÇÃO</span><h2>O que deseja<br/><em>gerenciar?</em></h2></div>
    <div class="admin-choice-grid">
      <button data-action="choose-admin" data-section="companies"><span class="admin-choice-icon">${icons.edit}</span><strong>Empresas</strong><small>Nome, descrição e foto</small>${icons.arrow}</button>
      <button data-action="choose-admin" data-section="guests"><span class="admin-choice-icon">${icons.plus}</span><strong>Convidados</strong><small>Adicionar, editar e remover</small>${icons.arrow}</button>
    </div>`, 'admin-modal--choice');
}

function adminLogin() {
  return adminShell(`<div class="admin-login">
    <span class="admin-lock">${icons.lock}</span>
    <span class="modal-kicker">ACESSO RESTRITO</span>
    <h2>Gerenciar<br/><em>${state.adminSection === 'companies' ? 'empresas.' : 'convidados.'}</em></h2>
    <p>Digite a senha de operação do evento para continuar.</p>
    <form id="admin-login-form">
      <label>Senha<input id="admin-password" data-keyboard type="password" name="password" inputmode="none" autocomplete="off" placeholder="Digite a senha" /></label>
      ${state.adminError ? `<span class="form-error">${escapeHtml(state.adminError)}</span>` : ''}
      <button class="primary-button" type="submit">Entrar ${icons.arrow}</button>
    </form>
  </div>`, 'admin-modal--login');
}

function adminGuestList() {
  const rows = guestList.map((person) => `<div class="admin-guest-row">
    ${personImage(person)}
    <div><strong>${escapeHtml(person.name)}</strong><span>${escapeHtml(person.role)} · ${escapeHtml(personCompany(person).name)}</span></div>
    <span class="admin-status ${person.present ? 'is-present' : ''}">${person.present ? 'Presente' : 'Pendente'}</span>
    <button data-action="edit-guest" data-id="${person.id}" aria-label="Editar ${escapeHtml(person.name)}">${icons.edit}</button>
    <button data-action="delete-guest" data-id="${person.id}" aria-label="Remover ${escapeHtml(person.name)}">${icons.trash}</button>
  </div>`).join('');
  return adminShell(`<header class="admin-heading">
      <div><span class="modal-kicker">ADMINISTRAÇÃO</span><h2>Convidados</h2><p>${guestList.length} convidados cadastrados</p></div>
      <button class="primary-button admin-add" data-action="add-guest">${icons.plus} Adicionar convidado</button>
    </header>
    ${state.adminError ? `<span class="form-error">${escapeHtml(state.adminError)}</span>` : ''}
    <div class="admin-guest-list">${rows || '<div class="empty-state"><strong>Nenhum convidado.</strong></div>'}</div>`, 'admin-modal--list');
}

function adminGuestForm() {
  const person = state.adminEditingId ? findPerson(state.adminEditingId) : null;
  const company = person ? personCompany(person).name : '';
  const photo = state.adminPhoto || person?.photo || '';
  return adminShell(`<div class="admin-form-heading">
      <button class="admin-back" data-action="admin-list">${icons.back} Voltar</button>
      <span class="modal-kicker">${person ? 'EDITAR CONVIDADO' : 'NOVO CONVIDADO'}</span>
      <h2>${person ? 'Atualize os dados.' : 'Adicione à lista.'}</h2>
    </div>
    <form id="guest-form" class="guest-form">
      <div class="guest-fields">
        <label>Nome<input name="name" autocomplete="off" required placeholder="Nome completo" value="${escapeHtml(person?.name || '')}" /></label>
        <label>Cargo<input name="role" autocomplete="off" required placeholder="Cargo ou função" value="${escapeHtml(person?.role || '')}" /></label>
        <label>LinkedIn <small>opcional</small><input name="linkedin" type="url" autocomplete="off" placeholder="linkedin.com/in/seu-perfil" value="${escapeHtml(person?.linkedin || '')}" /></label>
        <label>Empresa <small>opcional</small><input name="company" autocomplete="off" placeholder="Será exibido “-” se ficar vazio" value="${escapeHtml(company === '-' ? '' : company)}" /></label>
      </div>
      <div class="photo-field">
        <span>Foto</span>
        <div class="photo-preview ${photo ? 'has-photo' : ''}">${photo ? `<img id="guest-photo-preview" src="${photo}" alt="Prévia da foto" />` : `<span id="guest-photo-placeholder">${icons.upload}<small>Selecione uma foto</small></span>`}</div>
        <label class="secondary-button photo-upload">${icons.upload} ${photo ? 'Trocar foto' : 'Escolher foto'}<input id="guest-photo" type="file" accept="image/*" ${photo ? '' : 'required'} /></label>
      </div>
      <span class="form-error guest-form-error" id="guest-form-error">${escapeHtml(state.adminError)}</span>
      <button class="primary-button guest-save" type="submit">${person ? 'Salvar alterações' : 'Adicionar convidado'} ${icons.arrow}</button>
    </form>`, 'admin-modal--form');
}

function adminCompanyList() {
  const rows = Object.values(companyProfiles).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')).map((company) => `<div class="admin-company-row">
    ${company.photo ? `<img src="${escapeHtml(company.photo)}" alt="Foto da empresa ${escapeHtml(company.name)}" />` : `<span class="admin-company-initials">${escapeHtml(company.initials)}</span>`}
    <div><strong>${escapeHtml(company.name)}</strong><span>${escapeHtml(company.description || 'Sem descrição cadastrada')}</span></div>
    <button data-action="edit-company" data-id="${escapeHtml(company.id)}" aria-label="Editar ${escapeHtml(company.name)}">${icons.edit}</button>
  </div>`).join('');
  return adminShell(`<header class="admin-heading"><div><button class="admin-back" data-action="admin-choose">${icons.back} Voltar</button><span class="modal-kicker">ADMINISTRAÇÃO</span><h2>Empresas</h2><p>Edite os dados exibidos nos perfis dos participantes.</p></div></header>
    ${state.adminError ? `<span class="form-error">${escapeHtml(state.adminError)}</span>` : ''}
    <div class="admin-guest-list">${rows || '<div class="empty-state"><strong>Nenhuma empresa cadastrada.</strong></div>'}</div>`, 'admin-modal--list');
}

function adminCompanyForm() {
  const company = companyProfiles[state.adminCompanyEditingId];
  if (!company) return adminCompanyList();
  const photo = state.adminCompanyPhoto || company.photo;
  return adminShell(`<div class="admin-form-heading"><button class="admin-back" data-action="company-list">${icons.back} Voltar</button><span class="modal-kicker">EDITAR EMPRESA</span><h2>${escapeHtml(company.name)}</h2></div>
    <form id="company-form" class="guest-form company-form">
      <div class="guest-fields">
        <label>Nome<input data-keyboard name="name" inputmode="none" autocomplete="off" maxlength="120" required placeholder="Nome da empresa" value="${escapeHtml(company.name)}" /></label>
        <label>Descrição<textarea data-keyboard name="description" inputmode="none" maxlength="1000" placeholder="Conte um pouco sobre a empresa">${escapeHtml(company.description)}</textarea></label>
      </div>
      <div class="photo-field"><span>Foto da empresa</span><div class="photo-preview ${photo ? 'has-photo' : ''}">${photo ? `<img src="${escapeHtml(photo)}" alt="Prévia da empresa" />` : `<span>${icons.upload}<small>Nenhuma foto cadastrada</small></span>`}</div>
        <label class="secondary-button photo-upload">${icons.upload} ${photo ? 'Trocar foto' : 'Escolher foto'}<input id="company-photo" type="file" accept="image/*" /></label></div>
      <span class="form-error guest-form-error" id="company-form-error">${escapeHtml(state.adminError)}</span>
      <button class="primary-button guest-save" type="submit">Salvar empresa ${icons.arrow}</button>
    </form>`, 'admin-modal--form');
}

function renderQr(id) {
  hideKeyboard();
  const person = findPerson(id) || guestList[0];
  if (!person) return navigate('#/totem/presenca');
  state.checkedInId = person.id;
  // QR Codes must always use the public production alias. If the totem is
  // opened from a protected preview URL, using window.location.origin would
  // send guests to a Vercel login screen.
  const networkUrl = `${PUBLIC_NETWORK_ORIGIN}${NETWORK_PATH}?from=${encodeURIComponent(person.id)}`;
  root.innerHTML = `<main class="totem-screen qr-screen">
    ${totemHeader('03', 'Conecte-se')}
    <section class="qr-content">
      <div class="confirmation-copy" aria-live="polite">
        <div class="success-ring"><span>${icons.check}</span></div>
        <p class="eyebrow confirmation-label">PRESENÇA CONFIRMADA</p>
        <h1>Olá, ${escapeHtml(person.name.split(' ')[0])}.<br/><em>Que bom ter você aqui.</em></h1>
        <p class="qr-intro">Aproxime a câmera do celular para conhecer os participantes e criar novas conexões.</p>
      </div>
      <div class="qr-card"><canvas id="qr-canvas" aria-label="QR Code para acessar a área de networking"></canvas><div><span></span><strong>ESCANEIE PARA CONECTAR</strong><span></span></div></div>
    </section>
    <footer class="qr-actions">
      <button class="secondary-button" data-route="#/totem/presenca">${icons.back} Voltar para a lista</button>
      <button class="primary-button" data-route="#/totem">${icons.home} Voltar ao início</button>
    </footer>
  </main>`;
  requestAnimationFrame(() => {
    const canvas = document.querySelector('#qr-canvas');
    if (canvas) QRCode.toCanvas(canvas, networkUrl, { width: 330, margin: 2, color: { dark: '#17110e', light: '#f5eee6' }, errorCorrectionLevel: 'H' });
  });
}

function mobileHeader({ back = false } = {}) {
  return `<header class="mobile-header">${back ? `<button class="mobile-back" data-action="mobile-back" aria-label="Voltar">${icons.back}</button>` : '<span class="event-dot" aria-hidden="true"></span>'}<button class="mobile-event mobile-secret-trigger" data-action="network-admin-trigger" aria-label="FinOps Experience">FINOPS EXPERIENCE</button></header>`;
}

function participantCard(person, index = 0) {
  return `<button class="network-card" data-profile="${person.id}" style="--delay:${index * 45}ms">
    <span class="photo-wrap">${personImage(person)}</span>
    <span class="network-card-copy"><strong>${escapeHtml(person.name)}</strong><span>${escapeHtml(person.role)}</span><small>${companyLogo(person, 'sm')}${escapeHtml(personCompany(person).name)}</small></span>
    <span class="network-arrow">${icons.arrow}</span>
  </button>`;
}

function filteredNetworkGuests() {
  const normalized = state.networkQuery.trim().toLocaleLowerCase('pt-BR');
  return guestList.filter((person) => person.name.toLocaleLowerCase('pt-BR').includes(normalized) || personCompany(person).name.toLocaleLowerCase('pt-BR').includes(normalized));
}

function renderNetworking() {
  hideKeyboard();
  const filtered = filteredNetworkGuests();
  root.innerHTML = `<main class="mobile-screen network-list-screen">
    ${mobileHeader()}
    <section class="network-hero"><span class="network-count">${guestList.length} PARTICIPANTES</span><h1>Conexões que<br/><em>movem o futuro.</em></h1><p>Encontre quem você conheceu — e quem ainda vai conhecer.</p></section>
    <div class="network-sticky">
      <label class="search-field search-field--mobile">${icons.search}<input id="network-search" type="search" placeholder="Busque por nome ou empresa" value="${escapeHtml(state.networkQuery)}" autocomplete="off" /></label>
      <div class="result-meta"><span>Participantes</span><strong id="result-count">${filtered.length}</strong></div>
    </div>
    <section id="network-grid" class="network-grid">${filtered.length ? filtered.map(participantCard).join('') : `<div class="empty-state empty-state--mobile"><strong>Nenhuma conexão encontrada.</strong><span>Tente buscar por outro nome ou empresa.</span></div>`}</section>
    <footer class="mobile-footer">Conexões que continuam depois do evento.</footer>
    ${state.networkAdminOpen ? networkAdminOverlay() : ''}
  </main>`;
}

function renderProfile(id) {
  hideKeyboard();
  const person = findPerson(id) || guestList[0];
  if (!person) return navigate(networkListRoute());
  const company = personCompany(person);
  const colleagues = companyPeople(person);
  root.innerHTML = `<main class="mobile-screen profile-screen">
    ${mobileHeader({ back: true })}
    <section class="profile-hero"><div class="profile-photo">${personImage(person)}<span>${companyLogo(person, 'lg')}</span></div><div class="profile-heading"><h1>${escapeHtml(person.name)}</h1><p>${escapeHtml(person.role)}<br/><strong>${escapeHtml(company.name)}</strong></p></div></section>
    <section class="profile-body">
      ${linkedInUrl(person) ? `<a class="linkedin-icon" href="${escapeHtml(linkedInUrl(person))}" target="_blank" rel="noopener noreferrer" aria-label="Abrir LinkedIn de ${escapeHtml(person.name)}">${icons.linkedin}</a>` : `<button class="linkedin-icon" type="button" data-action="linkedin-unavailable" aria-label="LinkedIn não cadastrado para ${escapeHtml(person.name)}">${icons.linkedin}</button>`}
      <div class="company-block"><span class="section-kicker">EMPRESA</span><div class="company-feature">${company.photo ? `<img class="company-feature-photo" src="${escapeHtml(company.photo)}" alt="Foto da empresa ${escapeHtml(company.name)}" />` : companyLogo(person, 'xl')}<div><strong>${escapeHtml(company.name)}</strong><span>${company.description ? escapeHtml(company.description) : company.name === '-' ? 'Não informada' : 'Empresa deste participante'}</span></div></div></div>
      ${company.name !== '-' ? `<div class="colleagues-block"><div class="section-title"><div><span class="section-kicker">MAIS CONEXÕES</span><h2>Também da ${escapeHtml(company.name)}</h2></div><strong>${colleagues.length}</strong></div><div class="colleague-list">${colleagues.length ? colleagues.map(participantCard).join('') : '<p class="solo-company">Você encontrou o único participante desta empresa por aqui.</p>'}</div></div>` : ''}
    </section>
    <div id="linkedin-toast" class="linkedin-toast" role="status" aria-live="polite" hidden>Nenhum link do LinkedIn cadastrado.</div>
    ${state.networkAdminOpen ? networkAdminOverlay() : ''}
  </main>`;
}

function showLinkedInUnavailable() {
  const toast = document.querySelector('#linkedin-toast');
  if (!toast) return;
  window.clearTimeout(linkedinToastTimer);
  toast.hidden = false;
  linkedinToastTimer = window.setTimeout(() => { toast.hidden = true; }, 3000);
}

function networkAdminOverlay() {
  if (!state.networkAdminAuthenticated || state.networkAdminView === 'login') {
    return `<div class="modal-backdrop network-admin-backdrop" role="dialog" aria-modal="true" aria-label="Gerenciar LinkedIn">
      <section class="network-admin-modal network-admin-modal--login">
        <button class="icon-close" data-action="network-admin-close" aria-label="Fechar administração">×</button>
        <span class="admin-lock">${icons.lock}</span><span class="modal-kicker">ACESSO RESTRITO</span>
        <h2>Links do<br/><em>LinkedIn.</em></h2>
        <p>Digite a senha de operação do evento.</p>
        <form id="network-admin-login"><label>Senha<input name="password" type="password" required autocomplete="off" placeholder="Digite a senha" /></label>
          ${state.networkAdminError ? `<span class="form-error">${escapeHtml(state.networkAdminError)}</span>` : ''}
          <button class="primary-button" type="submit">Entrar ${icons.arrow}</button></form>
      </section>
    </div>`;
  }
  if (state.networkAdminView === 'form') {
    const person = findPerson(state.networkAdminEditingId);
    return `<div class="modal-backdrop network-admin-backdrop" role="dialog" aria-modal="true" aria-label="Editar LinkedIn">
      <section class="network-admin-modal">
        <button class="icon-close" data-action="network-admin-close" aria-label="Fechar administração">×</button>
        <button class="admin-back" data-action="network-admin-list">${icons.back} Voltar</button>
        <span class="modal-kicker">PERFIL PROFISSIONAL</span>
        <h2>${escapeHtml(person?.name || 'Convidado')}</h2>
        <p>Adicione o endereço do perfil pessoal no LinkedIn.</p>
        <form id="network-admin-form"><label>Link do LinkedIn<input name="linkedin" type="url" required inputmode="url" autocomplete="url" placeholder="https://www.linkedin.com/in/..." value="${escapeHtml(state.networkAdminDraft)}" /></label>
          ${state.networkAdminError ? `<span class="form-error">${escapeHtml(state.networkAdminError)}</span>` : ''}
          <button class="primary-button" type="submit">Salvar link ${icons.arrow}</button></form>
      </section>
    </div>`;
  }
  const rows = guestList.map((person) => `<div class="network-admin-row">
      ${personImage(person)}<div><strong>${escapeHtml(person.name)}</strong><span>${linkedInUrl(person) ? 'Perfil cadastrado' : 'Sem link cadastrado'}</span></div>
      <button data-action="network-admin-edit" data-id="${escapeHtml(person.id)}" aria-label="${linkedInUrl(person) ? 'Editar' : 'Adicionar'} link de ${escapeHtml(person.name)}">${linkedInUrl(person) ? icons.edit : icons.plus}</button>
      ${linkedInUrl(person) ? `<button data-action="network-admin-remove" data-id="${escapeHtml(person.id)}" aria-label="Remover link de ${escapeHtml(person.name)}">${icons.trash}</button>` : ''}
    </div>`).join('');
  return `<div class="modal-backdrop network-admin-backdrop" role="dialog" aria-modal="true" aria-label="Gerenciar LinkedIn">
    <section class="network-admin-modal network-admin-modal--list">
      <button class="icon-close" data-action="network-admin-close" aria-label="Fechar administração">×</button>
      <span class="modal-kicker">ADMINISTRAÇÃO</span><h2>LinkedIn dos<br/><em>convidados.</em></h2>
      <p>Adicione, atualize ou remova os perfis profissionais.</p>
      <div class="network-admin-rows">${rows}</div>
      ${state.networkAdminError ? `<span class="form-error">${escapeHtml(state.networkAdminError)}</span>` : ''}
      ${state.networkAdminDeleteId ? `<div class="network-admin-confirm"><p>Remover o link de ${escapeHtml(findPerson(state.networkAdminDeleteId)?.name || 'este convidado')}?</p><div><button class="secondary-button" data-action="network-admin-cancel-remove">Cancelar</button><button class="primary-button primary-button--danger" data-action="network-admin-confirm-remove">Remover link</button></div></div>` : ''}
    </section>
  </div>`;
}

function renderNetworkCurrent() {
  const [, page, id] = routeParts();
  if (page === 'perfil') renderProfile(id);
  else renderNetworking();
}

async function syncLinkedInLinks() {
  try {
    const response = await fetch('/api/linkedin', { cache: 'no-store' });
    if (!response.ok) return;
    const links = await response.json();
    for (const person of guestList) if (Object.hasOwn(links, person.id)) person.linkedin = links[person.id] || '';
    render();
  } catch { /* A lista continua visível mesmo se a conexão falhar. */ }
}

function openNetworkAdmin() {
  state.networkAdminOpen = true;
  state.networkAdminAuthenticated = false;
  state.networkAdminView = 'login';
  state.networkAdminError = '';
  state.networkAdminDeleteId = null;
  renderNetworkCurrent();
}

function handleNetworkAdminTrigger() {
  const now = Date.now();
  state.networkAdminTapCount = now - state.networkAdminLastTap < 900 ? state.networkAdminTapCount + 1 : 1;
  state.networkAdminLastTap = now;
  if (state.networkAdminTapCount >= 5) { state.networkAdminTapCount = 0; openNetworkAdmin(); }
}

async function saveLinkedIn(id, url, password = state.networkAdminPassword) {
  const response = await fetch(`/api/linkedin/${encodeURIComponent(id)}`, {
    method: url ? 'PUT' : 'DELETE',
    headers: { 'content-type': 'application/json', 'x-admin-password': password },
    body: url ? JSON.stringify({ url }) : undefined,
  });
  if (!response.ok) throw new Error('Não foi possível salvar o link. Confira a conexão e tente novamente.');
  const person = findPerson(id);
  if (person) person.linkedin = url;
}

async function saveGuestOnServer(person, editing) {
  const path = editing ? `/api/admin/guests/${encodeURIComponent(person.id)}` : '/api/admin/guests';
  const response = await fetch(path, {
    method: editing ? 'PUT' : 'POST',
    headers: { 'content-type': 'application/json', 'x-admin-password': state.adminPassword },
    body: JSON.stringify(person),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'Não foi possível salvar o convidado. Tente novamente.');
  return result;
}

async function deleteGuestOnServer(id) {
  const response = await fetch(`/api/admin/guests/${encodeURIComponent(id)}`, {
    method: 'DELETE', headers: { 'x-admin-password': state.adminPassword },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'Não foi possível remover o convidado.');
}

async function saveCompanyOnServer(company) {
  const response = await fetch(`/api/admin/companies/${encodeURIComponent(company.id)}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', 'x-admin-password': state.adminPassword },
    body: JSON.stringify(company),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'Não foi possível salvar a empresa.');
  return result;
}

function render() {
  hideKeyboard();
  window.scrollTo(0, 0);
  const [section, page, id] = routeParts();
  document.body.className = section === 'networking' ? 'is-mobile-flow' : 'is-totem-flow';
  if (section === 'networking' && page === 'perfil') renderProfile(id);
  else if (section === 'networking') renderNetworking();
  else if (page === 'presenca') renderAttendance();
  else if (page === 'qrcode') renderQr(id);
  else renderTotemHome();
}

function openAdmin() {
  state.adminOpen = true;
  state.adminAuthenticated = false;
  state.adminView = 'choose';
  state.adminError = '';
  state.confirmDialog = null;
  renderAttendance();
}

function handleAdminTrigger() {
  const now = Date.now();
  state.adminTapCount = now - state.adminLastTap < 700 ? state.adminTapCount + 1 : 1;
  state.adminLastTap = now;
  if (state.adminTapCount >= 3) {
    state.adminTapCount = 0;
    openAdmin();
  }
}

function openGuestForm(id = null) {
  state.adminEditingId = id;
  state.adminPhoto = id ? findPerson(id)?.photo || '' : '';
  state.adminView = 'form';
  state.adminError = '';
  renderAttendance();
}

function runRaffle() {
  if (state.raffleRunning) return;
  const eligible = guestList.filter((person) => person.present);
  if (!eligible.length) return;
  state.raffleRunning = true;
  state.raffleWinner = null;
  renderTotemHome();
  let ticks = 0;
  raffleTimer = window.setInterval(() => {
    if (!state.raffleOpen) return;
    const person = eligible[ticks % eligible.length];
    const name = document.querySelector('#raffle-name');
    const avatar = document.querySelector('#raffle-avatar');
    const company = document.querySelector('#raffle-company');
    if (name) name.textContent = person.name;
    if (avatar) { avatar.src = person.photo; avatar.alt = `Foto de ${person.name}`; }
    if (company) company.textContent = personCompany(person).name;
    ticks += 1;
  }, 110);
  raffleFinishTimer = window.setTimeout(() => {
    window.clearInterval(raffleTimer);
    raffleTimer = null;
    if (!state.raffleOpen) return;
    state.raffleWinner = eligible[Math.floor(Math.random() * eligible.length)];
    state.raffleRunning = false;
    renderTotemHome();
  }, 2400);
}

function stopRaffle() {
  window.clearInterval(raffleTimer);
  window.clearTimeout(raffleFinishTimer);
  raffleTimer = null;
  raffleFinishTimer = null;
  state.raffleRunning = false;
}

function showKeyboard(input) {
  if (!document.body.classList.contains('is-totem-flow')) return;
  keyboardTarget = input;
  keyboardShift = !input.value;
  renderKeyboard();
  document.body.classList.add('keyboard-open');
}

function hideKeyboard() {
  document.querySelector('#virtual-keyboard')?.remove();
  document.body.classList.remove('keyboard-open');
  keyboardTarget = null;
}

function renderKeyboard() {
  document.querySelector('#virtual-keyboard')?.remove();
  const rows = [
    ['1','2','3','4','5','6','7','8','9','0'],
    ['q','w','e','r','t','y','u','i','o','p'],
    ['a','s','d','f','g','h','j','k','l','ç'],
    ['z','x','c','v','b','n','m','á','é','ó'],
  ];
  const keyboard = document.createElement('div');
  keyboard.id = 'virtual-keyboard';
  keyboard.className = 'virtual-keyboard';
  keyboard.setAttribute('role', 'group');
  keyboard.setAttribute('aria-label', 'Teclado virtual');
  keyboard.innerHTML = `<div class="keyboard-top"><span>TECLADO</span><button type="button" data-keyboard-command="close" aria-label="Fechar teclado">×</button></div>
    ${rows.map((row) => `<div class="keyboard-row">${row.map((key) => `<button type="button" data-keyboard-key="${key}">${keyboardShift && /[a-záéóç]/.test(key) ? key.toUpperCase() : key}</button>`).join('')}</div>`).join('')}
    <div class="keyboard-row keyboard-controls">
      <button type="button" data-keyboard-command="shift" class="keyboard-shift ${keyboardShift ? 'is-active' : ''}">⇧ Maiúscula</button>
      <button type="button" data-keyboard-command="space" class="keyboard-space">Espaço</button>
      <button type="button" data-keyboard-command="backspace">⌫ Apagar</button>
      <button type="button" data-keyboard-command="clear">Limpar</button>
    </div>`;
  keyboard.addEventListener('click', (event) => {
    const button = event.target.closest('[data-keyboard-key], [data-keyboard-command]');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    virtualKeyPress(button);
  });
  document.body.append(keyboard);
}

function virtualKeyPress(button) {
  if (!keyboardTarget || !document.body.contains(keyboardTarget)) return hideKeyboard();
  const command = button.dataset.keyboardCommand;
  if (command === 'close') return hideKeyboard();
  if (command === 'shift') { keyboardShift = !keyboardShift; renderKeyboard(); return; }
  const start = keyboardTarget.selectionStart ?? keyboardTarget.value.length;
  const end = keyboardTarget.selectionEnd ?? start;
  let value = keyboardTarget.value;
  let cursor = start;
  if (command === 'backspace') {
    if (start !== end) value = value.slice(0, start) + value.slice(end);
    else if (start > 0) { value = value.slice(0, start - 1) + value.slice(end); cursor -= 1; }
  } else if (command === 'clear') {
    value = '';
    cursor = 0;
  } else {
    const raw = command === 'space' ? ' ' : button.dataset.keyboardKey;
    const output = keyboardShift ? raw.toLocaleUpperCase('pt-BR') : raw;
    value = value.slice(0, start) + output + value.slice(end);
    cursor = start + output.length;
    if (keyboardShift && /[a-záéóç]/i.test(raw)) { keyboardShift = false; renderKeyboard(); }
  }
  keyboardTarget.value = value;
  keyboardTarget.focus({ preventScroll: true });
  keyboardTarget.setSelectionRange(cursor, cursor);
  keyboardTarget.dispatchEvent(new Event('input', { bubbles: true }));
}

function resizePhoto(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      const size = 420;
      const scale = Math.max(size / image.width, size / image.height);
      const width = image.width * scale;
      const height = image.height * scale;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext('2d');
      context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
      URL.revokeObjectURL(objectUrl);
      resolve(canvas.toDataURL('image/jpeg', .78));
    };
    image.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('invalid-image')); };
    image.src = objectUrl;
  });
}

document.addEventListener('click', (eventTarget) => {
  const openKeyboard = document.querySelector('#virtual-keyboard');
  if (openKeyboard && !eventTarget.target.closest('#virtual-keyboard') && eventTarget.target !== keyboardTarget) hideKeyboard();

  const keyboardInput = eventTarget.target.closest('input[data-keyboard], textarea[data-keyboard]');
  if (keyboardInput) showKeyboard(keyboardInput);

  const keyboardButton = eventTarget.target.closest('[data-keyboard-key], [data-keyboard-command]');
  if (keyboardButton) return virtualKeyPress(keyboardButton);

  const routeButton = eventTarget.target.closest('[data-route]');
  if (routeButton) return navigate(routeButton.dataset.route);

  const actionButton = eventTarget.target.closest('[data-action]');
  if (actionButton) {
    const action = actionButton.dataset.action;
    if (action === 'start-checkin') navigate('#/totem/presenca');
    if (action === 'open-raffle') { state.raffleOpen = true; state.raffleWinner = null; renderTotemHome(); }
    if (action === 'close-raffle') { stopRaffle(); state.raffleOpen = false; state.raffleWinner = null; renderTotemHome(); }
    if (action === 'run-raffle') runRaffle();
    if (action === 'mobile-back') navigate(networkListRoute());
    if (action === 'open-quick-add') { state.quickAddOpen = true; renderAttendance(); }
    if (action === 'close-quick-add') { state.quickAddOpen = false; hideKeyboard(); renderAttendance(); }
    if (action === 'linkedin-unavailable') showLinkedInUnavailable();
    if (action === 'network-admin-trigger') handleNetworkAdminTrigger();
    if (action === 'network-admin-close') { state.networkAdminOpen = false; state.networkAdminPassword = ''; renderNetworkCurrent(); }
    if (action === 'network-admin-list') { state.networkAdminView = 'list'; state.networkAdminError = ''; renderNetworkCurrent(); }
    if (action === 'network-admin-edit') {
      state.networkAdminEditingId = actionButton.dataset.id;
      state.networkAdminDraft = linkedInUrl(findPerson(state.networkAdminEditingId)) || '';
      state.networkAdminError = '';
      state.networkAdminView = 'form';
      renderNetworkCurrent();
    }
    if (action === 'network-admin-remove') { state.networkAdminDeleteId = actionButton.dataset.id; renderNetworkCurrent(); }
    if (action === 'network-admin-cancel-remove') { state.networkAdminDeleteId = null; renderNetworkCurrent(); }
    if (action === 'network-admin-confirm-remove') {
      const id = state.networkAdminDeleteId;
      saveLinkedIn(id, '').then(() => {
        state.networkAdminDeleteId = null;
        state.networkAdminError = '';
        renderNetworkCurrent();
      }).catch((error) => { state.networkAdminError = error.message; renderNetworkCurrent(); });
    }
    if (action === 'admin-trigger') handleAdminTrigger();
    if (action === 'admin-choose') { state.adminView = 'choose'; state.adminError = ''; renderAttendance(); }
    if (action === 'choose-admin') {
      state.adminSection = actionButton.dataset.section === 'companies' ? 'companies' : 'guests';
      state.adminView = state.adminAuthenticated ? state.adminSection === 'companies' ? 'companies' : 'list' : 'login';
      state.adminError = '';
      renderAttendance();
    }
    if (action === 'close-admin') { state.adminOpen = false; state.adminPassword = ''; state.confirmDialog = null; renderAttendance(); }
    if (action === 'company-list') { state.adminView = 'companies'; state.adminError = ''; renderAttendance(); }
    if (action === 'edit-company') {
      state.adminCompanyEditingId = actionButton.dataset.id;
      state.adminCompanyPhoto = companyProfiles[state.adminCompanyEditingId]?.photo || '';
      state.adminView = 'company-form';
      state.adminError = '';
      renderAttendance();
    }
    if (action === 'add-guest') openGuestForm();
    if (action === 'edit-guest') openGuestForm(actionButton.dataset.id);
    if (action === 'admin-list') { state.adminView = 'list'; state.adminError = ''; renderAttendance(); }
    if (action === 'delete-guest') { state.confirmDialog = { type: 'delete-guest', personId: actionButton.dataset.id }; renderAttendance(); }
    if (action === 'cancel-confirmation') { state.confirmDialog = null; renderAttendance(); }
    if (action === 'confirm-checkin') {
      const person = findPerson(state.confirmDialog?.personId);
      if (person) { person.present = true; persistGuests(); state.confirmDialog = null; navigate(`#/totem/qrcode/${person.id}`); }
    }
    if (action === 'confirm-remove-presence') {
      const person = findPerson(state.confirmDialog?.personId);
      if (person) { person.present = false; persistGuests(); state.confirmDialog = null; renderAttendance(); }
    }
    if (action === 'confirm-delete-guest') {
      const id = state.confirmDialog?.personId;
      deleteGuestOnServer(id).then(() => {
        guestList = guestList.filter((person) => person.id !== id);
        persistGuests();
        state.confirmDialog = null;
        state.adminError = '';
        renderAttendance();
      }).catch((error) => {
        state.confirmDialog = null;
        state.adminError = error.message;
        renderAttendance();
      });
    }
    return;
  }

  const personRow = eventTarget.target.closest('[data-person]');
  if (personRow) {
    const person = findPerson(personRow.dataset.person);
    if (person) { state.confirmDialog = { type: person.present ? 'remove-presence' : 'confirm-presence', personId: person.id }; renderAttendance(); }
    return;
  }
  const profileCard = eventTarget.target.closest('[data-profile]');
  if (profileCard) navigate(networkProfileRoute(profileCard.dataset.profile));
});

document.addEventListener('keydown', (keyEvent) => {
  if (!keyEvent.target.matches('.totem-home')) return;
  if (keyEvent.key === 'Enter' || keyEvent.key === ' ') { keyEvent.preventDefault(); navigate('#/totem/presenca'); }
});

document.addEventListener('focusin', (focusEvent) => {
  const input = focusEvent.target.closest('input[data-keyboard], textarea[data-keyboard]');
  if (input) showKeyboard(input);
});

document.addEventListener('input', (inputEvent) => {
  if (inputEvent.target.matches('#totem-search')) {
    state.totemQuery = inputEvent.target.value;
    document.querySelector('#attendance-list').innerHTML = attendanceRows(state.totemQuery);
  }
  if (inputEvent.target.matches('#network-search')) {
    state.networkQuery = inputEvent.target.value;
    const filtered = filteredNetworkGuests();
    document.querySelector('#result-count').textContent = filtered.length;
    document.querySelector('#network-grid').innerHTML = filtered.length ? filtered.map(participantCard).join('') : `<div class="empty-state empty-state--mobile"><strong>Nenhuma conexão encontrada.</strong><span>Tente buscar por outro nome ou empresa.</span></div>`;
  }
});

document.addEventListener('change', async (changeEvent) => {
  if (changeEvent.target.matches('input[name="hasCompany"]')) {
    const field = document.querySelector('#quick-company-field');
    const input = field?.querySelector('input');
    if (!field || !input) return;
    const hasCompany = changeEvent.target.value === 'true';
    field.hidden = !hasCompany;
    input.required = hasCompany;
    if (!hasCompany) { input.value = ''; if (keyboardTarget === input) hideKeyboard(); }
    return;
  }
  if (!changeEvent.target.matches('#guest-photo, #company-photo')) return;
  const file = changeEvent.target.files?.[0];
  if (!file) return;
  try {
    const photo = await resizePhoto(file);
    if (changeEvent.target.id === 'company-photo') state.adminCompanyPhoto = photo;
    else state.adminPhoto = photo;
    state.adminError = '';
    const preview = document.querySelector('.photo-preview');
    if (preview) { preview.classList.add('has-photo'); preview.innerHTML = `<img src="${photo}" alt="Prévia da foto" />`; }
  } catch {
    state.adminError = 'Não foi possível ler essa imagem. Escolha outro arquivo.';
    renderAttendance();
  }
});

document.addEventListener('submit', (submitEvent) => {
  if (submitEvent.target.matches('#quick-add-form')) {
    submitEvent.preventDefault();
    const form = submitEvent.target;
    const values = new FormData(form);
    const name = String(values.get('name') || '').trim();
    const hasCompany = values.get('hasCompany') === 'true';
    const company = hasCompany ? String(values.get('company') || '').trim() : '';
    const errorField = form.querySelector('#quick-add-error');
    if (!name || (hasCompany && !company)) { errorField.textContent = 'Informe o nome e, se aplicável, a empresa.'; return; }
    const submitButton = form.querySelector('[type="submit"]');
    submitButton.disabled = true;
    fetch('/api/quick-guests', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, hasCompany, company }) })
      .then(async (response) => {
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || 'Não foi possível adicionar o convidado. Tente novamente.');
        guestList.push(result);
        persistGuests();
        state.quickAddOpen = false;
        state.totemQuery = result.name;
        renderAttendance();
        void syncCompanies();
      })
      .catch((error) => { errorField.textContent = error.message; submitButton.disabled = false; });
    return;
  }
  if (submitEvent.target.matches('#network-admin-login')) {
    submitEvent.preventDefault();
    const password = String(new FormData(submitEvent.target).get('password') || '');
    fetch('/api/admin/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password }) })
      .then((response) => {
        if (!response.ok) throw new Error(response.status === 401 ? 'Senha incorreta.' : 'Não foi possível validar a senha. Tente novamente.');
        state.networkAdminPassword = password;
        state.networkAdminAuthenticated = true;
        state.networkAdminView = 'list';
        state.networkAdminError = '';
        renderNetworkCurrent();
      })
      .catch((error) => { state.networkAdminError = error.message; renderNetworkCurrent(); });
    return;
  }
  if (submitEvent.target.matches('#network-admin-form')) {
    submitEvent.preventDefault();
    const raw = String(new FormData(submitEvent.target).get('linkedin') || '');
    state.networkAdminDraft = raw;
    const url = normalizeLinkedIn(raw);
    if (!url) {
      state.networkAdminError = 'Informe o endereço de um perfil pessoal do LinkedIn (linkedin.com/in/...).';
      renderNetworkCurrent();
      return;
    }
    saveLinkedIn(state.networkAdminEditingId, url)
      .then(() => { state.networkAdminView = 'list'; state.networkAdminError = ''; renderNetworkCurrent(); })
      .catch((error) => { state.networkAdminError = error.message; renderNetworkCurrent(); });
    return;
  }
  if (submitEvent.target.matches('#admin-login-form')) {
    submitEvent.preventDefault();
    const password = new FormData(submitEvent.target).get('password');
    fetch('/api/admin/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password }) })
      .then((response) => {
        if (!response.ok) throw new Error(response.status === 401 ? 'Senha incorreta. Tente novamente.' : 'Não foi possível validar a senha. Tente novamente.');
        state.adminAuthenticated = true;
        state.adminPassword = String(password);
        state.adminView = state.adminSection === 'companies' ? 'companies' : 'list';
        state.adminError = '';
        renderAttendance();
      })
      .catch((error) => { state.adminError = error.message; renderAttendance(); });
    return;
  }
  if (submitEvent.target.matches('#company-form')) {
    submitEvent.preventDefault();
    const values = new FormData(submitEvent.target);
    const name = String(values.get('name') || '').trim();
    const description = String(values.get('description') || '').trim();
    const id = state.adminCompanyEditingId;
    const errorField = document.querySelector('#company-form-error');
    if (!name) { if (errorField) errorField.textContent = 'Informe o nome da empresa.'; return; }
    const previous = companyProfiles[id];
    saveCompanyOnServer({ id, name, description, photo: state.adminCompanyPhoto || previous?.photo || '' })
      .then((saved) => {
        companyProfiles[id] = { ...previous, ...saved };
        guestList = guestList.map((person) => person.companyId === id && Object.hasOwn(person, 'company') ? { ...person, company: saved.name } : person);
        persistGuests();
        state.adminCompanyPhoto = '';
        state.adminCompanyEditingId = null;
        state.adminError = '';
        state.adminView = 'companies';
        renderAttendance();
      })
      .catch((error) => { state.adminError = error.message; if (errorField) errorField.textContent = error.message; });
    return;
  }
  if (submitEvent.target.matches('#guest-form')) {
    submitEvent.preventDefault();
    const values = new FormData(submitEvent.target);
    const name = String(values.get('name') || '').trim();
    const role = String(values.get('role') || '').trim();
    const rawLinkedIn = String(values.get('linkedin') || '').trim();
    const company = String(values.get('company') || '').trim();
    const linkedin = rawLinkedIn ? normalizeLinkedIn(rawLinkedIn) : '';
    const errorField = document.querySelector('#guest-form-error');
    if (rawLinkedIn && !linkedin) {
      const message = 'Informe um perfil pessoal válido do LinkedIn (linkedin.com/in/...).';
      state.adminError = message;
      if (errorField) errorField.textContent = message;
      return;
    }
    if (!name || !role || !state.adminPhoto) {
      state.adminError = 'Preencha nome, cargo e foto para continuar.';
      renderAttendance();
      return;
    }
    const previous = state.adminEditingId ? findPerson(state.adminEditingId) : null;
    const idBase = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'convidado';
    const draft = {
      id: previous?.id || `${idBase}-${Date.now()}`,
      name, role, company, photo: state.adminPhoto,
      present: previous?.present || false,
    };
    const editing = Boolean(previous);
    saveGuestOnServer(draft, editing).then(async (saved) => {
      await saveLinkedIn(saved.id, linkedin, state.adminPassword);
      const complete = { ...saved, linkedin };
      if (editing) guestList = guestList.map((person) => person.id === complete.id ? complete : person);
      else guestList.push(complete);
      persistGuests();
      state.adminView = 'list';
      state.adminEditingId = null;
      state.adminPhoto = '';
      state.adminError = '';
      renderAttendance();
      void syncCompanies();
    }).catch((error) => {
      state.adminError = error.message;
      const field = document.querySelector('.guest-form-error');
      if (field) field.textContent = error.message;
      else {
        const submit = document.querySelector('.guest-save');
        submit?.insertAdjacentHTML('beforebegin', `<span class="form-error guest-form-error">${escapeHtml(error.message)}</span>`);
      }
    });
    return;
  }
});

window.addEventListener('hashchange', render);
render();
void (async () => { await syncCompanies(); await syncGuests(); await syncLinkedInLinks(); })();
