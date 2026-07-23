const API_BASE = '';
let currentUser = null;

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

async function checkSession() {
  const token = localStorage.getItem('nx_token');
  if (!token) { currentUser = null; return; }
  const data = await api('/api/v1/auth/me');
  if (data.user) { currentUser = data.user; }
  else { localStorage.removeItem('nx_token'); currentUser = null; }
}

function updateNav() {
  const authEl = document.getElementById('navAuth');
  if (!authEl) return;
  const authed = document.querySelectorAll('.nav-authed');
  if (currentUser) {
    authEl.textContent = 'Log out'; authEl.href = '#/logout';
    authed.forEach(a => a.classList.remove('hidden'));
  } else {
    authEl.textContent = 'Log in'; authEl.href = '#/login';
    authed.forEach(a => a.classList.add('hidden'));
  }
}

function getHash() { return (location.hash.slice(1) || '/').split('?')[0]; }
function navigate(href) { location.hash = href; }

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
    case '/': case '': app.innerHTML = html('tmpl-home'); renderHome(); break;
    case '/models': app.innerHTML = html('tmpl-models'); renderModels(); break;
    case '/docs': app.innerHTML = html('tmpl-docs'); renderDocs(); break;
    case '/login':
      if (currentUser) { navigate('/dashboard'); return; }
      app.innerHTML = html('tmpl-login'); renderLogin(); break;
    case '/signup':
      if (currentUser) { navigate('/dashboard'); return; }
      app.innerHTML = html('tmpl-signup'); renderSignup(); break;
    case '/keys':
      if (!currentUser) { navigate('/login'); return; }
      app.innerHTML = html('tmpl-keys'); renderKeys(); break;
    case '/dashboard':
      if (!currentUser) { navigate('/login'); return; }
      app.innerHTML = html('tmpl-dashboard'); renderDashboard(); break;
    case '/logout':
      localStorage.removeItem('nx_token'); currentUser = null; navigate('/'); break;
    case '/chat':
    case '/playground':
      if (!currentUser) { navigate('/login'); return; }
      app.innerHTML = html('tmpl-chat'); renderChat(); break;
    default:
      app.innerHTML = `<section class="page-section"><div class="page-card"><h2>404</h2><p class="text-muted">Page not found.</p><a href="#/" data-nav class="btn btn-primary">Go home</a></div></section>`;
  }
}

function renderHome() {
  const target = document.getElementById('typedResponse');
  if (!target) return;
  const text = 'still here. what do you need?';
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { target.textContent = text; return; }
  let i = 0;
  function step() {
    if (i <= text.length) { target.textContent = text.slice(0, i); i++; setTimeout(step, 28); }
  }
  setTimeout(step, 900);
}

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
    navigate('/dashboard');
  });
}

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

async function renderDashboard() {
  const el = document.getElementById('dashboardContent');
  const data = await api('/api/v1/auth/me');
  const keys = data.keys || [];
  el.innerHTML = `
    <div style="text-align:center;margin-bottom:28px">
      <p class="text-muted" style="font-size:0.9rem">${esc(data.email)}</p>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:32px">
      <div class="page-card" style="padding:20px;text-align:center;margin:0">
        <div style="font-size:2rem;font-weight:700;font-family:var(--font-display)">${keys.length}</div>
        <div class="text-muted" style="font-size:0.82rem">API Keys</div>
      </div>
      <div class="page-card" style="padding:20px;text-align:center;margin:0">
        <div style="font-size:2rem;font-weight:700;font-family:var(--font-display)">${keys.filter(k => k.is_active).length}</div>
        <div class="text-muted" style="font-size:0.82rem">Active Keys</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
      <a href="#/keys" data-nav class="page-card" style="display:block;padding:20px;text-align:center;cursor:pointer;text-decoration:none;margin:0">
        <h3 style="margin:0 0 4px;font-family:var(--font-display);font-size:1rem">Manage Keys</h3>
        <p class="text-muted" style="margin:0;font-size:0.82rem">Generate, edit, enable or delete your API keys</p>
      </a>
      <a href="#/chat" data-nav class="page-card" style="display:block;padding:20px;text-align:center;cursor:pointer;text-decoration:none;margin:0">
        <h3 style="margin:0 0 4px;font-family:var(--font-display);font-size:1rem">Chat</h3>
        <p class="text-muted" style="margin:0;font-size:0.82rem">Test models interactively with full parameter control</p>
      </a>
    </div>
  `;
}

