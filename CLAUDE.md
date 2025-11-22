# Charlie's Personal Homepage Project

## Project Overview
Building a live personal homepage that displays dynamic data about Charlie's current state - music, reading, weather, activity, and sleep data. Features a narrative paragraph with typewriter animation and interactive biography sections.

## Live URLs
- **Frontend**: charliekubal.com (hosted on Hostinger)
- **Backend API**: https://us-central1-ckubal-homepage-be.cloudfunctions.net/getSiteData
- **Firebase Project**: ckubal-homepage-be

## Architecture
- **Backend**: Firebase Cloud Functions (Node.js 20)
- **Database**: Firestore
- **Frontend**: Vanilla HTML/CSS/JS
- **Hosting**: Hostinger (charliekubal.com)
- **Deployment**: Manual upload to Hostinger by Charlie

## User Preferences
- **Typography**: Helvetica Neue, tight letter-spacing, all lowercase
- **Layout**: Two-column structure (title left, content right)
- **Icons**: Prefers minimal designs, currently using circle toggle for theme
- **Spacing**: Tight, minimal spacing throughout

## Current Status ✅ READY FOR DEPLOYMENT

### 🆕 LATEST SESSION ACHIEVEMENTS (November 22, 2024)
- **Enhanced Workout Descriptions**: Dramatically improved activity parsing for indoor cycling classes and Pilates
- **Detailed Strava Integration**: Backend now fetches detailed activity data including kilojoules for power metrics
- **Smart Activity Detection**: Intelligent parsing distinguishes indoor vs outdoor cycling, extracts instructor names and class types
- **Pilates Support**: Added proper duration-only formatting for Pilates activities (like weightlifting/yoga)
- **Peloton kJ Display**: Shows power output when available for enhanced workout context
- **File Version Updates**: Updated to 20241122b for cache busting

### Previous Session Achievements (September 8, 2025)
- **Mobile Album Grid Fix**: Fixed favorite albums displaying to the right of text instead of below on mobile
- **Swiper Race Condition Fix**: Added pageLoadTime tracking to prevent initialization issues within 10 seconds of page load
- **Watch the Throne Album Fix**: Implemented Spotify API-based album fetching for "Watch the Throne" - now displays correct artwork and link
- **Custom Favicon**: Created "ck" monogram favicon with site typography, black circle background, multiple sizes for browser compatibility
- **CSS Layout Improvements**: Fixed taste-content flex direction on mobile to force vertical stacking

### Mobile-Specific Improvements
- **Centered Layout**: Social icons, subtitle section, and all content properly centered
- **Swiper Reliability**: Removed effect switching, simplified to consistent loop-enabled carousels
- **Text Containment**: Increased card heights (260px albums/sneakers, 250px jerseys) with proper padding
- **Navigation Fixes**: Arrow keys working for Recent Faves and Last Five Years reading lists
- **Performance**: Eliminated layout-breaking horizontal overflow issues

### Core Features Working
- **APIs**: Weather, Spotify, Books, WHOOP sleep, Strava, Steps, Location - all integrated  
- **Narrative UI**: Mad Libs style "currently" section with typewriter animation
- **Interactive Biography**: work|create|think sections with clickable highlights  
- **Collections**: Loop-enabled Swiper carousels for records, shoes, jerseys
- **Responsive Design**: Optimized for desktop (coverflow effect) and mobile (centered single slides)
- **Theme Toggle**: Circle icon switches between light/dark mode

## Files Ready for Upload
Upload these files to charliekubal.com via Hostinger:
- **`index.html`** (v=20241122a) - Updated file versions for cache busting
- **`script.js`** (v=20241122b) - Enhanced workout descriptions with intelligent activity parsing
- **`styles.css`** (v=20241122a) - Updated file version for cache busting
- **`assets/favicon.svg`** - Custom "ck" monogram favicon (vector)
- **`assets/favicon-16x16.png`** - 16x16 favicon for browser tabs
- **`assets/favicon-32x32.png`** - 32x32 favicon for bookmarks  
- **`assets/apple-touch-icon.png`** - 180x180 for iOS home screen
- **`assets/circle-toggle.svg`** (theme toggle icon)

