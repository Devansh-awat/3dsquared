// One-off: fix stale seed text after the 'Custom Logos / Boards' -> 'Custom Logos' rename.
// Protected by STAFF_PASSWORD. Remove this file once run.
const crypto = require('crypto');
const { query } = require('./_db');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const expected = process.env.STAFF_PASSWORD || '';
  const given = req.headers['x-admin-password'] || '';
  const a = Buffer.from(String(given));
  const b = Buffer.from(String(expected));
  const match = expected && a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!match) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const { rows } = await query(
    `UPDATE orders SET type = 'Custom Logos' WHERE type = 'Custom Logos / Boards' RETURNING id`
  );
  res.status(200).json({ ok: true, updated: rows.map(r => r.id) });
};
