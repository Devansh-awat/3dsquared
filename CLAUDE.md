# 3D² Store

## Working agreement

- **Auto-commit and push**: after making a change in this repo, commit it (with a clear message) and push to `origin` without waiting to be asked.
- **Checking external sites**: when asked to look at another site (e.g. for a UI comparison), verify page-level facts (routes, status codes, raw markup) with `curl`, not just the browser tool. Client-rendered SPAs 404 on direct/raw requests to routes the server has no rewrite for, even when in-app navigation to those same routes works fine client-side — don't conflate the two.
- **Keep this file current**: whenever a change alters the architecture, file layout, env vars, or setup steps described below, update this CLAUDE.md in the same commit.

## What this is

A 3D-printing storefront: customers configure a product (keychain, bookmark, keycap fidget toy,
PS5 holder, figurine, logo, articulated finger extensions, or a free-form request), submit an
order (no payment collected — "pay on delivery/pickup"), and staff review/download print files
from a password-gated panel.

A companion site for the same business (built by a friend, separate React SPA, also on Vercel)
exists at 3d-squared.vercel.app — its real product photos (e.g. the articulated hand) are a
legitimate source to reuse here since it's the same business, not a competitor.

Originally generated as a Claude Design (`claude.ai/design`) project, then implemented here as a
static site plus a small Vercel serverless backend.

## Architecture

- **Frontend — one real page per route, not a single-page app.** Each of `index.html` (catalog),
  `keychain.html`, `bookmark.html`, `keycap.html`, `ps5.html`, `figurine.html`, `logo.html`,
  `hand.html` (articulated finger extensions), `other.html`, `staff.html` is its own standalone
  document with its own `<x-dc>` template and its
  own `Component extends DCLogic` class — navigation between them is plain `<a href>` full page
  loads, so URLs are real/shareable/bookmarkable and back/forward work. This used to be one
  monolithic `index.html` that swapped "pages" via JS state; it was split apart deliberately.
  Adding a new product page means copying the pattern of an existing one (nav markup + own
  Component class), not adding a branch to a shared switch.
