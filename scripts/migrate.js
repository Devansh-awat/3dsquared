const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set. Run: vercel env pull .env.local, then source it, or export DATABASE_URL=...');
    process.exit(1);
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(sql);
  console.log('Migration applied: orders table ready.');
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
