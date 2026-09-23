import QRCode from 'qrcode';
import './styles.css';
import { companies, event, participants as initialParticipants } from './data.js';

const root = document.querySelector('#app');
const GUESTS_STORAGE_KEY = 'finops-experience-guests-v1';
const ADMIN_PASSWORD = 'Hip2026';
const BASE_GUEST_COUNT = initialParticipants.length;

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
  adminError: '',
  adminEditingId: null,
  adminPhoto: '',
  adminTapCount: 0,
  adminLastTap: 0,
  confirmDialog: null,
};

let guestList = loadGuests();
let keyboardTarget = null;
let keyboardShift = false;

const icons = {
  arrow: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  back: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg>',
  search: '<svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>',
  linkedin: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M7 9v8M7 6.5v.01M11 17v-4.4c0-2.9 5-3.1 5 0V17M11 9v8"/></svg>',
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
  const raw = window.location.hash.replace(/^#/, '') || '/totem';
  return raw.split('?')[0].split('/').filter(Boolean);
}

function findPerson(id) {
  return guestList.find((person) => person.id === id);
}

function personCompany(person) {
  if (Object.hasOwn(person, 'company')) {
    const name = person.company?.trim() || '-';
    return { name, initials: name === '-' ? '—' : name.split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase(), color: '#ff5a1f' };
  }
  return companies[person.companyId] || { name: '-', initials: '—', color: '#6e625b' };
}

function companyLogo(person, size = 'md') {
  const company = personCompany(person);
  return `<span class="company-logo company-logo--${size}" style="--company-color:${company.color}">${escapeHtml(company.initials)}</span>`;
}

function companyPeople(person) {
  const companyName = personCompany(person).name.toLocaleLowerCase('pt-BR');
  if (companyName === '-') return [];
  return guestList.filter((candidate) => candidate.id !== person.id && personCompany(candidate).name.toLocaleLowerCase('pt-BR') === companyName);
}

function personImage(person, className = '') {
  return `<img class="${className}" src="${person.photo}" alt="Foto de ${escapeHtml(person.name)}" loading="lazy" />`;
}

function presentCount() {
  return guestList.filter((person) => person.present).length;
}

function confirmedCount() {
  return Math.max(0, event.totalConfirmed + guestList.length - BASE_GUEST_COUNT);
}

function totemHeader(step, title) {
  const titleMarkup = title === 'Lista de presença'
    ? `<p class="admin-trigger" data-action="admin-trigger">${title}</p>`
    : `<p>${title}</p>`;
  return `<header class="totem-header">
    <span class="event-wordmark"><i></i>FINOPS EXPERIENCE</span>
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
      <span class="checkin-index">01</span>
      <span class="checkin-copy"><small>CHECK-IN</small><strong>Toque em qualquer lugar<br/>para encontrar seu nome</strong></span>
      <span class="round-arrow">${icons.arrow}</span>
    </div>
    <footer class="home-footer">
      <p>TOQUE PARA CONTINUAR</p>
      <button class="raffle-button" data-action="open-raffle">${icons.trophy}<span>Realizar sorteio</span></button>
    </footer>
    ${state.raffleOpen ? raffleModal() : ''}
  </main>`;
}

function raffleModal() {
  const eligible = guestList.filter((person) => person.present);
  const display = state.raffleWinner || eligible[0];
  return `<div class="modal-backdrop" data-action="noop" role="dialog" aria-modal="true" aria-labelledby="raffle-title">
    <section class="raffle-modal">
      <button class="icon-close" data-action="close-raffle" aria-label="Fechar sorteio">×</button>
      <span class="modal-kicker">SORTEIO · ${eligible.length} PARTICIPANTES</span>
      <h2 id="raffle-title">Quem leva<br/><em>essa experiência?</em></h2>
      ${display ? `<div class="raffle-stage ${state.raffleRunning ? 'is-running' : ''}">
        <div class="winner-avatar">${personImage(display)}</div>
        <div><small>${state.raffleWinner ? 'TEMOS UM VENCEDOR' : 'PRONTO PARA COMEÇAR'}</small><strong id="raffle-name">${escapeHtml(display.name)}</strong><span>${escapeHtml(personCompany(display).name)}</span></div>
      </div>
      <button class="primary-button primary-button--orange" data-action="run-raffle" ${state.raffleRunning ? 'disabled' : ''}>${state.raffleRunning ? 'Sorteando…' : state.raffleWinner ? 'Sortear novamente' : 'Iniciar sorteio'} ${icons.arrow}</button>`
      : '<div class="empty-raffle">Nenhum convidado presente para o sorteio.</div>'}
    </section>
  </div>`;
}

function renderAttendance() {
  hideKeyboard();
  root.innerHTML = `<main class="totem-screen attendance-screen">
    <div class="attendance-head">
      ${totemHeader('02', 'Lista de presença')}
      <button class="text-back" data-route="#/totem">${icons.back} Início</button>
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
  </main>`;
}

function attendanceRows(query = '') {
  const normalized = query.trim().toLocaleLowerCase('pt-BR');
  const filtered = guestList.filter((person) => person.name.toLocaleLowerCase('pt-BR').includes(normalized));
  if (!filtered.length) return `<div class="empty-state"><strong>Nenhum nome encontrado.</strong><span>Confira a busca ou peça ajuda à equipe do evento.</span></div>`;
  return filtered.map((person, index) => `<button class="attendance-row" data-person="${person.id}" style="--delay:${index * 28}ms">
    <span class="row-number">${String(index + 1).padStart(2, '0')}</span>
    ${personImage(person, 'row-avatar')}
    <span class="row-person"><strong>${escapeHtml(person.name)}</strong><small>${escapeHtml(person.role)} · ${escapeHtml(personCompany(person).name)}</small></span>
    ${person.present ? `<span class="present-badge">${icons.check} Presente</span>` : '<span class="tap-label">Sou eu</span>'}
    <span class="row-arrow">${icons.arrow}</span>
  </button>`).join('');
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
  if (!state.adminAuthenticated || state.adminView === 'login') return adminLogin();
  if (state.adminView === 'form') return adminGuestForm();
  return adminGuestList();
}

function adminShell(content, className = '') {
  return `<div class="modal-backdrop admin-backdrop" data-action="noop" role="dialog" aria-modal="true" aria-label="Gerenciar convidados">
    <section class="admin-modal ${className}">
      <button class="icon-close" data-action="close-admin" aria-label="Fechar administração">×</button>
      ${content}
    </section>
  </div>`;
}

function adminLogin() {
  return adminShell(`<div class="admin-login">
    <span class="admin-lock">${icons.lock}</span>
    <span class="modal-kicker">ACESSO RESTRITO</span>
    <h2>Gerenciar<br/><em>convidados.</em></h2>
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
      <div><span class="modal-kicker">ADMINISTRAÇÃO</span><h2>Convidados</h2><p>${guestList.length} registros neste dispositivo</p></div>
      <button class="primary-button admin-add" data-action="add-guest">${icons.plus} Adicionar convidado</button>
    </header>
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
        <label>Nome<input data-keyboard name="name" inputmode="none" autocomplete="off" required placeholder="Nome completo" value="${escapeHtml(person?.name || '')}" /></label>
        <label>Cargo<input data-keyboard name="role" inputmode="none" autocomplete="off" required placeholder="Cargo ou função" value="${escapeHtml(person?.role || '')}" /></label>
        <label>Empresa <small>opcional</small><input data-keyboard name="company" inputmode="none" autocomplete="off" placeholder="Será exibido “-” se ficar vazio" value="${escapeHtml(company === '-' ? '' : company)}" /></label>
      </div>
      <div class="photo-field">
        <span>Foto</span>
        <div class="photo-preview ${photo ? 'has-photo' : ''}">${photo ? `<img id="guest-photo-preview" src="${photo}" alt="Prévia da foto" />` : `<span id="guest-photo-placeholder">${icons.upload}<small>Selecione uma foto</small></span>`}</div>
        <label class="secondary-button photo-upload">${icons.upload} ${photo ? 'Trocar foto' : 'Escolher foto'}<input id="guest-photo" type="file" accept="image/*" ${photo ? '' : 'required'} /></label>
      </div>
      ${state.adminError ? `<span class="form-error guest-form-error">${escapeHtml(state.adminError)}</span>` : ''}
      <button class="primary-button guest-save" type="submit">${person ? 'Salvar alterações' : 'Adicionar convidado'} ${icons.arrow}</button>
    </form>`, 'admin-modal--form');
}

function renderQr(id) {
  hideKeyboard();
  const person = findPerson(id) || guestList[0];
  if (!person) return navigate('#/totem/presenca');
  state.checkedInId = person.id;
  const networkUrl = `${window.location.origin}${window.location.pathname}#/networking?from=${person.id}`;
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
  return `<header class="mobile-header">${back ? `<button class="mobile-back" data-action="mobile-back" aria-label="Voltar">${icons.back}</button>` : '<span class="event-dot" aria-hidden="true"></span>'}<span class="mobile-event">FINOPS EXPERIENCE</span></header>`;
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
  </main>`;
}

function renderProfile(id) {
  hideKeyboard();
  const person = findPerson(id) || guestList[0];
  if (!person) return navigate('#/networking');
  const company = personCompany(person);
  const colleagues = companyPeople(person);
  root.innerHTML = `<main class="mobile-screen profile-screen">
    <section class="profile-hero">${mobileHeader({ back: true })}<div class="profile-photo">${personImage(person)}<span>${companyLogo(person, 'lg')}</span></div><div class="profile-heading"><span class="eyebrow">PERFIL DO PARTICIPANTE</span><h1>${escapeHtml(person.name)}</h1><p>${escapeHtml(person.role)}<br/><strong>${escapeHtml(company.name)}</strong></p></div></section>
    <section class="profile-body">
      <a class="linkedin-button" href="${person.linkedin || 'https://www.linkedin.com/'}" target="_blank" rel="noreferrer">${icons.linkedin}<span>Conectar no LinkedIn</span>${icons.arrow}</a>
      <div class="company-block"><span class="section-kicker">SOBRE A EMPRESA</span><div class="company-feature">${companyLogo(person, 'xl')}<div><strong>${escapeHtml(company.name)}</strong><span>Serviços financeiros & tecnologia</span></div></div></div>
      <div class="colleagues-block"><div class="section-title"><div><span class="section-kicker">MAIS CONEXÕES</span><h2>Também da ${escapeHtml(company.name)}</h2></div><strong>${colleagues.length}</strong></div><div class="colleague-list">${colleagues.length ? colleagues.map(participantCard).join('') : '<p class="solo-company">Você encontrou o único participante desta empresa por aqui.</p>'}</div></div>
    </section>
  </main>`;
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
  state.adminView = 'login';
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
  const timer = window.setInterval(() => {
    const element = document.querySelector('#raffle-name');
    if (element) element.textContent = eligible[ticks % eligible.length].name;
    ticks += 1;
  }, 90);
  window.setTimeout(() => {
    window.clearInterval(timer);
    state.raffleWinner = eligible[Math.floor(Math.random() * eligible.length)];
    state.raffleRunning = false;
    renderTotemHome();
  }, 2400);
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
  keyboard.innerHTML = `<div class="keyboard-top"><span>TECLADO</span><button type="button" data-keyboard-command="close">Fechar ×</button></div>
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
  const keyboardButton = eventTarget.target.closest('[data-keyboard-key], [data-keyboard-command]');
  if (keyboardButton) return virtualKeyPress(keyboardButton);

  const routeButton = eventTarget.target.closest('[data-route]');
  if (routeButton) return navigate(routeButton.dataset.route);

  const actionButton = eventTarget.target.closest('[data-action]');
  if (actionButton) {
    const action = actionButton.dataset.action;
    if (action === 'start-checkin') navigate('#/totem/presenca');
    if (action === 'open-raffle') { state.raffleOpen = true; renderTotemHome(); }
    if (action === 'close-raffle') { state.raffleOpen = false; state.raffleRunning = false; renderTotemHome(); }
    if (action === 'run-raffle') runRaffle();
    if (action === 'mobile-back') window.history.back();
    if (action === 'admin-trigger') handleAdminTrigger();
    if (action === 'close-admin') { state.adminOpen = false; state.confirmDialog = null; renderAttendance(); }
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
      guestList = guestList.filter((person) => person.id !== state.confirmDialog?.personId);
      persistGuests();
      state.confirmDialog = null;
      renderAttendance();
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
  if (profileCard) navigate(`#/networking/perfil/${profileCard.dataset.profile}`);
});

document.addEventListener('keydown', (keyEvent) => {
  if (!keyEvent.target.matches('.totem-home')) return;
  if (keyEvent.key === 'Enter' || keyEvent.key === ' ') { keyEvent.preventDefault(); navigate('#/totem/presenca'); }
});

document.addEventListener('focusin', (focusEvent) => {
  const input = focusEvent.target.closest('input[data-keyboard]');
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
  if (!changeEvent.target.matches('#guest-photo')) return;
  const file = changeEvent.target.files?.[0];
  if (!file) return;
  try {
    state.adminPhoto = await resizePhoto(file);
    state.adminError = '';
    const preview = document.querySelector('.photo-preview');
    if (preview) { preview.classList.add('has-photo'); preview.innerHTML = `<img id="guest-photo-preview" src="${state.adminPhoto}" alt="Prévia da foto" />`; }
  } catch {
    state.adminError = 'Não foi possível ler essa imagem. Escolha outro arquivo.';
    renderAttendance();
  }
});

document.addEventListener('submit', (submitEvent) => {
  if (submitEvent.target.matches('#admin-login-form')) {
    submitEvent.preventDefault();
    const password = new FormData(submitEvent.target).get('password');
    if (password === ADMIN_PASSWORD) {
      state.adminAuthenticated = true;
      state.adminView = 'list';
      state.adminError = '';
    } else state.adminError = 'Senha incorreta. Tente novamente.';
    renderAttendance();
  }
  if (submitEvent.target.matches('#guest-form')) {
    submitEvent.preventDefault();
    const values = new FormData(submitEvent.target);
    const name = String(values.get('name') || '').trim();
    const role = String(values.get('role') || '').trim();
    const company = String(values.get('company') || '').trim();
    if (!name || !role || !state.adminPhoto) {
      state.adminError = 'Preencha nome, cargo e foto para continuar.';
      renderAttendance();
      return;
    }
    if (state.adminEditingId) {
      const person = findPerson(state.adminEditingId);
      if (person) Object.assign(person, { name, role, company, photo: state.adminPhoto });
    } else {
      const idBase = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'convidado';
      guestList.push({ id: `${idBase}-${Date.now()}`, name, role, company, photo: state.adminPhoto, linkedin: 'https://www.linkedin.com/', present: false });
    }
    if (persistGuests()) {
      state.adminView = 'list';
      state.adminEditingId = null;
      state.adminPhoto = '';
      state.adminError = '';
    }
    renderAttendance();
  }
});

window.addEventListener('hashchange', render);
render();
