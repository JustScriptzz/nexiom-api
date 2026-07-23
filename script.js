const API_BASE = '';
let currentUser = null;

// ---------- Utils ----------
const $ = (s, p = document) => p.querySelector(s);
const $$ = (s, p = document) => [...p.querySelectorAll(s)];
const html = (id) => document.getElementById(id).innerHTML;

async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...opts.headers };
  const token = localStorage.getItem('nx_token');
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers });
  return res.json();
}

function showError(el, msg) { if (el) { el.textContent = msg; el.classList.remove('hidden'); } }
function showSuccess(el, msg) { if (el) { el.textContent = msg; el.classList.remove('hidden'); } }
function hide(el) { if (el) el.classList.add('hidden'); }

// ---------- Auth ----------
async function checkSession() {
  const token = localStorage.getItem('nx_token');
  if (!token) { currentUser = null; return; }
  const data = await api('/api/v1/auth/me');
  if (data.user) {
    currentUser = data.user;
    currentUser.api_key = data.api_key;
  } else {
    localStorage.removeItem('nx_token');
    currentUser = null;
  }
}

function updateNav() {
  const el = document.getElementById('navAuth');
  if (!el) return;
  if (currentUser) {
    el.textContent = 'Dashboard';
    el.href = '#/dashboard';
  } else {
    el.textContent = 'Log in';
    el.href = '#/login';
  }
}

// ---------- Router ----------
function getHash() {
  const h = location.hash.slice(1) || '/';
  return h.split('?')[0];
}

function navigate(href) {
  location.hash = href;
}

function initRouter() {
  window.addEventListener('hashchange', renderRoute);
  window.addEventListener('load', renderRoute);
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-nav]');
    if (a && a.getAttribute('href').startsWith('#')) {
      e.preventDefault();
      navigate(a.getAttribute('href').slice(1));
    }
  });
}

async function renderRoute() {
  const route = getHash();
  const app = document.getElementById('app');
  await checkSession();
  updateNav();

  switch (route) {
    case '/':
    case '':
      app.innerHTML = html('tmpl-home');
      renderHome();
      break;
    case '/models':
      app.innerHTML = html('tmpl-models');
      renderModels();
      break;
    case '/docs':
      app.innerHTML = html('tmpl-docs');
      renderDocs();
      break;
    case '/login':
      if (currentUser) { navigate('/dashboard'); return; }
      app.innerHTML = html('tmpl-login');
      renderLogin();
      break;
    case '/signup':
      if (currentUser) { navigate('/dashboard'); return; }
      app.innerHTML = html('tmpl-signup');
      renderSignup();
      break;
    case '/dashboard':
      if (!currentUser) { navigate('/login'); return; }
      app.innerHTML = html('tmpl-dashboard');
      renderDashboard();
      break;
    case '/playground':
      if (!currentUser) { navigate('/login'); return; }
      app.innerHTML = html('tmpl-playground');
      renderPlayground();
      break;
    default:
      app.innerHTML = `<section class="page-section"><div class="page-card"><h2>404</h2><p class="text-muted">Page not found.</p><a href="#/" data-nav class="btn btn-primary">Go home</a></div></section>`;
  }
}

// ---------- Home ----------
function renderHome() {
  const target = document.getElementById('typedResponse');
  if (!target) return;
  const text = 'still here. what do you need?';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) { target.textContent = text; return; }
  let i = 0;
  function step() {
    if (i <= text.length) { target.textContent = text.slice(0, i); i++; setTimeout(step, 28); }
  }
  setTimeout(step, 900);
}

// ---------- Models ----------
async function renderModels() {
  const list = document.getElementById('modelsList');
  const data = await api('/api/v1/models');
  if (!data.models || data.models.length === 0) {
    list.innerHTML = '<p class="text-muted">No models are currently configured.</p>';
    return;
  }

  const grouped = {};
  for (const m of data.models) {
    if (!grouped[m.provider]) grouped[m.provider] = [];
    grouped[m.provider].push(m);
  }

  list.innerHTML = Object.entries(grouped).map(([provider, models]) => `
    <div class="provider-group">
      <div class="provider-header">${provider}</div>
      ${models.map((m) => `
        <div class="model-card${m.default ? ' model-default' : ''}">
          <span class="model-name">${m.id}</span>
          <span class="model-badge">${m.path}</span>
          ${m.default ? '<span class="model-badge model-badge-default">default</span>' : ''}
        </div>
      `).join('')}
    </div>
  `).join('');
}

