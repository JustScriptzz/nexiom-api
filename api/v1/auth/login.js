const { getKv, verifyPassword, generateToken, SESSION_TTL, handleOptions, json } = require('../../lib/db');

module.exports = async (req, res) => {
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') { json(res, 405, { error: 'Use POST.' }); return; }

  const { email, password } = req.body || {};
  if (!email || !password) { json(res, 400, { error: 'Email and password are required.' }); return; }

  const kv = getKv();
  if (!kv) { json(res, 500, { error: 'KV store not configured.' }); return; }

  const user = await kv.get(`users:${email}`);
  if (!user || !verifyPassword(password, user.password_hash)) {
    json(res, 401, { error: 'Invalid email or password.' });
    return;
  }

  const token = generateToken();
  const expires_at = Math.floor(Date.now() / 1000) + SESSION_TTL;

  await kv.set(`session:${token}`, { user_id: user.id, email, created_at: user.created_at }, { ex: SESSION_TTL });

  json(res, 200, {
    user: { id: user.id, email, created_at: user.created_at },
    session: { access_token: token, expires_at },
  });
};
