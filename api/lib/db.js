const { Redis } = require('@upstash/redis');
const crypto = require('crypto');

let _kv = null;
function getKv() {
  if (_kv) return _kv;
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  _kv = new Redis({ url, token });
  return _kv;
}

const SESSION_TTL = 7 * 24 * 60 * 60;

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const verify = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return hash === verify;
}

function generateId() {
  return crypto.randomUUID();
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function generateApiKey() {
  return 'nxm_' + crypto.randomBytes(24).toString('hex');
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function handleOptions(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders());
    res.end();
    return true;
  }
  return false;
}

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json', ...corsHeaders() });
  res.end(JSON.stringify(data));
}

module.exports = { getKv, hashPassword, verifyPassword, generateId, generateToken, generateApiKey, SESSION_TTL, corsHeaders, handleOptions, json };
