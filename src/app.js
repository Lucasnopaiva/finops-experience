import QRCode from 'qrcode';
import './styles.css';
import { companies, event, getCompany, getCompanyPeople, getParticipant, participants } from './data.js';

const root = document.querySelector('#app');
const state = {
  query: '',
  checkedInId: null,
  raffleOpen: false,
  raffleRunning: false,
  raffleWinner: null,
};

const icons = {
  arrow: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  back: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg>',
  search: '<svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>',
  linkedin: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M7 9v8M7 6.5v.01M11 17v-4.4c0-2.9 5-3.1 5 0V17M11 9v8"/></svg>',
  home: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m4 11 8-7 8 7v9h-6v-6h-4v6H4z"/></svg>',
  people: '<svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><path d="M3 20c.5-4 2.5-6 6-6s5.5 2 6 6M16 5.5a3 3 0 0 1 0 5.8M17 14c2.4.5 3.7 2.5 4 5"/></svg>',
  trophy: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M8 4h8v4c0 4-1.8 6-4 6s-4-2-4-6zM8 6H4v2c0 2 1.4 3.5 4 3.5M16 6h4v2c0 2-1.4 3.5-4 3.5M12 14v4M8 20h8"/></svg>',
  check: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></svg>',
};

function navigate(route) {
  if (window.location.hash === route) render();
  else window.location.hash = route;
}

