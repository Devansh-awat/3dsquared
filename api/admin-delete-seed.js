// One-off: remove the demo seed orders — they were added without a clear ask and are
// being deleted. Protected by STAFF_PASSWORD. Remove this file once run.
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
    `DELETE FROM orders WHERE id LIKE 'TD2-SEED-%' RETURNING id`
  );
  res.status(200).json({ ok: true, deleted: rows.map(r => r.id) });
};
