const { clearSessionCookie } = require('./_auth');

module.exports = (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  res.setHeader('Set-Cookie', clearSessionCookie());
  res.status(200).json({ ok: true });
};
