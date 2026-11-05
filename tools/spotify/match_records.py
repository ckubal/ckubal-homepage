#!/usr/bin/env python3
"""Match every record in the homepage collection to its canonical Spotify album.

Reads `recordCollection` out of homepage-frontend/script.js, finds the album on
Spotify (preferring the exact-title, explicit, non-deluxe release closest to the
pressing year), pulls its tracklist, and cross-checks the tracklist against
MusicBrainz's earliest official release of the same release group. Writes
homepage-frontend/assets/records.json for the flip cards and a review report
of anything that did not line up.

Run from the repo root:
    uv run --with requests python -I tools/spotify/match_records.py [--only "artist|album"] [--report path]

Credentials: SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET from the environment or
homepage-backend/functions/.env (never printed).
"""
import argparse
import base64
import json
import os
import re
import sys
import time
import unicodedata
from difflib import SequenceMatcher
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[2]
SCRIPT_JS = ROOT / "homepage-frontend" / "script.js"
OUT_JSON = ROOT / "homepage-frontend" / "assets" / "records.json"  # slim, what the page fetches
FULL_JSON = ROOT / "tools" / "spotify" / "records-full.json"  # everything, for review
ENV_FILE = ROOT / "homepage-backend" / "functions" / ".env"
OVERRIDES = ROOT / "tools" / "spotify" / "overrides.json"
CACHE_DIR = Path(os.environ.get("MATCH_CACHE", ROOT / "tools" / "spotify" / ".cache"))

UA = "charliekubal-homepage-records/1.0 (contact: site owner)"
EDITION_WORDS = re.compile(
    r"\b(deluxe|expanded|anniversary|remaster(ed)?|edition|bonus|special|"
    r"super|complete|collector'?s|tour|instrumentals?|a cappella|acapella|"
    r"clean|explicit|re-?issue|version|live|demos?|sessions?|chopped|"
    r"screwed|commentary|platinum|gold|the remixes|remix(es)?)\b"
)


# ----------------------------------------------------------------- helpers
def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode()
    s = s.lower().replace("&", "and")
    s = re.sub(r"[\(\[].*?[\)\]]", " ", s)  # drop parentheticals
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def sim(a: str, b: str) -> float:
    return SequenceMatcher(None, norm(a), norm(b)).ratio()


def cached_get(key: str, fn):
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    p = CACHE_DIR / (re.sub(r"[^a-z0-9]+", "_", key.lower())[:150] + ".json")
    if p.exists():
        return json.loads(p.read_text())
    data = fn()
    p.write_text(json.dumps(data))
    return data


def load_env():
    if os.environ.get("SPOTIFY_CLIENT_ID") and os.environ.get("SPOTIFY_CLIENT_SECRET"):
        return
    if ENV_FILE.exists():
        for line in ENV_FILE.read_text().splitlines():
            if "=" in line and not line.startswith("#"):
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"'))


def parse_collection():
    text = SCRIPT_JS.read_text()
    m = re.search(r"const recordCollection = \[(.*?)\n\];", text, re.S)
    if not m:
        sys.exit("recordCollection not found in script.js")
    records = []
    for line in m.group(1).splitlines():
        fm = re.search(
            r'artist:\s*"(.*?)",\s*album:\s*"(.*?)",\s*year:\s*(\d{4}),\s*cover:\s*"(.*?)"', line
        )
        if fm:
            records.append(
                {"artist": fm.group(1), "album": fm.group(2), "year": int(fm.group(3)), "cover": fm.group(4)}
            )
    return records


# ----------------------------------------------------------------- spotify
class Spotify:
    def __init__(self):
        cid, sec = os.environ.get("SPOTIFY_CLIENT_ID"), os.environ.get("SPOTIFY_CLIENT_SECRET")
        if not (cid and sec):
            sys.exit("missing SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET")
        r = requests.post(
            "https://accounts.spotify.com/api/token",
            data={"grant_type": "client_credentials"},
            headers={"Authorization": "Basic " + base64.b64encode(f"{cid}:{sec}".encode()).decode()},
            timeout=20,
        )
        r.raise_for_status()
        self.s = requests.Session()
        self.s.headers["Authorization"] = "Bearer " + r.json()["access_token"]

    def get(self, url, **params):
        for attempt in range(5):
            r = self.s.get(url, params=params, timeout=20)
            if r.status_code == 429:
                time.sleep(int(r.headers.get("Retry-After", "2")) + 1)
                continue
            r.raise_for_status()
            return r.json()
        raise RuntimeError("spotify rate limited too long")

    def search_albums(self, q):
        return cached_get(
            "sp_search_" + q,
            lambda: self.get("https://api.spotify.com/v1/search", q=q, type="album", market="US", limit=20),
        )["albums"]["items"]

    def album(self, album_id):
        return cached_get("sp_album_" + album_id, lambda: self.get(f"https://api.spotify.com/v1/albums/{album_id}", market="US"))

    def tracks(self, album_id):
        def fetch():
            items, url = [], f"https://api.spotify.com/v1/albums/{album_id}/tracks"
            params = {"market": "US", "limit": 50}
            while url:
                d = self.get(url, **params)
                items += d["items"]
                url, params = d.get("next"), {}
            return items

        return cached_get("sp_tracks_" + album_id, fetch)


