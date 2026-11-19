# Album Collage Tool — v1 Spec (lean)

A simple, no-login web tool linked from **weirdlittleideas.com**: search your favorite albums, arrange them, and export a square grid of their covers (3×3 up to 10×10). The collage is the product.

> This is the focused v1. The fuller "ranking engine / Spotify / accounts" exploration lives in `album-ranker-architecture.md` — everything heavy in there is explicitly **deferred** here.

---

## Platform: web app (confirmed)
One linkable URL, no install, mobile + desktop, shareable image output, and every data API is keyless/HTTP. Native = overhead with no benefit. Build as a responsive web app; make it a PWA later only if people want "save to home screen."

---

## The flow — three screens

### 1) Add albums
- **Search** by album or artist → results show cover, title, artist, year → tap to add to a **holding tray**.
- **Recommended-to-add strip** (the smart bit, solves "what am I forgetting"): a persistent **"Recommended for your collage"** row of **5–10 album cards**, each with a `+` to add — exactly like Spotify's "Recommended Songs" at the bottom of a playlist. It **re-ranks every time they add an album**, so it sharpens as the list grows.
  - **How it's built (aggregate, no Spotify/login):** treat everything they've added as a **seed set**. For each selected artist, pull **similar artists** (Last.fm `artist.getSimilar`) and their **top albums** (`artist.getTopAlbums`). Pool the candidates and **score each by (count of the user's picks it's similar to) × (the album's own popularity / Last.fm listeners)**, then drop anything already added. The point: albums adjacent to *several* of their selections rank highest — i.e. "popular albums similar to the ones you've picked," not just more-by-the-same-artist.
  - **Cold start:** with only 1–2 albums in, also show a light **"more by this artist"** inline suggestion; the aggregate strip takes over once there are ~3+ seeds.
  - Optional later upgrade: blend in **ListenBrainz** (open MusicBrainz data) for better coverage of new/niche artists where Last.fm similarity is patchy.
- Tray shows a running count and a "next" button.

### 2) Arrange
- Pick a **grid size**: 9 (3×3), 16, 25, 36, 49, 64, 81, 100 (10×10). Only offer sizes ≤ the number of albums added (or allow larger with blank cells — see Grid logic).
- **Drag to order** (covers in a grid; #1 = top-left, flowing left→right, top→bottom). Drag works on touch + mouse.
- Albums beyond the grid size sit in an "extras" row and can be swapped in.

### 3) Generate — two outputs
**A) The collage image**
- Render the square grid on a `<canvas>` (3×3 up to 10×10).
- **Rank number in the top-left corner of each cover, on by default** (small dark rounded badge, white number — same treatment as the reference top-100 collage). Toggle off if they want a clean grid.
- **Covers only — no titles/labels under the art.**
- **Output size:** a ~1500px "social" size and a hi-res size.
- Cover quality is handled in its own section (see "Cover art"); a placeholder tile is only the last resort.
- **Download PNG** + **Share** (ideally a share link with an OG image preview).

**B) The ranked text list**
- A numbered list in the same order as the grid, e.g. `1. Eminem – The Eminem Show`, `2. Taking Back Sunday – Tell All Your Friends`, … (default format **`N. Artist – Album`**; offer an `Album – Artist` flip).
- **Copy to clipboard** and **download** (.txt / .md).
- Implementation note from experience: programmatic clipboard writes are often blocked in embedded/sandboxed contexts — include a fallback that opens the list in a pre-selected text box so the user can always select-all and copy.

---

## Data sources (all keyless / server-proxied, no user login)
- **Album search:** iTunes Search API (fast, returns cover art) as primary; **MusicBrainz** as fallback / for deeper catalog.
- **Recall recommendations:** **Last.fm** `artist.getTopAlbums` (more by artist) + `artist.getSimilar` → their top albums (similar artists). Free API key.
- **Cover art:** iTunes `artworkUrl` (upsize to 600px) and/or **Cover Art Archive** (MusicBrainz release-group). Cache aggressively.
- All third-party calls go through a **thin serverless proxy** to (a) keep API keys off the client, (b) cache responses, (c) avoid CORS surprises. Covers must be CORS-clean so the canvas can export (iTunes/CAA are fine).

*No Spotify, no Last.fm login, no accounts required to use the tool.*

---

