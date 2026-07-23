const { getKv, generateApiKey, handleOptions, json } = require('../../lib/db');

module.exports = async (req, res) => {
  if (handleOptions(req, res)) return;

  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) { json(res, 401, { error: 'Not authenticated.' }); return; }

  const kv = getKv();
  if (!kv) { json(res, 500, { error: 'KV store not configured.' }); return; }

  const session = await kv.get(`session:${token}`);
  if (!session) { json(res, 401, { error: 'Invalid or expired session.' }); return; }

  const userId = session.user_id;

  async function getUserKeys() {
    return (await kv.get(`userkeys:${userId}`)) || [];
  }

  async function saveUserKeys(keys) {
    await kv.set(`userkeys:${userId}`, keys);
  }

  if (req.method === 'GET') {
    const keys = await getUserKeys();
    json(res, 200, { keys });
    return;
  }

  if (req.method === 'POST') {
    const { label, models } = req.body || {};
    const newKey = generateApiKey();
    const now = new Date().toISOString();
    const entry = { key: newKey, label: label || 'Untitled Key', is_active: true, models: models || null, created_at: now, last_used_at: null };

    const keys = await getUserKeys();
    keys.push(entry);
    await saveUserKeys(keys);
    await kv.set(`apikey:${newKey}`, { user_id: userId, label: entry.label, is_active: true, models: entry.models, created_at: now, last_used_at: null });

    json(res, 201, { key: entry, message: 'API key created.' });
    return;
  }

  if (req.method === 'PUT') {
    const { key, label, is_active, models } = req.body || {};
    if (!key) { json(res, 400, { error: 'Key is required.' }); return; }

    const existing = await kv.get(`apikey:${key}`);
    if (!existing || existing.user_id !== userId) { json(res, 404, { error: 'Key not found.' }); return; }

    const updates = {};
    if (label !== undefined) updates.label = label;
    if (is_active !== undefined) updates.is_active = is_active;
    if (models !== undefined) updates.models = models;

    const updatedEntry = { ...existing, ...updates };
    await kv.set(`apikey:${key}`, updatedEntry);

    const keys = await getUserKeys();
    const idx = keys.findIndex((k) => k.key === key);
    if (idx !== -1) {
      keys[idx] = { ...keys[idx], ...updates };
      await saveUserKeys(keys);
    }

    json(res, 200, { key: updatedEntry, message: 'Key updated.' });
    return;
  }

  if (req.method === 'DELETE') {
    const { key } = req.body || {};
    if (!key) { json(res, 400, { error: 'Key is required.' }); return; }

    const existing = await kv.get(`apikey:${key}`);
    if (!existing || existing.user_id !== userId) { json(res, 404, { error: 'Key not found.' }); return; }

    await kv.del(`apikey:${key}`);

    const keys = await getUserKeys();
    const filtered = keys.filter((k) => k.key !== key);
    await saveUserKeys(filtered);

    json(res, 200, { message: 'Key deleted.' });
    return;
  }

  json(res, 405, { error: 'Method not allowed.' });
};
