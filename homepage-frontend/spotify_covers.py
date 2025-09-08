#!/usr/bin/env python3
# download album covers from spotify
# uses client creds for better quality

import requests
import os
import time
import base64
from urllib.parse import quote_plus
from PIL import Image
from io import BytesIO

# albums that need better covers
priority_albums = [
    {"artist": "blink-182", "album": "take off your pants and jacket", "filename": "blink-182-take-off-your-pants.jpg"},
    {"artist": "charli xcx", "album": "brat", "filename": "charli-xcx-brat.jpg"},
    {"artist": "childish gambino", "album": "camp", "filename": "childish-gambino-camp.jpg"},
    {"artist": "childish gambino", "album": "kauai", "filename": "childish-gambino-kauai.jpg"},
    {"artist": "eminem", "album": "infinite", "filename": "eminem-infinite.jpg"},
    {"artist": "frank ocean", "album": "endless", "filename": "frank-ocean-endless.jpg"},
    {"artist": "fred again", "album": "actual life 2", "filename": "fred-again-actual-life-2.jpg"},
    {"artist": "kanye west", "album": "yeezus", "filename": "kanye-west-yeezus.jpg"},
    {"artist": "lorde", "album": "pure heroine", "filename": "lorde-pure-heroine.jpg"},
    {"artist": "mac miller", "album": "swimming", "filename": "mac-miller-swimming.jpg"},
    {"artist": "mac miller", "album": "circles", "filename": "mac-miller-circles.jpg"},
    {"artist": "mac miller", "album": "tiny desk", "filename": "mac-miller-tiny-desk.jpg"},
    {"artist": "mura masa", "album": "r.y.c", "filename": "mura-masa-ryc.jpg"},
    {"artist": "pusha t", "album": "daytona", "filename": "pusha-t-daytona.jpg"},
    {"artist": "sigur rós", "album": "( )", "filename": "sigur-ros-parentheses.jpg"},
    {"artist": "taking back sunday", "album": "tell all your friends", "filename": "taking-back-sunday-tell-all-your-friends.jpg"},
    {"artist": "taylor swift", "album": "1989", "filename": "taylor-swift-1989.jpg"},
    {"artist": "vampire weekend", "album": "contra", "filename": "vampire-weekend-contra.jpg"}
]

def test_itunes_rate_limit():
    # check if itunes is still rate limiting us
    try:
        test_url = "https://itunes.apple.com/search?term=test&entity=album&limit=1"
        response = requests.get(test_url, headers={'User-Agent': 'AlbumCoverDownloader/1.0'})
        return response.status_code == 200
    except:
        return False

def download_from_alternative_apis(artist, album, filename, output_dir):
    # try different apis to get album art
    
    # try lastfm first (no auth needed)
    try:
        api_key = "b25b959554ed76058ac220b7b2e0a026"  # Public demo key
        search_url = f"http://ws.audioscrobbler.com/2.0/?method=album.getinfo&api_key={api_key}&artist={quote_plus(artist)}&album={quote_plus(album)}&format=json"
        
        print(f"Last.fm search: {artist} - {album}")
        
        response = requests.get(search_url, headers={'User-Agent': 'AlbumCoverDownloader/1.0'})
        if response.status_code == 200:
            data = response.json()
            album_data = data.get('album', {})
            images = album_data.get('image', [])
            
            # Find largest image
            artwork_url = None
            for img in images:
                if img.get('size') == 'extralarge':
                    artwork_url = img.get('#text')
                    break
            
            if artwork_url and artwork_url.strip():
                img_response = requests.get(artwork_url, headers={'User-Agent': 'AlbumCoverDownloader/1.0'})
                if img_response.status_code == 200:
                    img = Image.open(BytesIO(img_response.content))
                    img = img.convert('RGB')
                    img = img.resize((300, 300), Image.Resampling.LANCZOS)
                    
                    output_path = os.path.join(output_dir, filename)
                    img.save(output_path, 'JPEG', quality=98)
                    
                    print(f"  ✅ Downloaded via Last.fm: {filename}")
                    return True
    except Exception as e:
        print(f"  ❌ Last.fm error: {str(e)}")
    
    # Method 2: Try iTunes again (in case rate limit reset)
    try:
        search_term = f"{artist} {album}".replace("&", "and").replace("...", "").replace("***", "")
        search_url = f"https://itunes.apple.com/search?term={quote_plus(search_term)}&entity=album&limit=3"
        
        print(f"  iTunes retry: {artist} - {album}")
        
        response = requests.get(search_url, headers={'User-Agent': 'AlbumCoverDownloader/1.0'})
        if response.status_code == 200:
            data = response.json()
            results = data.get('results', [])
            
            if results:
                best_result = results[0]
                artwork_url = best_result.get('artworkUrl100', '').replace('100x100', '1200x1200')
                
                if artwork_url:
                    img_response = requests.get(artwork_url, headers={'User-Agent': 'AlbumCoverDownloader/1.0'})
                    if img_response.status_code == 200:
                        img = Image.open(BytesIO(img_response.content))
                        img = img.convert('RGB')
                        img = img.resize((300, 300), Image.Resampling.LANCZOS)
                        
                        output_path = os.path.join(output_dir, filename)
                        img.save(output_path, 'JPEG', quality=98)
                        
                        print(f"  ✅ Downloaded via iTunes: {filename}")
                        return True
    except Exception as e:
        print(f"  ❌ iTunes error: {str(e)}")
    
    print(f"  ❌ All methods failed")
    return False

def main():
    output_dir = "assets/records"
    
    print("🔄 Testing iTunes rate limit status...")
    if test_itunes_rate_limit():
        print("✅ iTunes API accessible")
    else:
        print("⚠️ iTunes API still rate limited")
    
    print(f"\n🎵 Downloading {len(priority_albums)} album covers using multiple APIs")
    print("-" * 60)
    
    successful = 0
    failed = 0
    failed_albums = []
    
    for i, record in enumerate(priority_albums, 1):
        print(f"[{i}/{len(priority_albums)}]", end=" ")
        
        if download_from_alternative_apis(record["artist"], record["album"], record["filename"], output_dir):
            successful += 1
        else:
            failed += 1
            failed_albums.append(f"{record['artist']} - {record['album']}")
            
        time.sleep(0.5)  # Rate limiting
    
    print("-" * 60)
    print(f"🎉 Complete! {successful} successful, {failed} failed")
    
    if failed_albums:
        print(f"\n❌ Still missing ({len(failed_albums)}):")
        for album in failed_albums:
            print(f"  - {album}")
    
    print(f"📁 Images saved in: {output_dir}/")

if __name__ == "__main__":
    main()