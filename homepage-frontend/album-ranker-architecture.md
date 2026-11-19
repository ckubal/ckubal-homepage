# Album Ranker — Architecture & Build Plan

A scoping document to feed into a Claude Code session. Goal: an app that lets anyone build a ranked Top-N album list (10/25/50/100), refine it via drag + face-off swiping with lockable segments, then export a collage and (optionally) a playlist.

---

## 0. TL;DR — the three reframes you need to accept first

1. **Do not architect this as a "Spotify app."** As of 2025–26, a new Spotify Web API app is capped at **5 manually-allowlisted Premium users** (Development Mode), and the only way out (Extended Quota Mode) now requires a **registered business + ~250k monthly active users + a launched service**. There is no indie path to a public Spotify-powered app. Spotify must be an *optional* integration, not the backbone.

2. **Spotify cannot give "most-played albums of all time."** `user-top-read` returns top **tracks/artists only** (no albums), and `long_term` is ~1 year, not lifetime. **Last.fm** *can* (`user.getTopAlbums?period=overall`, with playcounts, free API). Make Last.fm the primary "all-time" source, with manual search as the universal fallback.

3. **Build it as a source-agnostic ranking + collage web app.** Core value (rank albums, make a collage) needs zero Spotify. Data + covers come from Last.fm / MusicBrainz / iTunes. Spotify is a bonus "export playlist" feature for you and a small allowlist.

This reframe is what makes the product actually shippable to other people.

---

## 1. Platform recommendation: Responsive Web App (PWA), not iOS-native

**Recommendation: web-first, installable PWA. Revisit native only if playback/widgets become core.**

Why web wins here:
- **Auth is web-native.** OAuth redirect flows (Spotify PKCE, Last.fm) are trivial in the browser, painful to embed natively.
- **No App Store gatekeeping.** Apple review + Spotify's scrutiny of third-party Spotify apps + 30% IAP politics = friction for zero benefit. Instant deploys.
- **Cross-platform for free.** Desktop = mouse drag; mobile = touch swipe. One codebase.
- **Shareable.** Collages and lists share via URL/OG image — native makes this harder.
- **This is not a playback app.** The one thing native does better (background audio, Spotify iOS SDK) you don't need.

Push-back on iOS-first: it roughly doubles build cost, adds review latency to every change, and the only payoff is slightly nicer swipe physics — which `framer-motion` + `dnd-kit` get you 90% of the way to on web. Ship the PWA; if it gets traction and you want home-screen widgets / offline, wrap it (Capacitor) or go native later.

Caveat to design around: **touch drag-and-drop is the one genuinely finicky web interaction.** Use a library built for it (`dnd-kit` with the touch sensor + long-press activation) and test on a real phone early.

---

## 2. Data-source strategy (the heart of the reframe)

Treat "where albums and covers come from" as a pluggable layer with graceful degradation.

| Need | Primary | Secondary | Notes |
|---|---|---|---|
| All-time top albums + playcounts | **Last.fm** `user.getTopAlbums?period=overall` | Spotify top-tracks → group into albums (~1yr only) | Last.fm is the only clean "all-time albums" source. Free API key, generous limits. Not everyone has a Last.fm though. |
| Manual add (universal fallback) | **MusicBrainz** / **Last.fm** album search | iTunes Search | Always available; no auth. Lets non-Last.fm users build a list. |
| Cover art | **Cover Art Archive** (MusicBrainz release-group) + **iTunes Search** (`artworkUrl` → upsize to 600px) | Last.fm image fields; Spotify `i.scdn.co` if connected | No auth, CORS-friendly, cache aggressively. (Heads-up: iTunes/CAA are fine from a normal browser; some sandboxes block them — irrelevant for a deployed app.) |
| Canonical album identity | **MusicBrainz release-group MBID** | Spotify album ID (if connected) | Pick one stable key so covers/tracks/dedupe line up. |
| Playlist export (optional) | **Spotify** (allowlist only) | Apple Music (MusicKit), or "export list / deep links" | See §6.3 — the 5-user cap means this can't be a public feature. |

