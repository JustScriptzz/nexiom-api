const { getKv, hashPassword, generateId, handleOptions, json } = require('../../lib/db');

module.exports = async (req, res) => {
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') { json(res, 405, { error: 'Use POST.' }); return; }

  const { email, password } = req.body || {};
  if (!email || !password) { json(res, 400, { error: 'Email and password are required.' }); return; }
  if (password.length < 6) { json(res, 400, { error: 'Password must be at least 6 characters.' }); return; }

  const kv = getKv();
  if (!kv) { json(res, 500, { error: 'KV store not configured.' }); return; }

  const existing = await kv.get(`users:${email}`);
  if (existing) { json(res, 409, { error: 'An account with this email already exists.' }); return; }

  const id = generateId();
  const password_hash = hashPassword(password);
  const now = new Date().toISOString();

  await kv.set(`users:${email}`, { id, password_hash, created_at: now });
  await kv.set(`user:${id}`, { email, created_at: now });

  json(res, 201, { user: { id, email }, message: 'Account created. You can now log in.' });
};
