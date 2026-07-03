// Seeds a few sample orders into the staff downloads panel so it isn't empty on first deploy.
// These are demo entries (not real customer orders) that showcase the PS5 holder, a custom
// logo request (Manchester United), and a bookmark order in the staff Orders list.
const { Pool } = require('pg');

const SAMPLES = [
  {
    id: 'TD2-SEED-PS5',
    name: 'Sample Customer',
    email: 'sample@example.com',
    phone: '+91 90000 00001',
    type: 'PS5 Controller / Holder',
    specs_text: 'Marvel theme — base: red, accents: gold, logo: black. (Demo seed order)',
    price: 300,
    base_color_hex: '#B32424',
    text_color_hex: '#D4AF37',
    dims: { w: 120, d: 90, h: 60, textDepth: 1, hole: false },
    photo_url: '/uploads/ps5-holder.webp',
  },
  {
    id: 'TD2-SEED-LOGO-MUFC',
    name: 'Sample Customer',
    email: 'sample@example.com',
    phone: '+91 90000 00002',
    type: 'Custom Logos / Boards',
    specs_text: 'Logo: Manchester United — ring: gold, letters: black. Size: Medium. (Demo seed order)',
    price: 200,
    base_color_hex: '#DA020E',
    text_color_hex: '#FBE122',
    dims: { w: 90, d: 90, h: 5, textDepth: 1.2, hole: true },
    photo_url: '/uploads/manchester-united-logo.jpeg',
  },
  {
    id: 'TD2-SEED-BOOKMARK',
    name: 'Sample Customer',
    email: 'sample@example.com',
    phone: '+91 90000 00003',
    type: 'Bookmark',
    specs_text: 'Shape: Custom — "an astronaut" · Base: Black · Text color: White. (Demo seed order)',
    price: 200,
    base_color_hex: '#1B1B1B',
    text_color_hex: '#F4F4F2',
    dims: { w: 32, d: 100, h: 2, textDepth: 0.6, hole: true },
    photo_url: '/uploads/bookmark.jpeg',
  },
];

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  for (const s of SAMPLES) {
    await pool.query(
      `INSERT INTO orders (id, name, email, phone, type, specs_text, price, base_color_hex, text_color_hex, dims, photo_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (id) DO NOTHING`,
      [s.id, s.name, s.email, s.phone, s.type, s.specs_text, s.price, s.base_color_hex, s.text_color_hex, JSON.stringify(s.dims), s.photo_url]
    );
  }
  console.log(`Seeded ${SAMPLES.length} sample orders.`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
