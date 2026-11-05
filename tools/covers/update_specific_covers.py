#!/usr/bin/env python3
"""
Update specific album covers with highest quality versions
Uses iTunes API for maximum quality (1000x1000 source)
"""

import requests
import os
import time
from urllib.parse import quote_plus
from PIL import Image
from io import BytesIO

# Specific albums that need better artwork
albums_to_update = [
    {"artist": "blink-182", "album": "enema of the state", "filename": "blink-182-enema-of-the-state.jpg"},
    {"artist": "blink-182", "album": "take off your pants and jacket", "filename": "blink-182-take-off-your-pants.jpg"},
    {"artist": "charli xcx", "album": "brat", "filename": "charli-xcx-brat.jpg"},
    {"artist": "childish gambino", "album": "camp", "filename": "childish-gambino-camp.jpg"},
    {"artist": "childish gambino", "album": "kauai", "filename": "childish-gambino-kauai.jpg"},
    {"artist": "eminem", "album": "infinite", "filename": "eminem-infinite.jpg"},
    {"artist": "frank ocean", "album": "blonde", "filename": "frank-ocean-blond.jpg"},  # Note: using "blonde" for search
    {"artist": "frank ocean", "album": "endless", "filename": "frank-ocean-endless.jpg"},
    {"artist": "fred again", "album": "actual life 2", "filename": "fred-again-actual-life-2.jpg"},
    {"artist": "glass animals", "album": "i love you so f***ing much", "filename": "glass-animals-i-love-you-so-fucking-much.jpg"},
    {"artist": "john coltrane", "album": "a love supreme", "filename": "john-coltrane-love-supreme.jpg"},
    {"artist": "kanye west", "album": "late registration", "filename": "kanye-west-late-registration.jpg"},
    {"artist": "kanye west", "album": "yeezus", "filename": "kanye-west-yeezus.jpg"},
    {"artist": "linkin park", "album": "hybrid theory", "filename": "linkin-park-hybrid-theory.jpg"},
    {"artist": "lorde", "album": "pure heroine", "filename": "lorde-pure-heroine.jpg"},
    {"artist": "lizzo", "album": "special", "filename": "lizzo-special.jpg"},
    {"artist": "mac miller", "album": "faces", "filename": "mac-miller-faces.jpg"},
    {"artist": "mac miller", "album": "kids", "filename": "mac-miller-kids.jpg"},
    {"artist": "mac miller", "album": "swimming", "filename": "mac-miller-swimming.jpg"},
    {"artist": "mac miller", "album": "tiny desk concert", "filename": "mac-miller-tiny-desk.jpg"},
    {"artist": "mac miller", "album": "circles", "filename": "mac-miller-circles.jpg"},
    {"artist": "mura masa", "album": "r.y.c", "filename": "mura-masa-ryc.jpg"},
    {"artist": "notorious b.i.g.", "album": "life after death", "filename": "notorious-big-life-after-death.jpg"},
    {"artist": "notorious b.i.g.", "album": "ready to die", "filename": "notorious-big-ready-to-die.jpg"},
    {"artist": "purity ring", "album": "another eternity", "filename": "purity-ring-another-eternity.jpg"},
    {"artist": "puff daddy", "album": "no way out", "filename": "puff-daddy-no-way-out.jpg"},
    {"artist": "pusha t", "album": "daytona", "filename": "pusha-t-daytona.jpg"},
    {"artist": "red hot chili peppers", "album": "stadium arcadium", "filename": "red-hot-chili-peppers-stadium-arcadium.jpg"},
    {"artist": "rihanna", "album": "anti", "filename": "rihanna-anti.jpg"},
    {"artist": "say anything", "album": "is a real boy", "filename": "say-anything-is-a-real-boy.jpg"},
    {"artist": "taking back sunday", "album": "tell all your friends", "filename": "taking-back-sunday-tell-all-your-friends.jpg"},
    {"artist": "taylor swift", "album": "1989", "filename": "taylor-swift-1989.jpg"},
    {"artist": "taylor swift", "album": "evermore", "filename": "taylor-swift-evermore.jpg"},
    {"artist": "taylor swift", "album": "folklore", "filename": "taylor-swift-folklore.jpg"},
    {"artist": "the beatles", "album": "revolver", "filename": "the-beatles-revolver.jpg"},
    {"artist": "the weeknd", "album": "starboy", "filename": "the-weeknd-starboy.jpg"},
    {"artist": "third eye blind", "album": "third eye blind", "filename": "third-eye-blind-third-eye-blind.jpg"},
    {"artist": "vampire weekend", "album": "contra", "filename": "vampire-weekend-contra.jpg"},
    {"artist": "vampire weekend", "album": "vampire weekend", "filename": "vampire-weekend-vampire-weekend.jpg"}
]

