# jewelcase 100 — vibe + copy bible

Design direction and ready-to-use copy for the site's aesthetic. Goal: the second someone lands, they're back in a teenage bedroom in 2003 — CD booklet open, Sharpie-labeled mix burning, album covers thumbtacked to the wall above the bed. Reference points: **AbsolutePunk.net (2002)**, **PureVolume**, **MySpace**, **Alternative Press**, Tower Records / Sam Goody, Winamp, LimeWire, the Discman.

Hand this to Claude Code alongside `album-collage-tool-spec.md` (that one is *what it does*; this one is *how it feels*).

---

## 1. The feeling (the one-paragraph brief)
You saved up, rode to the mall, and bought the CD. You sat on the floor and read every word of the liner notes before the disc even spun — the thank-yous, the lyrics, who played bass. The covers that mattered got cut out, taped, and thumbtacked into a grid over your bed, rearranged whenever the ranking in your head changed. Your taste *was* your identity, and you defended it on a forum at 1am. **jewelcase 100 is that wall, rebuilt.** Warm, a little grainy, a little cocky about taste, and unmistakably pre-streaming.

Tone in three words: **nostalgic, scene-kid, hand-made.** Not a sterile retro pastiche — a lived-in bedroom.

---

## 2. The moodboard, in words (mine these references)
- **Physical media ritual:** jewel cases, the booklet fold-out, liner notes, the spine, the silver/rainbow underside of a CD-R, Sharpie handwriting on a burned mix, the cake-box spindle of 100 blanks, Case Logic binders, the Discman skip-protection, peeling the cellophane.
- **Bedroom wall:** album covers + AP/Spin magazine pull-out posters in a grid, thumbtacks, masking/Scotch tape curling at the corners, a corkboard, ticket stubs, band stickers on the laptop and the Trapper Keeper.
- **The web of the era:** MySpace profiles (autoplay song, **Top 8**, glitter, tiled backgrounds, "thanks for the add"), PureVolume band pages + play counts, AbsolutePunk forums (review scores, signatures, "+1 / this," scene points), AIM away messages set to lyrics, Winamp skins ("it really whips the llama's ass"), LimeWire/Kazaa downloads (the file-name roulette, "4 min remaining"), hit counters, guestbooks, "under construction" energy.
- **Retail + culture:** Tower Records, Sam Goody, FYE listening stations, Columbia House "12 CDs for a penny," Warped Tour merch tables, Hot Topic, checkered Vans, studded belts, side-swept bangs.
- **Icon vocabulary:** the five-point **star** (the scene icon), **checkerboard**, **halftone dots**, **stars/sparkle gifs**, distressed/grunge textures, glossy beveled "web 2.0" buttons, drop shadows, marquee scroll text.

---

## 3. Visual direction

### Skins (a feature *and* an homage — Winamp had skins, so do we)
Ship 2–3 swappable "skins" with a little switcher in the corner. This is peak era and gives range:
- **"bedroom wall"** (default) — warm corkboard/denim background, covers look thumbtacked + taped, slight paper grain. Cozy, hand-made.
- **"scene"** — near-black background, neon accents, checkerboard borders, star bullets. MySpace-profile-on-black energy.
- **"liner notes"** — cream paper, dense tiny type, booklet/credits feel. Clean and readable.

### Color
- **bedroom wall:** corkboard tan `#c9a36a` / denim `#3a4a6b` ground, ink `#171514`, tape off-white `#f3ead6`, Sharpie red `#d12b2b`, highlighter accents (yellow `#f5e642`, lime `#9ad500`).
- **scene:** near-black `#0d0d10`, hot pink `#ff2d95`, electric blue `#19b6ff`, lime `#aaff00`, white. High contrast, neon-on-black.
- **purevolume nod:** charcoal `#1a1a1a` + hot orange `#ff5e1a` + magenta + grey.
Keep album covers the brightest things on screen — everything else is the bedroom around them.

### Typography
- **Wordmark / big headers:** a chunky condensed grotesque with band-logo swagger (web-safe fallback: Arial Black / Helvetica Bold Condensed). "jewelcase 100" set tight, maybe a tiny chrome/Y2K bevel or a sticker treatment.
- **Body / UI:** **Verdana / Tahoma** — using the actual OS web fonts of 2003 is an instant time machine and stays readable.
- **System accents** (counters, timestamps, badges, "beta"): a **pixel font** (Silkscreen / "04b03").
- **The tracklist / liner notes:** a **monospace or a marker font** so it reads like Sharpie on a CD-R.

