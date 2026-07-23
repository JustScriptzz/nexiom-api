const { handleOptions, json } = require('../../lib/db');

function deriveModelsUrl(chatUrl) {
  try {
    const u = new URL(chatUrl);
    const path = u.pathname;
    const modelsPath = path.replace(/\/chat\/completions\/?$/, '/models').replace(/\/v1\/?$/, '/v1/models');
    if (modelsPath === path && !path.endsWith('/models')) {
      const base = path.replace(/\/chat\/completions\/?$/, '').replace(/\/?$/, '');
      return `${u.origin}${base}/models`;
    }
    return `${u.origin}${modelsPath}`;
  } catch {
    return null;
  }
}

module.exports = async (req, res) => {
  if (handleOptions(req, res)) return;
  if (req.method !== 'GET') { json(res, 405, { error: 'Use GET.' }); return; }

  const results = [];
  const ids = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

  for (const id of ids) {
    const url = process.env[`PATH_${id}_URL`];
    const key = process.env[`PATH_${id}_KEY`];
    const defaultModel = process.env[`PATH_${id}_MODEL`];
    if (!url || !key) continue;

    let provider = 'unknown';
    try { provider = new URL(url).hostname; } catch {}

    const modelsUrl = deriveModelsUrl(url);

    if (modelsUrl) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        const resp = await fetch(modelsUrl, {
          headers: { authorization: `Bearer ${key}` },
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (resp.ok) {
          const body = await resp.json();
          const list = body.data || body.models || [];
          if (Array.isArray(list)) {
            for (const m of list) {
              const modelId = m.id || m.model || m.name;
              if (modelId) {
                results.push({
                  id: modelId,
                  provider,
                  path: `Path ${id}`,
                  default: modelId === defaultModel,
                });
              }
            }
            continue;
          }
        }
      } catch {}
    }

    if (defaultModel) {
      results.push({ id: defaultModel, provider, path: `Path ${id}`, default: true });
    }
  }

  json(res, 200, { models: results });
};
