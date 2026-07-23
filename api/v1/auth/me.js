const { getKv, handleOptions, json } = require('../../lib/db');

module.exports = async (req, res) => {
  if (handleOptions(req, res)) return;
  if (req.method !== 'GET') { json(res, 405, { error: 'Use GET.' }); return; }

  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) { json(res, 401, { error: 'Not authenticated.' }); return; }

  const kv = getKv();
  if (!kv) { json(res, 500, { error: 'KV store not configured.' }); return; }

  const session = await kv.get(`session:${token}`);
  if (!session) { json(res, 401, { error: 'Invalid or expired session.' }); return; }

  const keys = (await kv.get(`userkeys:${session.user_id}`)) || [];

  json(res, 200, {
    email: session.email,
    user_id: session.user_id,
    created_at: session.created_at || null,
    keys,
  });
};
