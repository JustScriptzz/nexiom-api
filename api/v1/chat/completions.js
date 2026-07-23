const { Redis } = require('@upstash/redis');

const PATH_IDS = ["A", "B", "C", "D", "E", "F", "G", "H"];
const REQUEST_TIMEOUT_MS = 20000;
const OPencodeZenFree = [
  'deepseek-v4-flash-free', 'gpt-5-nano', 'big-pickle',
  'mimo-v2.5-free', 'mimo-v2-flash', 'laguna-s-2.1-free',
  'north-mini-code-free', 'nemotron-3-ultra-free',
  'nemotron-3-super-free', 'hy3-free',
];

let _kv = null;
function getKv() {
  if (_kv) return _kv;
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (url && token) _kv = new Redis({ url, token });
  return _kv;
}

function loadPaths(reqModel) {
  return PATH_IDS.map((id) => ({
    label: `path-${id.toLowerCase()}`,
    url: process.env[`PATH_${id}_URL`],
    key: process.env[`PATH_${id}_KEY`],
    model: process.env[`PATH_${id}_MODEL`],
  })).filter((p) => {
    if (!p.url || !p.key) return false;
    try { if (new URL(p.url).hostname.includes('groq')) return false; } catch {}
    const isZen = p.label === 'path-c';
    if (isZen && reqModel && !OPencodeZenFree.includes(reqModel)) return false;
    return true;
  });
}

let _authorizedKeyMeta = null;

async function isAuthorized(req) {
  const header = req.headers["authorization"] || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return false;

  if (process.env.NEXIOM_API_KEY && token === process.env.NEXIOM_API_KEY) {
    return true;
  }

  if (process.env.NEXIOM_KEYS) {
    try {
      const keys = JSON.parse(process.env.NEXIOM_KEYS);
      if (keys.some((k) => (typeof k === "string" ? k : k.key) === token)) return true;
    } catch (err) {}
  }

  const kv = getKv();
  if (kv) {
    const data = await kv.get(`apikey:${token}`);
    if (data && data.user_id) {
      if (data.is_active === false) return false;
      _authorizedKeyMeta = data;
      await kv.set(`apikey:${token}`, { ...data, last_used_at: new Date().toISOString() });
      return true;
    }
  }

  return false;
}

async function callPath(path, body) {
  const payload = { ...body };
  const requestedModel = body.model;
  if (!requestedModel || requestedModel === "nexiom-default") {
    if (path.model) {
      payload.model = path.model;
    } else {
      delete payload.model;
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const upstream = await fetch(path.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
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
  if (req.method !== "POST") {
    res.status(405).json({ error: { message: "Use POST." } });
    return;
  }

  if (!(await isAuthorized(req))) {
    res.status(401).json({ error: { message: "Missing or invalid API key." } });
    return;
  }

  const body = req.body || {};
  if (!Array.isArray(body.messages)) {
    res.status(400).json({ error: { message: "Request body needs a messages array." } });
    return;
  }

  let candidates = loadPaths(body.model);

  const reqModel = body.model;
  if (_authorizedKeyMeta && Array.isArray(_authorizedKeyMeta.models) && _authorizedKeyMeta.models.length > 0) {
    if (reqModel && !_authorizedKeyMeta.models.includes(reqModel)) {
      res.status(403).json({ error: { message: `This API key is not allowed to use model "${reqModel}".` } });
      return;
    }
    candidates = candidates.filter((p) => !p.model || _authorizedKeyMeta.models.includes(p.model));
  }
  _authorizedKeyMeta = null;

  if (candidates.length === 0) {
    res.status(503).json({ error: { message: "No inference paths are configured yet." } });
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

      res.status(200).json(result.json);
      return;
    } catch (err) {
      attempts.push({ path: path.label, error: err && err.name === "AbortError" ? "timeout" : "network error" });
    }
  }

  res.status(502).json({
    error: {
      message: "Every inference path failed for this request.",
      attempts,
    },
  });
};
