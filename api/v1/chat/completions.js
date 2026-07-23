// Nexiom gateway — tries each configured inference path in order and
// falls back to the next one on a rate limit, server error, or timeout.
// Which real services sit behind PATH_A..PATH_E lives ONLY in Vercel's
// environment variables — nothing about them is written in this repo.

const PATH_IDS = ["A", "B", "C", "D", "E"];

function loadPaths() {
  return PATH_IDS.map((id) => ({
    label: `path-${id.toLowerCase()}`,
    url: process.env[`PATH_${id}_URL`],
    key: process.env[`PATH_${id}_KEY`],
    model: process.env[`PATH_${id}_MODEL`],
  })).filter((p) => p.url && p.key);
}

const REQUEST_TIMEOUT_MS = 20000;

function isAuthorized(req) {
  const header = req.headers["authorization"] || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return false;

  if (process.env.NEXIOM_API_KEY && token === process.env.NEXIOM_API_KEY) {
    return true;
  }

  if (process.env.NEXIOM_KEYS) {
    try {
      const keys = JSON.parse(process.env.NEXIOM_KEYS);
      return keys.some((k) => (typeof k === "string" ? k : k.key) === token);
    } catch (err) {
      return false;
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

  if (!isAuthorized(req)) {
    res.status(401).json({ error: { message: "Missing or invalid API key." } });
    return;
  }

  const body = req.body || {};
  if (!Array.isArray(body.messages)) {
    res.status(400).json({ error: { message: "Request body needs a messages array." } });
    return;
  }

  const candidates = loadPaths();
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
