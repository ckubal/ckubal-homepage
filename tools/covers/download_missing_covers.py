#!/usr/bin/env python3
# missing album cover downloader
# uses spotify api for the ones we couldnt get

import requests
import os
import time
import base64
from urllib.parse import quote_plus
from PIL import Image
from io import BytesIO

# albums we still need covers for
missing_records = [
    {"artist": "100 gecs", "album": "1000 gecs", "filename": "100-gecs-1000-gecs.jpg"},
    {"artist": "belle & sebastian", "album": "fold your hands child, you walk like a peasant", "filename": "belle-sebastian-fold-your-hands.jpg"},
    {"artist": "belle & sebastian", "album": "the life pursuit", "filename": "belle-sebastian-life-pursuit.jpg"},
    {"artist": "brand new", "album": "deja entendu", "filename": "brand-new-deja-entendu.jpg"},
    {"artist": "charli xcx", "album": "crash", "filename": "charli-xcx-crash.jpg"},
    {"artist": "charli xcx", "album": "brat", "filename": "charli-xcx-brat.jpg"},
    {"artist": "death cab for cutie", "album": "plans", "filename": "death-cab-for-cutie-plans.jpg"},
    {"artist": "desaparecidos", "album": "read music, speak spanish", "filename": "desaparecidos-read-music-speak-spanish.jpg"},
    {"artist": "dmx", "album": "flesh of my flesh blood of my blood", "filename": "dmx-flesh-of-my-flesh.jpg"},
    {"artist": "eminem", "album": "infinite", "filename": "eminem-infinite.jpg"},
    {"artist": "eminem", "album": "the slim shady lp", "filename": "eminem-slim-shady-lp.jpg"},
    {"artist": "frank ocean", "album": "blond", "filename": "frank-ocean-blond.jpg"},
    {"artist": "jack harlow", "album": "jackman.", "filename": "jack-harlow-jackman.jpg"},
    {"artist": "jack's mannequin", "album": "everything in transit", "filename": "jacks-mannequin-everything-in-transit.jpg"},
    {"artist": "jay-z", "album": "vol. 2... hard knock life", "filename": "jay-z-vol-2-hard-knock-life.jpg"},
    {"artist": "lorde", "album": "pure heroine", "filename": "lorde-pure-heroine.jpg"},
    {"artist": "minus the bear", "album": "menos el oso", "filename": "minus-the-bear-menos-el-oso.jpg"},
    {"artist": "nas", "album": "stillmatic", "filename": "nas-stillmatic.jpg"},
    {"artist": "sublime", "album": "sublime", "filename": "sublime-sublime.jpg"},
    {"artist": "the 1975", "album": "being funny in a foreign language", "filename": "the-1975-being-funny.jpg"},
    {"artist": "the postal service", "album": "give up", "filename": "the-postal-service-give-up.jpg"},
    {"artist": "the streets", "album": "original pirate material", "filename": "the-streets-original-pirate-material.jpg"},
    {"artist": "the streets", "album": "a grand don't come for free", "filename": "the-streets-grand-dont-come-for-free.jpg"},
    {"artist": "vampire weekend", "album": "modern vampires of the city", "filename": "vampire-weekend-modern-vampires.jpg"}
]

# spotify api stuff
def get_spotify_token():
    # get spotify token with client creds
    # would need real api creds
    # using other sources for now
    return None

def download_from_spotify(artist, album, filename, output_dir):
    # download cover from spotify api
    try:
        # Search query
        search_query = f"artist:{artist} album:{album}"
        search_url = f"https://api.spotify.com/v1/search?q={quote_plus(search_query)}&type=album&limit=1"
        
        print(f"Spotify search: {artist} - {album}")
        
        # needs spotify auth
        # skipping without creds
        print(f"  ⚠️  Spotify API requires authentication - skipping")
        return False
        
    except Exception as e:
        print(f"  ❌ Error: {str(e)}")
        return False

