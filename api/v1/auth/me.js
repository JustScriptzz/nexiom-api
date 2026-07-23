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

  const userKey = await kv.get(`userkey:${session.user_id}`);

  json(res, 200, {
    user: { id: session.user_id, email: session.email },
    api_key: userKey || null,
  });
};
