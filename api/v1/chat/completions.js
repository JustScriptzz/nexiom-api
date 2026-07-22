// Nexiom gateway — tries each configured inference path in order and
// falls back to the next one on a rate limit, server error, or timeout.
// Real provider identity is intentionally kept out of anything sent
// back to the caller (see PATH_LABEL below) — only env var names and
// this file reveal which service is which.

const PROVIDERS = [
  {
    label: "path-a",
    key: process.env.GROQ_API_KEY,
    url: "https://api.groq.com/openai/v1/chat/completions",
    defaultModel: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
  },
  {
    label: "path-b",
    key: process.env.CEREBRAS_API_KEY,
    url: "https://api.cerebras.ai/v1/chat/completions",
    defaultModel: process.env.CEREBRAS_MODEL || "llama3.3-70b",
  },
  {
    label: "path-c",
    key: process.env.OFOX_API_KEY,
    url: "https://api.ofox.ai/v1/chat/completions",
    defaultModel: process.env.OFOX_MODEL || "openai/gpt-5.5",
  },
  {
    label: "path-d",
    key: process.env.ATLAS_API_KEY,
    url: process.env.ATLAS_BASE_URL || "https://api.atlascloud.ai/v1/chat/completions",
    defaultModel: process.env.ATLAS_MODEL || "llama-3.3-70b",
  },
  {
    label: "path-e",
    key: process.env.OPENCODE_ZEN_API_KEY,
    url: "https://opencode.ai/zen/v1/chat/completions",
    defaultModel: process.env.OPENCODE_ZEN_MODEL || "big-pickle",
  },
];

const REQUEST_TIMEOUT_MS = 20000;

function isAuthorized(req) {
  const header = req.headers["authorization"] || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  return Boolean(process.env.NEXIOM_API_KEY) && token === process.env.NEXIOM_API_KEY;
}

async function callProvider(provider, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const upstream = await fetch(provider.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${provider.key}`,
      },
      body: JSON.stringify({
        ...body,
        model:
          body.model && body.model !== "nexiom-default"
            ? body.model
            : provider.defaultModel,
      }),
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

  const candidates = PROVIDERS.filter((p) => p.key);
  if (candidates.length === 0) {
    res.status(503).json({ error: { message: "No inference paths are configured yet." } });
    return;
  }

  const attempts = [];

  for (const provider of candidates) {
    try {
      const result = await callProvider(provider, body);

      if (result.status === 429 || result.status >= 500) {
        attempts.push({ path: provider.label, status: result.status });
        continue;
      }

      if (!result.ok) {
        attempts.push({ path: provider.label, status: result.status });
        continue;
      }

      res.status(200).json(result.json);
      return;
    } catch (err) {
      attempts.push({ path: provider.label, error: err && err.name === "AbortError" ? "timeout" : "network error" });
    }
  }

  res.status(502).json({
    error: {
      message: "Every inference path failed for this request.",
      attempts,
    },
  });
};
