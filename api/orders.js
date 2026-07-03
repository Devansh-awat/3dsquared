const crypto = require('crypto');
const { query } = require('./_db');
const { requireStaff } = require('./_auth');

function toClientOrder(row) {
  return {
    id: row.id,
    createdAt: row.created_at,
    paid: row.paid,
    name: row.name,
    email: row.email,
    phone: row.phone,
    type: row.type,
    specsText: row.specs_text,
    price: row.price === null ? null : Number(row.price),
    baseColorHex: row.base_color_hex,
    textColorHex: row.text_color_hex,
    dims: row.dims,
    photoUrl: row.photo_url,
  };
}

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    if (!requireStaff(req, res)) return;
    const { rows } = await query('SELECT * FROM orders ORDER BY created_at DESC');
    res.status(200).json({ orders: rows.map(toClientOrder) });
    return;
  }

  if (req.method === 'POST') {
    const b = req.body || {};
    if (!b.name || !b.email || !b.phone || !b.type || !b.specsText) {
      res.status(400).json({ error: 'Missing required order fields' });
      return;
    }
    const id = 'TD2-' + Date.now().toString(36).toUpperCase() + '-' + crypto.randomBytes(2).toString('hex').toUpperCase();
    const { rows } = await query(
      `INSERT INTO orders (id, name, email, phone, type, specs_text, price, base_color_hex, text_color_hex, dims, photo_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        id, b.name, b.email, b.phone, b.type, b.specsText,
        b.price ?? null, b.baseColorHex ?? null, b.textColorHex ?? null,
        b.dims ? JSON.stringify(b.dims) : null, b.photoUrl ?? null,
      ]
    );
    res.status(201).json({ order: toClientOrder(rows[0]) });
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
};
