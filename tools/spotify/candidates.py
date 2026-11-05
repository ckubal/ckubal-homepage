#!/usr/bin/env python3
"""List Spotify album candidates for a query, to pick overrides by hand.

    uv run --with requests --with certifi python -I tools/spotify/candidates.py "artist" "album" ["extra query"...]
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from match_records import Spotify, load_env  # noqa: E402


def main():
    load_env()
    sp = Spotify()
    artist, album = sys.argv[1], sys.argv[2]
    queries = [f'album:"{album}" artist:"{artist}"', f"{artist} {album}"] + sys.argv[3:]
    seen = set()
    for q in queries:
        for a in sp.search_albums(q):
            if a["id"] in seen:
                continue
            seen.add(a["id"])
            arts = ", ".join(f'{x["name"]}#{x["id"][:6]}' for x in a["artists"])
            print(f'{a["id"]}  {a["release_date"][:4]}  {a["album_type"]:11s} {a["total_tracks"]:3d}  {a["name"]}  [{arts}]')


if __name__ == "__main__":
    main()