### Texture + chrome
- Subtle paper grain / scanlines / noise overlay (low opacity — don't muddy the covers).
- Tape corners + thumbtacks on cover tiles (in "bedroom wall" skin); checkerboard rule lines (in "scene").
- Beveled/glossy buttons with drop shadows; or flat MySpace-table panels — lean glossy.
- A **custom cursor** (a tiny CD or a star).
- A **"beta" sticker** in the corner. Always beta. Forever 2003.

### Signature components (homage, mostly decorative)
- A **"now playing" bar** pinned to the bottom (Winamp-style), with a fake EQ and a *press-play* (never autoplay — see Sound).
- A **hit counter** in the footer ("you are visitor #00,001").
- A **"Top 8" badge/tooltip** on the 3×3 grid size (MySpace wink).
- **Star ratings / "scene points"** as a playful flourish.
- A **guestbook / "sign the wall"** link.
- A **marquee ticker** for the recommendation strip (covers scroll by like a record-store new-arrivals shelf).

### Motion
- Hover a tile → the **CD slides halfway out of the jewel case**, or the cover does a little **Cover Flow tilt**.
- Add an album → **sparkle/star burst** + a soft "ka-chunk" (CD tray).
- On generate → the wall **develops like a Polaroid** / covers drop in one by one with a tape-press.
- Drag → the tile lifts with a shadow like you're peeling tape off the wall.

### Sound (optional, **user-initiated only**)
The MySpace autoplay song is the ultimate nostalgia trigger *and* the ultimate annoyance — so: a **"press play"** on the now-playing bar that does a CD-tray click + (optional) a short chiptune loop, with an obvious mute. Never auto-play on load.

### Don'ts
- No flat minimal SaaS look. No generic "vaporwave." No Frutiger-Aero glass (that's 2008, too late). No trying-too-hard cringe slang on every line — restraint makes the references land.

---

## 4. Voice + tone
Write like a **music-obsessed 16-year-old who works the counter at the record store and posts on the forum at 1am.** Lowercase. Confident about taste. Warm, not snarky. Period slang used **sparingly and well**: *heavy rotation, all killer no filler, deep cut, the binder, rip, burn, liner notes, skip to track 7, scene, now playing, what's on yours.* When in doubt, cut the joke and keep the warmth.

---

## 5. Copy deck (ready to use)

### Landing / hero
- **Wordmark:** jewelcase 100
- **Tagline (pick one, A/B later):**
  - "before playlists, there were walls."
  - "arrange your favorite album covers like it's your bedroom wall, circa 2003."
  - "rip. arrange. hang."
- **Subhead:** "build a grid of the album covers that raised you — up to 100, ranked — like the wall over your bed. no logins, no subscriptions, no skips."
- **Primary CTA:** "start digging →"
- **Secondary:** "see an example wall"

### Step 1 — Add (the "dig")
- **Header:** "what's in heavy rotation?"
- **Search placeholder:** "search an album or artist… (no skips allowed)"
- **Add button (on a result):** "+ add to the binder"
- **Holding tray label:** "the binder · {n} in"
- **Recommendation strip header (rotate):**
  - "you might've forgotten about…"
  - "if you f*** with these, you'll want…"
  - "more for the wall →"
- **Recommendation add:** "+ grab it"
- **Empty state:** "the binder's empty. go dig. 🪙"
- **Next CTA:** "to the wall →"

### Step 2 — Arrange (the "wall")
- **Header:** "pin them up. best stuff in the center."
- **Grid-size picker label:** "how big's your wall?"
  - 3×3 → tooltip: **"the Top 8 (+1) 😉"**
  - 4×4, 5×5 … 10×10 → "the whole wall (100)"
- **Drag hint:** "drag to rearrange the wall"
- **Lock / pin control:** "thumbtack the top spot" (locks #1; extend to top-5 / top-10)
- **#1 tile label:** "the centerpiece"
- **Generate CTA:** "make the poster →"

### Step 3 — Generate (the "hang it")
- **Header:** "ready to hang."
- **Buttons:**
  - "save the poster (.png)"
  - "copy the tracklist"
  - "download liner notes (.txt)"
- **Tracklist styling note:** render the numbered list like **Sharpie on a CD-R / liner-note credits** — `1. eminem – the eminem show`, monospace/marker font, faint disc-ring behind it.
- **Share text (prefilled):** "my wall — {n} albums, ranked, in order. what's on yours? 🎧 jewelcase100…"

### Microcopy (sprinkle everywhere)
- **Loading:** "ripping cover art…" · "buffering…" · "burning…" · "4 minutes remaining (jk)"
- **Save success:** "burned. ✅ your wall's saved." 
- **Cover art missing:** "couldn't find the art on this one — it's a deep cut. got a better copy? **upload it** or **paste a link.**"
- **Wrong cover:** "not the right pressing? **swap the cover →**"
- **404 / no results:** "track not found. (try LimeWire? …jk) — search again."
- **Reset:** "wipe the wall and start over?"

### Footer (load it up — this is where the era lives)
- A small **now-playing bar**: "♫ now playing: your taste, on shuffle  ▸ press play"
- **Hit counter:** "you are visitor #00,001"
- "all killer, no filler."
- "made in a teenage bedroom · a **weird little idea** by charlie kubal"
- gag line: "best viewed at 1024×768 · © 2003"
- "sign the guestbook" · "add to top 8"

### Easter eggs (optional, very on-brand)
- 3×3 size whispers **"Top 8"**; hovering #1 in any size shows **"profile song"** as a tooltip.
- The now-playing **press-play** = CD-tray click + optional 8-bit loop, with mute.
- Type a band name anywhere → **star confetti** (the scene star).
- A **"pimp my wall"** button that cycles the skins.
- Konami code → switches every cover to its cassette/CD-spine view for 10 seconds.

---

## 6. One-line brief for the dev (paste at the top of the Claude Code task)
> Build jewelcase 100 to feel like a teenage bedroom in 2003: corkboard-and-tape warmth, Tahoma/Verdana + pixel-font accents, swappable Winamp-style "skins," album covers thumbtacked into a ranked grid, a decorative now-playing bar + hit counter, and copy written like a record-store kid who lives on AbsolutePunk. Nostalgia first, polish second — covers are the brightest thing on screen, everything else is the bedroom around them.
