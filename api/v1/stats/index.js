const { handleOptions, json } = require('../../lib/db');

const PATH_IDS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

module.exports = async (req, res) => {
  if (handleOptions(req, res)) return;
  if (req.method !== 'GET') { json(res, 405, { error: 'Use GET.' }); return; }

  const paths = PATH_IDS.map((id) => ({
    id,
    url: process.env[`PATH_${id}_URL`],
    key: process.env[`PATH_${id}_KEY`],
    model: process.env[`PATH_${id}_MODEL`],
  })).filter((p) => p.url && p.key);

  const providerStatus = await Promise.all(paths.map(async (p) => {
    let status = 'unknown';
    let latency = null;
    try {
      const start = Date.now();
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 5000);
      const resp = await fetch(p.url.replace(/\/chat\/completions\/?$/, '/models'), {
        headers: { authorization: `Bearer ${p.key}` },
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      latency = Date.now() - start;
      status = resp.ok ? 'online' : `error ${resp.status}`;
    } catch (e) {
      status = e?.name === 'AbortError' ? 'timeout' : 'unreachable';
    }
    return { path: `Path ${p.id}`, default_model: p.model || null, status, latency };
  }));

  json(res, 200, {
    paths_configured: paths.length,
    providers: providerStatus,
  });
};