def pick_spotify(sp: Spotify, rec):
    artist, album, year = rec["artist"], rec["album"], rec["year"]
    queries = [f'album:"{album}" artist:"{artist}"', f"{artist} {album}", f'album:"{album}"']
    seen, cands = set(), []
    for q in queries:
        for a in sp.search_albums(q):
            if a["id"] in seen:
                continue
            seen.add(a["id"])
            cands.append(a)
        if any(sim(a["name"], album) > 0.9 for a in cands):
            break
    if not cands:
        return None, []

    def base_score(a):
        name_s = sim(a["name"], album)
        art_s = max(sim(x["name"], artist) for x in a["artists"])
        if art_s < 0.6:
            # collaborations: accept if every token of the record's artist shows up
            joined = " ".join(norm(x["name"]) for x in a["artists"])
            art_s = 0.8 if all(t in joined for t in norm(artist).split() if len(t) > 2) else art_s
        try:
            ry = int(a["release_date"][:4])
        except ValueError:
            ry = year
        if art_s < 0.5:
            return -1  # wrong artist, whatever the title says
        year_pen = min(abs(ry - year), 10) * 0.02
        edition_pen = 0.15 if (EDITION_WORDS.search(a["name"].lower()) and not EDITION_WORDS.search(album.lower())) else 0
        exact = 0.1 if norm(a["name"]) == norm(album) else 0
        type_bonus = {"album": 0.05, "compilation": 0.02, "single": 0}.get(a["album_type"], 0)
        return name_s * 0.6 + art_s * 0.3 + exact + type_bonus - year_pen - edition_pen

    cands.sort(key=base_score, reverse=True)
    top = base_score(cands[0])
    if top < 0.55:
        return None, cands[:5]
    # among near-ties prefer the explicit pressing, then the earliest release
    tied = [a for a in cands[:6] if base_score(a) >= top - 0.06]
    enriched = []
    for a in tied:
        tr = sp.tracks(a["id"])
        explicit_n = sum(1 for t in tr if t.get("explicit"))
        enriched.append((a, tr, explicit_n))
    enriched.sort(key=lambda e: (-(e[2] > 0), -base_score(e[0]), e[0]["release_date"]))
    a, tr, explicit_n = enriched[0]
    full = sp.album(a["id"])
    return {
        "id": a["id"],
        "name": a["name"],
        "artists": [x["name"] for x in a["artists"]],
        "release_date": a["release_date"],
        "album_type": a["album_type"],
        "total_tracks": a["total_tracks"],
        "url": a["external_urls"]["spotify"],
        "label": full.get("label"),
        "explicit_tracks": explicit_n,
        "tracks": [
            {"n": t["track_number"], "disc": t.get("disc_number", 1), "title": t["name"], "ms": t["duration_ms"], "explicit": bool(t.get("explicit"))}
            for t in tr
        ],
        "score": round(base_score(a), 3),
    }, cands[:5]


