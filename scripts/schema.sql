CREATE TABLE IF NOT EXISTS orders (
  id             TEXT PRIMARY KEY,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid           BOOLEAN NOT NULL DEFAULT false,
  name           TEXT NOT NULL,
  email          TEXT NOT NULL,
  phone          TEXT NOT NULL,
  type           TEXT NOT NULL,
  specs_text     TEXT NOT NULL,
  price          NUMERIC,
  base_color_hex TEXT,
  text_color_hex TEXT,
  dims           JSONB,
  photo_url      TEXT
);

CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders (created_at DESC);
