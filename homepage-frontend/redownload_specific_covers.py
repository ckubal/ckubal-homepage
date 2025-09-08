#!/usr/bin/env python3
"""
Re-download specific album covers for better quality
Uses iTunes Search API for high-quality album artwork
"""

import requests
import os
import time
from urllib.parse import quote_plus
from PIL import Image
from io import BytesIO

# Specific records to re-download for better quality
specific_records = [
    {"artist": "2pac", "album": "greatest hits", "filename": "2pac-greatest-hits.jpg"},
    {"artist": "amy winehouse", "album": "back to black", "filename": "amy-winehouse-back-to-black.jpg"},
    {"artist": "atmosphere", "album": "when life gives you lemons, you paint that shit gold", "filename": "atmosphere-when-life-gives-you-lemons.jpg"},
    {"artist": "baby keem", "album": "the melodic blue", "filename": "baby-keem-melodic-blue.jpg"},
    {"artist": "beyoncé", "album": "lemonade", "filename": "beyonce-lemonade.jpg"},
    {"artist": "blink-182", "album": "enema of the state", "filename": "blink-182-enema-of-the-state.jpg"},
    {"artist": "bloc party", "album": "silent alarm", "filename": "bloc-party-silent-alarm.jpg"},
    {"artist": "chance the rapper", "album": "coloring book", "filename": "chance-the-rapper-coloring-book.jpg"},
    {"artist": "charli xcx", "album": "brat", "filename": "charli-xcx-brat.jpg"},
    {"artist": "charli xcx", "album": "how i'm feeling now", "filename": "charli-xcx-how-im-feeling-now.jpg"},
    {"artist": "childish gambino", "album": "because the internet", "filename": "childish-gambino-because-the-internet.jpg"},
    {"artist": "childish gambino", "album": "camp", "filename": "childish-gambino-camp.jpg"},
    {"artist": "childish gambino with jaden smith", "album": "kauai", "filename": "childish-gambino-kauai.jpg"},
    {"artist": "clipse", "album": "let god sort em out", "filename": "clipse-let-god-sort-em-out.jpg"},
    {"artist": "daft punk", "album": "random access memories", "filename": "daft-punk-random-access-memories.jpg"},
    {"artist": "death cab for cutie", "album": "plans", "filename": "death-cab-for-cutie-plans.jpg"},
    {"artist": "desaparecidos", "album": "read music, speak spanish", "filename": "desaparecidos-read-music-speak-spanish.jpg"},
    {"artist": "doechii", "album": "alligator bites never heal", "filename": "doechii-alligator-bites-never-heal.jpg"},
    {"artist": "dr. dre", "album": "2001", "filename": "dr-dre-2001.jpg"},
    {"artist": "dr. dre", "album": "the chronic", "filename": "dr-dre-chronic.jpg"},
    {"artist": "drake", "album": "take care", "filename": "drake-take-care.jpg"},
    {"artist": "eminem", "album": "the eminem show", "filename": "eminem-eminem-show.jpg"},
    {"artist": "eminem", "album": "infinite", "filename": "eminem-infinite.jpg"},
    {"artist": "eminem", "album": "the marshall mathers lp", "filename": "eminem-marshall-mathers-lp.jpg"},
    {"artist": "eminem", "album": "the slim shady lp", "filename": "eminem-slim-shady-lp.jpg"},
    {"artist": "frank ocean", "album": "blond", "filename": "frank-ocean-blond.jpg"},
    {"artist": "frank ocean", "album": "endless", "filename": "frank-ocean-endless.jpg"},
    {"artist": "fred again..", "album": "actual life 2", "filename": "fred-again-actual-life-2.jpg"},
    {"artist": "fred again..", "album": "actual life 3", "filename": "fred-again-actual-life-3.jpg"},
    {"artist": "fred again..", "album": "ten days", "filename": "fred-again-ten-days.jpg"},
    {"artist": "glass animals", "album": "i love you so f***ing much.", "filename": "glass-animals-i-love-you-so-fucking-much.jpg"},
    {"artist": "glass animals", "album": "dreamland", "filename": "glass-animals-dreamland.jpg"},
    {"artist": "glass animals", "album": "zaba", "filename": "glass-animals-zaba.jpg"},
    {"artist": "green day", "album": "dookie", "filename": "green-day-dookie.jpg"},
    {"artist": "incubus", "album": "morning view", "filename": "incubus-morning-view.jpg"},
    {"artist": "jack's mannequin", "album": "everything in transit", "filename": "jacks-mannequin-everything-in-transit.jpg"},
    {"artist": "jamie xx", "album": "in waves", "filename": "jamie-xx-in-waves.jpg"},
    {"artist": "jay-z", "album": "the black album", "filename": "jay-z-black-album.jpg"},
    {"artist": "jay-z", "album": "the blueprint", "filename": "jay-z-blueprint.jpg"},
    {"artist": "jay-z & kanye west", "album": "watch the throne", "filename": "jay-z-kanye-west-watch-the-throne.jpg"},
    {"artist": "john coltrane", "album": "a love supreme", "filename": "john-coltrane-love-supreme.jpg"},
    {"artist": "jorja smith", "album": "lost & found", "filename": "jorja-smith-lost-and-found.jpg"},
    {"artist": "kanye west", "album": "the college dropout", "filename": "kanye-west-college-dropout.jpg"},
    {"artist": "kanye west", "album": "graduation", "filename": "kanye-west-graduation.jpg"},
    {"artist": "kanye west", "album": "yeezus", "filename": "kanye-west-yeezus.jpg"},
    {"artist": "kendrick lamar", "album": "damn.", "filename": "kendrick-lamar-damn.jpg"},
    {"artist": "kendrick lamar", "album": "gnx", "filename": "kendrick-lamar-gnx.jpg"},
    {"artist": "kendrick lamar", "album": "good kid, m.a.a.d city", "filename": "kendrick-lamar-good-kid-maad-city.jpg"},
    {"artist": "kendrick lamar", "album": "to pimp a butterfly", "filename": "kendrick-lamar-to-pimp-a-butterfly.jpg"},
    {"artist": "killer mike", "album": "michael", "filename": "killer-mike-michael.jpg"},
    {"artist": "lauryn hill", "album": "the miseducation of lauryn hill", "filename": "lauryn-hill-miseducation.jpg"},
    {"artist": "linkin park", "album": "hybrid theory", "filename": "linkin-park-hybrid-theory.jpg"},
    {"artist": "lizzo", "album": "special", "filename": "lizzo-special.jpg"},
    {"artist": "lorde", "album": "pure heroine", "filename": "lorde-pure-heroine.jpg"},
    {"artist": "mac miller", "album": "faces", "filename": "mac-miller-faces.jpg"},
    {"artist": "mac miller", "album": "k.i.d.s.", "filename": "mac-miller-kids.jpg"},
    {"artist": "mac miller", "album": "macadelic", "filename": "mac-miller-macadelic.jpg"},
    {"artist": "mac miller", "album": "swimming", "filename": "mac-miller-swimming.jpg"},
    {"artist": "mac miller", "album": "npr music tiny desk concert", "filename": "mac-miller-tiny-desk.jpg"},
    {"artist": "mgmt", "album": "oracular spectacular", "filename": "mgmt-oracular-spectacular.jpg"},
    {"artist": "mura masa", "album": "r.y.c", "filename": "mura-masa-ryc.jpg"},
    {"artist": "nick drake", "album": "pink moon", "filename": "nick-drake-pink-moon.jpg"},
    {"artist": "nirvana", "album": "nevermind", "filename": "nirvana-nevermind.jpg"},
    {"artist": "notorious b.i.g.", "album": "ready to die", "filename": "notorious-big-ready-to-die.jpg"},
    {"artist": "olivia rodrigo", "album": "sour", "filename": "olivia-rodrigo-sour.jpg"},
    {"artist": "puff daddy & the family", "album": "no way out", "filename": "puff-daddy-no-way-out.jpg"},
    {"artist": "purity ring", "album": "another eternity", "filename": "purity-ring-another-eternity.jpg"},
    {"artist": "pusha t", "album": "daytona", "filename": "pusha-t-daytona.jpg"},
    {"artist": "red hot chili peppers", "album": "stadium arcadium", "filename": "red-hot-chili-peppers-stadium-arcadium.jpg"},
    {"artist": "rihanna", "album": "anti", "filename": "rihanna-anti.jpg"},
    {"artist": "say anything", "album": "...is a real boy", "filename": "say-anything-is-a-real-boy.jpg"},
    {"artist": "sigur rós", "album": "( )", "filename": "sigur-ros-parentheses.jpg"},
    {"artist": "sigur rós", "album": "takk...", "filename": "sigur-ros-takk.jpg"},
    {"artist": "taking back sunday", "album": "tell all your friends", "filename": "taking-back-sunday-tell-all-your-friends.jpg"},
    {"artist": "taylor swift", "album": "1989", "filename": "taylor-swift-1989.jpg"},
    {"artist": "taylor swift", "album": "evermore", "filename": "taylor-swift-evermore.jpg"},
    {"artist": "taylor swift", "album": "folklore", "filename": "taylor-swift-folklore.jpg"},
    {"artist": "the beatles", "album": "revolver", "filename": "the-beatles-revolver.jpg"},
    {"artist": "the strokes", "album": "is this it", "filename": "the-strokes-is-this-it.jpg"},
    {"artist": "the weeknd", "album": "starboy", "filename": "the-weeknd-starboy.jpg"},
    {"artist": "third eye blind", "album": "third eye blind", "filename": "third-eye-blind-third-eye-blind.jpg"},
    {"artist": "vampire weekend", "album": "contra", "filename": "vampire-weekend-contra.jpg"},
    {"artist": "vampire weekend", "album": "vampire weekend", "filename": "vampire-weekend-vampire-weekend.jpg"}
]