# ----------------------------------------------------------------- musicbrainz
class MusicBrainz:
    def __init__(self):
        self.s = requests.Session()
        self.s.headers["User-Agent"] = UA
        self.last = 0

    def get(self, url, **params):
        wait = 1.1 - (time.time() - self.last)
        if wait > 0:
            time.sleep(wait)
        for attempt in range(4):
            r = self.s.get(url, params={**params, "fmt": "json"}, timeout=30)
            self.last = time.time()
            if r.status_code == 503:
                time.sleep(3)
                continue
            r.raise_for_status()
            return r.json()
        raise RuntimeError("musicbrainz unavailable")

    def release_group(self, artist, album):
        def esc(s):
            return re.sub(r'([+\-!(){}\[\]^"~*?:\\/])', r"\\\1", s)

        queries = [
            f'releasegroup:({esc(album)}) AND artist:({esc(artist)}) AND (primarytype:album OR primarytype:ep)',
            f'releasegroup:({esc(album)}) AND artist:({esc(artist)})',
            f"{esc(artist)} {esc(album)}",
        ]
        groups = []
        for q in queries:
            d = cached_get("mb_rg_" + q, lambda q=q: self.get("https://musicbrainz.org/ws/2/release-group", query=q, limit=10))
            groups += d.get("release-groups", [])
            if any(sim(rg["title"], album) > 0.85 for rg in groups):
                break
        best, best_s = None, 0
        for rg in groups:
            if rg.get("secondary-types") and any(t in ("Live", "Remix", "Demo", "Mixtape/Street", "DJ-mix") for t in rg["secondary-types"]):
                continue
            s = sim(rg["title"], album) * 0.7 + max(sim(c["name"], artist) for c in rg.get("artist-credit", [{"name": ""}])) * 0.3
            if s > best_s:
                best, best_s = rg, s
        return (best, best_s) if best_s > 0.6 else (None, best_s)

    def canonical_tracks(self, rg_id):
        d = cached_get(
            "mb_rel_" + rg_id,
            lambda: self.get("https://musicbrainz.org/ws/2/release", **{"release-group": rg_id, "status": "official", "limit": 100}),
        )
        rels = [r for r in d.get("releases", []) if r.get("status") == "Official"]
        if not rels:
            return None

        def key(r):
            date = r.get("date") or "9999"
            country = r.get("country") or "ZZ"
            return (date, 0 if country in ("US", "XW", "XE", "GB") else 1)

        rels.sort(key=key)
        rel = rels[0]
        full = cached_get("mb_relfull_" + rel["id"], lambda: self.get(f"https://musicbrainz.org/ws/2/release/{rel['id']}", inc="recordings"))
        tracks = []
        for medium in full.get("media", []):
            fmt = (medium.get("format") or "").lower()
            if "video" in fmt or "dvd" in fmt or "blu" in fmt:
                continue
            for t in medium.get("tracks", []):
                tracks.append(t["title"])
        return {"release_id": rel["id"], "date": rel.get("date"), "country": rel.get("country"), "format": full.get("media", [{}])[0].get("format"), "tracks": tracks}


def compare(sp_tracks, mb_tracks):
    """Fraction of MusicBrainz track titles found in the Spotify tracklist, and vice versa."""
    sp_n = [norm(t["title"]) for t in sp_tracks]
    mb_n = [norm(t) for t in mb_tracks]

    def covered(src, dst):
        hit = 0
        for a in src:
            if any(SequenceMatcher(None, a, b).ratio() > 0.8 or a in b or b in a for b in dst if a and b):
                hit += 1
        return hit / len(src) if src else 0

    return round(covered(mb_n, sp_n), 2), round(covered(sp_n, mb_n), 2)


