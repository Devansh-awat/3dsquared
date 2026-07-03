const crypto = require('crypto');

const COOKIE_NAME = 'td2_staff_session';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('SESSION_SECRET is not set in the environment.');
  return secret;
}

function sign(value) {
  return crypto.createHmac('sha256', getSecret()).update(value).digest('base64url');
}

function createSessionCookie() {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + SESSION_TTL_MS })).toString('base64url');
  const sig = sign(payload);
  const token = `${payload}.${sig}`;
  const maxAge = Math.floor(SESSION_TTL_MS / 1000);
  return `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`;
}

function clearSessionCookie() {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  header.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    out[k] = decodeURIComponent(v);
  });
  return out;
}

function isAuthed(req) {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[COOKIE_NAME];
  if (!token) return false;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;
  let expected;
  try {
    expected = sign(payload);
  } catch (e) {
    return false;
  }
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return false;
  try {
    const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return typeof exp === 'number' && Date.now() < exp;
  } catch (e) {
    return false;
  }
}

function requireStaff(req, res) {
  if (!isAuthed(req)) {
    res.status(401).json({ error: 'Not authenticated' });
    return false;
  }
  return true;
}

module.exports = { createSessionCookie, clearSessionCookie, isAuthed, requireStaff };