def download_from_itunes(artist, album, filename, output_dir):
    # download from itunes (no auth needed)
    try:
        search_term = f"{artist} {album}".replace("&", "and")
        search_url = f"https://itunes.apple.com/search?term={quote_plus(search_term)}&entity=album&limit=1"
        
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
            
        artwork_url = results[0].get('artworkUrl100', '').replace('100x100', '600x600')
        if not artwork_url:
            print(f"  ❌ No artwork URL")
            return False
            
        # Download the image
        img_response = requests.get(artwork_url, headers={'User-Agent': 'AlbumCoverDownloader/1.0'})
        if img_response.status_code != 200:
            print(f"  ❌ Failed to download image: {img_response.status_code}")
            return False
            
        # Process and resize image
        img = Image.open(BytesIO(img_response.content))
        img = img.convert('RGB')
        img = img.resize((300, 300), Image.Resampling.LANCZOS)
        
        output_path = os.path.join(output_dir, filename)
        img.save(output_path, 'JPEG', quality=95)
            
        print(f"  ✅ Downloaded: {filename}")
        return True
        
    except Exception as e:
        print(f"  ❌ Error: {str(e)}")
        return False

def download_from_lastfm(artist, album, filename, output_dir):
    # download from lastfm (free)
    try:
        # lastfm album info api
        api_key = "b25b959554ed76058ac220b7b2e0a026"  # public demo key
        search_url = f"http://ws.audioscrobbler.com/2.0/?method=album.getinfo&api_key={api_key}&artist={quote_plus(artist)}&album={quote_plus(album)}&format=json"
        
        print(f"Last.fm search: {artist} - {album}")
        
        response = requests.get(search_url, headers={'User-Agent': 'AlbumCoverDownloader/1.0'})
        if response.status_code != 200:
            print(f"  ❌ Failed to search: {response.status_code}")
            return False
            
        data = response.json()
        album_data = data.get('album', {})
        images = album_data.get('image', [])
        
        # Find largest image
        artwork_url = None
        for img in images:
            if img.get('size') == 'extralarge':
                artwork_url = img.get('#text')
                break
        
        if not artwork_url or artwork_url.strip() == '':
            print(f"  ❌ No artwork URL found")
            return False
            
        # Download the image
        img_response = requests.get(artwork_url, headers={'User-Agent': 'AlbumCoverDownloader/1.0'})
        if img_response.status_code != 200:
            print(f"  ❌ Failed to download image: {img_response.status_code}")
            return False
            
        # Process and resize image
        img = Image.open(BytesIO(img_response.content))
        img = img.convert('RGB')
        img = img.resize((300, 300), Image.Resampling.LANCZOS)
        
        output_path = os.path.join(output_dir, filename)
        img.save(output_path, 'JPEG', quality=95)
            
        print(f"  ✅ Downloaded: {filename}")
        return True
        
    except Exception as e:
        print(f"  ❌ Error: {str(e)}")
        return False

def main():
    output_dir = "assets/records"
    
    print(f"🎵 Downloading {len(missing_records)} missing album covers")
    print("-" * 60)
    
    successful = 0
    failed = 0
    
    for i, record in enumerate(missing_records, 1):
        print(f"[{i}/{len(missing_records)}]", end=" ")
        
        # Check if file already exists
        output_path = os.path.join(output_dir, record["filename"])
        if os.path.exists(output_path):
            print(f"File already exists: {record['filename']}")
            successful += 1
            continue
        
        # Try iTunes API first (most reliable)
        if download_from_itunes(record["artist"], record["album"], record["filename"], output_dir):
            successful += 1
        # Try Last.fm as backup
        elif download_from_lastfm(record["artist"], record["album"], record["filename"], output_dir):
            successful += 1
        else:
            failed += 1
            
        time.sleep(0.3)  # Rate limiting
    
    print("-" * 60)
    print(f"🎉 Complete! {successful} successful, {failed} failed")
    print(f"📁 Images saved in: {output_dir}/")

if __name__ == "__main__":
    main()