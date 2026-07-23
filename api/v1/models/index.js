const { handleOptions, json } = require('../../lib/db');

module.exports = async (req, res) => {
  if (handleOptions(req, res)) return;
  if (req.method !== 'GET') { json(res, 405, { error: 'Use GET.' }); return; }

  const models = [];
  for (const id of ['A', 'B', 'C', 'D', 'E']) {
    const model = process.env[`PATH_${id}_MODEL`];
    const url = process.env[`PATH_${id}_URL`];
    const key = process.env[`PATH_${id}_KEY`];
    if (model && url && key) {
      let provider = 'unknown';
      try { provider = new URL(url).hostname; } catch {}
      models.push({ id: model, label: `Path ${id}`, provider, available: true });
    }
  }

  json(res, 200, { models });
};