function renderKeys() {
  const list = document.getElementById('keyList');
  const genBtn = document.getElementById('genKeyBtn');
  const msgEl = document.getElementById('keyMessage');

  async function loadKeys() {
    const data = await api('/api/v1/keys');
    const keys = data.keys || [];
    if (keys.length === 0) {
      list.innerHTML = '<p class="text-muted" style="padding:12px 0">No API keys yet. Generate one below.</p>';
      return;
    }
    list.innerHTML = keys.map((k, i) => `
      <div class="key-row${k.is_active ? '' : ' key-row-disabled'}">
        <div class="key-row-header">
          <span class="key-row-label">${esc(k.label)}</span>
          <span class="key-row-status ${k.is_active ? 'status-active' : 'status-inactive'}">${k.is_active ? 'Active' : 'Disabled'}</span>
        </div>
        <div class="key-row-meta">
          <code class="key-row-value" id="keyVal_${i}">${k.key}</code>
          <span class="text-muted key-row-date">Created ${new Date(k.created_at).toLocaleDateString()}</span>
        </div>
        <div class="key-row-actions">
          <button class="btn-sm" data-action="copy" data-idx="${i}">Copy</button>
          <button class="btn-sm" data-action="toggle" data-idx="${i}">${k.is_active ? 'Disable' : 'Enable'}</button>
          <button class="btn-sm" data-action="edit" data-idx="${i}">Edit</button>
          <button class="btn-sm btn-sm-danger" data-action="delete" data-idx="${i}">Delete</button>
        </div>
      </div>
    `).join('');

    list.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const idx = parseInt(btn.dataset.idx);
        const key = keys[idx].key;
        hide(msgEl);

        switch (btn.dataset.action) {
          case 'copy': {
            const el = document.getElementById(`keyVal_${idx}`);
            if (el) { await navigator.clipboard.writeText(el.textContent); showSuccess(msgEl, 'Copied!'); }
            break;
          }
          case 'toggle': {
            const data = await api('/api/v1/keys', { method: 'PUT', body: JSON.stringify({ key, is_active: !keys[idx].is_active }) });
            if (data.error) showError(msgEl, data.error); else { showSuccess(msgEl, data.message); await loadKeys(); }
            break;
          }
          case 'delete': {
            if (!confirm(`Delete key "${keys[idx].label}"?`)) return;
            const data = await api('/api/v1/keys', { method: 'DELETE', body: JSON.stringify({ key }) });
            if (data.error) showError(msgEl, data.error); else { showSuccess(msgEl, 'Key deleted.'); await loadKeys(); }
            break;
          }
          case 'edit': {
            const label = prompt('Label:', keys[idx].label);
            if (label === null) return;
            const modelsRaw = prompt('Allowed models (comma-separated, leave blank for all):', (keys[idx].models || []).join(', '));
            const models = modelsRaw ? modelsRaw.split(',').map((s) => s.trim()).filter(Boolean) : null;
            const data = await api('/api/v1/keys', { method: 'PUT', body: JSON.stringify({ key, label, models }) });
            if (data.error) showError(msgEl, data.error); else { showSuccess(msgEl, 'Key updated.'); await loadKeys(); }
            break;
          }
        }
      });
    });
  }

  genBtn.addEventListener('click', async () => {
    hide(msgEl);
    const label = prompt('Label for this key (optional):') || 'Untitled Key';
    const data = await api('/api/v1/keys', { method: 'POST', body: JSON.stringify({ label }) });
    if (data.error) showError(msgEl, data.error);
    else { showSuccess(msgEl, 'API key created!'); await loadKeys(); }
  });

  loadKeys();
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

async function renderChat() {
  const form = document.getElementById('chatForm');
  const input = document.getElementById('chatInput');
  const messages = document.getElementById('chatMessages');
  const sendBtn = document.getElementById('chatSend');
  const modelSel = document.getElementById('chatModel');
  const tempRange = document.getElementById('chatTemp');
  const tempVal = document.getElementById('chatTempVal');
  const maxTok = document.getElementById('chatMaxTokens');
  const toggle = document.getElementById('chatToolbarToggle');
  const toolbar = document.getElementById('chatToolbar');

  toggle.addEventListener('click', () => toolbar.classList.toggle('ct-hidden'));

  tempRange.addEventListener('input', () => { tempVal.textContent = tempRange.value; });

  const modelsData = await api('/api/v1/models');
  if (modelsData.models && modelsData.models.length > 0) {
    const seen = new Set();
    modelSel.innerHTML = '<option value="">Auto</option>' +
      modelsData.models
        .filter((m) => { if (seen.has(m.id)) return false; seen.add(m.id); return true; })
        .map((m) => `<option value="${m.id}">${m.id}</option>`)
        .join('');
  } else {
    modelSel.innerHTML = '<option value="">Auto</option>';
  }

  function addMsg(role, content) {
    const div = document.createElement('div');
    div.className = `chat-msg chat-msg-${role}`;
    div.innerHTML = `<div class="chat-msg-content">${esc(content)}</div>`;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    addMsg('user', text);
    input.value = '';
    input.style.height = 'auto';
    sendBtn.disabled = true;
    sendBtn.textContent = '...';

    const thinkingDiv = document.createElement('div');
    thinkingDiv.className = 'chat-msg chat-msg-assistant';
    thinkingDiv.innerHTML = '<div class="chat-msg-content thinking-dots"><span></span><span></span><span></span></div>';
    messages.appendChild(thinkingDiv);
    messages.scrollTop = messages.scrollHeight;

    const payload = {
      messages: [{ role: 'user', content: text }],
      model: modelSel.value || undefined,
      temperature: parseFloat(tempRange.value),
      max_tokens: parseInt(maxTok.value) || undefined,
    };

    const data = await api('/api/v1/playground/chat', { method: 'POST', body: JSON.stringify(payload) });

    if (data.error) {
      thinkingDiv.querySelector('.chat-msg-content').textContent = data.error?.message || data.error || 'Request failed.';
    } else {
      thinkingDiv.querySelector('.chat-msg-content').textContent = data.choices?.[0]?.message?.content || JSON.stringify(data);
    }
    sendBtn.disabled = false;
    sendBtn.textContent = 'Send';
  });

  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 160) + 'px';
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.dispatchEvent(new Event('submit')); }
  });
}

initRouter();
