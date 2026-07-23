const { getKv, handleOptions, json } = require('../../lib/db');

const PATH_IDS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const REQUEST_TIMEOUT_MS = 30000;

function loadPaths() {
  return PATH_IDS.map((id) => ({
    label: `path-${id.toLowerCase()}`,
    url: process.env[`PATH_${id}_URL`],
    key: process.env[`PATH_${id}_KEY`],
    model: process.env[`PATH_${id}_MODEL`],
  })).filter((p) => {
    if (!p.url || !p.key) return false;
    try { return !new URL(p.url).hostname.includes('groq'); } catch { return true; }
  });
}

async function callPath(path, body) {
  const payload = { ...body };
  const requestedModel = body.model;
  if (!requestedModel || requestedModel === 'nexiom-default') {
    if (path.model) payload.model = path.model;
    else delete payload.model;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const upstream = await fetch(path.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${path.key}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    return { ok: upstream.ok, status: upstream.status, json: upstream.ok ? await upstream.json() : null };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = async (req, res) => {
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') { json(res, 405, { error: 'Use POST.' }); return; }

  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) { json(res, 401, { error: 'Not authenticated. Log in to use the playground.' }); return; }

  const kv = getKv();
  if (!kv) { json(res, 500, { error: 'KV store not configured.' }); return; }

  const session = await kv.get(`session:${token}`);
  if (!session) { json(res, 401, { error: 'Invalid or expired session.' }); return; }

  const body = req.body || {};
  if (!Array.isArray(body.messages)) {
    json(res, 400, { error: 'Request body needs a messages array.' });
    return;
  }

  const candidates = loadPaths();
  if (candidates.length === 0) {
    json(res, 503, { error: 'No inference paths are configured yet.' });
    return;
  }

  const attempts = [];

  for (const path of candidates) {
    try {
      const result = await callPath(path, body);

      if (result.status === 429 || result.status >= 500) {
        attempts.push({ path: path.label, status: result.status });
        continue;
      }

      if (!result.ok) {
        attempts.push({ path: path.label, status: result.status });
        continue;
      }

      const userKey = await kv.get(`userkey:${session.user_id}`);
      if (userKey) {
        const now = new Date().toISOString();
        await kv.set(`apikey:${userKey.key}`, { ...userKey, last_used_at: now });
        await kv.set(`userkey:${session.user_id}`, { ...userKey, last_used_at: now });
      }

      json(res, 200, result.json);
      return;
    } catch (err) {
      attempts.push({ path: path.label, error: err && err.name === 'AbortError' ? 'timeout' : 'network error' });
    }
  }

  json(res, 502, { error: { message: 'Every inference path failed for this request.', attempts } });
};