def download_highest_quality_cover(artist, album, filename, output_dir, attempt=1):
    """Download highest quality album cover with retry logic"""
    try:
        # Multiple search strategies
        search_terms = [
            f"{artist} {album}",
            f'"{artist}" "{album}"',
            f"{artist} album {album}"
        ]
        
        for search_term in search_terms[:attempt]:
            search_term_clean = search_term.replace("&", "and").replace("...", "").replace("***", "")
            search_url = f"https://itunes.apple.com/search?term={quote_plus(search_term_clean)}&entity=album&limit=5"
            
            print(f"iTunes search (attempt {attempt}): {artist} - {album}")
            
            response = requests.get(search_url, headers={
                'User-Agent': 'AlbumCoverDownloader/1.0',
                'Accept': 'application/json'
            })
            
            if response.status_code != 200:
                print(f"  ❌ Failed to search: {response.status_code}")
                continue
                
            try:
                data = response.json()
            except:
                print(f"  ❌ Invalid JSON response")
                continue
                
            results = data.get('results', [])
            
            if not results:
                continue
            
            # Find best match
            best_result = None
            for result in results:
                result_album = result.get('collectionName', '').lower()
                result_artist = result.get('artistName', '').lower()
                target_album = album.lower()
                target_artist = artist.lower()
                
                # Exact match preferred
                if target_album in result_album and target_artist in result_artist:
                    best_result = result
                    break
            
            if not best_result and results:
                best_result = results[0]  # Fallback to first result
                
            if best_result:
                # Get maximum quality artwork
                artwork_url = best_result.get('artworkUrl100', '').replace('100x100', '1200x1200')
                if not artwork_url:
                    continue
                    
                # Download the image
                img_response = requests.get(artwork_url, headers={'User-Agent': 'AlbumCoverDownloader/1.0'})
                if img_response.status_code != 200:
                    continue
                    
                # Process and resize image to exactly 300x300
                img = Image.open(BytesIO(img_response.content))
                img = img.convert('RGB')
                img = img.resize((300, 300), Image.Resampling.LANCZOS)
                
                output_path = os.path.join(output_dir, filename)
                img.save(output_path, 'JPEG', quality=98)
                    
                print(f"  ✅ Downloaded: {filename}")
                return True
        
        print(f"  ❌ No suitable results found")
        return False
        
    except Exception as e:
        print(f"  ❌ Error: {str(e)}")
        return False

def main():
    output_dir = "assets/records"
    
    print(f"🎵 Updating {len(albums_to_update)} album covers with highest quality")
    print("-" * 60)
    
    successful = 0
    failed = 0
    failed_albums = []
    
    for i, record in enumerate(albums_to_update, 1):
        print(f"[{i}/{len(albums_to_update)}]", end=" ")
        
        if download_highest_quality_cover(record["artist"], record["album"], record["filename"], output_dir):
            successful += 1
        else:
            failed += 1
            failed_albums.append(f"{record['artist']} - {record['album']}")
            
        time.sleep(0.3)  # Rate limiting
    
    print("-" * 60)
    print(f"🎉 Complete! {successful} successful, {failed} failed")
    
    if failed_albums:
        print(f"\n❌ Failed to download ({len(failed_albums)}):")
        for album in failed_albums:
            print(f"  - {album}")
    
    print(f"📁 High-quality images saved in: {output_dir}/")

if __name__ == "__main__":
    main()