# ----------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", help='filter: substring of "artist|album"')
    ap.add_argument("--report", default=str(ROOT / "tools" / "spotify" / "match-report.md"))
    ap.add_argument("--no-mb", action="store_true", help="skip the MusicBrainz cross-check")
    args = ap.parse_args()

    load_env()
    sp, mb = Spotify(), (None if args.no_mb else MusicBrainz())
    overrides = json.loads(OVERRIDES.read_text()) if OVERRIDES.exists() else {}
    existing = json.loads(FULL_JSON.read_text()) if FULL_JSON.exists() else {}
    records = parse_collection()
    print(f"{len(records)} records in collection", file=sys.stderr)

    out, report = dict(existing), []
    for i, rec in enumerate(records, 1):
        key = rec["cover"]
        label = f'{rec["artist"]}|{rec["album"]}'
        if args.only and args.only.lower() not in label.lower():
            continue
        ov = overrides.get(key, {})
        try:
            if ov.get("spotify_id"):
                a = sp.album(ov["spotify_id"])
                tr = sp.tracks(ov["spotify_id"])
                match = {
                    "id": a["id"], "name": a["name"], "artists": [x["name"] for x in a["artists"]],
                    "release_date": a["release_date"], "album_type": a["album_type"], "total_tracks": a["total_tracks"],
                    "url": a["external_urls"]["spotify"], "label": a.get("label"),
                    "explicit_tracks": sum(1 for t in tr if t.get("explicit")),
                    "tracks": [{"n": t["track_number"], "disc": t.get("disc_number", 1), "title": t["name"], "ms": t["duration_ms"], "explicit": bool(t.get("explicit"))} for t in tr],
                    "score": 1.0, "override": True,
                }
                cands = []
            elif ov.get("url"):
                # not on Spotify, but we know where it lives and what's on it
                match = {"id": None, "name": ov.get("name", rec["album"]), "artists": [rec["artist"]], "release_date": str(rec["year"]),
                         "album_type": "album", "total_tracks": len(ov.get("tracks", [])), "url": ov["url"], "label": None,
                         "link_label": ov.get("link_label", "listen"), "explicit_tracks": 0, "override": True, "score": 1.0,
                         "tracks": [{"n": i + 1, "disc": 1, "title": t, "ms": 0, "explicit": False} for i, t in enumerate(ov.get("tracks", []))]}
                cands = []
            elif ov.get("skip"):
                match, cands = None, []
            else:
                match, cands = pick_spotify(sp, rec)
        except Exception as e:  # noqa: BLE001
            match, cands = None, []
            report.append(f"- ERROR {label}: {e}")

        entry = {"artist": rec["artist"], "album": rec["album"], "year": rec["year"], "spotify": match}
        flags = []
        if match is None:
            flags.append("no spotify match" + (" (override: skip)" if ov.get("skip") else ""))
            if cands:
                flags.append("candidates: " + "; ".join(f'{c["name"]} by {c["artists"][0]["name"]} ({c["release_date"][:4]})' for c in cands))
        else:
            if match.get("override"):
                pass  # hand-picked: nothing to second-guess
            elif match["explicit_tracks"] == 0:
                flags.append("no explicit tracks on the chosen version (may simply be a clean record)")
            if EDITION_WORDS.search(match["name"].lower()) and not EDITION_WORDS.search(rec["album"].lower()):
                flags.append(f'edition in title: "{match["name"]}"')
            if abs(int(match["release_date"][:4]) - rec["year"]) > 1:
                flags.append(f'year {match["release_date"][:4]} vs collection {rec["year"]}')
            if mb and not ov.get("skip_mb") and match.get("id"):
                try:
                    rg, rg_s = mb.release_group(rec["artist"], rec["album"])
                    if rg:
                        canon = mb.canonical_tracks(rg["id"])
                        if canon and canon["tracks"]:
                            mb_in_sp, sp_in_mb = compare(match["tracks"], canon["tracks"])
                            entry["musicbrainz"] = {
                                "release_group": rg["id"], "title": rg["title"], "first_release": rg.get("first-release-date"),
                                "release": canon["release_id"], "release_date": canon["date"], "country": canon["country"],
                                "track_count": len(canon["tracks"]), "mb_in_spotify": mb_in_sp, "spotify_in_mb": sp_in_mb,
                            }
                            if mb_in_sp < 0.75:
                                flags.append(f'MusicBrainz tracklist only {int(mb_in_sp*100)}% covered by Spotify version ({len(canon["tracks"])} vs {len(match["tracks"])} tracks)')
                            elif sp_in_mb < 0.75:
                                flags.append(f'Spotify version has extra tracks not on canonical release ({len(match["tracks"])} vs {len(canon["tracks"])})')
                        else:
                            flags.append("MusicBrainz release group found but no official tracklist")
                    else:
                        flags.append("no MusicBrainz release group")
                except Exception as e:  # noqa: BLE001
                    flags.append(f"MusicBrainz error: {e}")
        entry["flags"] = flags
        out[key] = entry
        status = "ok " if not flags else "?? "
        print(f'{status}{i:3d}/{len(records)} {label} -> {match["name"] if match else "-"}', file=sys.stderr)
        if flags:
            report.append(f'- **{label}** ({key}) -> {match["name"] + " [" + match["url"] + "]" if match else "no match"}\n  - ' + "\n  - ".join(flags))

    FULL_JSON.write_text(json.dumps(out, ensure_ascii=False, indent=1))
    slim = {}
    for k, v in out.items():
        sp = v.get("spotify")
        if not sp:
            continue
        entry = {"name": sp["name"], "url": sp["url"], "tracks": [t["title"] for t in sp["tracks"]]}
        if sp.get("id"):
            entry["id"] = sp["id"]
        if sp.get("link_label"):
            entry["link_label"] = sp["link_label"]
        slim[k] = entry
    OUT_JSON.write_text(json.dumps(slim, ensure_ascii=False, separators=(",", ":")))
    Path(args.report).write_text("# record match report\n\n" + ("\n".join(report) if report else "all clean") + "\n")
    print(f"wrote {OUT_JSON} ({len(slim)} linked of {len(out)}), {FULL_JSON} and {args.report} ({len(report)} flagged)", file=sys.stderr)


if __name__ == "__main__":
    main()