**Onboarding implication:** don't gate the app behind a Spotify login. Offer three on-ramps: *Connect Last.fm* (best, gives all-time seeds), *Connect Spotify* (recent tastes + later export), or *Just start adding albums* (manual search). Maybe a "try with demo data" mode so people see value before connecting anything.

---

## 3. Recommended stack

- **Frontend:** Next.js (React) + TypeScript + Tailwind.
- **Drag/reorder:** `dnd-kit` (touch + keyboard + accessible).
- **Swipe cards:** `framer-motion` (drag-to-swipe, spring physics).
- **State:** Zustand (ranking session is a fat client-side state machine).
- **Collage:** HTML `<canvas>` → PNG export (client-side; cover images must be CORS-enabled to avoid canvas tainting — CAA/iTunes/Spotify all send CORS headers).
- **Backend (thin, serverless):** Next.js API routes on Vercel for: OAuth token exchange/refresh (keep any secrets server-side), a **Last.fm proxy** (hide the API key, add caching), optional persistence + share links.
- **DB (optional, phase 2):** Supabase (Postgres + Auth) if you want cross-device + shareable saved lists. **MVP can be local-first (IndexedDB), no account required** — lowest friction.
- **Hosting:** Vercel. Near-zero cost at small scale (mostly static + serverless + client compute).

Why a backend at all if it's client-heavy: (1) don't ship API keys/refresh tokens to the browser, (2) cache Last.fm/cover lookups, (3) server-render OG images for shared collages. Keep it thin.

---

## 4. Data model (conceptual)

```
RankingSession
  id, sizeTarget (10|25|50|100), status (building|ranking|done),
  source (lastfm|spotify|manual|mixed), createdAt

Candidate            // in the "holding area"
  sessionId, albumRef, title, artist, coverUrl, playcount?, addedAt, included(bool)

AlbumRef             // canonical identity
  mbid? , spotifyId?, title, artist, year

RankItem             // included albums being ranked
  sessionId, albumRef, rating, ratingDeviation, volatility,  // Glicko-2
  comparisons (int), locked(bool), position(int)

Comparison           // every face-off (for audit + convergence)
  sessionId, aRef, bRef, winnerRef, ts

ExportArtifact
  sessionId, type (collage|playlist), params (grid size / track-mode), url/externalId
```

Persistence: MVP = serialize the whole session to IndexedDB. Phase 2 = sync to Supabase for accounts/sharing.

---

## 5. The ranking engine (the technical core — spec this carefully)

### 5.1 Reality check on 100 items (push-back)
- Full pairwise = n(n−1)/2 = **4,950 comparisons** for 100. Infeasible.
- Even good adaptive ranking needs ~5–8 comparisons/item for a stable order ≈ **500–800 swipes** for 100. That's a fatigue cliff.
- **Therefore: don't make pure swiping the path to 100.** Use a hybrid:
  1. **Seed** ratings from playcounts (Last.fm) so the starting order is already meaningful → fewer comparisons needed.
  2. **Coarse bucket sort:** let users drag albums into tiers (e.g., S / A / B / C, or "top, middle, rest"). This is fast and slashes the comparison space — you only ever face off items in the *same or adjacent* tiers.
  3. **Targeted face-offs:** only on ambiguous adjacent pairs the algorithm is unsure about.
  4. **Manual drag** to fine-tune at the end.
- Strongly nudge users toward 10/25 for the swipe-heavy experience; treat 100 as "seed + tier + light face-off + drag," not "swipe 800 times."