// ---------- Docs ----------
function renderDocs() {
  const tabs = document.getElementById('codeTabs');
  if (!tabs) return;
  const buttons = $$('.tab', tabs);
  const panels = $$('.code-block');
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      buttons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      panels.forEach((p) => p.classList.toggle('hidden', p.dataset.panel !== btn.dataset.tab));
    });
  });
}

// ---------- Login ----------
function renderLogin() {
  const form = document.getElementById('loginForm');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const errorEl = document.getElementById('loginError');
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = 'Logging in...';
    hide(errorEl);
    const data = await api('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    if (data.error) {
      showError(errorEl, data.error);
      btn.disabled = false; btn.textContent = 'Log in';
      return;
    }
    localStorage.setItem('nx_token', data.session.access_token);
    currentUser = data.user;
    currentUser.api_key = null;
    navigate('/dashboard');
  });
}

// ---------- Signup ----------
function renderSignup() {
  const form = document.getElementById('signupForm');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    const errorEl = document.getElementById('signupError');
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = 'Creating account...';
    hide(errorEl);
    const data = await api('/api/v1/auth/signup', { method: 'POST', body: JSON.stringify({ email, password }) });
    if (data.error) {
      showError(errorEl, data.error);
      btn.disabled = false; btn.textContent = 'Create account';
      return;
    }
    navigate('/login');
  });
}

// ---------- Dashboard ----------
function renderDashboard() {
  const display = document.getElementById('keyDisplay');
  const genBtn = document.getElementById('genKeyBtn');
  const revokeBtn = document.getElementById('revokeKeyBtn');
  const copyBtn = document.getElementById('copyKeyBtn');
  const msgEl = document.getElementById('keyMessage');

  async function refreshKey() {
    const data = await api('/api/v1/keys');
    if (data.api_key) {
      display.innerHTML = `<code class="key-value">${data.api_key.key}</code><span class="text-muted key-date">Created ${new Date(data.api_key.created_at).toLocaleDateString()}</span>`;
      hide(genBtn);
      revokeBtn.classList.remove('hidden');
      copyBtn.classList.remove('hidden');
    } else {
      display.innerHTML = '<span class="text-muted">No API key yet. Generate one below.</span>';
      genBtn.classList.remove('hidden');
      revokeBtn.classList.add('hidden');
      copyBtn.classList.add('hidden');
    }
  }

  refreshKey();

  genBtn.addEventListener('click', async () => {
    hide(msgEl);
    const data = await api('/api/v1/keys', { method: 'POST' });
    if (data.error) {
      showError(msgEl, data.error);
      return;
    }
    showSuccess(msgEl, 'API key created!');
    await refreshKey();
  });

  revokeBtn.addEventListener('click', async () => {
    if (!confirm('Revoke your current API key? This cannot be undone.')) return;
    hide(msgEl);
    const data = await api('/api/v1/keys', { method: 'DELETE' });
    if (data.error) { showError(msgEl, data.error); return; }
    showSuccess(msgEl, 'API key revoked.');
    await refreshKey();
  });

  copyBtn.addEventListener('click', async () => {
    const code = display.querySelector('code');
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code.textContent);
      showSuccess(msgEl, 'Copied to clipboard!');
    } catch {
      showError(msgEl, 'Failed to copy.');
    }
  });
}

// ---------- Playground ----------
function renderPlayground() {
  const form = document.getElementById('chatForm');
  const input = document.getElementById('chatInput');
  const messages = document.getElementById('chatMessages');
  const sendBtn = document.getElementById('chatSend');

  function addMsg(role, content) {
    const div = document.createElement('div');
    div.className = `chat-msg chat-msg-${role}`;
    div.innerHTML = `<div class="chat-msg-label">${role === 'user' ? 'You' : 'Nexiom'}</div><div class="chat-msg-content">${content}</div>`;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    addMsg('user', text);
    input.value = '';
    sendBtn.disabled = true;
    sendBtn.textContent = 'Sending...';

    addMsg('system', 'Thinking...');
    const msgIdx = messages.lastElementChild;

    const data = await api('/api/v1/playground/chat', {
      method: 'POST',
      body: JSON.stringify({ messages: [{ role: 'user', content: text }] }),
    });

    if (data.error) {
      msgIdx.querySelector('.chat-msg-content').textContent = data.error?.message || data.error || 'Request failed.';
      sendBtn.disabled = false;
      sendBtn.textContent = 'Send';
      return;
    }

    const reply = data.choices?.[0]?.message?.content || JSON.stringify(data);
    msgIdx.querySelector('.chat-msg-content').textContent = reply;
    sendBtn.disabled = false;
    sendBtn.textContent = 'Send';
  });
}

// ---------- Init ----------
initRouter();