## Technical Details

### Key Technical Lessons Learned
- **Mobile Swiper Strategy**: Use JavaScript responsive breakpoints instead of CSS overrides for reliable behavior
- **"Hi, I'm Charlie" Rule**: ALWAYS two lines ("hi, i'm" / "charlie") - NEVER single line, enforced with `<br>` tag
- **Mobile Container Widths**: Use `calc(100vw - 20px)` and aggressive `overflow: hidden` to prevent horizontal scrolling
- **Typography Consistency**: Match heading sizes across sections with shared CSS classes
- **Empty State Handling**: Hide empty right column on mobile with `:empty` and `:has()` selectors

### Navigation Fixed
- **Recent/Last Five Years**: Arrow keys navigate individual book cards
- **This Year**: Arrow keys navigate paginated content
- **Annual Years (2024, etc.)**: Basic display working (navigation deprioritized)

### Theme Toggle Implementation
```css
/* Circle fills in light mode */
[data-theme="light"] .circle-fill { opacity: 1 !important; }
[data-theme="dark"] .circle-fill { opacity: 0 !important; }
```

### Mobile Optimization
- **768px breakpoint**: Enhanced reading navigation, centered layouts
- **480px breakpoint**: Smaller icons (16px), optimized touch targets (44px minimum)

## Commands to Remember
```bash
# Deploy backend changes
cd homepage-backend
firebase deploy --only functions

# Test main API
curl https://us-central1-ckubal-homepage-be.cloudfunctions.net/getSiteData
```

## GitHub Commit Guidelines
- NEVER include Claude Code references in commit messages
- NEVER include "Generated with Claude Code" signatures
- NEVER include "Co-Authored-By: Claude" attributions
- Keep commit messages clean and professional

## Enhanced Workout Activity Parsing

### New Intelligent Activity Detection
The system now intelligently parses workout activities with enhanced logic for indoor cycling classes and Pilates:

**SoulCycle Classes:**
- Input: `"FEEL GOOD FRIDAY with Zapporah"`
- Output: `"my last workout was a 45m feel good friday soulcycle class with zapporah yesterday"`

**Peloton Classes (with kJ data):**
- Input: `"Hip Hop Ride with Alex Toussaint"` + `kilojoules: 523`
- Output: `"my last workout was a 45m peloton hip hop ride with alex toussaint with 523kJ output yesterday"`

**Pilates Sessions:**
- Input: `"Pilates class"` or `activityType: "Pilates"`
- Output: `"my last workout was a 60 min pilates session yesterday"`

### Technical Implementation
- **Backend**: Enhanced Strava API calls to fetch detailed activity data including power metrics
- **Frontend**: Smart parsing extracts instructor names, class types, and distinguishes indoor vs outdoor activities
- **Duration-Only Activities**: Pilates follows weightlifting/yoga pattern (no distance display)
- **Graceful Fallback**: Works with both direct Strava API and RunMusic endpoint data

## Example Narrative Output
> "I'm currently in **San Francisco** where it's **67°** and **sunny**. I **slept pretty well** last night and I'm up to **2,275 steps** today. I **went for a 45m feel good friday soulcycle class with zapporah recently**. My current jam is **No Broke Boys by Disco Lines** and I'm currently reading **Playland by Andrew Carlin**."

Features:
- **Yellow highlighting** on data values only
- **Typewriter animation** with 40ms delay per character
- **Graceful failure** - missing data sections skipped
- **Travel detection** - shows "traveling in" for cities >100mi from SF
- **Enhanced workout descriptions** - intelligent parsing for indoor cycling and Pilates

---

*Last updated: November 22, 2024 - Enhanced Workout Activity Descriptions Session*