function routeParts() {
  const raw = window.location.hash.replace(/^#/, '') || '/totem';
  return raw.split('?')[0].split('/').filter(Boolean);
}

function companyLogo(companyId, size = 'md') {
  const company = companies[companyId];
  return `<span class="company-logo company-logo--${size}" style="--company-color:${company.color}">${company.initials}</span>`;
}

function personImage(person, className = '') {
  return `<img class="${className}" src="${person.photo}" alt="Foto de ${person.name}" loading="lazy" />`;
}

function totemHeader(step, title) {
  return `<header class="totem-header">
    <span class="event-wordmark"><i></i>FINOPS EXPERIENCE</span>
    <div class="step-indicator"><span>${step}</span><span class="step-line"></span><span>03</span></div>
    <p>${title}</p>
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
  const present = participants.filter((person) => person.present);
  const display = state.raffleWinner || present[0];
  return `<div class="modal-backdrop" data-action="noop" role="dialog" aria-modal="true" aria-labelledby="raffle-title">
    <section class="raffle-modal">
      <button class="icon-close" data-action="close-raffle" aria-label="Fechar sorteio">×</button>
      <span class="modal-kicker">SORTEIO · ${present.length} PARTICIPANTES</span>
      <h2 id="raffle-title">Quem leva<br/><em>essa experiência?</em></h2>
      <div class="raffle-stage ${state.raffleRunning ? 'is-running' : ''}">
        <div class="winner-avatar">${personImage(display)}</div>
        <div><small>${state.raffleWinner ? 'TEMOS UM VENCEDOR' : 'PRONTO PARA COMEÇAR'}</small><strong id="raffle-name">${display.name}</strong><span>${getCompany(display.companyId).name}</span></div>
      </div>
      <button class="primary-button primary-button--orange" data-action="run-raffle" ${state.raffleRunning ? 'disabled' : ''}>
        ${state.raffleRunning ? 'Sorteando…' : state.raffleWinner ? 'Sortear novamente' : 'Iniciar sorteio'} ${icons.arrow}
      </button>
    </section>
  </div>`;
}

function renderAttendance() {
  root.innerHTML = `<main class="totem-screen attendance-screen">
    <div class="attendance-head">
      ${totemHeader('02', 'Lista de presença')}
      <button class="text-back" data-route="#/totem">${icons.back} Início</button>
      <div class="attendance-title">
        <div><p class="eyebrow eyebrow--dark">FAÇA SEU CHECK-IN</p><h1>Encontre<br/><em>seu nome.</em></h1></div>
        <div class="presence-count"><strong>${participants.filter((p) => p.present).length}</strong><span>pessoas<br/>presentes</span></div>
      </div>
    </div>
    <section class="attendance-panel">
      <div class="attendance-toolbar">
        <p><strong>${event.totalConfirmed}</strong> convidados confirmados</p>
        <label class="search-field search-field--totem">${icons.search}<input id="totem-search" type="search" placeholder="Busque seu nome" value="${state.query}" autocomplete="off" /></label>
      </div>
      <div id="attendance-list" class="attendance-list">${attendanceRows(state.query)}</div>
      <p class="privacy-note">Toque no seu nome para confirmar sua presença e acessar seu QR Code.</p>
    </section>
  </main>`;
  document.querySelector('#totem-search')?.focus({ preventScroll: true });
}

function attendanceRows(query = '') {
  const normalized = query.trim().toLocaleLowerCase('pt-BR');
  const filtered = participants.filter((person) => person.name.toLocaleLowerCase('pt-BR').includes(normalized));
  if (!filtered.length) return `<div class="empty-state"><strong>Nenhum nome encontrado.</strong><span>Confira a busca ou peça ajuda à equipe do evento.</span></div>`;
  return filtered.map((person, index) => `<button class="attendance-row" data-person="${person.id}" style="--delay:${index * 28}ms">
    <span class="row-number">${String(index + 1).padStart(2, '0')}</span>
    ${personImage(person, 'row-avatar')}
    <span class="row-person"><strong>${person.name}</strong><small>${person.role} · ${getCompany(person.companyId).name}</small></span>
    ${person.present ? `<span class="present-badge">${icons.check} Presente</span>` : '<span class="tap-label">Sou eu</span>'}
    <span class="row-arrow">${icons.arrow}</span>
  </button>`).join('');
}

function renderQr(id) {
  const person = getParticipant(id) || participants[0];
  state.checkedInId = person.id;
  const networkUrl = `${window.location.origin}${window.location.pathname}#/networking?from=${person.id}`;
  root.innerHTML = `<main class="totem-screen qr-screen">
    ${totemHeader('03', 'Conecte-se')}
    <section class="qr-content">
      <div class="confirmation-copy" aria-live="polite">
        <div class="success-ring"><span>${icons.check}</span></div>
        <p class="eyebrow confirmation-label">PRESENÇA CONFIRMADA</p>
        <h1>Olá, ${person.name.split(' ')[0]}.<br/><em>Que bom ter você aqui.</em></h1>
        <p class="qr-intro">Aproxime a câmera do celular para conhecer os participantes e criar novas conexões.</p>
      </div>
      <div class="qr-card">
        <canvas id="qr-canvas" aria-label="QR Code para acessar a área de networking"></canvas>
        <div><span></span><strong>ESCANEIE PARA CONECTAR</strong><span></span></div>
      </div>
    </section>
    <footer class="qr-actions">
      <button class="secondary-button" data-route="#/totem/presenca">${icons.back} Voltar para a lista</button>
      <button class="primary-button" data-route="#/totem">${icons.home} Voltar ao início</button>
    </footer>
  </main>`;
  requestAnimationFrame(() => {
    const canvas = document.querySelector('#qr-canvas');
    if (!canvas) return;
    QRCode.toCanvas(canvas, networkUrl, { width: 330, margin: 2, color: { dark: '#17110e', light: '#fffaf3' }, errorCorrectionLevel: 'H' });
  });
}

function mobileHeader({ back = false } = {}) {
  return `<header class="mobile-header">
    ${back ? `<button class="mobile-back" data-action="mobile-back" aria-label="Voltar">${icons.back}</button>` : '<span class="event-dot" aria-hidden="true"></span>'}
    <span class="mobile-event">FINOPS EXPERIENCE</span>
  </header>`;
}

function participantCard(person, index = 0) {
  const company = getCompany(person.companyId);
  return `<button class="network-card" data-profile="${person.id}" style="--delay:${index * 45}ms">
    <span class="photo-wrap">${personImage(person)}</span>
    <span class="network-card-copy"><strong>${person.name}</strong><span>${person.role}</span><small>${companyLogo(person.companyId, 'sm')}${company.name}</small></span>
    <span class="network-arrow">${icons.arrow}</span>
  </button>`;
}

function renderNetworking() {
  const normalized = state.query.trim().toLocaleLowerCase('pt-BR');
  const filtered = participants.filter((person) => {
    const company = getCompany(person.companyId).name;
    return person.name.toLocaleLowerCase('pt-BR').includes(normalized) || company.toLocaleLowerCase('pt-BR').includes(normalized);
  });
  root.innerHTML = `<main class="mobile-screen network-list-screen">
    ${mobileHeader()}
    <section class="network-hero">
      <span class="network-count">${participants.length} PARTICIPANTES</span>
      <h1>Conexões que<br/><em>movem o futuro.</em></h1>
      <p>Encontre quem você conheceu — e quem ainda vai conhecer.</p>
    </section>
    <div class="network-sticky">
      <label class="search-field search-field--mobile">${icons.search}<input id="network-search" type="search" placeholder="Busque por nome ou empresa" value="${state.query}" autocomplete="off" /></label>
      <div class="result-meta"><span>Participantes</span><strong id="result-count">${filtered.length}</strong></div>
    </div>
    <section id="network-grid" class="network-grid">
      ${filtered.length ? filtered.map(participantCard).join('') : `<div class="empty-state empty-state--mobile"><strong>Nenhuma conexão encontrada.</strong><span>Tente buscar por outro nome ou empresa.</span></div>`}
    </section>
    <footer class="mobile-footer">Conexões que continuam depois do evento.</footer>
  </main>`;
}

function renderProfile(id) {
  const person = getParticipant(id) || participants[0];
  const company = getCompany(person.companyId);
  const colleagues = getCompanyPeople(person.companyId, person.id);
  root.innerHTML = `<main class="mobile-screen profile-screen">
    <section class="profile-hero">
      ${mobileHeader({ back: true })}
      <div class="profile-photo">${personImage(person)}<span>${companyLogo(person.companyId, 'lg')}</span></div>
      <div class="profile-heading">
        <span class="eyebrow">PERFIL DO PARTICIPANTE</span>
        <h1>${person.name}</h1>
        <p>${person.role}<br/><strong>${company.name}</strong></p>
      </div>
    </section>
    <section class="profile-body">
      <a class="linkedin-button" href="${person.linkedin}" target="_blank" rel="noreferrer">${icons.linkedin}<span>Conectar no LinkedIn</span>${icons.arrow}</a>
      <div class="company-block">
        <span class="section-kicker">SOBRE A EMPRESA</span>
        <div class="company-feature">${companyLogo(person.companyId, 'xl')}<div><strong>${company.name}</strong><span>Serviços financeiros & tecnologia</span></div></div>
      </div>
      <div class="colleagues-block">
        <div class="section-title"><div><span class="section-kicker">MAIS CONEXÕES</span><h2>Também da ${company.name}</h2></div><strong>${colleagues.length}</strong></div>
        <div class="colleague-list">${colleagues.length ? colleagues.map(participantCard).join('') : '<p class="solo-company">Você encontrou o único participante desta empresa por aqui.</p>'}</div>
      </div>
    </section>
  </main>`;
}

function render() {
  window.scrollTo(0, 0);
  const [section, page, id] = routeParts();
  document.body.className = section === 'networking' ? 'is-mobile-flow' : 'is-totem-flow';
  state.query = '';
  if (section === 'networking' && page === 'perfil') renderProfile(id);
  else if (section === 'networking') renderNetworking();
  else if (page === 'presenca') renderAttendance();
  else if (page === 'qrcode') renderQr(id);
  else renderTotemHome();
}

function runRaffle() {
  if (state.raffleRunning) return;
  const eligible = participants.filter((person) => person.present);
  state.raffleRunning = true;
  state.raffleWinner = null;
  renderTotemHome();
  let ticks = 0;
  const nameElement = () => document.querySelector('#raffle-name');
  const timer = window.setInterval(() => {
    const person = eligible[ticks % eligible.length];
    if (nameElement()) nameElement().textContent = person.name;
    ticks += 1;
  }, 90);
  window.setTimeout(() => {
    window.clearInterval(timer);
    state.raffleWinner = eligible[Math.floor(Math.random() * eligible.length)];
    state.raffleRunning = false;
    renderTotemHome();
  }, 2400);
}

document.addEventListener('click', (eventTarget) => {
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
    return;
  }

  const personRow = eventTarget.target.closest('[data-person]');
  if (personRow) return navigate(`#/totem/qrcode/${personRow.dataset.person}`);
  const profileCard = eventTarget.target.closest('[data-profile]');
  if (profileCard) return navigate(`#/networking/perfil/${profileCard.dataset.profile}`);
});

