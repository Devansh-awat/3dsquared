# 3D² Store

## Working agreement

- **Auto-commit**: after making a change in this repo, commit it (with a clear message) without waiting to be asked. Don't push automatically — pushing to `origin` still needs a go-ahead.
- **Keep this file current**: whenever a change alters the architecture, file layout, env vars, or setup steps described below, update this CLAUDE.md in the same commit.

## What this is

A 3D-printing storefront: customers configure a product (keychain, bookmark, keycap fidget toy,
PS5 holder, figurine, logo, or a free-form request), submit an order (no payment collected —
"pay on delivery/pickup"), and staff review/download print files from a password-gated panel.

Originally generated as a Claude Design (`claude.ai/design`) project, then implemented here as a
static site plus a small Vercel serverless backend.

## Architecture

- **Frontend**: `index.html` is a single-file app in Claude's "dc" component format — the whole
  UI/state machine lives in one `<script type="text/x-dc" data-dc-script">` block as a class
  (`Component extends DCLogic`) with a React-like `state` + `render()`. `support.js` is the
  runtime that parses `<x-dc>`/`sc-if`/`sc-for`/`{{ }}` bindings in `index.html` and boots
  React + ReactDOM + Babel from CDN on `DOMContentLoaded` — **no build step**, it's plain static
  hosting. Don't edit `support.js` by hand (see its header comment — it's generated from a
  separate `dc-runtime` source you don't have here).
- **3D preview**: the keychain customizer compiles OpenSCAD (via `openscad-wasm` from a CDN) to
  STL in-browser and renders it with `three.js`, live, as you type.
- **3MF export**: `mf3-writer.js` builds a minimal, dependency-free `.3MF` (zip + 3MF XML) from an
  order's `dims`/color specs — simplified box geometry, not the precise engraved shape, just
  enough for a slicer to open. Used by the staff panel's "Download .3MF" button.
- **Backend**: `/api/*.js` are Vercel Node serverless functions (zero-config — no framework).
  - `POST /api/staff-login` — checks the password against `STAFF_PASSWORD`, sets a signed,
    HttpOnly session cookie (HMAC'd with `SESSION_SECRET`, 8h expiry).
  - `POST /api/staff-logout` — clears the cookie.
  - `GET /api/session` — `{ authed: boolean }`, used on page load to restore staff session.
  - `GET /api/orders` — staff-only (cookie checked), lists all orders.
  - `POST /api/orders` — public, called by the checkout forms; inserts a row and returns it.
  - `PATCH /api/orders/[id]/toggle-paid` — staff-only, flips the paid flag.
  - `api/_db.js` / `api/_auth.js` — shared Postgres pool / cookie sign+verify helpers.
- **Database**: Postgres, schema in `scripts/schema.sql` (single `orders` table). `dims` and
  the rest of an order's specs are stored so `.3MF` files can be regenerated later from the
  staff panel.
- **Fonts**: `KC_FONTS` in `index.html` is the single source of truth for keychain/bookmark
  font choices — each entry needs a `.ttf` in `fonts/`, an `@font-face` in the `<style>` block,
  and the FreeType `family:style` name OpenSCAD needs (get it with
  `python3 -c "from fontTools.ttLib import TTFont; t=TTFont('fonts/X.ttf'); print(t['name'].getDebugName(1), t['name'].getDebugName(2))"`).
  Google Fonts often only ship variable `.ttf`s in their GitHub repo — fetch a static instance
  via `curl -A "<old UA>" https://fonts.googleapis.com/css2?family=...` (returns a `.woff` URL)
  and convert with `fontTools` (`TTFont(...).flavor = None; .save(...)`) if a plain static `.ttf`
  isn't available.
- **Seed/demo data**: `scripts/seed.js` inserts a few sample orders (PS5 holder, a Manchester
  United logo request, a bookmark) referencing photos committed under `uploads/`, so the staff
  panel isn't empty on first deploy. These are demo rows, not real customers.

## Local setup

```
npm install
vercel link                # if not already linked
vercel env pull .env.local # after setting the env vars below in the Vercel dashboard
```

Required env vars (Vercel dashboard → Settings → Environment Variables, or `vercel env add`):

- `DATABASE_URL` — any Postgres connection string (Vercel Postgres, Neon, Supabase, etc.)
- `STAFF_PASSWORD` — the staff login password
- `SESSION_SECRET` — random string used to sign session cookies (e.g. `openssl rand -hex 32`)

Then, with those pulled into `.env.local`:

```
export $(grep -v '^#' .env.local | xargs)   # or use `dotenv -e .env.local -- ...`
npm run migrate   # creates the orders table
npm run seed      # inserts the demo PS5 / Man Utd logo / bookmark orders
```

Serve the static site locally with any static server (e.g. `python3 -m http.server`) — API
routes only run under `vercel dev` or once deployed.

## Deploy

`vercel --prod` (or push to the connected GitHub repo/branch for auto-deploy). No build step for
the frontend; Vercel auto-installs `package.json` deps for the `/api` functions.