### 5.2 Algorithm
- Use **Glicko-2** (rating + rating deviation RD + volatility) per item, not plain Elo. RD gives you (a) smarter pair selection and (b) a principled stopping signal.
- **Seeding:** map playcount (or drag-tier) → initial rating; high RD so early comparisons move things fast.
- **Pair selection (active learning):** among **unlocked** items, pick the pair that maximizes information gain ≈ *closest ratings × highest combined RD*, never repeating a recent pair, while guaranteeing every item reaches a minimum comparison count (coverage floor). Skip cross-tier pairs that are already obviously ordered.
- **Swipe affordances:** left/right = preference; add **"too close / equal"** (nudges both toward their mean, low info) and **"skip"** (haven't heard enough). Equal/skip prevent forced-choice noise.

### 5.3 "The app knows when it has a good sense" — define it concretely
Declare convergence when **all** hold:
- every unlocked item has ≥ k comparisons (k≈4 for top-10, ≈6–8 for top-100),
- max RD across unlocked items < threshold (uncertainty low),
- rank order stable over the last N comparisons (Kendall's τ between successive orderings > ~0.95).

Surface this as a **confidence meter** ("~80% confident in this order — keep going or finish?"), not a hard gate. Let people stop early.

### 5.4 Locking segments (their step 2b)
- Each item: `locked: bool` + reserved `position`. Locked items are **excluded from face-offs** and from drag (or draggable only within the unlocked region).
- For v1, support **prefix locks** (lock top-1 / top-5 / top-10) since that matches the request and is simplest. Allow arbitrary single-item pin later.
- Visual: lock icon + a divider line between the locked block and the live region. Re-locking/unlocking should be one tap.

### 5.5 Mode interplay (avoid a confusing UX)
Keep two clear modes plus locking:
- **Sort mode** (face-offs): algorithm drives order; drag disabled (or "suggest only").
- **Curate mode** (drag): user owns the order; face-offs paused; manual order overrides ratings.
- **Lock** works in both. Switching modes never silently discards work. This separation prevents the "did my drag just get overwritten by an Elo update?" confusion.

---

## 6. Feature spec mapped to your three steps

### Step 1 — Selection & Connection
- **1a/1b** Connect Last.fm (all-time albums) / Spotify (recent, optional) / manual search → populate a **holding area**. Show playcount and source per candidate. *(Reframed per §2 — "all-time" comes from Last.fm, not Spotify.)*
- **1c** Choose target size 10/25/50/100. Make it **changeable later** (don't trap them). Warn that 100 is a bigger commitment and recommend the tier-based flow.
- **1d** Holding area = clearly a "staging" zone (distinct visual from the final list); items toggle "include/exclude"; show count vs. target ("18 / 25 added").
- *Push-back:* most-played ≠ favorite (background/work music, one-hit albums inflate playcount — you hit exactly this with single-track-dominated albums). Consider showing a **play-distribution hint** (is this album's plays spread across tracks or one single?) or just let users freely curate. At minimum, don't auto-include by playcount without confirmation.

### Step 2 — Organization & Ranking
- **2a** Drag reorder (`dnd-kit`).
- **2b** Lockable prefix segments (§5.4).
- **2c** Face-off card swiping (§5.2), with equal/skip.
- **2d** Convergence meter + "you're good to finish" prompt (§5.3).

### Step 3 — Finalization
- **3a** Full list view, drag to fine-tune (Curate mode).
- **3b** **Collage generator.** Restrict to perfect squares (9/16/25/36/49/64/81/100); if their list isn't a perfect square, either pad/crop to the nearest square or let them pick a square subset of the top-K. Client-side canvas; options: rank numbers on/off, titles on/off, cell size / output resolution (640px covers → up to 6400px for 100 — watch memory; offer "share" vs "hi-res" sizes). Export PNG + share (server-rendered OG image for links). Handle missing covers with a tasteful placeholder.
- **3c** **Playlist export (optional, caveated).** This is where Spotify's 5-user cap bites:
  - For **you + a tiny allowlist**: full Spotify Web API flow (PKCE, `playlist-modify-*`), build the playlist in ranked order. Offer **full-albums** (~1,500 tracks, batched 100/req, respect 429 + Retry-After) vs **one signature track per album**.
  - For **everyone else**: you can't create on their Spotify. Alternatives: export an ordered list (CSV/JSON), generate **Spotify deep-links / a "search & add" helper**, or support **Apple Music (MusicKit)** which has its own (different) terms. Be honest in the UI that auto-create is Spotify-account-gated.
  - **Reuse the "best version" picker we built** (see §7) — it's a real feature, not a footnote.

---

## 7. The "best album version" picker (bake this in — we just lived it)
When resolving an album to a streaming service, naive "first search result" gives wrong versions. Encode these rules:
- **Prefer explicit** when an explicit edition exists.
- **Use popularity as a play-count proxy** to find the canonical release.
- **Exclude** live / instrumental / karaoke / commentary / a cappella / "originally performed by" / sped-up-slowed versions (name regex).
- **Avoid box-set bloat:** if a candidate's track count ≫ the expected (>~1.6×), it's an anniversary/super-deluxe stuffed with demos/live — skip in favor of the standard (or standard-deluxe) edition.
- **Guard against wrong-album matches:** "( )", self-titled albums, and numbered series ("Run the Jewels" vs "Run the Jewels 2") need exact-title + artist guards, or you'll grab a different record.
- Always show the user what was picked and let them override per album.

This logic belongs in a shared module used by both playlist export and (optionally) cover resolution.

---

## 8. Phasing

- **Phase 0 — Core loop, no auth.** Manual album search → holding area → pick size → drag + tier sort → collage export. Local-first (IndexedDB). *This alone is a shippable product and dodges every Spotify problem.*
- **Phase 1 — Smarter ranking.** Glicko-2 face-offs, locks, convergence meter, seeded ordering.
- **Phase 2 — Data connectors.** Last.fm (all-time seeds + covers), better cover sourcing/caching. Optional accounts + saved/shareable lists (Supabase) + OG share images.
- **Phase 3 — Spotify export (allowlist).** PKCE flow, best-version picker, full-album vs one-track, rate-limit handling. Clearly scoped to allowlisted users; explore Apple Music / export-only for the rest.

Riskiest / longest poles to front-load: (1) the **Spotify access policy** (decide early whether playlist export is even in scope), (2) the **100-item ranking UX** (prototype the tier+face-off flow before committing), (3) **touch drag-and-drop** feel on real devices.

---

## 9. Open decisions for you (these change the build)
1. **Is Spotify playlist export in scope at all**, given it can only ever serve ~5 allowlisted Premium users? (If "just for me + friends," fine. If "for the public," probably drop it or go Apple Music / export-only.)
2. **Accounts or local-only for MVP?** Local-only = zero friction, no cross-device, no public sharing of saved lists. Accounts = Supabase + more build.
3. **Primary all-time source:** lean on Last.fm (requires users to have scrobbled for years) vs. accept "manual + recent Spotify" and skip true all-time?
4. **Does the collage need to support non-square N**, or is "perfect squares only / pick a square subset" acceptable?
5. **Full-album playlists vs one-track-per-album** as the default export.

---

## 10. Suggested first tasks for the Claude Code session
1. Scaffold Next.js + TS + Tailwind + Zustand; define the data model in §4.
2. Build the **manual-search → holding-area → size-select** flow against MusicBrainz/iTunes (no auth) — the Phase 0 core.
3. Implement the **tier bucket-sort + drag** reorder with `dnd-kit` (test touch early).
4. Implement the **Glicko-2 engine + active pair selection + convergence meter** as a standalone, unit-tested module.
5. Implement the **canvas collage** exporter (perfect-square grids, rank numbers toggle, hi-res export).
6. *(Later)* Last.fm connector (proxied), then the allowlisted Spotify export with the §7 best-version picker.

---

### Sources
- Spotify Developer Mode now 5 users / Premium-only — [TechCrunch, Feb 2026](https://techcrunch.com/2026/02/06/spotify-changes-developer-mode-api-to-require-premium-accounts-limits-test-users/)
- Extended Web API access criteria (registered business, ~250k MAU) — [Spotify for Developers blog, Apr 2025](https://developer.spotify.com/blog/2025-04-15-updating-the-criteria-for-web-api-extended-access)
- Quota modes — [Spotify docs](https://developer.spotify.com/documentation/web-api/concepts/quota-modes)
- `user-top-read` time ranges (no all-time, tracks/artists only) — [Spotify Web API reference](https://developer.spotify.com/documentation/web-api/reference/get-users-top-artists-and-tracks)
- Rate limits — [Spotify docs](https://developer.spotify.com/documentation/web-api/concepts/rate-limits)
