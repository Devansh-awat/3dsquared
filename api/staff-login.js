const crypto = require('crypto');
const { createSessionCookie } = require('./_auth');

module.exports = (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const expected = process.env.STAFF_PASSWORD;
  if (!expected) {
    res.status(500).json({ error: 'STAFF_PASSWORD is not configured on the server.' });
    return;
  }
  const password = (req.body && req.body.password) || '';
  const a = Buffer.from(String(password));
  const b = Buffer.from(String(expected));
  const match = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!match) {
    res.status(401).json({ error: 'Incorrect password' });
    return;
  }
  res.setHeader('Set-Cookie', createSessionCookie());
  res.status(200).json({ ok: true });
};
