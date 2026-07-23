const { handleOptions, json } = require('../../lib/db');

const PATH_IDS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const OPencodeZenFree = [
  'deepseek-v4-flash-free', 'big-pickle',
  'mimo-v2.5-free', 'mimo-v2-flash', 'laguna-s-2.1-free',
  'north-mini-code-free', 'nemotron-3-ultra-free',
  'nemotron-3-super-free', 'hy3-free',
];

module.exports = async (req, res) => {
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') { json(res, 405, { error: 'Use POST.' }); return; }

  const { models } = req.body || {};
  if (!Array.isArray(models) || models.length === 0) {
    json(res, 400, { error: 'Send a models array with { id, path } objects.' });
    return;
  }

  const pathConfigs = PATH_IDS.map((id) => ({
    id,
    url: process.env[`PATH_${id}_URL`],
    key: process.env[`PATH_${id}_KEY`],
  })).filter((p) => {
    if (!p.url || !p.key) return false;
    try { const h = new URL(p.url).hostname; if (h.includes('groq') || h.includes('ofox') || h.includes('cerebras') || h.includes('ai.furry.vg')) return false; } catch {}
    return true;
  });

  const grouped = {};
  for (const m of models) {
    const letter = (m.path || '').replace('Path ', '');
    if (!letter) continue;
    if (!grouped[letter]) grouped[letter] = [];
    grouped[letter].push(m.id);
  }

  const allResults = [];

  await Promise.all(Object.entries(grouped).map(async ([letter, modelIds]) => {
    const cfg = pathConfigs.find(p => p.id === letter);
    if (!cfg) {
      for (const id of modelIds) allResults.push({ id, ok: false, error: 'path not configured' });
      return;
    }

    const results = await Promise.allSettled(modelIds.map(async (modelId) => {
      const payload = {
        model: modelId,
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 1,
        temperature: 0,
        stream: false,
      };

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 25000);
      try {
        const start = Date.now();
        const resp = await fetch(cfg.url, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${cfg.key}`,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        const latency = Date.now() - start;
        clearTimeout(timer);

        if (resp.ok) {
          const body = await resp.json();
          const content = body?.choices?.[0]?.message?.content || body?.choices?.[0]?.delta?.content || '';
          return { id: modelId, ok: true, latency, snippet: content.slice(0, 80) };
        }
        const errBody = await resp.json().catch(() => ({}));
        const msg = errBody?.error?.message || errBody?.error || `HTTP ${resp.status}`;
        return { id: modelId, ok: false, error: typeof msg === 'string' ? msg : JSON.stringify(msg) };
      } catch (e) {
        clearTimeout(timer);
        return { id: modelId, ok: false, error: e?.name === 'AbortError' ? 'timeout' : 'network error' };
      }
    }));

    for (const r of results) {
      allResults.push(r.status === 'fulfilled' ? r.value : { id: 'unknown', ok: false, error: 'internal error' });
    }
  }));

  json(res, 200, { results: allResults });
};
