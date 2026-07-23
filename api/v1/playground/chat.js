const { getKv, handleOptions, json } = require('../../lib/db');

const PATH_IDS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const REQUEST_TIMEOUT_MS = 30000;
const STREAM_TIMEOUT_MS = 60000;
const OPencodeZenFree = [
  'deepseek-v4-flash-free', 'big-pickle',
  'mimo-v2.5-free', 'mimo-v2-flash', 'laguna-s-2.1-free',
  'north-mini-code-free', 'nemotron-3-ultra-free',
  'nemotron-3-super-free', 'hy3-free',
];

function loadPaths(reqModel) {
  return PATH_IDS.map((id) => ({
    label: `path-${id.toLowerCase()}`,
    url: process.env[`PATH_${id}_URL`],
    key: process.env[`PATH_${id}_KEY`],
    model: process.env[`PATH_${id}_MODEL`],
  })).filter((p) => {
    if (!p.url || !p.key) return false;
    try { const h = new URL(p.url).hostname; if (h.includes('groq') || h.includes('ofox') || h.includes('cerebras') || h.includes('ai.furry.vg')) return false; } catch {}
    const isZen = p.label === 'path-c';
    if (isZen && reqModel && reqModel !== 'nexiom-default' && !OPencodeZenFree.includes(reqModel)) return false;
    return true;
  });
}

function resolvePayload(path, body) {
  const payload = { ...body };
  const requestedModel = body.model;
  if (!requestedModel || requestedModel === 'nexiom-default') {
    if (path.model) payload.model = path.model;
    else delete payload.model;
  }
  return payload;
}

async function callPath(path, body) {
  const payload = resolvePayload(path, body);
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

async function streamPath(path, body, res) {
  const payload = resolvePayload(path, body);
  payload.stream = true;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), STREAM_TIMEOUT_MS);
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

    if (!upstream.ok) {
      clearTimeout(timer);
      const err = await upstream.json().catch(() => ({}));
      return { ok: false, status: upstream.status, error: err };
    }

    const headers = {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    };
    if (payload.model) headers['X-Model'] = payload.model;
    res.writeHead(200, headers);

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let lastModel = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      for (const line of chunk.split('\n')) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            if (parsed.model) lastModel = parsed.model;
            if (parsed.choices?.[0]?.delta?.content) {
              res.write(`data: ${JSON.stringify({ content: parsed.choices[0].delta.content })}\n\n`);
            }
          } catch {}
        }
      }
    }
    if (lastModel) res.write(`data: ${JSON.stringify({ done: true, model: lastModel })}\n\n`);
    else res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    clearTimeout(timer);
    res.end();
    return { ok: true };
  } catch (err) {
    clearTimeout(timer);
    return { ok: false, status: 0, error: { message: err?.name === 'AbortError' ? 'timeout' : 'network error' } };
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

  const isStream = body.stream === true;
  delete body.stream;

  const candidates = loadPaths(body.model);
  if (candidates.length === 0) {
    json(res, 503, { error: 'No inference paths are configured yet.' });
    return;
  }

  const attempts = [];

  for (const [i, path] of candidates.entries()) {
    try {
      let result;
      if (isStream) {
        result = await streamPath(path, body, res);
        if (result.ok) return;
      } else {
        result = await callPath(path, body);
        if (!result.ok && result.status >= 500) {
          attempts.push({ path: path.label, status: result.status });
          if (i < candidates.length - 1) continue;
        } else if (!result.ok) {
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
      }

      if (isStream) {
        attempts.push({ path: path.label, status: result.status, error: result.error?.error?.message || result.error?.message || 'stream failed' });
      }
    } catch (err) {
      if (isStream) {
        try { res.end(); } catch {}
        return;
      }
      attempts.push({ path: path.label, error: err && err.name === 'AbortError' ? 'timeout' : 'network error' });
    }
  }

  if (isStream) {
    if (!res.headersSent) {
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    }
    res.write(`data: ${JSON.stringify({ error: 'Every inference path failed for this request.', attempts })}\n\n`);
    res.end();
  } else {
    json(res, 502, { error: { message: 'Every inference path failed for this request.', attempts } });
  }
};
