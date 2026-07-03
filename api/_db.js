const { Pool } = require('pg');

let pool;
function getPool() {
  if (!pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is not set — provision a Postgres database and set it in Vercel env vars.');
    }
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });
  }
  return pool;
}

async function query(text, params) {
  return getPool().query(text, params);
}

module.exports = { query, getPool };
