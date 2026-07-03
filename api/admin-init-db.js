// One-time setup endpoint: creates the orders table and inserts demo seed rows.
// Protected by STAFF_PASSWORD since it runs arbitrary DDL/inserts. Remove this file
// once you've run it — it doesn't need to stay deployed.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { query } = require('./_db');

const SAMPLES = [
  {
    id: 'TD2-SEED-PS5',
    name: 'Sample Customer', email: 'sample@example.com', phone: '+91 90000 00001',
    type: 'PS5 Controller / Holder',
    specs_text: 'Marvel theme — base: red, accents: gold, logo: black. (Demo seed order)',
    price: 300, base_color_hex: '#B32424', text_color_hex: '#D4AF37',
    dims: { w: 120, d: 90, h: 60, textDepth: 1, hole: false },
    photo_url: '/uploads/ps5-holder.webp',
  },
  {
    id: 'TD2-SEED-LOGO-MUFC',
    name: 'Sample Customer', email: 'sample@example.com', phone: '+91 90000 00002',
    type: 'Custom Logos / Boards',
    specs_text: 'Logo: Manchester United — ring: gold, letters: black. Size: Medium. (Demo seed order)',
    price: 200, base_color_hex: '#DA020E', text_color_hex: '#FBE122',
    dims: { w: 90, d: 90, h: 5, textDepth: 1.2, hole: true },
    photo_url: '/uploads/manchester-united-logo.jpeg',
  },
  {
    id: 'TD2-SEED-BOOKMARK',
    name: 'Sample Customer', email: 'sample@example.com', phone: '+91 90000 00003',
    type: 'Bookmark',
    specs_text: 'Shape: Custom — "an astronaut" · Base: Black · Text color: White. (Demo seed order)',
    price: 200, base_color_hex: '#1B1B1B', text_color_hex: '#F4F4F2',
    dims: { w: 32, d: 100, h: 2, textDepth: 0.6, hole: true },
    photo_url: '/uploads/bookmark.jpeg',
  },
];

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const expected = process.env.STAFF_PASSWORD || '';
  const given = (req.headers['x-admin-password'] || '');
  const a = Buffer.from(String(given));
  const b = Buffer.from(String(expected));
  const match = expected && a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!match) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const schema = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'schema.sql'), 'utf8');
  await query(schema);

  for (const s of SAMPLES) {
    await query(
      `INSERT INTO orders (id, name, email, phone, type, specs_text, price, base_color_hex, text_color_hex, dims, photo_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (id) DO NOTHING`,
      [s.id, s.name, s.email, s.phone, s.type, s.specs_text, s.price, s.base_color_hex, s.text_color_hex, JSON.stringify(s.dims), s.photo_url]
    );
  }

  const { rows } = await query('SELECT count(*)::int AS n FROM orders');
  res.status(200).json({ ok: true, orderCount: rows[0].n });
};
