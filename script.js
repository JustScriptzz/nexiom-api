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
  if (data.email) { currentUser = data; }
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

  document.body.classList.remove('route-chat');
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
      document.body.classList.add('route-chat');
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

  const actions = document.querySelector('.hero-actions');
  if (actions && currentUser) {
    actions.innerHTML = `
      <a href="#/chat" class="btn btn-primary" data-nav>Open Chat</a>
      <a href="#/dashboard" class="btn btn-ghost" data-nav>Dashboard</a>
    `;
  }
}

async function renderModels() {
  const list = document.getElementById('modelsList');
  const data = await api('/api/v1/models');
  if (!data.models || data.models.length === 0) {
    list.innerHTML = '<p class="text-muted">No models are currently configured.</p>';
    return;
  }
  list.innerHTML = `<div class="models-grid-flat">${data.models.map((m) => `
    <div class="model-card${m.default ? ' model-default' : ''}">
      <span class="model-name">${m.id}</span>
      ${m.default ? '<span class="model-badge model-badge-default">default</span>' : ''}
    </div>
  `).join('')}</div>`;
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
  const activeKeys = keys.filter(k => k.is_active);
  const lastUsed = keys.filter(k => k.last_used_at).sort((a, b) => new Date(b.last_used_at) - new Date(a.last_used_at))[0];

  let modelsCount = 0;
  let stats = { providers: [] };
  try {
    const [m, s] = await Promise.all([
      api('/api/v1/models').catch(() => ({ models: [] })),
      api('/api/v1/stats').catch(() => ({ providers: [] })),
    ]);
    if (m.models) modelsCount = m.models.length;
    if (s.providers) stats = s;
  } catch {}

  const online = stats.providers.filter(p => p.status === 'online').length;
  const offline = stats.providers.filter(p => p.status !== 'online').length;

  el.innerHTML = `
    <div class="dash-header">
      <div class="dash-user">
        <div class="dash-avatar">${(data.email || '?')[0].toUpperCase()}</div>
        <div>
          <p class="dash-email">${esc(data.email)}</p>
          <p class="dash-joined">Member since ${data.created_at ? new Date(data.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'today'}</p>
        </div>
      </div>
    </div>

    <div class="dash-grid">
      <div class="dash-card">
        <div class="dash-card-icon">🔑</div>
        <div class="dash-card-body">
          <div class="dash-card-value">${keys.length}</div>
          <div class="dash-card-label">Total Keys</div>
        </div>
        <div class="dash-card-footer">
          ${activeKeys.length} active · ${keys.length - activeKeys.length} disabled
        </div>
      </div>
      <div class="dash-card">
        <div class="dash-card-icon">🧠</div>
        <div class="dash-card-body">
          <div class="dash-card-value">${modelsCount}</div>
          <div class="dash-card-label">Models</div>
        </div>
        <div class="dash-card-footer">
          Across ${stats.providers.length} providers
        </div>
      </div>
      <div class="dash-card">
        <div class="dash-card-icon">📡</div>
        <div class="dash-card-body">
          <div class="dash-card-value">${online}</div>
          <div class="dash-card-label">Providers Online</div>
        </div>
        <div class="dash-card-footer">
          ${offline > 0 ? `${offline} offline` : 'All healthy'}
        </div>
      </div>
    </div>

    <div class="dash-section-header">
      <h3>Provider Status</h3>
    </div>
    <div class="dash-providers">
      ${stats.providers.map(p => `
        <div class="dash-provider ${p.status === 'online' ? 'dash-provider-ok' : 'dash-provider-down'}">
          <div class="dash-provider-left">
            <span class="dash-dot ${p.status === 'online' ? 'dash-dot-ok' : 'dash-dot-err'}"></span>
            <span class="dash-provider-name">${esc(p.provider)}</span>
            <span class="dash-provider-path">${p.path}</span>
          </div>
          <div class="dash-provider-right">
            ${p.latency ? `<span class="dash-latency">${p.latency}ms</span>` : ''}
            <span class="dash-status ${p.status === 'online' ? 'dash-status-ok' : 'dash-status-err'}">${p.status}</span>
          </div>
          ${p.default_model ? `<div class="dash-provider-model">default: ${esc(p.default_model)}</div>` : ''}
        </div>
      `).join('')}
    </div>

    <div class="dash-section-header">
      <h3>Quick Actions</h3>
    </div>
    <div class="dash-actions">
      <a href="#/keys" data-nav class="dash-action">
        <span class="dash-action-icon">🔑</span>
        <span class="dash-action-label">Manage Keys</span>
        <span class="dash-action-arrow">→</span>
      </a>
      <a href="#/chat" data-nav class="dash-action">
        <span class="dash-action-icon">💬</span>
        <span class="dash-action-label">Open Chat</span>
        <span class="dash-action-arrow">→</span>
      </a>
      <a href="#/models" data-nav class="dash-action">
        <span class="dash-action-icon">🧠</span>
        <span class="dash-action-label">Browse Models</span>
        <span class="dash-action-arrow">→</span>
      </a>
      <a href="#/docs" data-nav class="dash-action">
        <span class="dash-action-icon">📄</span>
        <span class="dash-action-label">API Docs</span>
        <span class="dash-action-arrow">→</span>
      </a>
    </div>

    ${lastUsed ? `
    <div class="dash-section-header">
      <h3>Recent Activity</h3>
    </div>
    <div class="dash-activity">
      <div class="dash-activity-item">
        <span class="dash-activity-icon">🔑</span>
        <div class="dash-activity-body">
          <span class="dash-activity-text">Key <strong>${esc(lastUsed.label || lastUsed.key)}</strong> last used</span>
          <span class="dash-activity-time">${new Date(lastUsed.last_used_at).toLocaleString()}</span>
        </div>
      </div>
    </div>` : ''}
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

  const comboTrigger = document.getElementById('chatModelTrigger');
  const comboDropdown = document.getElementById('chatModelDropdown');
  const comboSearch = document.getElementById('chatModelSearch');
  const comboOptions = document.getElementById('chatModelOptions');
  let allModels = [];

  function populateOptions(filter) {
    const q = (filter || '').toLowerCase();
    comboOptions.innerHTML = '<div class="ct-combo-opt" data-value="">Auto</div>' +
      allModels
        .filter((m) => !q || m.id.toLowerCase().includes(q))
        .map((m) => `<div class="ct-combo-opt${m.id === modelSel.value ? ' selected' : ''}" data-value="${m.id}">${esc(m.id)}</div>`)
        .join('');
  }

  function closeCombo() {
    comboDropdown.classList.remove('open');
    comboSearch.value = '';
  }

  function selectModel(value) {
    modelSel.value = value;
    comboTrigger.textContent = value || 'Auto';
    closeCombo();
  }

  comboTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = comboDropdown.classList.toggle('open');
    if (isOpen) {
      populateOptions();
      comboSearch.focus();
    }
  });

  comboDropdown.addEventListener('click', (e) => {
    const opt = e.target.closest('.ct-combo-opt');
    if (!opt) return;
    selectModel(opt.dataset.value);
  });

  comboSearch.addEventListener('input', () => populateOptions(comboSearch.value));

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.ct-combo')) closeCombo();
  });

  comboSearch.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeCombo();
    if (e.key === 'Enter') {
      const first = comboOptions.querySelector('.ct-combo-opt:not([data-value=""])');
      if (first) selectModel(first.dataset.value);
    }
  });

  const modelsData = await api('/api/v1/models');
  if (modelsData.models && modelsData.models.length > 0) {
    const seen = new Set();
    allModels = modelsData.models.filter((m) => { if (seen.has(m.id)) return false; seen.add(m.id); return true; });
    modelSel.innerHTML = '<option value="">Auto</option>' + allModels.map((m) => `<option value="${m.id}">${m.id}</option>`).join('');
    populateOptions();
  } else {
    modelSel.innerHTML = '<option value="">Auto</option>';
    populateOptions();
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

    const msgDiv = document.createElement('div');
    msgDiv.className = 'chat-msg chat-msg-assistant';
    msgDiv.innerHTML = '<div class="chat-msg-content thinking-dots"><span></span><span></span><span></span></div>';
    messages.appendChild(msgDiv);
    messages.scrollTop = messages.scrollHeight;

    const payload = {
      messages: [{ role: 'user', content: text }],
      model: modelSel.value || undefined,
      temperature: parseFloat(tempRange.value),
      max_tokens: parseInt(maxTok.value) || undefined,
      stream: true,
    };

    const token = localStorage.getItem('nx_token');
    let fullContent = '';
    let responseModel = '';

    try {
      const res = await fetch(API_BASE + '/api/v1/playground/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        msgDiv.innerHTML = '<div class="chat-msg-content" style="color:#ff5f57">' + esc(errData.error?.message || 'Request failed.') + '</div>';
        sendBtn.disabled = false;
        sendBtn.textContent = 'Send';
        return;
      }

      const label = responseModel ? `<div class="chat-msg-model">${esc(responseModel)}</div>` : '';
      msgDiv.innerHTML = label + '<div class="chat-msg-content"></div>';
      const contentEl = msgDiv.querySelector('.chat-msg-content');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const data = JSON.parse(line.slice(6));
          if (data.done) {
            if (data.model) responseModel = data.model;
            break;
          }
          if (data.error) {
            contentEl.textContent = data.error?.message || data.error || 'Error';
            break;
          }
          if (data.content) {
            fullContent += data.content;
            contentEl.textContent = fullContent;
            messages.scrollTop = messages.scrollHeight;
          }
        }
      }

      if (responseModel) {
        const modelEl = document.createElement('div');
        modelEl.className = 'chat-msg-model';
        modelEl.textContent = responseModel;
        msgDiv.insertBefore(modelEl, msgDiv.firstChild);
      }
    } catch (err) {
      msgDiv.innerHTML = '<div class="chat-msg-content" style="color:#ff5f57">Network error: ' + esc(err.message) + '</div>';
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
