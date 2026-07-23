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

  if (req.method === 'GET') {
    const userKey = await kv.get(`userkey:${session.user_id}`);
    json(res, 200, { api_key: userKey || null });
    return;
  }

  if (req.method === 'POST') {
    const existing = await kv.get(`userkey:${session.user_id}`);
    if (existing) {
      json(res, 409, { error: 'You already have an API key. Revoke it first to generate a new one.', api_key: existing });
      return;
    }

    const newKey = generateApiKey();
    const now = new Date().toISOString();
    const keyData = { key: newKey, created_at: now, last_used_at: null };

    await kv.set(`apikey:${newKey}`, { user_id: session.user_id, created_at: now, last_used_at: null });
    await kv.set(`userkey:${session.user_id}`, keyData);

    json(res, 201, { api_key: keyData, message: 'API key created.' });
    return;
  }

  if (req.method === 'DELETE') {
    const existing = await kv.get(`userkey:${session.user_id}`);
    if (existing) {
      await kv.del(`apikey:${existing.key}`);
      await kv.del(`userkey:${session.user_id}`);
    }
    json(res, 200, { message: 'API key revoked.' });
    return;
  }

  json(res, 405, { error: 'Method not allowed.' });
};