## Grid logic (get these details right)
- Square grids only: 9, 16, 25, 36, 49, 64, 81, 100.
- Default to the **largest square ≤ albums added**; let the user pick smaller.
- If a chosen grid is larger than the album count, fill remaining cells with a tasteful **placeholder** (or block the option — pick one; placeholder is friendlier).
- Order is **row-major, #1 top-left**.
- **Cover art** has its own section below (multi-source + user fixes); placeholders are a rare last resort, not the norm.
- Export: covers at ~600px → up to 6000px for a 10×10; offer a "social" size (~1500px) and a "hi-res" size, and watch canvas memory on the big one.

---

## Cover art — no misses, no wrong art (this makes or breaks the tool)

Bad or missing covers are the fastest way to make this feel broken, so treat cover resolution as a first-class feature, not an afterthought.

**1. Auto-resolution chain (gets the large majority).** For each album, try sources in reliability order and take the first clean square hit, then cache it:
`iTunes → Cover Art Archive (MusicBrainz) → Deezer → Last.fm → Spotify (only if connected)`.
Order matters: iTunes and Cover Art Archive carry official art; **Last.fm is later on purpose** because it sometimes serves user-uploaded *wrong* art (hit this firsthand). All of these are CORS-friendly or proxied, so canvas export stays clean.

**2. Fix wrong/ambiguous art — "change cover" per tile.** Each cover has a small change-cover affordance that shows 2–4 candidate images (from the chain above + a quick re-search) to pick from. This is what fixes *incorrect* matches (wrong edition / wrong album / a "( )"-style untitled record grabbing the wrong thing).

**3. Fix true misses — user-supplied art (always works):**
- **Upload an image** (local file). Same-origin, so it crops to square and exports from the canvas with no CORS issue — best for mixtapes/obscure releases.
- **Paste an image URL**, routed through a **server-side image proxy** (our endpoint fetches the image and re-serves it from our domain). This makes *any* URL canvas-safe and lets users pull art from anywhere.
- **"Find this cover" button** that opens an image search pre-filled with `"<album>" "<artist>" album cover` in a new tab. We **cannot** auto-pull from Google (no free API; scraping breaks their ToS and is fragile) — so this is a manual assist: the user finds the right image, then pastes the URL (→ proxy) or saves + uploads.

**4. Placeholder** (styled tile with artist/title text) only if the user declines all of the above — should be rare.

Cache every resolved/overridden cover keyed by album identity so a given album never has to be fixed twice.

## Stack
- **Next.js + TypeScript + Tailwind** (Vercel).
- **dnd-kit** for drag/reorder (touch + keyboard).
- **Canvas API** for the collage export.
- **Serverless API routes** (Vercel) as the proxy/cache for iTunes / MusicBrainz / Last.fm.
- **localStorage / IndexedDB** to persist a session (no DB needed for v1).
- *(Optional)* a blob store (Vercel Blob / S3) for generated images + OG share links.
- No auth, no database, no Spotify SDK in v1.

---

## Explicitly out of scope for v1 (revisit only if people ask)
- **Spotify connect / playlist export** — gated to a ≤5–25 user allowlist in dev mode, so it can't serve a public link. Skip for the public tool; possible later as a private perk.
- **Ranking face-offs / segment locks / Glicko convergence** — that's a *ranking* product; this is a *collage* product. Drag-ordering is enough. Add an optional "help me order these" mode in v2 if requested.
- **Accounts / cross-device sync / true all-time data (Last.fm login)** — not needed to make a collage.

---

## Build order (suggested Claude Code tasks)
1. Scaffold Next.js + TS + Tailwind; set up the serverless proxy with iTunes search + a cache.
2. **Add screen:** search → results → holding tray (localStorage).
3. **Recommended-to-add strip:** aggregate recommender — Last.fm `artist.getSimilar` + `artist.getTopAlbums` across the whole seed set, scored by (overlap with picks × album popularity), excluding already-added; re-rank on every add; show 5–10 with a `+`.
4. **Arrange screen:** grid-size picker + dnd-kit drag ordering (test on a real phone).
5. **Generate screen:** canvas collage (rank numbers / titles toggles, missing-cover placeholders, export sizes) + download.
6. *(Optional)* share links + OG image generation; small visual polish for weirdlittleideas.com.

---

## Open micro-decisions
1. **Search provider** default — iTunes (simplest, has covers) vs MusicBrainz (deeper, no key, but rate-limited). Recommend iTunes-first, MusicBrainz fallback.
2. **Share links** in v1, or just PNG download? (Links add a blob store + a tiny bit of backend, but drive sharing.)
3. **Oversized grid** behavior — placeholders for empty cells, or restrict grid options to ≤ album count?
4. *(Decided)* Collage shows a **rank number top-left on each cover**, **covers only (no titles/labels)**. Text-list default format is **`N. Artist – Album`**.