- Each page's format is Claude's "dc" component format — the whole UI/state machine for that page
  lives in one `<script type="text/x-dc" data-dc-script">` block. `support.js` is the runtime that
  parses `<x-dc>`/`sc-if`/`sc-for`/`{{ }}` bindings and boots React + ReactDOM + Babel from CDN on
  `DOMContentLoaded` per page — **no build step**, it's plain static hosting. Don't edit
  `support.js` by hand (see its header comment — it's generated from a separate `dc-runtime`
  source you don't have here).
- **`styles.css`** is the shared design system — a plain stylesheet (CSS custom properties for
  color/spacing/radius/shadow tokens, plus reusable classes: `.page`/`.nav`/`.footer` shell,
  `.card`, `.btn`/`.btn-primary`/`.btn-secondary`, `.input`/`.textarea`/`.field-label`,
  `.segmented`/`.seg-btn`, `.swatches`/`.swatch`, `.price-row`, `.confirmation`, `.toggle`,
  `.badge`, `.empty-state`) — linked from every page's `<helmet>` via
  `<link rel="stylesheet" href="./styles.css">`. All 8 pages follow the same structural pattern:
  `.page` > `.nav` > `.container`/`.container-narrow` (page content, usually a `.card.card-pad`
  wrapping `.section` blocks) > `.footer`. When adding a new product page, copy this pattern
  rather than writing new inline styles — extend `styles.css` with new shared classes if a need
  recurs across pages, but keep page-specific one-offs (e.g. the keychain 3D preview canvas
  sizing) in that page's own `<style>` block in `<helmet>`.
- **`shared.js`** is a plain ES module (not a dc file) with the bits every page's Component class
  needs from the backend: `submitOrder`, `checkSession`, `loadOrders`, `togglePaid`, `staffLogin`,
  `staffLogout`, `download3MF`, plus `isValidOrder`/`COLORS`/`ACCENT` constants. Each page's class
  pulls these in via `await import('./shared.js')` inside its methods (dynamic import works from
  plain scripts, no bundler needed) — this keeps the network/session logic in one place instead of
  duplicated nine times. Small synchronous-at-render-time constants (`ACCENT`, `COLORS`) are still
  duplicated as class fields per page, since a dynamic import can't resolve before first render.
- **3D preview**: the keychain page compiles OpenSCAD (via `openscad-wasm` from a CDN) to STL
  in-browser and renders it with `three.js`, live, as you type. This logic only exists in
  `keychain.html` — it's the one page that needs the `three` importmap and the `@font-face` rules
  for `KC_FONTS`.
- **3MF export**: `mf3-writer.js` builds a minimal, dependency-free `.3MF` (zip + 3MF XML) from an
  order's `dims`/color specs — simplified box geometry, not the precise engraved shape, just
  enough for a slicer to open. Used by the staff panel's "Download .3MF" button, via
  `shared.js`'s `download3MF`. **The button only shows for `type === 'Keychain'` orders**
  (`staff.html`'s `canDownload3MF`/`cannotDownload3MF`) — every other product type's `dims` are
  hardcoded placeholder numbers with no real geometry behind them (PS5/Figurine/Logo/Other are
  free-text descriptions manually reviewed by staff; bookmark has no SCAD/parametric design yet
  either), so a "3MF" for them would be a meaningless generic box. Don't re-enable it for other
  types without an actual geometry source for that product.
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
- **Fonts**: `KC_FONTS` in `keychain.html` is the single source of truth for keychain font
  choices — each entry needs a `.ttf` in `fonts/`, an `@font-face` in `keychain.html`'s
  `<style>` block,
  and the FreeType `family:style` name OpenSCAD needs (get it with
  `python3 -c "from fontTools.ttLib import TTFont; t=TTFont('fonts/X.ttf'); print(t['name'].getDebugName(1), t['name'].getDebugName(2))"`).
  Google Fonts often only ship variable `.ttf`s in their GitHub repo — fetch a static instance
  via `curl -A "<old UA>" https://fonts.googleapis.com/css2?family=...` (returns a `.woff` URL)
  and convert with `fontTools` (`TTFont(...).flavor = None; .save(...)`) if a plain static `.ttf`
  isn't available.
- **No seed/demo data**: the `orders` table only ever holds real customer submissions. An earlier
  version of this repo seeded 3 fake demo orders (PS5/logo/bookmark) — those were removed since
  they were never actually asked for; don't re-add synthetic orders without being asked. The
  `uploads/` photos (`ps5-holder.webp`, `manchester-united-logo.jpeg`, `bookmark.jpeg`,
  `articulated-hand-1.jpeg` through `-4.jpeg`) are still used legitimately as real product photos
  on the catalog page (`index.html`) — keep those. The `articulated-hand-*.jpeg` files were pulled
  from the companion 3d-squared.vercel.app site's `/ProductPictures/` (same business, so fair game
  — see above).
- **Product page layout**: pages with visual media (`keychain.html`'s live 3D preview,
  `hand.html`'s photo gallery) use `.container-product` + `.product-layout` (from `styles.css`) —
  a two-column grid with media on the left and the configurator card on the right, collapsing to a
  single stacked column (media first) under 860px. Product pages that are pure text forms with no
  media (ps5/figurine/logo/other) stay on `.container-narrow` — don't force the two-column layout
  onto them without an actual image/preview to put in the left column.

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
```

Note: in this Claude Code sandbox, `vercel env pull` returns redacted/empty values even though the
same command works fine in a normal terminal — real secrets only resolve inside Vercel's actual
serverless runtime here. To run one-off scripts against production data from this sandbox, add a
temporary password-protected `/api/admin-*.js` endpoint, deploy, `curl` it once, then delete it —
see git history for examples (`admin-init-db.js`, `admin-patch.js`, `admin-delete-seed.js`).

Serve the static site locally with any static server (e.g. `python3 -m http.server`) — API
routes only run under `vercel dev` or once deployed.

## Deploy

`vercel --prod` (or push to the connected GitHub repo/branch for auto-deploy). No build step for
the frontend; Vercel auto-installs `package.json` deps for the `/api` functions.
