#!/usr/bin/env python3
"""
Album Cover Downloader
Downloads high-resolution album covers using MusicBrainz Cover Art Archive
"""

import requests
import os
import time
from urllib.parse import quote_plus
from PIL import Image
from io import BytesIO

# Record collection data matching JavaScript array
records = [
    {"artist": "100 gecs", "album": "1000 gecs", "filename": "100-gecs-1000-gecs.jpg"},
    {"artist": "2 chainz", "album": "pretty girls like trap music", "filename": "2-chainz-pretty-girls-like-trap-music.jpg"},
    {"artist": "2pac", "album": "greatest hits", "filename": "2pac-greatest-hits.jpg"},
    {"artist": "50 cent", "album": "get rich or die tryin'", "filename": "50-cent-get-rich-or-die-tryin.jpg"},
    {"artist": "amy winehouse", "album": "back to black", "filename": "amy-winehouse-back-to-black.jpg"},
    {"artist": "andrew bird", "album": "the mysterious production of eggs", "filename": "andrew-bird-mysterious-production-of-eggs.jpg"},
    {"artist": "andrew bird", "album": "armchair apocrypha", "filename": "andrew-bird-armchair-apocrypha.jpg"},
    {"artist": "asap rocky", "album": "long.live.a$ap", "filename": "asap-rocky-long-live-asap.jpg"},
    {"artist": "atmosphere", "album": "god loves ugly", "filename": "atmosphere-god-loves-ugly.jpg"},
    {"artist": "atmosphere", "album": "seven's travels", "filename": "atmosphere-sevens-travels.jpg"},
    {"artist": "atmosphere", "album": "when life gives you lemons, you paint that shit gold", "filename": "atmosphere-when-life-gives-you-lemons.jpg"},
    {"artist": "a tribe called quest", "album": "people's instinctive travels and the paths of rhythm", "filename": "a-tribe-called-quest-peoples-instinctive-travels.jpg"},
    {"artist": "baby keem", "album": "the melodic blue", "filename": "baby-keem-melodic-blue.jpg"},
    {"artist": "belle & sebastian", "album": "fold your hands child, you walk like a peasant", "filename": "belle-sebastian-fold-your-hands.jpg"},
    {"artist": "belle & sebastian", "album": "dear catastrophe waitress", "filename": "belle-sebastian-dear-catastrophe-waitress.jpg"},
    {"artist": "belle & sebastian", "album": "the life pursuit", "filename": "belle-sebastian-life-pursuit.jpg"},
    {"artist": "beyoncé", "album": "lemonade", "filename": "beyonce-lemonade.jpg"},
    {"artist": "blink-182", "album": "enema of the state", "filename": "blink-182-enema-of-the-state.jpg"},
    {"artist": "blink-182", "album": "take off your pants and jacket", "filename": "blink-182-take-off-your-pants.jpg"},
    {"artist": "bloc party", "album": "silent alarm", "filename": "bloc-party-silent-alarm.jpg"},
    {"artist": "brand new", "album": "deja entendu", "filename": "brand-new-deja-entendu.jpg"},
    {"artist": "brand new", "album": "the devil and god are raging inside me", "filename": "brand-new-devil-and-god.jpg"},
    {"artist": "bright eyes", "album": "vinyl box set", "filename": "bright-eyes-vinyl-box-set.jpg"},
    {"artist": "chance the rapper", "album": "coloring book", "filename": "chance-the-rapper-coloring-book.jpg"},
    {"artist": "charli xcx", "album": "how i'm feeling now", "filename": "charli-xcx-how-im-feeling-now.jpg"},
    {"artist": "charli xcx", "album": "crash", "filename": "charli-xcx-crash.jpg"},
    {"artist": "charli xcx", "album": "brat", "filename": "charli-xcx-brat.jpg"},
    {"artist": "childish gambino", "album": "camp", "filename": "childish-gambino-camp.jpg"},
    {"artist": "childish gambino", "album": "because the internet", "filename": "childish-gambino-because-the-internet.jpg"},
    {"artist": "childish gambino with jaden smith", "album": "kauai", "filename": "childish-gambino-kauai.jpg"},
    {"artist": "clipse", "album": "let god sort em out", "filename": "clipse-let-god-sort-em-out.jpg"},
    {"artist": "daft punk", "album": "random access memories", "filename": "daft-punk-random-access-memories.jpg"},
    {"artist": "dave", "album": "we're all alone in this together", "filename": "dave-were-all-alone.jpg"},
    {"artist": "death cab for cutie", "album": "plans", "filename": "death-cab-for-cutie-plans.jpg"},
    {"artist": "desaparecidos", "album": "read music, speak spanish", "filename": "desaparecidos-read-music-speak-spanish.jpg"},
    {"artist": "dmx", "album": "flesh of my flesh blood of my blood", "filename": "dmx-flesh-of-my-flesh.jpg"},
    {"artist": "doechii", "album": "alligator bites never heal", "filename": "doechii-alligator-bites-never-heal.jpg"},
    {"artist": "drake", "album": "take care", "filename": "drake-take-care.jpg"},
    {"artist": "drake", "album": "nothing was the same", "filename": "drake-nothing-was-the-same.jpg"},
    {"artist": "drake", "album": "if you're reading this it's too late", "filename": "drake-if-youre-reading-this.jpg"},
    {"artist": "drake & future", "album": "what a time to be alive", "filename": "drake-future-what-a-time-to-be-alive.jpg"},
    {"artist": "dr. dre", "album": "the chronic", "filename": "dr-dre-chronic.jpg"},
    {"artist": "dr. dre", "album": "2001", "filename": "dr-dre-2001.jpg"},
    {"artist": "eminem", "album": "infinite", "filename": "eminem-infinite.jpg"},
    {"artist": "eminem", "album": "the slim shady lp", "filename": "eminem-slim-shady-lp.jpg"},
    {"artist": "eminem", "album": "the marshall mathers lp", "filename": "eminem-marshall-mathers-lp.jpg"},
    {"artist": "eminem", "album": "the eminem show", "filename": "eminem-eminem-show.jpg"},
    {"artist": "fall out boy", "album": "take this to your grave", "filename": "fall-out-boy-take-this-to-your-grave.jpg"},
    {"artist": "fall out boy", "album": "from under the cork tree", "filename": "fall-out-boy-from-under-cork-tree.jpg"},
    {"artist": "frank ocean", "album": "endless", "filename": "frank-ocean-endless.jpg"},
    {"artist": "frank ocean", "album": "blond", "filename": "frank-ocean-blond.jpg"},
    {"artist": "fred again..", "album": "actual life", "filename": "fred-again-actual-life.jpg"},
    {"artist": "fred again..", "album": "actual life 2", "filename": "fred-again-actual-life-2.jpg"},
    {"artist": "fred again..", "album": "actual life 3", "filename": "fred-again-actual-life-3.jpg"},
    {"artist": "fred again..", "album": "ten days", "filename": "fred-again-ten-days.jpg"},
    {"artist": "glass animals", "album": "zaba", "filename": "glass-animals-zaba.jpg"},
    {"artist": "glass animals", "album": "dreamland", "filename": "glass-animals-dreamland.jpg"},
    {"artist": "glass animals", "album": "i love you so f***ing much.", "filename": "glass-animals-i-love-you-so-fucking-much.jpg"},
    {"artist": "green day", "album": "dookie", "filename": "green-day-dookie.jpg"},
    {"artist": "hobo johnson", "album": "the fall of hobo johnson", "filename": "hobo-johnson-fall-of-hobo-johnson.jpg"},
    {"artist": "incubus", "album": "make yourself", "filename": "incubus-make-yourself.jpg"},
    {"artist": "incubus", "album": "morning view", "filename": "incubus-morning-view.jpg"},
    {"artist": "jack harlow", "album": "jackman.", "filename": "jack-harlow-jackman.jpg"},
    {"artist": "jack's mannequin", "album": "everything in transit", "filename": "jacks-mannequin-everything-in-transit.jpg"},
    {"artist": "jamie xx", "album": "in waves", "filename": "jamie-xx-in-waves.jpg"},
    {"artist": "jay-z", "album": "vol. 2... hard knock life", "filename": "jay-z-vol-2-hard-knock-life.jpg"},
    {"artist": "jay-z", "album": "the blueprint", "filename": "jay-z-blueprint.jpg"},
    {"artist": "jay-z", "album": "the black album", "filename": "jay-z-black-album.jpg"},
    {"artist": "jay-z & kanye west", "album": "watch the throne", "filename": "jay-z-kanye-west-watch-the-throne.jpg"},
    {"artist": "john coltrane", "album": "a love supreme", "filename": "john-coltrane-love-supreme.jpg"},
    {"artist": "jorja smith", "album": "lost & found", "filename": "jorja-smith-lost-and-found.jpg"},
    {"artist": "kanye west", "album": "the college dropout", "filename": "kanye-west-college-dropout.jpg"},
    {"artist": "kanye west", "album": "late registration", "filename": "kanye-west-late-registration.jpg"},
    {"artist": "kanye west", "album": "graduation", "filename": "kanye-west-graduation.jpg"},
    {"artist": "kanye west", "album": "my beautiful dark twisted fantasy", "filename": "kanye-west-mbdtf.jpg"},
    {"artist": "kanye west", "album": "yeezus", "filename": "kanye-west-yeezus.jpg"},
    {"artist": "kendrick lamar", "album": "good kid, m.a.a.d city", "filename": "kendrick-lamar-good-kid-maad-city.jpg"},
    {"artist": "kendrick lamar", "album": "to pimp a butterfly", "filename": "kendrick-lamar-to-pimp-a-butterfly.jpg"},
    {"artist": "kendrick lamar", "album": "damn.", "filename": "kendrick-lamar-damn.jpg"},
    {"artist": "kendrick lamar", "album": "mr. morale & the big steppers", "filename": "kendrick-lamar-mr-morale.jpg"},
    {"artist": "kendrick lamar", "album": "gnx", "filename": "kendrick-lamar-gnx.jpg"},
    {"artist": "kids see ghosts", "album": "kids see ghosts", "filename": "kids-see-ghosts.jpg"},
    {"artist": "killer mike", "album": "michael", "filename": "killer-mike-michael.jpg"},
    {"artist": "lauryn hill", "album": "the miseducation of lauryn hill", "filename": "lauryn-hill-miseducation.jpg"},
    {"artist": "lil wayne", "album": "tha carter iii", "filename": "lil-wayne-tha-carter-iii.jpg"},
    {"artist": "linkin park", "album": "hybrid theory", "filename": "linkin-park-hybrid-theory.jpg"},
    {"artist": "lizzo", "album": "special", "filename": "lizzo-special.jpg"},
    {"artist": "lorde", "album": "pure heroine", "filename": "lorde-pure-heroine.jpg"},
    {"artist": "lupe fiasco", "album": "lupe fiasco's food & liquor", "filename": "lupe-fiasco-food-and-liquor.jpg"},
    {"artist": "lupe fiasco", "album": "lupe fiasco's the cool", "filename": "lupe-fiasco-the-cool.jpg"},
    {"artist": "lykke li", "album": "so sad so sexy", "filename": "lykke-li-so-sad-so-sexy.jpg"},
    {"artist": "mac miller", "album": "k.i.d.s.", "filename": "mac-miller-kids.jpg"},
    {"artist": "mac miller", "album": "macadelic", "filename": "mac-miller-macadelic.jpg"},
    {"artist": "mac miller", "album": "faces", "filename": "mac-miller-faces.jpg"},
    {"artist": "mac miller", "album": "swimming", "filename": "mac-miller-swimming.jpg"},
    {"artist": "mac miller", "album": "circles", "filename": "mac-miller-circles.jpg"},
    {"artist": "mac miller", "album": "npr music tiny desk concert", "filename": "mac-miller-tiny-desk.jpg"},
    {"artist": "mase", "album": "harlem world", "filename": "mase-harlem-world.jpg"},
    {"artist": "mgmt", "album": "oracular spectacular", "filename": "mgmt-oracular-spectacular.jpg"},
    {"artist": "minus the bear", "album": "menos el oso", "filename": "minus-the-bear-menos-el-oso.jpg"},
    {"artist": "modest mouse", "album": "we were dead before the ship even sank", "filename": "modest-mouse-we-were-dead.jpg"},
    {"artist": "mura masa", "album": "r.y.c", "filename": "mura-masa-ryc.jpg"},
    {"artist": "nas", "album": "illmatic", "filename": "nas-illmatic.jpg"},
    {"artist": "nas", "album": "stillmatic", "filename": "nas-stillmatic.jpg"},
    {"artist": "new found glory", "album": "sticks and stones", "filename": "new-found-glory-sticks-and-stones.jpg"},
    {"artist": "nick drake", "album": "pink moon", "filename": "nick-drake-pink-moon.jpg"},
    {"artist": "nirvana", "album": "nevermind", "filename": "nirvana-nevermind.jpg"},
    {"artist": "notorious b.i.g.", "album": "ready to die", "filename": "notorious-big-ready-to-die.jpg"},
    {"artist": "notorious b.i.g.", "album": "life after death", "filename": "notorious-big-life-after-death.jpg"},
    {"artist": "olivia rodrigo", "album": "sour", "filename": "olivia-rodrigo-sour.jpg"},
    {"artist": "panic! at the disco", "album": "a fever you can't sweat out", "filename": "panic-at-the-disco-fever.jpg"},
    {"artist": "phoenix", "album": "wolfgang amadeus phoenix", "filename": "phoenix-wolfgang-amadeus-phoenix.jpg"},
    {"artist": "puff daddy & the family", "album": "no way out", "filename": "puff-daddy-no-way-out.jpg"},
    {"artist": "purity ring", "album": "another eternity", "filename": "purity-ring-another-eternity.jpg"},
    {"artist": "pusha t", "album": "daytona", "filename": "pusha-t-daytona.jpg"},
    {"artist": "red hot chili peppers", "album": "stadium arcadium", "filename": "red-hot-chili-peppers-stadium-arcadium.jpg"},
    {"artist": "rihanna", "album": "anti", "filename": "rihanna-anti.jpg"},
    {"artist": "run the jewels", "album": "run the jewels", "filename": "run-the-jewels.jpg"},
    {"artist": "run the jewels", "album": "run the jewels 3", "filename": "run-the-jewels-3.jpg"},
    {"artist": "say anything", "album": "...is a real boy", "filename": "say-anything-is-a-real-boy.jpg"},
    {"artist": "sigur rós", "album": "( )", "filename": "sigur-ros-parentheses.jpg"},
    {"artist": "sigur rós", "album": "takk...", "filename": "sigur-ros-takk.jpg"},
    {"artist": "something corporate", "album": "leaving through the window", "filename": "something-corporate-leaving-through-the-window.jpg"},
    {"artist": "sublime", "album": "sublime", "filename": "sublime-sublime.jpg"},
    {"artist": "sufjan stevens", "album": "carrie & lowell", "filename": "sufjan-stevens-carrie-lowell.jpg"},
    {"artist": "taking back sunday", "album": "tell all your friends", "filename": "taking-back-sunday-tell-all-your-friends.jpg"},
    {"artist": "taylor swift", "album": "1989", "filename": "taylor-swift-1989.jpg"},
    {"artist": "taylor swift", "album": "folklore", "filename": "taylor-swift-folklore.jpg"},
    {"artist": "taylor swift", "album": "evermore", "filename": "taylor-swift-evermore.jpg"},
    {"artist": "the 1975", "album": "a brief inquiry into online relationships", "filename": "the-1975-brief-inquiry.jpg"},
    {"artist": "the 1975", "album": "being funny in a foreign language", "filename": "the-1975-being-funny.jpg"},
    {"artist": "the beatles", "album": "revolver", "filename": "the-beatles-revolver.jpg"},
    {"artist": "the beatles", "album": "sgt. pepper's lonely hearts club band", "filename": "the-beatles-sgt-peppers.jpg"},
    {"artist": "the format", "album": "dog problems", "filename": "the-format-dog-problems.jpg"},
    {"artist": "the postal service", "album": "give up", "filename": "the-postal-service-give-up.jpg"},
    {"artist": "the shins", "album": "wincing the night away", "filename": "the-shins-wincing-the-night-away.jpg"},
    {"artist": "the streets", "album": "original pirate material", "filename": "the-streets-original-pirate-material.jpg"},
    {"artist": "the streets", "album": "a grand don't come for free", "filename": "the-streets-grand-dont-come-for-free.jpg"},
    {"artist": "the strokes", "album": "is this it", "filename": "the-strokes-is-this-it.jpg"},
    {"artist": "the weeknd", "album": "house of balloons", "filename": "the-weeknd-house-of-balloons.jpg"},
    {"artist": "the weeknd", "album": "starboy", "filename": "the-weeknd-starboy.jpg"},
    {"artist": "the xx", "album": "xx", "filename": "the-xx-xx.jpg"},
    {"artist": "third eye blind", "album": "third eye blind", "filename": "third-eye-blind-third-eye-blind.jpg"},
    {"artist": "tyler, the creator", "album": "call me if you get lost", "filename": "tyler-the-creator-call-me-if-you-get-lost.jpg"},
    {"artist": "vampire weekend", "album": "vampire weekend", "filename": "vampire-weekend-vampire-weekend.jpg"},
    {"artist": "vampire weekend", "album": "contra", "filename": "vampire-weekend-contra.jpg"},
    {"artist": "vampire weekend", "album": "modern vampires of the city", "filename": "vampire-weekend-modern-vampires.jpg"}
]