document.addEventListener('keydown', (keyEvent) => {
  if (!keyEvent.target.matches('.totem-home')) return;
  if (keyEvent.key === 'Enter' || keyEvent.key === ' ') {
    keyEvent.preventDefault();
    navigate('#/totem/presenca');
  }
});

document.addEventListener('input', (inputEvent) => {
  if (inputEvent.target.matches('#totem-search')) {
    state.query = inputEvent.target.value;
    document.querySelector('#attendance-list').innerHTML = attendanceRows(state.query);
  }
  if (inputEvent.target.matches('#network-search')) {
    state.query = inputEvent.target.value;
    const normalized = state.query.trim().toLocaleLowerCase('pt-BR');
    const filtered = participants.filter((person) => {
      const company = getCompany(person.companyId).name;
      return person.name.toLocaleLowerCase('pt-BR').includes(normalized) || company.toLocaleLowerCase('pt-BR').includes(normalized);
    });
    document.querySelector('#result-count').textContent = filtered.length;
    document.querySelector('#network-grid').innerHTML = filtered.length
      ? filtered.map(participantCard).join('')
      : `<div class="empty-state empty-state--mobile"><strong>Nenhuma conexão encontrada.</strong><span>Tente buscar por outro nome ou empresa.</span></div>`;
  }
});

window.addEventListener('hashchange', render);
render();
