# jewelcase 100 — Instagram data-card prompts

Prompts to generate square (1080×1080) Instagram stat cards for the "my top 100 albums" post, styled to match jewelcase 100. All numbers are **top 100 only** (ranks 1–100; the 101–115 extras are excluded).

---

## ⚠️ Critical: feed these to a CODE LLM, not an image generator
Diffusion image models (Midjourney, DALL·E, GPT-image, etc.) **cannot render exact numbers, bars, or text** — they'll invent wrong percentages and garbled labels. Each prompt below asks for a **self-contained HTML file** that renders a precise 1080×1080 square. Feed them to a code-capable LLM (Claude, Claude Code, etc.), open the HTML, and screenshot/export at 1080×1080 (or 2160 for retina). That's the only way the data comes out correct.

## How many images
3 cards: **cover → genre → era**. (Optional 4th: top artists — data at the bottom.) Weighting is shown *inside* the genre and era cards, so you don't need a separate weighting slide.

## The weighting (explain it on the cards)
Decile points: your **top 10 = 10 pts each, 11–20 = 9, 21–30 = 8 … 91–100 = 1** (linear). 550 pts total. The weighted % shows where your *highest-ranked* picks cluster, vs. the raw count which treats #1 and #100 equally.

---

## SHARED STYLE BLOCK  (paste at the top of every prompt)

```
STYLE — jewelcase 100 "scene" stat card, early-2000s music-internet nostalgia
(think AbsolutePunk.net 2002, PureVolume, MySpace-on-black, CD liner notes).

- Canvas: exactly 1080 x 1080 px (Instagram square). Build it at 2x (2160) and scale for crispness if you can.
- Background: near-black #0d0d10 with a very subtle scanline + film-grain overlay (low opacity, don't muddy it).
- Primary text: warm off-white #f3ead6.
- Accent colors: hot pink #ff2d95 and electric blue #19b6ff. Lime #aaff00 used ONLY for the "weighted" marker.
- A thin black/white CHECKERBOARD rule as section dividers. Small five-point stars (★) in pink as bullets.
- Wordmark "jewelcase 100" in a chunky condensed bold (Arial Black / Helvetica Condensed), lowercase, small, top-left.
- Headers: bold condensed sans. Body/labels: Tahoma or Verdana. Numbers/counters: a pixel or monospace font (system-readout feel).
- Footer strip: a tiny faux "now playing" bar (♫ now playing: charlie's top 100) + a fake hit counter ("visitor #00,100") + "est. 2003".
- Flat only — no modern gradients/soft shadows. A little tape-corner / CD-disc / equalizer texture is welcome. Lowercase, sentence-case copy (matches the brand). No emoji except the ♫ and ★.
- Everything legible at phone size: large headline, generous spacing, high contrast.
```

---

## PROMPT 1 — Cover / title card

```
[PASTE SHARED STYLE BLOCK]

Make the COVER slide of an Instagram carousel. Content:
- Big headline (2–3 lines): "my top 100 albums" / "by the numbers"
- Subhead: "ranked, cased up — a hip-hop core with a 2000s emo streak, collected over 20 years"
- A faint 10x10 grid of small album-cover squares as a background texture behind the text (or a tasteful tiled-cover motif) — covers are the only bright element; dim them ~40% so the text pops.
- Small "swipe →" hint bottom-right in the pixel font.
- Keep it striking and legible in-feed; this is the scroll-stopper.
Output a single self-contained HTML file sized 1080x1080.
```

---

## PROMPT 2 — Genre card

```
[PASTE SHARED STYLE BLOCK]

Make a GENRE breakdown slide (1080x1080). 
Headline: "half my top 100 is hip hop" 
Subhead: "— and it's even bigger at the top (53% weighted)"

Draw a horizontal bar chart, 7 rows, ordered as below. Each row shows:
  • genre label (left), 
  • a solid bar whose length = the RAW % (use the accent colors; hip hop pink, others a muted off-white/blue),
  • the raw count + "%" at the bar end,
  • a small LIME tick/marker on the same row at the WEIGHTED % position, labeled "weighted".
So each row visually compares raw share vs. weighted share.

Data (genre — raw count (raw %) — weighted %):
  hip hop        50  (50%)   53%
  rock           22  (22%)   21%
  indie / alt    10  (10%)   10%
  pop             8   (8%)    4%
  electronic      5   (5%)    6%
  R&B / soul      4   (4%)    5%
  other (Weird Al) 1  (1%)    1%

Footnote (small): "raw = # of albums. weighted = decile points (top 10 = 10 pts each … 91–100 = 1 pt) — shows where my TOP picks cluster."
One-line insight bottom: "pop & indie are loved but live in the back half; hip hop & rock own the peaks."
Output a single self-contained HTML file, 1080x1080.
```

---

## PROMPT 3 — Era card

```
[PASTE SHARED STYLE BLOCK]

Make an ERA-OF-MY-LIFE breakdown slide (1080x1080). Bin = the life stage I was in when each album came out (born June 1985).
Headline: "balanced by count — but my peaks are teenage"
Subhead: "40% of my weighted score is teen-era albums"

Same dual-bar style as the genre card: solid bar = RAW %, lime marker = WEIGHTED %, on each row.
Use a light→dark progression so earlier life stages are lighter, later darker (a time-progression feel).

Data (era — raw count (raw %) — weighted %):
  kid          11  (11%)   12%
  teenager     33  (33%)   40%
  your 20s     26  (26%)   26%
  your 30s     30  (30%)   23%   ← includes the 3 from your 40s so far

Footnote (small): "weighted = decile points (top 10 worth most, linearly down to 91–100). by count my eras are even; by weight, the albums that imprinted in my teens dominate."
Do NOT print release years — life-stage labels only.
Output a single self-contained HTML file, 1080x1080.
```

---

## BONUS PROMPT 4 — Most-decorated artists (optional)

```
[PASTE SHARED STYLE BLOCK]

Make a "most-decorated artists" slide (1080x1080).
Headline: "the artists that built the list"
Show a ranked leaderboard, each row: artist name, # of albums on my top 100, and weighted points (decile). 
Style the rows like a forum/scoreboard with ★ bullets and the pixel font for the numbers.

Data (artist — albums — weighted pts):
  Kanye West          6    45
  Eminem              3    29
  Jay-Z               3    22
  Lil Wayne           2    17
  Atmosphere          3    16
  Taking Back Sunday  2    16
  blink-182           2    16
  Fred again..        3    15

Caption line: "Kanye leads on volume; Eminem punches highest — 3 albums, all in my top 15 (incl. #1)."
Output a single self-contained HTML file, 1080x1080.
```

---

## Carousel order (recommended)
`5×5 grid → 7×7 grid → 10×10 grid → cover card → genre card → era card → 1–2 jewelcase 100 app screenshots (CTA)`

Grids first (hook + escalation), data viz in the middle (the payoff insights), app screenshots last (the "I built a tool, link in bio" call to action). Don't intersperse — keep the grids together so the build-up lands.