def download_high_quality_cover(artist, album, filename, output_dir):
    """Download high-quality album cover using iTunes API with album name in search"""
    try:
        # Enhanced search including both artist and album name
        search_term = f"{artist} {album}".replace("&", "and").replace("...", "")
        search_url = f"https://itunes.apple.com/search?term={quote_plus(search_term)}&entity=album&limit=3"
        
        print(f"iTunes search: {artist} - {album}")
        
        response = requests.get(search_url, headers={'User-Agent': 'AlbumCoverDownloader/1.0'})
        if response.status_code != 200:
            print(f"  ❌ Failed to search: {response.status_code}")
            return False
            
        data = response.json()
        results = data.get('results', [])
        
        if not results:
            print(f"  ❌ No results found")
            return False
        
        # Find best match (exact album name match preferred)
        best_result = None
        for result in results:
            result_album = result.get('collectionName', '').lower()
            target_album = album.lower()
            if target_album in result_album or result_album in target_album:
                best_result = result
                break
        
        if not best_result:
            best_result = results[0]  # Fallback to first result
            
        # Get highest quality artwork (replace 100x100 with 1000x1000 then resize)
        artwork_url = best_result.get('artworkUrl100', '').replace('100x100', '1000x1000')
        if not artwork_url:
            print(f"  ❌ No artwork URL")
            return False
            
        # Download the image
        img_response = requests.get(artwork_url, headers={'User-Agent': 'AlbumCoverDownloader/1.0'})
        if img_response.status_code != 200:
            print(f"  ❌ Failed to download image: {img_response.status_code}")
            return False
            
        # Process and resize image to exactly 300x300
        img = Image.open(BytesIO(img_response.content))
        img = img.convert('RGB')
        img = img.resize((300, 300), Image.Resampling.LANCZOS)
        
        output_path = os.path.join(output_dir, filename)
        img.save(output_path, 'JPEG', quality=98)  # Higher quality
            
        print(f"  ✅ Downloaded: {filename}")
        return True
        
    except Exception as e:
        print(f"  ❌ Error: {str(e)}")
        return False

def main():
    output_dir = "assets/records"
    
    print(f"🎵 Re-downloading {len(specific_records)} album covers for better quality")
    print("-" * 60)
    
    successful = 0
    failed = 0
    
    for i, record in enumerate(specific_records, 1):
        print(f"[{i}/{len(specific_records)}]", end=" ")
        
        if download_high_quality_cover(record["artist"], record["album"], record["filename"], output_dir):
            successful += 1
        else:
            failed += 1
            
        time.sleep(0.2)  # Rate limiting
    
    print("-" * 60)
    print(f"🎉 Complete! {successful} successful, {failed} failed")
    print(f"📁 High-quality images saved in: {output_dir}/")

if __name__ == "__main__":
    main()