def download_album_cover(artist, album, filename, output_dir):
    """Download album cover using MusicBrainz Cover Art Archive"""
    
    try:
        search_query = f"{artist} {album}"
        search_url = f"https://musicbrainz.org/ws/2/release/?query={quote_plus(search_query)}&fmt=json&limit=1"
        
        print(f"Searching for: {artist} - {album}")
        
        search_response = requests.get(search_url, headers={'User-Agent': 'AlbumCoverDownloader/1.0'})
        if search_response.status_code != 200:
            print(f"  ❌ Failed to search: {search_response.status_code}")
            return False
            
        search_data = search_response.json()
        releases = search_data.get('releases', [])
        
        if not releases:
            print(f"  ❌ No releases found")
            return False
            
        release_id = releases[0]['id']
        cover_url = f"https://coverartarchive.org/release/{release_id}/front-500"
        
        cover_response = requests.get(cover_url, headers={'User-Agent': 'AlbumCoverDownloader/1.0'})
        if cover_response.status_code != 200:
            print(f"  ❌ No cover art: {cover_response.status_code}")
            return False
            
        img = Image.open(BytesIO(cover_response.content))
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
    os.makedirs(output_dir, exist_ok=True)
    
    print(f"🎵 Downloading {len(records)} album covers to {output_dir}/")
    print("-" * 60)
    
    successful = 0
    failed = 0
    
    for i, record in enumerate(records, 1):
        print(f"[{i}/{len(records)}]", end=" ")
        
        if download_album_cover(record["artist"], record["album"], record["filename"], output_dir):
            successful += 1
        else:
            failed += 1
            
        time.sleep(0.5)
    
    print("-" * 60)
    print(f"🎉 Complete! {successful} successful, {failed} failed")
    print(f"📁 Images saved in: {output_dir}/")

if __name__ == "__main__":
    main()