// api endpoint
const API_URL = 'https://us-central1-ckubal-homepage-be.cloudfunctions.net/getSiteData';

// dom elements
const narrativeParagraphEl = document.getElementById('narrative-paragraph');
const lastUpdatedEl = document.getElementById('last-updated');

// helpers
function formatTimestamp(timestamp) {
    if (!timestamp || !timestamp._seconds) return '';
    const date = new Date(timestamp._seconds * 1000);
    return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
}

function getTimeSince(timestamp) {
    if (!timestamp || !timestamp._seconds) return '';
    const now = new Date();
    const then = new Date(timestamp._seconds * 1000);
    const diffMs = now - then;
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    
    if (diffMinutes < 60) {
        return `${diffMinutes}m ago`;
    } else if (diffMinutes < 1440) { // 24 hours
        const hours = Math.floor(diffMinutes / 60);
        return `${hours}h ago`;
    } else {
        const days = Math.floor(diffMinutes / 1440);
        return `${days}d ago`;
    }
}

function mapSleepStatus(status, performance) {
    const statusMap = {
        'great': 'slept pretty well',
        'good': 'slept well',
        'okay': 'slept okay',
        'not the best': 'didn\'t sleep great'
    };
    
    return statusMap[status] || 'slept okay';
}

function getIndoorCyclingDescription(activityData, duration, formattedDistance) {
    const activity = activityData.activity.toLowerCase();
    const activityName = activityData.activity;
    
    // Helper function to extract instructor name
    function extractInstructor(name) {
        // Pattern: "CLASS NAME with INSTRUCTOR"
        const withMatch = name.match(/\bwith\s+([a-zA-Z]+)/i);
        if (withMatch) {
            return withMatch[1].toLowerCase();
        }
        
        // Pattern: "INSTRUCTOR's CLASS" or just instructor name at end
        const possessiveMatch = name.match(/\b([a-zA-Z]+)'s\b/i);
        if (possessiveMatch) {
            return possessiveMatch[1].toLowerCase();
        }
        
        // For SoulCycle: instructor name often appears after class type
        const soulCycleMatch = name.match(/\b(?:with\s+)?([a-zA-Z]+)$/i);
        if (activity.includes('soulcycle') && soulCycleMatch) {
            return soulCycleMatch[1].toLowerCase();
        }
        
        return null;
    }
    
    // Helper function to extract class type/theme  
    function extractClassType(name) {
        const original = name.trim();
        
        // Remove instructor pattern and clean up
        let cleaned = original.replace(/\bwith\s+[a-zA-Z]+$/i, '').trim();
        
        // For SoulCycle patterns like "FEEL GOOD FRIDAY with Zapporah"
        if (cleaned.toLowerCase().includes('feel good friday')) {
            return 'feel good friday';
        }
        
        // For Peloton patterns like "Hip Hop Ride" or "Pop Ride"
        if (cleaned.toLowerCase().includes('hip hop')) {
            return 'hip hop ride';
        }
        if (cleaned.toLowerCase().includes('pop ride')) {
            return 'pop ride';
        }
        if (cleaned.toLowerCase().includes('climb ride')) {
            return 'climb ride';
        }
        if (cleaned.toLowerCase().includes('intervals')) {
            return 'intervals ride';
        }
        
        // Generic patterns
        if (cleaned.toLowerCase().includes('ride')) {
            return cleaned.toLowerCase();
        }
        
        return cleaned.toLowerCase();
    }
    
    // Detect if it's indoor cycling (vs outdoor bike ride)
    const hasInstructorPattern = /\bwith\s+[a-zA-Z]+/i.test(activityName);
    const hasClassTypePattern = /\b(feel good|hip hop|pop|climb|intervals|spin|class)\b/i.test(activity);
    
    const isIndoor = activity.includes('soulcycle') || 
                    activity.includes('peloton') || 
                    activity.includes('spin') ||
                    parseFloat(formattedDistance) > 15 || // Unrealistic distance suggests indoor/estimated
                    (hasInstructorPattern && hasClassTypePattern); // Class with instructor = indoor
    
    if (!isIndoor) {
        // Outdoor bike ride
        return `${formattedDistance} bike ride`;
    }
    
    // Indoor cycling class
    const instructor = extractInstructor(activityName);
    const classType = extractClassType(activityName);
    
    // Build description based on platform
    const isSoulCycle = activity.includes('soulcycle') || 
                       (activity.includes('feel good friday') && hasInstructorPattern);
    
    if (isSoulCycle) {
        if (instructor && classType) {
            return `${duration} ${classType} soulcycle class with ${instructor}`;
        } else if (instructor) {
            return `${duration} soulcycle class with ${instructor}`;
        } else if (classType) {
            return `${duration} ${classType} soulcycle class`;
        } else {
            return `${duration} soulcycle class`;
        }
    } else if (activity.includes('peloton')) {
        let description = `${duration} peloton`;
        
        if (classType) {
            description = `${duration} peloton ${classType}`;
        }
        
        if (instructor) {
            description += ` with ${instructor}`;
        }
        
        // Add kJ output if available
        if (activityData.kilojoules) {
            description += ` with ${Math.round(activityData.kilojoules)}kJ output`;
        }
        
        return description;
    } else {
        // Generic indoor cycling
        if (instructor && classType) {
            return `${duration} ${classType} with ${instructor}`;
        } else if (instructor) {
            return `${duration} spin class with ${instructor}`;
        } else {
            return `${duration} indoor cycling class`;
        }
    }
}

function getWorkoutDescription(activityData) {
    if (!activityData || !activityData.activity || !activityData.date) {
        return null;
    }
    
    const activity = activityData.activity.toLowerCase();
    const activityType = activityData.type ? activityData.type.toLowerCase() : '';
    const distance = activityData.distance;
    const duration = activityData.duration;
    const timeAgo = getWorkoutTimeAgo(activityData.date);
    
    // build workout text
    let workoutType = '';
    
    // map activities to readable text
    // pull out the number from distance
    const distanceValue = parseFloat(distance);
    const distanceUnit = distance.replace(/[\d.]/g, '').trim();
    const formattedDistance = distanceUnit === 'miles' ? `${distanceValue} mile` : distance;
    
    // grab location if its there
    let locationText = '';
    
    // check for "in [location]" pattern
    const inMatch = activity.match(/\bin\s+(\w+)/);
    if (inMatch) {
        locationText = ` in ${inMatch[1]}`;
    } else {
        // look for location names
        const locationNames = ['mammoth', 'tahoe', 'sf', 'san francisco', 'la', 'los angeles', 'nyc', 'new york', 'brooklyn', 'manhattan'];
        for (const location of locationNames) {
            if (activity.includes(location)) {
                locationText = ` in ${location}`;
                break;
            }
        }
    }
    
    // prioritize strava activity type if available
    if (activityType === 'weighttraining') {
        const durationWithMin = duration.replace(/(\d+)m/, '$1 min');
        workoutType = `${durationWithMin} weightlifting session`;
    } else if (activityType === 'run') {
        workoutType = `${formattedDistance} run`;
    } else if (activityType === 'ride' || activityType === 'cycling') {
        // Enhanced logic for indoor cycling classes
        workoutType = getIndoorCyclingDescription(activityData, duration, formattedDistance);
    } else if (activityType === 'walk') {
        workoutType = `${formattedDistance} walk`;
    } else if (activityType === 'hike') {
        workoutType = `${formattedDistance} hike`;
    } else if (activityType === 'swim') {
        const durationWithMin = duration.replace(/(\d+)m/, '$1 min');
        workoutType = `${durationWithMin} swim`;
    } else if (activityType === 'yoga') {
        const durationWithMin = duration.replace(/(\d+)m/, '$1 min');
        workoutType = `${durationWithMin} yoga session`;
    } else if (activityType === 'pilates') {
        const durationWithMin = duration.replace(/(\d+)m/, '$1 min');
        workoutType = `${durationWithMin} pilates session`;
    } else if (activity.includes('run') || activity.includes('jog')) {
        workoutType = `${formattedDistance} run`;
    } else if (activity.includes('ride') || activity.includes('bike') || activity.includes('cycling') || 
               activity.includes('soulcycle') || activity.includes('spin') || activity.includes('peloton')) {
        // Enhanced logic for indoor cycling classes (fallback when type isn't set)
        workoutType = getIndoorCyclingDescription(activityData, duration, formattedDistance);
    } else if (activity.includes('tonal')) {
        const durationWithMin = duration.replace(/(\d+)m/, '$1 min');
        workoutType = `${durationWithMin} tonal session`;
    } else if (activity.includes('lift') || activity.includes('strength') || activity.includes('weight training') || activity.includes('weightlifting') || activity.includes('weight')) {
        const durationWithMin = duration.replace(/(\d+)m/, '$1 min');
        workoutType = `${durationWithMin} weightlifting session`;
    } else if (activity.includes('walk')) {
        workoutType = `${formattedDistance} walk`;
    } else if (activity.includes('hike') || activity.includes('mountain')) {
        workoutType = `${formattedDistance} hike`;
    } else if (activity.includes('yoga')) {
        const durationWithMin = duration.replace(/(\d+)m/, '$1 min');
        workoutType = `${durationWithMin} yoga session`;
    } else if (activity.includes('pilates')) {
        const durationWithMin = duration.replace(/(\d+)m/, '$1 min');
        workoutType = `${durationWithMin} pilates session`;
    } else if (activity.includes('swim')) {
        // use duration for swims since strava distance is often wrong
        const durationWithMin = duration.replace(/(\d+)m/, '$1 min');
        workoutType = `${durationWithMin} swim`;
    } else {
        workoutType = `${formattedDistance} ${activity}`;
    }
    
    return `my last workout was a ${workoutType}${locationText} ${timeAgo}`;
}

function getWorkoutTimeAgo(activityDate) {
    if (!activityDate) return 'a couple days ago';
    
    const activityTime = new Date(activityDate);
    const now = new Date();
    const diffMs = now - activityTime;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffDays === 0) {
        if (diffHours < 6) {
            return 'earlier today';
        } else {
            return 'today';
        }
    } else if (diffDays === 1) {
        return 'yesterday';
    } else if (diffDays === 2) {
        return 'a couple days ago';
    } else {
        return 'a couple days ago';
    }
}

function isLocationTravel(city, weather) {
    if (!city || !weather) return false;
    
    const cityLower = city.toLowerCase();
    
    // cities that mean i'm traveling from sf
    const travelCities = [
        'new york', 'nyc', 'manhattan', 'brooklyn',
        'los angeles', 'la', 'hollywood', 'santa monica',
        'chicago', 'austin', 'portland', 'seattle',
        'paris', 'london', 'tokyo', 'barcelona', 'amsterdam',
        'miami', 'denver', 'nashville', 'atlanta', 'boston'
    ];
    
    return travelCities.some(travelCity => cityLower.includes(travelCity));
}

function generateNarrative(data) {
    let narrative = "i'm ";
    
    // Extract values from Promise.allSettled format
    const currentSong = data.currentSong?.value || data.currentSong;
    const currentBook = data.currentBook?.value || data.currentBook;
    const activityData = data.activityData?.value || data.activityData;
    
    // debug - see what data we got
    console.log('Generating narrative with data:', {
        song: currentSong,
        book: currentBook
    });
    
    let hasContent = false;
    
    // Current book (first)
    if (currentBook && currentBook.title && currentBook.author) {
        const title = currentBook.title.toLowerCase();
        const author = currentBook.author.toLowerCase();
        const goodreadsSearchUrl = `https://www.goodreads.com/search?q=${encodeURIComponent(title + ' ' + author)}`;
        narrative += `<span class="narrative-link" data-target="favorite-reads">reading</span> <em>${title}</em> by ${author}`;
        console.log('BOOK ITALICS APPLIED:', `reading <em>${title}</em> by ${author}`);
        hasContent = true;
    }
    
    // Current song (second)
    if (currentSong && currentSong.title && currentSong.artist) {
        const title = currentSong.title.toLowerCase();
        const artist = currentSong.artist.toLowerCase();
        const spotifyUrl = currentSong.spotifyUrl || `https://open.spotify.com/search/${encodeURIComponent(title + ' ' + artist)}`;
        
        if (hasContent) {
            narrative += ` and my <span class="narrative-link" data-target="favorite-music">current jam</span> is ${title} by ${artist}`;
        } else {
            narrative += `listening to ${title} by ${artist}`;
            hasContent = true;
        }
    }
    
    if (hasContent) {
        narrative += ". ";
    }
    
    // Workout (last)
    if (activityData) {
        const workoutDesc = getWorkoutDescription(activityData);
        if (workoutDesc) {
            narrative += `${workoutDesc}.`;
        }
    }
    
    return narrative;
}

// Fetch and update data
async function fetchData() {
    try {
        console.log('Fetching data from:', API_URL);
        
        const response = await fetch(API_URL);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Received data:', data);
        
        updateUI(data);
        
    } catch (error) {
        console.error('Error fetching data:', error);
        console.log('Current hostname:', window.location.hostname);
        console.log('Current protocol:', window.location.protocol);
        
        // Always use sample data when API fails (for local testing)
        console.log('Using sample data for local testing');
        // Don't use sample data - let the real API load
    }
}

function typewriteText(element, htmlText, callback) {
    // Pre-calculate height to prevent layout shift
    const tempElement = element.cloneNode(true);
    tempElement.innerHTML = htmlText;
    tempElement.style.visibility = 'hidden';
    tempElement.style.position = 'absolute';
    tempElement.style.width = element.offsetWidth + 'px';
    element.parentNode.appendChild(tempElement);
    
    const finalHeight = tempElement.offsetHeight;
    element.parentNode.removeChild(tempElement);
    
    // Set min-height to prevent shifting
    element.style.minHeight = finalHeight + 'px';
    
    element.innerHTML = '';
    element.classList.remove('loading');
    element.classList.add('ready'); // Make visible before typing
    
    // Create a temporary element to parse HTML and extract plain text for timing
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlText;
    const plainText = tempDiv.textContent || tempDiv.innerText || '';
    
    let i = 0;
    const speed = 40; // Typing speed in milliseconds
    const pauseAfterSentence = 600; // Pause duration after sentences
    
    function typeChar() {
        if (i < plainText.length) {
            // Create a slice of the HTML that corresponds to the plain text position
            let charCount = 0;
            let htmlSlice = '';
            let htmlIndex = 0;
            
            while (charCount <= i && htmlIndex < htmlText.length) {
                const char = htmlText[htmlIndex];
                htmlSlice += char;
                
                if (char === '<') {
                    // Skip to end of tag
                    while (htmlIndex < htmlText.length && htmlText[htmlIndex] !== '>') {
                        htmlIndex++;
                        if (htmlIndex < htmlText.length) {
                            htmlSlice += htmlText[htmlIndex];
                        }
                    }
                } else if (char !== '>' && !char.match(/<|\s*>/)) {
                    // Only count visible characters
                    charCount++;
                }
                htmlIndex++;
            }
            
            element.innerHTML = htmlSlice + '<span class="typing-cursor">|</span>';
            
            // Check if we just typed a sentence-ending punctuation
            const currentChar = plainText[i];
            const isEndOfSentence = currentChar === '.' || currentChar === '!' || currentChar === '?';
            
            i++;
            
            if (isEndOfSentence && i < plainText.length) {
                // Pause at end of sentence with cursor blinking
                setTimeout(typeChar, pauseAfterSentence);
            } else {
                setTimeout(typeChar, speed);
            }
        } else {
            element.innerHTML = htmlText;
            if (callback) callback();
        }
    }
    
    typeChar();
}

function updateUI(data) {
    console.log('Updating UI with data:', data);
    
    // Store data globally for taste categories
    window.siteData = data;
    
    // setup lists with data from backend
    initializeLists(data);
    
    // Wait for data to be fully loaded before starting typewriter
    waitForDataAndStartTypewriter(data);
}

function isDataFullyLoaded(data) {
    // Check if we have at least one piece of meaningful data
    const hasBook = data.currentBook?.value || data.currentBook;
    const hasSong = data.currentSong?.value || data.currentSong;
    const hasActivity = data.activityData?.value || data.activityData;
    
    // We need at least one data point to show something meaningful
    return hasBook || hasSong || hasActivity;
}

function waitForDataAndStartTypewriter(data, startTime = Date.now()) {
    const maxWaitTime = 5000; // 5 seconds max
    const checkInterval = 100; // Check every 100ms
    
    console.log('Checking data ready:', {
        dataFullyLoaded: isDataFullyLoaded(data),
        timeWaited: Date.now() - startTime,
        hasNarrativeEl: !!narrativeParagraphEl,
        data: data
    });
    
    if (isDataFullyLoaded(data) || (Date.now() - startTime) > maxWaitTime) {
        // Data is ready or we've waited long enough
        console.log('Starting typewriter with data');
        const narrative = generateNarrative(data);
        console.log('Generated narrative:', narrative);
        typewriteText(narrativeParagraphEl, narrative, () => {
            // add click handlers after typing finishes
            const narrativeLinks = narrativeParagraphEl.querySelectorAll('.narrative-link');
            narrativeLinks.forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    const target = link.getAttribute('data-target');
                    const dynamicContent = document.getElementById('dynamic-content');
                    
                    if (dynamicContent) {
                        if (target === 'favorite-reads') {
                            // Set to this year view by default
                            currentReadList = 'thisYear';
                            showFavoriteReads(dynamicContent);
                            scrollToDynamicContentOnMobile();
                        } else if (target === 'favorite-music') {
                            showFavoriteMusic(dynamicContent);
                            scrollToDynamicContentOnMobile();
                        }
                    }
                });
            });
        });
    } else {
        // Keep waiting and checking
        setTimeout(() => {
            waitForDataAndStartTypewriter(data, startTime);
        }, checkInterval);
    }
    
    // Update favorite rappers from spreadsheet
    if (data.favoriteRappers) {
        const rappersContainer = document.getElementById('favorite-rappers');
        if (rappersContainer && data.favoriteRappers.length > 0) {
            rappersContainer.innerHTML = data.favoriteRappers
                .filter(rapper => rapper && rapper.trim() && rapper !== 'F') // Filter out empty values and 'F'
                .map((rapper, index) => `<p>${index + 1}. ${rapper.toLowerCase()}</p>`)
                .join('');
        }
    }
    
    // Update current favorite songs from Spotify playlist
    if (data.favoriteSongsCurrent) {
        const songsContainer = document.getElementById('favorite-songs-current');
        if (songsContainer && data.favoriteSongsCurrent.length > 0) {
            songsContainer.innerHTML = data.favoriteSongsCurrent
                .slice(0, 5) // Take only first 5 tracks
                .map(song => `<p>${song.title.toLowerCase()} - ${song.artist.toLowerCase()}</p>`)
                .join('');
        }
    }
    
    // Update all-time favorite songs from Spotify playlist
    if (data.favoriteSongsAllTime) {
        const songsContainer = document.getElementById('favorite-songs-alltime');
        if (songsContainer && data.favoriteSongsAllTime.length > 0) {
            songsContainer.innerHTML = data.favoriteSongsAllTime
                .slice(0, 10) // Take only first 10 tracks
                .map(song => `<p>${song.title.toLowerCase()} - ${song.artist.toLowerCase()}</p>`)
                .join('');
        }
    }
    

    // Update last updated time
    if (data.lastUpdated) {
        const timeAgo = getTimeSince(data.lastUpdated);
        lastUpdatedEl.textContent = `last updated ${timeAgo}`;
    }
    
    // refresh taste categories
    if (window.initializeTasteCategories) {
        // reload fresh data
        window.initializeTasteCategories();
    }
    
    // setup taste section if function exists
    if (window.displayRandomTasteList) {
        // start with music category
        window.displayRandomTasteList('taste-music');
    }
}

function showError() {
    narrativeParagraphEl.innerHTML = 'unable to load data - please try refreshing';
    lastUpdatedEl.textContent = 'connection error';
    
    // Remove loading classes
    document.querySelectorAll('.loading').forEach(el => {
        el.classList.remove('loading');
    });
}

// setup loading
function initializeLoading() {
    console.log('Initializing loading...', narrativeParagraphEl);
    if (narrativeParagraphEl) {
        narrativeParagraphEl.textContent = 'loading...';
        narrativeParagraphEl.classList.add('loading');
    } else {
        console.error('narrativeParagraphEl not found');
    }
}

// Experience item expand/collapse functionality
function initializeExperienceItems() {
    const experienceNames = document.querySelectorAll('.experience-name-inline');
    const experienceDetails = document.querySelectorAll('.experience-detail-item');
    
    experienceNames.forEach(name => {
        name.addEventListener('click', () => {
            const target = name.getAttribute('data-target');
            const targetDetail = document.getElementById(`detail-${target}`);
            
            // Update active states for names
            experienceNames.forEach(n => {
                n.classList.remove('active');
                n.classList.add('inactive');
            });
            experienceDetails.forEach(d => d.classList.remove('active'));
            
            // Add active state to clicked name and corresponding detail
            name.classList.remove('inactive');
            name.classList.add('active');
            if (targetDetail) {
                targetDetail.classList.add('active');
            }
        });
    });
}

// Play category functionality
function initializePlayCategories() {
    const playCategories = document.querySelectorAll('.play-category-inline');
    const playDetails = document.querySelectorAll('.play-detail-item');
    
    playCategories.forEach(category => {
        category.addEventListener('click', () => {
            const target = category.getAttribute('data-target');
            const targetDetail = document.getElementById(`detail-${target}`);
            
            // Update active states for categories
            playCategories.forEach(c => {
                c.classList.remove('active');
                c.classList.add('inactive');
            });
            playDetails.forEach(d => d.classList.remove('active'));
            
            // Add active state to clicked category and corresponding detail
            category.classList.remove('inactive');
            category.classList.add('active');
            if (targetDetail) {
                targetDetail.classList.add('active');
            }
        });
    });
}

// Investment links functionality
function initializeInvestmentLinks() {
    const investmentLinks = document.querySelectorAll('.investment-link');
    
    investmentLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Update active states for investment links
            investmentLinks.forEach(l => {
                l.classList.remove('active');
                l.classList.add('inactive');
            });
            
            // Add active state to clicked link
            link.classList.remove('inactive');
            link.classList.add('active');
            
            // Open link in new tab after brief delay for visual feedback
            setTimeout(() => {
                window.open(link.href, '_blank', 'noopener');
            }, 100);
        });
    });
}

// Taste category functionality with random selection
function initializeTasteCategories() {
    const tasteCategories = document.querySelectorAll('.taste-category-inline');
    const tasteDetails = document.querySelectorAll('.taste-detail-item');
    
    // Define taste lists - music and podcasts will be loaded from backend, others are placeholders
    let tasteLists = {
        'taste-music': [], // Will be populated from backend data
        'taste-books': [
            { title: 'coming soon', items: ['building reading lists...'] }
        ],
        'taste-podcasts': [], // Will be populated from backend podcast data
        'taste-art': [
            { title: 'coming soon', items: ['building art collections...'] }
        ]
    };
    
    // Load real music lists from backend if available
    if (window.siteData && window.siteData.tasteMusicLists) {
        tasteLists['taste-music'] = window.siteData.tasteMusicLists;
        console.log('Loaded taste music lists:', window.siteData.tasteMusicLists);
    }
    
    // Load real podcast episodes from backend if available
    if (window.siteData && window.siteData.podcastEpisodes) {
        tasteLists['taste-podcasts'] = [
            { 
                title: 'favorite episodes', 
                items: window.siteData.podcastEpisodes,
                type: 'podcast',
                playlistUrl: window.siteData.podcastPlaylistUrl
            }
        ];
        console.log('Loaded podcast episodes:', window.siteData.podcastEpisodes);
    }
    
    // taste category clicks
    tasteCategories.forEach(category => {
        category.addEventListener('click', () => {
            const target = category.getAttribute('data-target');
            const targetDetail = document.getElementById(`detail-${target}`);
            
            // Remove active state from all categories and details
            tasteCategories.forEach(c => c.classList.remove('active'));
            tasteDetails.forEach(d => d.classList.remove('active'));
            
            // Add active state to clicked category and corresponding detail
            category.classList.add('active');
            if (targetDetail) {
                targetDetail.classList.add('active');
            }
            
            // load content for selected category
            displayRandomTasteList(target);
        });
    });
    
    // shuffle button clicks
    Object.keys(tasteLists).forEach(category => {
        const shuffleBtn = document.getElementById(`${category}-shuffle-btn`);
        if (shuffleBtn) {
            shuffleBtn.addEventListener('click', () => {
                displayRandomTasteList(category);
            });
        }
    });
    
    function displayRandomTasteList(category) {
        const lists = (window.tasteLists && window.tasteLists[category]) || tasteLists[category];
        if (!lists || lists.length === 0) return;
        
        // Get a random list from this category
        const randomList = lists[Math.floor(Math.random() * lists.length)];
        const titleEl = document.getElementById(`current-${category}-title`);
        const listEl = document.getElementById(`current-${category}-list`);
        
        if (titleEl) titleEl.textContent = randomList.title;
        
        if (listEl && randomList.items) {
            let listHTML = '';
            
            // podcasts are different
            if (randomList.type === 'podcast' && randomList.items.length > 0) {
                // Add the pithy intro text
                listHTML += `<p style="font-style: italic; color: #aaaaaa; margin-bottom: 20px;">the single best episode of an okay podcast is always better than a random episode from a great podcast series.</p>`;
                
                // Pick a random episode
                const randomEpisode = randomList.items[Math.floor(Math.random() * randomList.items.length)];
                
                listHTML += `
                    <div style="margin-bottom: 20px;">
                        <h4 style="margin-bottom: 8px; font-size: 1rem; color: #ffffff;">${randomEpisode.show}</h4>
                        <p style="margin-bottom: 6px; font-size: 1.1rem; font-weight: 600;"><a href="${randomEpisode.url}" target="_blank" rel="noopener" style="color: #ffffff; text-decoration: underline; text-underline-offset: 2px;">${randomEpisode.name}</a></p>
                        <p style="margin-bottom: 10px; font-size: 0.9rem; color: #888888;">${formatDurationFromMs(randomEpisode.duration)} • ${formatDateFromString(randomEpisode.releaseDate)}</p>
                        <p style="font-size: 0.95rem; color: #cccccc; line-height: 1.4;">${randomEpisode.synopsis}</p>
                    </div>
                `;
                
                // Add playlist link
                if (randomList.playlistUrl) {
                    listHTML += `<p><a href="${randomList.playlistUrl}" target="_blank" rel="noopener" style="color: #ffffff; text-decoration: underline; text-underline-offset: 2px;">→ view full playlist of favorite episodes</a></p>`;
                }
            } else {
                // regular lists (music, books, art)
                listHTML = randomList.items
                    .map((item, index) => `<p>${index + 1}. ${item}</p>`)
                    .join('');
                
                // Add playlist link if available
                if (randomList.playlistUrl) {
                    listHTML += `<p style="margin-top: 15px;"><a href="${randomList.playlistUrl}" target="_blank" rel="noopener" style="color: #ffffff; text-decoration: underline; text-underline-offset: 2px;">→ open playlist</a></p>`;
                }
            }
            
            listEl.innerHTML = listHTML;
        }
    }
    
    function formatDurationFromMs(durationMs) {
        const totalSeconds = Math.floor(durationMs / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else {
            return `${minutes}m`;
        }
    }
    
    function formatDateFromString(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric', 
            year: 'numeric' 
        });
    }
    
    // Store function and data globally for use after data loads
    window.displayRandomTasteList = displayRandomTasteList;
    window.tasteLists = tasteLists;
}



// Combined button functionality for play and taste sections
function initializeExpandButtons() {
    const buttons = document.querySelectorAll('.play-category-btn');
    console.log('Found buttons:', buttons.length);
    
    buttons.forEach(button => {
        button.addEventListener('click', () => {
            const category = button.getAttribute('data-category');
            const detailsContainer = document.getElementById(`${category}-details`);
            
            console.log('Button clicked:', category, 'Container found:', !!detailsContainer);
            
            if (detailsContainer) {
                const isHidden = detailsContainer.style.display === 'none' || window.getComputedStyle(detailsContainer).display === 'none';
                detailsContainer.style.display = isHidden ? 'block' : 'none';
            }
        });
    });
}

// Collection toggle functionality
function initializeCollectionToggle() {
    const toggleLinks = document.querySelectorAll('.collection-toggle-link');
    const collectionViews = document.querySelectorAll('.collection-view');
    
    console.log('Found toggle links:', toggleLinks.length);
    
    toggleLinks.forEach(link => {
        link.addEventListener('click', () => {
            const targetCollection = link.getAttribute('data-collection');
            console.log('Clicked collection toggle:', targetCollection);
            
            // Update active states for toggle links
            toggleLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            
            // Update active states for collection views
            collectionViews.forEach(view => view.classList.remove('active'));
            const targetView = document.getElementById(`${targetCollection}-view`);
            console.log('Target view found:', targetView);
            
            if (targetView) {
                targetView.classList.add('active');
                console.log('Made view active:', targetCollection);
                
                // setup records when switching
                if (targetCollection === 'records') {
                    console.log('Initializing records after click...');
                    setTimeout(() => {
                        initializeRecordCollection();
                    }, 100);
                }
            }
        });
    });
}

// Crystal Quest Easter Egg - Konami Code - Temporarily Commented Out
/*
function initializeCrystalQuest() {
    const konamiCode = [
        'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
        'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight',
        'KeyB', 'KeyA'
    ];
    
    let konamiProgress = 0;
    let lastKeyTime = 0;
    const timeoutMs = 1000; // Reset if more than 1 second between keys
    
    const modal = document.getElementById('crystal-quest-modal');
    const closeBtn = document.querySelector('.crystal-close');
    const gameFrame = document.getElementById('crystal-game-frame');
    
    // Listen for keydown events
    document.addEventListener('keydown', (e) => {
        const currentTime = Date.now();
        
        // Reset if too much time passed between keys
        if (currentTime - lastKeyTime > timeoutMs) {
            konamiProgress = 0;
        }
        
        // Check if the current key matches the expected key in sequence
        if (e.code === konamiCode[konamiProgress]) {
            konamiProgress++;
            lastKeyTime = currentTime;
            
            // Complete sequence entered!
            if (konamiProgress === konamiCode.length) {
                e.preventDefault();
                showCrystalQuest();
                konamiProgress = 0; // Reset for next time
            }
        } else {
            konamiProgress = 0; // Reset on wrong key
        }
    });
    
    function showCrystalQuest() {
        modal.style.display = 'block';
        // Reload iframe to start fresh each time
        gameFrame.src = gameFrame.src;
    }
    
    function hideCrystalQuest() {
        modal.style.display = 'none';
        // Clear iframe to stop game
        gameFrame.src = 'about:blank';
    }
    
    // close button
    closeBtn.addEventListener('click', hideCrystalQuest);
    
    // Close on background click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            hideCrystalQuest();
        }
    });
    
    // Close on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.style.display === 'block') {
            hideCrystalQuest();
        }
    });
}
*/

// Shoe collection data
const shoeCollection = [
    { brand: "a ma maniére x wmns", name: "air jordan 3 retro", colorway: "while you were sleeping", image: "01-a-ma-maniere-jordan-3-while-you-were-sleeping.jpg" },
    { brand: "nike", name: "air deldon 1", colorway: "be true", image: "02-nike-air-deldon-1-be-true.jpg" },
    { brand: "nike", name: "jordan 4", colorway: "white thunder", image: "03-nike-jordan-4-white-thunder.jpg" },
    { brand: "nike", name: "jordan 3", colorway: "black cat 2025", image: "04-nike-jordan-3-black-cat-2025.jpg" },
    { brand: "nike", name: "pegasus 89 golf", colorway: "phoenix open", image: "05-nike-pegasus-89-golf-phoenix-open.jpg" },
    { brand: "jordan", name: "spizike low", colorway: "houston oilers", image: "06-jordan-spizike-low-houston-oilers.jpg" },
    { brand: "cdg play x converse", name: "chuck 70", colorway: "black", image: "07-cdg-play-converse-chuck-70-black.jpg" },
    { brand: "nike", name: "jordan 3", colorway: "fear 2023", image: "08-nike-jordan-3-fear-2023.jpg" },
    // Position 09: Nike Wmns Air Max 270 Triple Black (removed)
    { brand: "nike", name: "lebron 9", colorway: "watch the throne", image: "10-nike-lebron-9-watch-the-throne.jpg" },
    { brand: "nike", name: "air zoom gt jump 2", colorway: "white black", image: "11-nike-air-zoom-gt-jump-2-white-black.jpg" },
    { brand: "off-white x nike", name: "af1 mid", colorway: "black", image: "12-off-white-nike-af1-mid-black.jpg" },
    { brand: "nike", name: "wmns jordan 1 mid", colorway: "black white", image: "13-nike-wmns-jordan-1-mid-black-white.jpg" },
    { brand: "nike", name: "dunk low", colorway: "black white", image: "14-nike-dunk-low-black-white.jpg" },
    { brand: "nike", name: "jordan 4 11lab4", colorway: "black", image: "15-nike-jordan-4-11lab4-black.jpg" },
    { brand: "jordan", name: "proto max 720", colorway: "gold gum", image: "16-jordan-proto-max-720-gold-gum.jpg" },
    // Position 17: Adidas Stan Smith Silver Metallic (removed)
    { brand: "nike", name: "sf air force 1 high", colorway: "sage", image: "18-nike-sf-air-force-1-high-sage.jpg" },
    { brand: "reebok", name: "question low patent", colorway: "vivid orange", image: "19-reebok-question-low-patent-vivid-orange.jpg" },
    { brand: "nike", name: "air max 270 react", colorway: "multi-color", image: "20-nike-air-max-270-react-multi-color.jpg" },
    // Position 21: Nike Jordan Maxin 200 Royal Volt (removed)
    { brand: "reebok", name: "pump omni zone 2", colorway: "dee brown", image: "22-reebok-pump-omni-zone-2-dee-brown.jpg" },
    { brand: "nike", name: "shox gravity", colorway: "grand purple", image: "23-nike-shox-gravity-grand-purple.jpg" },
    { brand: "nike", name: "jordan air max 200", colorway: "challenge red", image: "24-nike-jordan-air-max-200-challenge-red.jpg" },
    // Position 25: Nike Wmns Air Jordan 1 Low Triple White (removed)
    { brand: "nike", name: "air jordan 1 mid se", colorway: "cyber fuchsia", image: "26-nike-air-jordan-1-mid-se-cyber-fuchsia.jpg" },
    { brand: "nike", name: "sf air force 1 mid", colorway: "team orange", image: "27-nike-sf-air-force-1-mid-team-orange.jpg" },
    { brand: "nike", name: "air max 97", colorway: "olympic gold", image: "28-nike-air-max-97-olympic-gold.jpg" },
    // Position 29: Nike Air Fear Of God Moc Black (removed)
    { brand: "nike", name: "air max 97", colorway: "bright citron", image: "30-nike-air-max-97-bright-citron.jpg" },
    { brand: "nike", name: "blazer mid 77 vintage", colorway: "white black", image: "31-nike-blazer-mid-77-vintage-white-black.jpg" },
    { brand: "nike", name: "shox gravity", colorway: "metallic silver", image: "32-nike-shox-gravity-metallic-silver.jpg" },
    { brand: "nike", name: "air max 720 saturn qs", colorway: "all star motorsport", image: "33-nike-air-max-720-saturn-qs-all-star-motorsport.jpg" },
    { brand: "nike", name: "air jordan 1 retro high og", colorway: "black gym red", image: "34-nike-air-jordan-1-retro-high-og-black-gym-red.jpg" },
    { brand: "nike", name: "air max 720 saturn", colorway: "white", image: "35-nike-air-max-720-saturn-white.jpg" },
    { brand: "nike", name: "air jordan 3 retro tinker sp", colorway: "black cement", image: "36-nike-air-jordan-3-retro-tinker-sp-black-cement.jpg" },
    { brand: "just don x jordan", name: "legacy 312", colorway: "billy hoyle", image: "37-just-don-jordan-legacy-312-billy-hoyle.jpg" },
    { brand: "nike", name: "air force 1 07 qs", colorway: "velvet rose", image: "38-nike-air-force-1-07-qs-velvet-rose.jpg" },
    { brand: "nike", name: "air jordan 1 retro high og", colorway: "city of flight", image: "39-nike-air-jordan-1-retro-high-og-city-of-flight.jpg" },
    { brand: "nike", name: "air jordan 4 retro", colorway: "motorsports", image: "40-nike-air-jordan-4-retro-motorsports.jpg" }
];

// Jersey Collection Data
const jerseyCollection = [
    { team: "76ers", player: "allen iverson", number: "3", year: "2000-01", image: "ai.jpg" },
    { team: "timberwolves", player: "anthony edwards", number: "5", year: "2023-24", image: "ant.jpg" },
    { team: "knicks", player: "jalen brunson", number: "11", year: "2023-24", image: "brunson.jpg" },
    { team: "trailblazers", player: "damian lillard", number: "0", year: "2022-23", image: "dame.jpg" },
    { team: "clippers", player: "darius miles", number: "21", year: "2002-03", image: "darius.jpg" },
    { team: "49ers", player: "deion sanders", number: "21", year: "1995", image: "deion.jpg" },
    { team: "duke", player: "cooper flagg", number: "2", year: "2024-25", image: "flagg.jpg" },
    { team: "bucks", player: "giannis antetokounmpo", number: "34", year: "2023-24", image: "giannis.jpg" },
    { team: "warriors", player: "gary payton ii", number: "0", year: "2021-22", image: "gp2.jpg" },
    { team: "grizzlies", player: "ja morant", number: "12", year: "2023-24", image: "ja.jpg" },
    { team: "suns", player: "kevin johnson", number: "7", year: "1992-93", image: "kj.jpg" },
    { team: "lakers", player: "kobe bryant", number: "8", year: "1996-97", image: "kobe.jpg" },
    { team: "mavericks", player: "luka dončić", number: "77", year: "2023-24", image: "luka.jpg" },
    { team: "hornets", player: "muggsy bogues", number: "1", year: "1993-94", image: "mugsy.jpg" },
    { team: "nuggets", player: "dikembe mutombo", number: "55", year: "1996-97", image: "mutombo.jpg" },
    { team: "magic", player: "penny hardaway", number: "1", year: "1993-94", image: "penny.jpg" },
    { team: "duke", player: "jj redick", number: "4", year: "2004-05", image: "redick.jpg" },
    { team: "pistons", player: "dennis rodman", number: "10", year: "1988-89", image: "rodmanpistons.jpg" },
    { team: "jazz", player: "donovan mitchell", number: "45", year: "2021-22", image: "spida.jpg" },
    { team: "spurs", player: "victor wembanyama", number: "1", year: "2023-24", image: "wemby.jpg" },
    { team: "ucla", player: "russell westbrook", number: "0", year: "2006-07", image: "westbrook.jpg" },
    { team: "giants", player: "will clark", number: "22", year: "1989", image: "willclark.jpg" },
    { team: "pelicans", player: "zion williamson", number: "1", year: "2023-24", image: "zion.jpg" }
];

// Original Shoe collection functionality (preserved for easy revert)
/*
function initializeShoeCollectionOriginal() {
    const carousel = document.getElementById('shoe-carousel');
    const nextBtn = document.getElementById('collection-next-btn');
    
    if (!carousel) return;
    
    let currentIndex = 0;
    
    function displayShoe(index) {
        const shoe = shoeCollection[index];
        
        carousel.innerHTML = `
            <div class="shoe-item">
                <img src="assets/shoes/${shoe.image}" alt="${shoe.name}" class="shoe-image" />
                <div class="shoe-brand">${shoe.brand}</div>
                <div class="shoe-name">${shoe.name}</div>
                <div class="shoe-colorway">'${shoe.colorway}'</div>
            </div>
        `;
    }
    
    // start with a ma maniere
    displayShoe(0);
    
    // nav buttons
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            currentIndex = (currentIndex + 1) % shoeCollection.length;
            displayShoe(currentIndex);
        });
    }
    
    const prevBtn = document.getElementById('collection-prev-shoe-btn');
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            currentIndex = (currentIndex - 1 + shoeCollection.length) % shoeCollection.length;
            displayShoe(currentIndex);
        });
    }
}
*/

// NEW: Shoe collection functionality with Swiper (TEST VERSION)
let shoeCollectionInitialized = false;

function initializeShoeCollection(carouselId = 'shoe-carousel') {
    // Only skip if static shoe carousel already initialized
    if (shoeCollectionInitialized && carouselId === 'shoe-carousel') return;
    
    // Reset flag for dynamic carousels to allow reinitialization
    if (carouselId !== 'shoe-carousel') {
        shoeCollectionInitialized = false;
    }
    
    const shoeCarousel = document.getElementById(carouselId);
    
    console.log('Shoe collection elements:', { shoeCarousel });
    
    if (!shoeCarousel) {
        console.log('Missing shoe collection elements, skipping initialization');
        return;
    }
    
    // Destroy existing swiper if it exists
    if (window.currentShoeSwiper) {
        try {
            window.currentShoeSwiper.destroy(true, true);
            window.currentShoeSwiper = null;
        } catch (e) {
            console.log('Error destroying previous shoe swiper:', e);
        }
    }
    
    shoeCollectionInitialized = true;
    console.log('Initializing shoe collection with Swiper...');
    
    // Generate Swiper slides for all shoes
    const shoeHTML = shoeCollection.map(shoe => `
        <div class="swiper-slide">
            <img src="assets/shoes/${shoe.image}" alt="${shoe.name}" class="shoe-image" />
            <div class="shoe-brand">${shoe.brand}</div>
            <div class="shoe-name">${shoe.name}</div>
            <div class="shoe-colorway">'${shoe.colorway}'</div>
        </div>
    `).join('');
    
    shoeCarousel.innerHTML = shoeHTML;
    
    // wait a bit for dom then setup swiper
    setTimeout(() => {
        console.log('Attempting to initialize shoe Swiper...');
        const swiperElement = document.querySelector('.shoe-swiper');
        console.log('Shoe Swiper element found:', !!swiperElement);
        console.log('Shoe slides found:', shoeCarousel.children.length);
        
        if (typeof Swiper === 'undefined') {
            console.error('Swiper library not loaded');
            return;
        }
        
        const randomIndex = Math.floor(Math.random() * shoeCollection.length);
        
        const shoeSwiper = window.currentShoeSwiper = new Swiper('.shoe-swiper', {
            effect: 'coverflow',
            grabCursor: true,
            centeredSlides: true,
            slidesPerView: 1.4,
            initialSlide: randomIndex,
            loop: true,
            loopAdditionalSlides: 3,
            keyboard: {
                enabled: true,
                onlyInViewport: true,
            },
            autoplay: {
                delay: 2000,
                disableOnInteraction: false,
            },
            speed: 2000,
            coverflowEffect: {
                rotate: 35,
                stretch: -20,
                depth: 200,
                modifier: 1,
                slideShadows: true,
            },
            // Force initialization and proper loading
            observer: true,
            observeParents: true,
            observeSlideChildren: true,
            updateOnImagesReady: true,
            preloadImages: false,
            lazy: {
                loadPrevNext: true,
            },
            watchOverflow: true,
            breakpoints: {
                // Mobile: optimized for shoes
                320: {
                    slidesPerView: 1.15,
                    spaceBetween: 15,
                    centeredSlides: true,
                    effect: 'slide', // Simpler effect for mobile
                    loop: true,
                },
                // Desktop: coverflow effect  
                769: {
                    slidesPerView: 1.4,
                    spaceBetween: 0,
                    coverflowEffect: {
                        rotate: 35,
                        stretch: -20,
                        depth: 200,
                        modifier: 1,
                        slideShadows: true,
                    },
                }
            },
            navigation: {
                nextEl: '.shoe-swiper .swiper-button-next',
                prevEl: '.shoe-swiper .swiper-button-prev',
            },
            on: {
                init: function () {
                    console.log('Shoe Swiper initialized successfully on slide:', randomIndex);
                    // Force update after initialization to ensure proper mobile centering
                    setTimeout(() => {
                        this.update();
                        this.updateSlides();
                        this.slideTo(this.activeIndex, 0);
                    }, 50);
                },
                slideChange: function () {
                    console.log('Shoe slide changed to:', this.activeIndex);
                },
                resize: function() {
                    this.update();
                    this.updateSlides();
                }
            }
        });
        
        console.log('Shoe Swiper created:', shoeSwiper);
    }, 500);
    
    console.log('Shoe collection Swiper initialization complete');
}

// Jersey collection functionality with Swiper
let jerseyCollectionInitialized = false;

function initializeJerseyCollection(carouselId = 'jersey-carousel') {
    // Only skip if static jersey carousel already initialized
    if (jerseyCollectionInitialized && carouselId === 'jersey-carousel') return;
    
    // Reset flag for dynamic carousels to allow reinitialization
    if (carouselId !== 'jersey-carousel') {
        jerseyCollectionInitialized = false;
    }
    
    const jerseyCarousel = document.getElementById(carouselId);
    
    console.log('Jersey collection elements:', { jerseyCarousel });
    
    if (!jerseyCarousel) {
        console.log('Missing jersey collection elements, skipping initialization');
        return;
    }
    
    // Destroy existing swiper if it exists
    if (window.currentJerseySwiper) {
        try {
            window.currentJerseySwiper.destroy(true, true);
            window.currentJerseySwiper = null;
        } catch (e) {
            console.log('Error destroying previous jersey swiper:', e);
        }
    }
    
    jerseyCollectionInitialized = true;
    console.log('Initializing jersey collection with Swiper...');
    
    // Generate Swiper slides for all jerseys
    const jerseyHTML = jerseyCollection.map(jersey => `
        <div class="swiper-slide">
            <img src="assets/jerseys/${jersey.image}" alt="${jersey.player} ${jersey.team}" class="jersey-image" />
            <div class="jersey-team">${jersey.team}</div>
            <div class="jersey-player">${jersey.player}</div>
            <div class="jersey-number">#${jersey.number}</div>
        </div>
    `).join('');
    
    jerseyCarousel.innerHTML = jerseyHTML;
    
    // wait a bit for dom then setup swiper
    setTimeout(() => {
        console.log('Attempting to initialize jersey Swiper...');
        const swiperElement = document.querySelector('.jersey-swiper');
        console.log('Jersey Swiper element found:', !!swiperElement);
        console.log('Jersey slides found:', jerseyCarousel.children.length);
        
        if (typeof Swiper === 'undefined') {
            console.error('Swiper library not loaded');
            return;
        }
        
        const randomIndex = Math.floor(Math.random() * jerseyCollection.length);
        
        const jerseySwiper = window.currentJerseySwiper = new Swiper('.jersey-swiper', {
            effect: 'coverflow',
            grabCursor: true,
            centeredSlides: true,
            slidesPerView: 1.4,
            initialSlide: randomIndex,
            loop: true,
            loopAdditionalSlides: 3,
            keyboard: {
                enabled: true,
                onlyInViewport: true,
            },
            autoplay: {
                delay: 2000,
                disableOnInteraction: false,
            },
            speed: 2000,
            coverflowEffect: {
                rotate: 35,
                stretch: -20,
                depth: 200,
                modifier: 1,
                slideShadows: true,
            },
            // Force initialization and proper loading
            observer: true,
            observeParents: true,
            observeSlideChildren: true,
            updateOnImagesReady: true,
            preloadImages: false,
            lazy: {
                loadPrevNext: true,
            },
            watchOverflow: true,
            breakpoints: {
                // Mobile: optimized for jerseys  
                320: {
                    slidesPerView: 1.1,
                    spaceBetween: 10,
                    centeredSlides: true,
                    effect: 'slide', // Simpler effect for mobile
                    loop: true,
                },
                // Desktop: coverflow effect  
                769: {
                    slidesPerView: 1.4,
                    spaceBetween: 0,
                    coverflowEffect: {
                        rotate: 35,
                        stretch: -20,
                        depth: 200,
                        modifier: 1,
                        slideShadows: true,
                    },
                }
            },
            navigation: {
                nextEl: '.jersey-swiper .swiper-button-next',
                prevEl: '.jersey-swiper .swiper-button-prev',
            },
            on: {
                init: function () {
                    console.log('Jersey Swiper initialized successfully on slide:', randomIndex);
                    // Force update after initialization to ensure proper mobile centering
                    setTimeout(() => {
                        this.update();
                        this.updateSlides();
                        this.slideTo(this.activeIndex, 0);
                    }, 50);
                },
                slideChange: function () {
                    console.log('Jersey slide changed to:', this.activeIndex);
                },
                resize: function() {
                    this.update();
                    this.updateSlides();
                }
            }
        });
        
        console.log('Jersey Swiper created:', jerseySwiper);
    }, 500);
    
    console.log('Jersey collection Swiper initialization complete');
}

// Record collection data - organized alphabetically by artist, chronologically by release year
const recordCollection = [
    { artist: "the 1975", album: "a brief inquiry into online relationships", year: 2018, cover: "the-1975-brief-inquiry.jpg" },
    { artist: "the 1975", album: "being funny in a foreign language", year: 2022, cover: "the-1975-being-funny.jpg" },
    { artist: "100 gecs", album: "1000 gecs", year: 2020, cover: "100-gecs-1000-gecs.jpg" },
    { artist: "2 chainz", album: "pretty girls like trap music", year: 2017, cover: "2-chainz-pretty-girls-like-trap-music.jpg" },
    { artist: "2pac", album: "greatest hits", year: 1998, cover: "2pac-greatest-hits.jpg" },
    { artist: "50 cent", album: "get rich or die tryin'", year: 2003, cover: "50-cent-get-rich-or-die-tryin.jpg" },
    { artist: "amy winehouse", album: "back to black", year: 2006, cover: "amy-winehouse-back-to-black.jpg" },
    { artist: "andrew bird", album: "armchair apocrypha", year: 2007, cover: "andrew-bird-armchair-apocrypha.jpg" },
    { artist: "andrew bird", album: "the mysterious production of eggs", year: 2005, cover: "andrew-bird-mysterious-production-of-eggs.jpg" },
    { artist: "asap rocky", album: "long.live.a$ap", year: 2013, cover: "asap-rocky-long-live-asap.jpg" },
    { artist: "atmosphere", album: "god loves ugly", year: 2002, cover: "atmosphere-god-loves-ugly.jpg" },
    { artist: "atmosphere", album: "seven's travels", year: 2003, cover: "atmosphere-sevens-travels.jpg" },
    { artist: "atmosphere", album: "when life gives you lemons, you paint that shit gold", year: 2008, cover: "atmosphere-when-life-gives-you-lemons.jpg" },
    { artist: "a tribe called quest", album: "people's instinctive travels and the paths of rhythm", year: 1990, cover: "a-tribe-called-quest-peoples-instinctive-travels.jpg" },
    { artist: "baby keem", album: "the melodic blue", year: 2021, cover: "baby-keem-melodic-blue.jpg" },
    { artist: "the beatles", album: "revolver", year: 1966, cover: "the-beatles-revolver.jpg" },
    { artist: "the beatles", album: "sgt. pepper's lonely hearts club band", year: 1967, cover: "the-beatles-sgt-peppers.jpg" },
    { artist: "belle & sebastian", album: "fold your hands child, you walk like a peasant", year: 2000, cover: "belle-sebastian-fold-your-hands.jpg" },
    { artist: "belle & sebastian", album: "dear catastrophe waitress", year: 2003, cover: "belle-sebastian-dear-catastrophe-waitress.jpg" },
    { artist: "belle & sebastian", album: "the life pursuit", year: 2006, cover: "belle-sebastian-life-pursuit.jpg" },
    { artist: "beyoncé", album: "lemonade", year: 2016, cover: "beyonce-lemonade.jpg" },
    { artist: "blink-182", album: "enema of the state", year: 1999, cover: "blink-182-enema-of-the-state.jpg" },
    { artist: "blink-182", album: "take off your pants and jacket", year: 2001, cover: "blink-182-take-off-your-pants.jpg" },
    { artist: "bloc party", album: "silent alarm", year: 2005, cover: "bloc-party-silent-alarm.jpg" },
    { artist: "brand new", album: "deja entendu", year: 2003, cover: "brand-new-deja-entendu.jpg" },
    { artist: "brand new", album: "the devil and god are raging inside me", year: 2006, cover: "brand-new-devil-and-god.jpg" },
    { artist: "bright eyes", album: "vinyl box set", year: 2003, cover: "bright-eyes-vinyl-box-set.jpg" },
    { artist: "chance the rapper", album: "coloring book", year: 2016, cover: "chance-the-rapper-coloring-book.jpg" },
    { artist: "charli xcx", album: "how i'm feeling now", year: 2020, cover: "charli-xcx-how-im-feeling-now.jpg" },
    { artist: "charli xcx", album: "crash", year: 2022, cover: "charli-xcx-crash.jpg" },
    { artist: "charli xcx", album: "brat", year: 2024, cover: "charli-xcx-brat.jpg" },
    { artist: "childish gambino", album: "camp", year: 2011, cover: "childish-gambino-camp.jpg" },
    { artist: "childish gambino", album: "because the internet", year: 2013, cover: "childish-gambino-because-the-internet.jpg" },
    { artist: "childish gambino with jaden smith", album: "kauai", year: 2014, cover: "childish-gambino-kauai.jpg" },
    { artist: "clipse", album: "let god sort em out", year: 2025, cover: "clipse-let-god-sort-em-out.jpg" },
    { artist: "daft punk", album: "random access memories", year: 2013, cover: "daft-punk-random-access-memories.jpg" },
    { artist: "dave", album: "we're all alone in this together", year: 2021, cover: "dave-were-all-alone.jpg" },
    { artist: "death cab for cutie", album: "plans", year: 2005, cover: "death-cab-for-cutie-plans.jpg" },
    { artist: "desaparecidos", album: "read music, speak spanish", year: 2002, cover: "desaparecidos-read-music-speak-spanish.jpg" },
    { artist: "dmx", album: "flesh of my flesh blood of my blood", year: 1998, cover: "dmx-flesh-of-my-flesh.jpg" },
    { artist: "doechii", album: "alligator bites never heal", year: 2022, cover: "doechii-alligator-bites-never-heal.jpg" },
    { artist: "drake", album: "nothing was the same", year: 2013, cover: "drake-nothing-was-the-same.jpg" },
    { artist: "drake", album: "if you're reading this it's too late", year: 2015, cover: "drake-if-youre-reading-this.jpg" },
    { artist: "drake", album: "take care", year: 2011, cover: "drake-take-care.jpg" },
    { artist: "drake & future", album: "what a time to be alive", year: 2015, cover: "drake-future-what-a-time-to-be-alive.jpg" },
    { artist: "dr. dre", album: "the chronic", year: 1992, cover: "dr-dre-chronic.jpg" },
    { artist: "dr. dre", album: "2001", year: 1999, cover: "dr-dre-2001.jpg" },
    { artist: "eminem", album: "infinite", year: 1996, cover: "eminem-infinite.jpg" },
    { artist: "eminem", album: "the slim shady lp", year: 1999, cover: "eminem-slim-shady-lp.jpg" },
    { artist: "eminem", album: "the marshall mathers lp", year: 2000, cover: "eminem-marshall-mathers-lp.jpg" },
    { artist: "eminem", album: "the eminem show", year: 2002, cover: "eminem-eminem-show.jpg" },
    { artist: "fall out boy", album: "take this to your grave", year: 2003, cover: "fall-out-boy-take-this-to-your-grave.jpg" },
    { artist: "fall out boy", album: "from under the cork tree", year: 2005, cover: "fall-out-boy-from-under-cork-tree.jpg" },
    { artist: "the format", album: "dog problems", year: 2006, cover: "the-format-dog-problems.jpg" },
    { artist: "frank ocean", album: "endless", year: 2016, cover: "frank-ocean-endless.jpg" },
    { artist: "frank ocean", album: "blond", year: 2016, cover: "frank-ocean-blond.jpg" },
    { artist: "fred again..", album: "actual life", year: 2021, cover: "fred-again-actual-life.jpg" },
    { artist: "fred again..", album: "actual life 2", year: 2021, cover: "fred-again-actual-life-2.jpg" },
    { artist: "fred again..", album: "actual life 3", year: 2022, cover: "fred-again-actual-life-3.jpg" },
    { artist: "fred again..", album: "ten days", year: 2025, cover: "fred-again-ten-days.jpg" },
    { artist: "glass animals", album: "zaba", year: 2014, cover: "glass-animals-zaba.jpg" },
    { artist: "glass animals", album: "dreamland", year: 2020, cover: "glass-animals-dreamland.jpg" },
    { artist: "glass animals", album: "i love you so f***ing much.", year: 2024, cover: "glass-animals-i-love-you-so-fucking-much.jpg" },
    { artist: "green day", album: "dookie", year: 1994, cover: "green-day-dookie.jpg" },
    { artist: "hobo johnson", album: "the fall of hobo johnson", year: 2019, cover: "hobo-johnson-fall-of-hobo-johnson.jpg" },
    { artist: "incubus", album: "make yourself", year: 1999, cover: "incubus-make-yourself.jpg" },
    { artist: "incubus", album: "morning view", year: 2001, cover: "incubus-morning-view.jpg" },
    { artist: "jack harlow", album: "jackman.", year: 2023, cover: "jack-harlow-jackman.jpg" },
    { artist: "jack's mannequin", album: "everything in transit", year: 2005, cover: "jacks-mannequin-everything-in-transit.jpg" },
    { artist: "jamie xx", album: "in waves", year: 2024, cover: "jamie-xx-in-waves.jpg" },
    { artist: "jay-z", album: "vol. 2... hard knock life", year: 1998, cover: "jay-z-vol-2-hard-knock-life.jpg" },
    { artist: "jay-z", album: "the blueprint", year: 2001, cover: "jay-z-blueprint.jpg" },
    { artist: "jay-z", album: "the black album", year: 2003, cover: "jay-z-black-album.jpg" },
    { artist: "jay-z & kanye west", album: "watch the throne", year: 2011, cover: "jay-z-kanye-west-watch-the-throne.jpg" },
    { artist: "john coltrane", album: "a love supreme", year: 1965, cover: "john-coltrane-love-supreme.jpg" },
    { artist: "jorja smith", album: "lost & found", year: 2018, cover: "jorja-smith-lost-and-found.jpg" },
    { artist: "kanye west", album: "the college dropout", year: 2004, cover: "kanye-west-college-dropout.jpg" },
    { artist: "kanye west", album: "late registration", year: 2005, cover: "kanye-west-late-registration.jpg" },
    { artist: "kanye west", album: "graduation", year: 2007, cover: "kanye-west-graduation.jpg" },
    { artist: "kanye west", album: "my beautiful dark twisted fantasy", year: 2010, cover: "kanye-west-mbdtf.jpg" },
    { artist: "kanye west", album: "yeezus", year: 2013, cover: "kanye-west-yeezus.jpg" },
    { artist: "kendrick lamar", album: "good kid, m.a.a.d city", year: 2012, cover: "kendrick-lamar-good-kid-maad-city.jpg" },
    { artist: "kendrick lamar", album: "to pimp a butterfly", year: 2015, cover: "kendrick-lamar-to-pimp-a-butterfly.jpg" },
    { artist: "kendrick lamar", album: "damn.", year: 2017, cover: "kendrick-lamar-damn.jpg" },
    { artist: "kendrick lamar", album: "mr. morale & the big steppers", year: 2022, cover: "kendrick-lamar-mr-morale.jpg" },
    { artist: "kendrick lamar", album: "gnx", year: 2024, cover: "kendrick-lamar-gnx.jpg" },
    { artist: "kids see ghosts", album: "kids see ghosts", year: 2018, cover: "kids-see-ghosts.jpg" },
    { artist: "killer mike", album: "michael", year: 2023, cover: "killer-mike-michael.jpg" },
    { artist: "lauryn hill", album: "the miseducation of lauryn hill", year: 1998, cover: "lauryn-hill-miseducation.jpg" },
    { artist: "lil wayne", album: "tha carter iii", year: 2008, cover: "lil-wayne-tha-carter-iii.jpg" },
    { artist: "linkin park", album: "hybrid theory", year: 2000, cover: "linkin-park-hybrid-theory.jpg" },
    { artist: "lizzo", album: "special", year: 2022, cover: "lizzo-special.jpg" },
    { artist: "lorde", album: "pure heroine", year: 2013, cover: "lorde-pure-heroine.jpg" },
    { artist: "lupe fiasco", album: "lupe fiasco's food & liquor", year: 2006, cover: "lupe-fiasco-food-and-liquor.jpg" },
    { artist: "lupe fiasco", album: "lupe fiasco's the cool", year: 2007, cover: "lupe-fiasco-the-cool.jpg" },
    { artist: "lykke li", album: "so sad so sexy", year: 2018, cover: "lykke-li-so-sad-so-sexy.jpg" },
    { artist: "mac miller", album: "k.i.d.s.", year: 2010, cover: "mac-miller-kids.jpg" },
    { artist: "mac miller", album: "macadelic", year: 2012, cover: "mac-miller-macadelic.jpg" },
    { artist: "mac miller", album: "faces", year: 2014, cover: "mac-miller-faces.jpg" },
    { artist: "mac miller", album: "swimming", year: 2018, cover: "mac-miller-swimming.jpg" },
    { artist: "mac miller", album: "circles", year: 2020, cover: "mac-miller-circles.jpg" },
    { artist: "mac miller", album: "npr music tiny desk concert", year: 2021, cover: "mac-miller-tiny-desk.jpg" },
    { artist: "mase", album: "harlem world", year: 1997, cover: "mase-harlem-world.jpg" },
    { artist: "mgmt", album: "oracular spectacular", year: 2008, cover: "mgmt-oracular-spectacular.jpg" },
    { artist: "minus the bear", album: "menos el oso", year: 2005, cover: "minus-the-bear-menos-el-oso.jpg" },
    { artist: "modest mouse", album: "we were dead before the ship even sank", year: 2007, cover: "modest-mouse-we-were-dead.jpg" },
    { artist: "mura masa", album: "r.y.c", year: 2020, cover: "mura-masa-ryc.jpg" },
    { artist: "nas", album: "illmatic", year: 1994, cover: "nas-illmatic.jpg" },
    { artist: "nas", album: "stillmatic", year: 2001, cover: "nas-stillmatic.jpg" },
    { artist: "new found glory", album: "sticks and stones", year: 2002, cover: "new-found-glory-sticks-and-stones.jpg" },
    { artist: "nick drake", album: "pink moon", year: 1972, cover: "nick-drake-pink-moon.jpg" },
    { artist: "nirvana", album: "nevermind", year: 1991, cover: "nirvana-nevermind.jpg" },
    { artist: "notorious b.i.g.", album: "ready to die", year: 1994, cover: "notorious-big-ready-to-die.jpg" },
    { artist: "notorious b.i.g.", album: "life after death", year: 1997, cover: "notorious-big-life-after-death.jpg" },
    { artist: "olivia rodrigo", album: "sour", year: 2021, cover: "olivia-rodrigo-sour.jpg" },
    { artist: "panic! at the disco", album: "a fever you can't sweat out", year: 2005, cover: "panic-at-the-disco-fever.jpg" },
    { artist: "phoenix", album: "wolfgang amadeus phoenix", year: 2009, cover: "phoenix-wolfgang-amadeus-phoenix.jpg" },
    { artist: "the postal service", album: "give up", year: 2003, cover: "the-postal-service-give-up.jpg" },
    { artist: "puff daddy & the family", album: "no way out", year: 1997, cover: "puff-daddy-no-way-out.jpg" },
    { artist: "purity ring", album: "another eternity", year: 2015, cover: "purity-ring-another-eternity.jpg" },
    { artist: "pusha t", album: "daytona", year: 2018, cover: "pusha-t-daytona.jpg" },
    { artist: "red hot chili peppers", album: "stadium arcadium", year: 2006, cover: "red-hot-chili-peppers-stadium-arcadium.jpg" },
    { artist: "rihanna", album: "anti", year: 2016, cover: "rihanna-anti.jpg" },
    { artist: "run the jewels", album: "run the jewels", year: 2013, cover: "run-the-jewels.jpg" },
    { artist: "run the jewels", album: "run the jewels 3", year: 2016, cover: "run-the-jewels-3.jpg" },
    { artist: "say anything", album: "...is a real boy", year: 2004, cover: "say-anything-is-a-real-boy.jpg" },
    { artist: "the shins", album: "wincing the night away", year: 2007, cover: "the-shins-wincing-the-night-away.jpg" },
    { artist: "sigur rós", album: "( )", year: 2002, cover: "sigur-ros-parentheses.jpg" },
    { artist: "sigur rós", album: "takk...", year: 2005, cover: "sigur-ros-takk.jpg" },
    { artist: "something corporate", album: "leaving through the window", year: 2002, cover: "something-corporate-leaving-through-the-window.jpg" },
    { artist: "the streets", album: "original pirate material", year: 2002, cover: "the-streets-original-pirate-material.jpg" },
    { artist: "the streets", album: "a grand don't come for free", year: 2004, cover: "the-streets-grand-dont-come-for-free.jpg" },
    { artist: "the strokes", album: "is this it", year: 2001, cover: "the-strokes-is-this-it.jpg" },
    { artist: "sublime", album: "sublime", year: 1996, cover: "sublime-sublime.jpg" },
    { artist: "sufjan stevens", album: "carrie & lowell", year: 2015, cover: "sufjan-stevens-carrie-lowell.jpg" },
    { artist: "taking back sunday", album: "tell all your friends", year: 2002, cover: "taking-back-sunday-tell-all-your-friends.jpg" },
    { artist: "taylor swift", album: "1989", year: 2014, cover: "taylor-swift-1989.jpg" },
    { artist: "taylor swift", album: "folklore", year: 2020, cover: "taylor-swift-folklore.jpg" },
    { artist: "taylor swift", album: "evermore", year: 2020, cover: "taylor-swift-evermore.jpg" },
    { artist: "third eye blind", album: "third eye blind", year: 1997, cover: "third-eye-blind-third-eye-blind.jpg" },
    { artist: "tyler, the creator", album: "call me if you get lost", year: 2021, cover: "tyler-the-creator-call-me-if-you-get-lost.jpg" },
    { artist: "vampire weekend", album: "vampire weekend", year: 2008, cover: "vampire-weekend-vampire-weekend.jpg" },
    { artist: "vampire weekend", album: "contra", year: 2010, cover: "vampire-weekend-contra.jpg" },
    { artist: "vampire weekend", album: "modern vampires of the city", year: 2013, cover: "vampire-weekend-modern-vampires.jpg" },
    { artist: "the weeknd", album: "house of balloons", year: 2011, cover: "the-weeknd-house-of-balloons.jpg" },
    { artist: "the weeknd", album: "starboy", year: 2016, cover: "the-weeknd-starboy.jpg" },
    { artist: "the xx", album: "xx", year: 2009, cover: "the-xx-xx.jpg" }
];

// Record collection functionality
let recordCollectionInitialized = false;

function initializeRecordCollection(carouselId = 'record-carousel') {
    // Only skip if static record carousel already initialized  
    if (recordCollectionInitialized && carouselId === 'record-carousel') return;
    
    // Reset flag for dynamic carousels to allow reinitialization
    if (carouselId !== 'record-carousel') {
        recordCollectionInitialized = false;
    }
    
    const recordCarousel = document.getElementById(carouselId);
    
    console.log('Record collection elements:', { recordCarousel });
    
    if (!recordCarousel) {
        console.log('Missing record collection elements, skipping initialization');
        return;
    }
    
    // Destroy existing swiper if it exists
    if (window.currentRecordSwiper) {
        try {
            window.currentRecordSwiper.destroy(true, true);
            window.currentRecordSwiper = null;
        } catch (e) {
            console.log('Error destroying previous record swiper:', e);
        }
    }
    
    recordCollectionInitialized = true;
    console.log('Initializing record collection with Swiper...');
    
    // Generate Swiper slides for all records
    const recordHTML = recordCollection.map(record => `
        <div class="swiper-slide">
            <img src="assets/records/${record.cover}" alt="${record.album}" class="record-cover" />
            <div class="record-artist">${record.artist}</div>
            <div class="record-album">${record.album}</div>
        </div>
    `).join('');
    
    recordCarousel.innerHTML = recordHTML;
    
    // wait a bit for dom then setup swiper
    setTimeout(() => {
        console.log('Attempting to initialize record Swiper...');
        const swiperElement = document.querySelector('.record-swiper');
        console.log('Record Swiper element found:', !!swiperElement);
        console.log('Record slides found:', recordCarousel.children.length);
        
        if (typeof Swiper === 'undefined') {
            console.error('Swiper library not loaded');
            return;
        }
        
        const randomIndex = Math.floor(Math.random() * recordCollection.length);
        
        const recordSwiper = window.currentRecordSwiper = new Swiper('.record-swiper', {
            effect: 'coverflow',
            grabCursor: true,
            centeredSlides: true,
            slidesPerView: 2.5,
            initialSlide: randomIndex,
            loop: true,
            loopAdditionalSlides: 5,
            keyboard: {
                enabled: true,
                onlyInViewport: true,
            },
            autoplay: {
                delay: 2000,
                disableOnInteraction: false,
            },
            speed: 2000,
            coverflowEffect: {
                rotate: 35,
                stretch: -80,
                depth: 200,
                modifier: 1,
                slideShadows: true,
            },
            // Force initialization and proper loading
            observer: true,
            observeParents: true,
            observeSlideChildren: true,
            updateOnImagesReady: true,
            preloadImages: false,
            lazy: {
                loadPrevNext: true,
            },
            breakpoints: {
                // Mobile: optimized for records
                320: {
                    slidesPerView: 1.2,
                    spaceBetween: 20,
                    centeredSlides: true,
                    effect: 'slide', // Simpler effect for mobile
                    coverflowEffect: {
                        rotate: 0,
                        stretch: 0,
                        depth: 0,
                        modifier: 1,
                        slideShadows: false,
                    },
                },
                // Desktop: coverflow effect
                769: {
                    slidesPerView: 2.5,
                    spaceBetween: 0,
                    coverflowEffect: {
                        rotate: 35,
                        stretch: -80,
                        depth: 200,
                        modifier: 1,
                        slideShadows: true,
                    },
                }
            },
            navigation: {
                nextEl: '.record-swiper .swiper-button-next',
                prevEl: '.record-swiper .swiper-button-prev',
            },
            on: {
                init: function () {
                    console.log('Record Swiper initialized successfully on slide:', randomIndex);
                    // Force update after initialization to ensure proper mobile centering
                    setTimeout(() => {
                        this.update();
                        this.updateSlides();
                        this.slideTo(this.activeIndex, 0);
                    }, 50);
                },
                slideChange: function () {
                    console.log('Record slide changed to:', this.activeIndex);
                },
                resize: function() {
                    this.update();
                    this.updateSlides();
                }
            }
        });
        
        console.log('Record Swiper created:', recordSwiper);
    }, 500);
    
    console.log('Record collection Swiper initialization complete');
}

// Bio navigation functionality
function initializeBioNavigation() {
    const bioLabels = document.querySelectorAll('.bio-label.clickable');
    const bioParagraphs = document.querySelectorAll('.bio-paragraph');
    const dynamicContent = document.getElementById('dynamic-content');
    
    // Default to work section on load
    const workLabel = document.querySelector('.bio-label[data-paragraph="work"]');
    const workParagraph = document.getElementById('bio-work');
    
    if (workLabel && workParagraph && dynamicContent) {
        // Set proper active/inactive states for default work selection
        bioLabels.forEach(l => {
            if (l === workLabel) {
                l.classList.add('active');
                l.classList.remove('inactive');
            } else {
                l.classList.remove('active');
                l.classList.add('inactive');
            }
        });
        workParagraph.style.display = 'block';
        showWorkExperience(dynamicContent, false);
    }
    
    bioLabels.forEach(label => {
        label.addEventListener('click', () => {
            const targetParagraph = label.getAttribute('data-paragraph');
            
            // Clear right sidebar content when switching sections
            if (dynamicContent) {
                dynamicContent.innerHTML = '';
            }
            
            // Reset all highlight states to default when switching sections
            const allHighlights = document.querySelectorAll('.highlight.clickable');
            allHighlights.forEach(h => {
                h.classList.remove('active', 'inactive');
            });
            
            // Update active states for labels
            bioLabels.forEach(l => {
                l.classList.remove('active');
                l.classList.add('inactive');
            });
            label.classList.remove('inactive');
            label.classList.add('active');
            
            // Hide all paragraphs, show target
            bioParagraphs.forEach(p => p.style.display = 'none');
            const targetElement = document.getElementById(`bio-${targetParagraph}`);
            if (targetElement) {
                targetElement.style.display = 'block';
            }
            
            // Show appropriate right sidebar content based on section
            if (dynamicContent) {
                if (targetParagraph === 'work') {
                    showWorkExperience(dynamicContent, false);
                }
                // create and think dont auto-load
                // Content appears when user clicks specific highlights within paragraphs
            }
        });
    });
}

// check if mobile
function isMobileDevice() {
    return window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// wait for page readiness before initializing swipers
function waitForReadyThenInitialize(initFunction, type) {
    console.log(`Waiting for readiness to initialize ${type}...`);
    
    // Check if page is still loading
    const checkReadiness = () => {
        const isDocumentReady = document.readyState === 'complete';
        const isSwiperLoaded = typeof Swiper !== 'undefined';
        const timeSinceLoad = Date.now() - window.pageLoadTime;
        
        console.log(`${type} readiness check:`, {
            documentReady: isDocumentReady,
            swiperLoaded: isSwiperLoaded,
            timeSinceLoad: timeSinceLoad
        });
        
        if (isDocumentReady && isSwiperLoaded) {
            // Add a minimum delay if page just loaded
            const minDelay = timeSinceLoad < 5000 ? 500 : 100;
            setTimeout(() => {
                console.log(`Initializing ${type} after ${minDelay}ms delay`);
                initFunction();
            }, minDelay);
        } else {
            // Try again in 100ms
            setTimeout(checkReadiness, 100);
        }
    };
    
    checkReadiness();
}

// scroll to content on mobile
function scrollToDynamicContentOnMobile() {
    if (isMobileDevice()) {
        const dynamicContent = document.getElementById('dynamic-content');
        if (dynamicContent) {
            setTimeout(() => {
                dynamicContent.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'start' 
                });
            }, 100); // Small delay to let content populate first
        }
    }
}

// Dynamic content for highlights
function initializeDynamicContent() {
    const highlights = document.querySelectorAll('.highlight.clickable');
    const dynamicContent = document.getElementById('dynamic-content');
    let exitsToggleState = 'chronos'; // Track which exit company to show next
    
    highlights.forEach(highlight => {
        highlight.addEventListener('click', () => {
            const target = highlight.getAttribute('data-target');
            
            // Update highlight states
            highlights.forEach(h => {
                h.classList.remove('active');
                h.classList.add('inactive');
            });
            highlight.classList.remove('inactive');
            highlight.classList.add('active');
            
            // Show different content based on target
            if (target === 'work') {
                showWorkExperience(dynamicContent, false);
                scrollToDynamicContentOnMobile();
            } else if (target.startsWith('work-')) {
                // work highlights - show specific company
                showWorkExperience(dynamicContent);
                setTimeout(() => {
                    const companyTarget = getWorkCompanyTarget(target);
                    if (companyTarget) {
                        selectWorkExperienceCompany(companyTarget);
                    }
                    scrollToDynamicContentOnMobile();
                }, 100);
            } else if (target === 'records') {
                showRecordCollection(dynamicContent);
                scrollToDynamicContentOnMobile();
            } else if (target === 'sneakers') {
                showShoeCollection(dynamicContent);
                scrollToDynamicContentOnMobile();
            } else if (target === 'jerseys') {
                showJerseyCollection(dynamicContent);
                scrollToDynamicContentOnMobile();
            } else if (target === 'podcasts') {
                showPodcastEpisodes(dynamicContent);
                scrollToDynamicContentOnMobile();
            } else if (target === 'investing') {
                showInvestments(dynamicContent);
                scrollToDynamicContentOnMobile();
            } else if (target === 'builds' || target === 'music' || target === 'writing' || target === 'cirque-disobey') {
                showCreativeWork(dynamicContent, target);
                scrollToDynamicContentOnMobile();
            } else if (target === 'goat-rappers') {
                showGoatRappers(dynamicContent);
                scrollToDynamicContentOnMobile();
            } else if (target === 'music-lists') {
                showMusicLists(dynamicContent);
                scrollToDynamicContentOnMobile();
            } else if (target === 'favorite-music') {
                showFavoriteMusic(dynamicContent);
                scrollToDynamicContentOnMobile();
            } else if (target === 'favorite-reads') {
                // Set to this year view by default
                currentReadList = 'thisYear';
                showFavoriteReads(dynamicContent);
                scrollToDynamicContentOnMobile();
            }
        });
    });
    
    // map work stuff to companies
    function getWorkCompanyTarget(workTarget) {
        const mappings = {
            'work-roblox': 'roblox',
            'work-creativity': 'sway',
            'work-connecting': 'bungalow',
            'work-best-versions': 'chronos',
            'work-design': 'ideo',
            'work-founder': 'chronos',
            'work-consumer-mobile': 'life360',
            'work-exits': () => {
                // Toggle between chronos and sway for exits
                const current = exitsToggleState;
                exitsToggleState = exitsToggleState === 'chronos' ? 'sway' : 'chronos';
                return current;
            }
        };
        
        const mapping = mappings[workTarget];
        return typeof mapping === 'function' ? mapping() : mapping;
    }
    
    // select a company
    function selectWorkExperienceCompany(companyTarget) {
        const experienceNames = document.querySelectorAll('.experience-name-inline');
        const experienceDetails = document.querySelectorAll('.experience-detail-item');
        
        // Find and click the target company
        experienceNames.forEach(name => {
            if (name.getAttribute('data-target') === companyTarget) {
                // Update active states for names
                experienceNames.forEach(n => {
                    n.classList.remove('active');
                    n.classList.add('inactive');
                });
                experienceDetails.forEach(d => d.classList.remove('active'));
                
                // Add active state to target name and corresponding detail
                name.classList.remove('inactive');
                name.classList.add('active');
                const targetDetail = document.getElementById(`detail-${companyTarget}`);
                if (targetDetail) {
                    targetDetail.classList.add('active');
                }
            }
        });
    }
}

function showWorkExperience(container, showSelection = true) {
    console.log('WORK EXPERIENCE CALLED WITH showSelection:', showSelection);
    console.log('WORK EXPERIENCE CONTAINER:', container);
    container.innerHTML = `
        <div class="experience-names-row">
            <span class="experience-name-inline" data-target="roblox">roblox</span>
            <span class="separator">|</span>
            <span class="experience-name-inline" data-target="sway">sway</span>
            <span class="separator">|</span>
            <span class="experience-name-inline" data-target="bungalow">bungalow</span>
            <span class="separator">|</span>
            <span class="experience-name-inline" data-target="ideo">ideo</span>
            <span class="separator">|</span>
            <span class="experience-name-inline" data-target="life360">life360</span>
            <span class="separator">|</span>
            <span class="experience-name-inline" data-target="chronos">chronos</span>
            <span class="separator">|</span>
            <span class="experience-name-inline" data-target="google">google</span>
        </div>
        <div class="experience-names-row">
            <span class="experience-name-inline" data-target="stanford">stanford gsb</span>
            <span class="separator">|</span>
            <span class="experience-name-inline" data-target="columbia">columbia</span>
        </div>
        <div class="experience-details-container" style="margin-top: 24px;">
            <div class="experience-detail-item${showSelection ? ' active' : ''}" id="detail-roblox">
                <p class="experience-date">2021 — now</p>
                <p>product. joined with the sway team. avatar team. building tools to enable hundreds of millions of people to create and self-express through play. focused on systems that make traditionally complex 3d modeling accessible to anyone on any device. working on experiences that let people bring their imagination to life in virtual worlds with their friends.</p>
            </div>
            <div class="experience-detail-item" id="detail-sway">
                <p class="experience-date">2020 — 2021</p>
                <p>ml startup. led design and product for motion capture technology that reached number three on the app store. enabled users to create professional motion capture via mobile video and machine learning without needing expensive mocap suits. built ai for personalized interactive content creation. focused on making advanced animation tools accessible to creators everywhere.</p>
            </div>
            <div class="experience-detail-item" id="detail-bungalow">
                <p class="experience-date">2019 — 2020</p>
                <p>product. sought to help people moving to cities find great places to live and roommates. founders fund company where i led mobile product development. focused on creating better matching algorithms and user experiences that made the transition to new cities less overwhelming and more connected.</p>
            </div>
            <div class="experience-detail-item" id="detail-ideo">
                <p class="experience-date">2018 — 2019</p>
                <p>design. human-centered everything. worked on projects including enabling capital access to underrepresented groups, rethinking retirement for the modern day, creating new opportunities for investment, reimagining the future of work, and designing tools for financial literacy across healthcare, education, and technology with teams spanning mexico, the uk, germany, israel, and across the us. learned how to ask better questions and design for real human needs.</p>
            </div>
            <div class="experience-detail-item" id="detail-life360">
                <p class="experience-date">2015 — 2016</p>
                <p>product. joined through the chronos acquisition. family safety through location sharing platform that went public in may 2019. led teen driving safety initiative that became core to the monetization business. focused on helping families stay connected while maintaining the eternal balance of safety and independence that defines modern family dynamics.</p>
            </div>
            <div class="experience-detail-item" id="detail-chronos">
                <p class="experience-date">2012 — 2015</p>
                <p>co-founder and head of product. acquired by life360. built tools to help users make better decisions through passively collected data. created best-in-class background location technology that became a top 50 lifestyle app. published articles in the atlantic and business insider about the future of personal analytics and time awareness. focused on helping people understand where their attention and energy actually go.</p>
            </div>
            <div class="experience-detail-item" id="detail-google">
                <p class="experience-date">2008 — 2010</p>
                <p>google calendar. helped prioritize feature requests and bug fixes across the platform. received platinum exceptional contribution award for behavioral study and statistical analysis, cited as the future of the department. made scheduling slightly less painful through intelligent features and cross-platform experiences. learned that time is everyone's most precious resource and small improvements can have massive impact.</p>
            </div>
            <div class="experience-detail-item" id="detail-stanford">
                <p class="experience-date">2010 — 2012</p>
                <p>mba focused on entrepreneurship. toured weekends playing wait what shows, and started chronos from the gsb. learned how to balance multiple passions while building something meaningful. discovered that the best opportunities often come from combining seemingly unrelated interests and experiences. angel invested in brazilian startups during the summer between first and second year.</p>
            </div>
            <div class="experience-detail-item" id="detail-columbia">
                <p class="experience-date">2004 — 2008</p>
                <p>ba in english and psychology. spent four years studying how people think, decide, and connect. recorded a lot of music, went to a lot of concerts, and explored every corner of new york city from eighteen to twenty-two. learned that we're all beautifully irrational and that understanding human behavior is the key to building things that actually matter to people.</p>
            </div>
        </div>
    `;
    // reinit experience stuff
    setTimeout(() => initializeExperienceItems(), 100);
}

function showInvestments(container, showSelection = false) {
    container.innerHTML = `
        <div class="investment-names-row">
            <span class="investment-name-inline clickable" data-target="alma">alma</span>
            <span class="separator">|</span>
            <span class="investment-name-inline clickable" data-target="deel">deel</span>
            <span class="separator">|</span>
            <span class="investment-name-inline clickable" data-target="bloom-wolf">bloom & wolf</span>
            <span class="separator">|</span>
            <span class="investment-name-inline clickable" data-target="vibrant">vibrant</span>
            <span class="separator">|</span>
            <span class="investment-name-inline clickable" data-target="healthtap">healthtap</span>
            <span class="separator">|</span>
            <span class="investment-name-inline clickable" data-target="boam">boam ai</span>
        </div>
        <div class="investment-names-row">
            <span class="investment-name-inline clickable" data-target="pixaera">pixaera</span>
            <span class="separator">|</span>
            <span class="investment-name-inline clickable" data-target="upwage">upwage</span>
            <span class="separator">|</span>
            <span class="investment-name-inline clickable" data-target="copper">copper</span>
            <span class="separator">|</span>
            <span class="investment-name-inline clickable" data-target="raeden">raeden</span>
            <span class="separator">|</span>
            <span class="investment-name-inline clickable" data-target="marine-snow">marine snow</span>
        </div>
        
        <div class="syndicate-investments" style="margin-top: 20px;">
            <div class="syndicate-names-container">
                <span class="syndicate-title-inline">via syndicates:</span>
                <span class="syndicate-name clickable" data-target="sesh">sesh</span>   
                <span class="syndicate-name clickable" data-target="cal">cal.com</span>   
                <span class="syndicate-name clickable" data-target="acquire">acquire.com</span>   
                <span class="syndicate-name clickable" data-target="ocho">carry (ocho)</span>   
                <span class="syndicate-name clickable" data-target="matter">matter health</span>   
                <span class="syndicate-name clickable" data-target="laylo">laylo</span>   
                <span class="syndicate-name clickable" data-target="thirdweb">thirdweb</span>   
                <span class="syndicate-name clickable" data-target="bonsai">bonsai</span>   
                <span class="syndicate-name clickable" data-target="softr">softr</span>   
                <span class="syndicate-name clickable" data-target="ens">ens domains</span>   
                <span class="syndicate-name clickable" data-target="solace">solace health</span>   
                <span class="syndicate-name clickable" data-target="casa">casa</span>   
                <span class="syndicate-name clickable" data-target="rainbow">rainbow</span>   
                <span class="syndicate-name clickable" data-target="syndicate-co">syndicate</span>   
                <span class="syndicate-name clickable" data-target="grain">grain</span>
            </div>
        </div>
        
        <!-- Combined details container for both main investments and syndicates -->
        <div class="investment-details-container" style="margin-top: 30px;">
            <!-- Main Investment Details -->
            <div class="investment-detail-item" id="detail-alma">
                <p class="investment-url"><a href="https://www.tryalma.com/" target="_blank" rel="noopener" class="external-link">tryalma.com</a></p>
                <p>ai-powered legal tech platform simplifying the visa process for technologists, founders, and researchers. automates document processing and provides personal legal advisors to fast-track international talent into america's tech ecosystem with higher approval rates.</p>
            </div>
            <div class="investment-detail-item" id="detail-bloom-wolf">
                <p class="investment-url"><a href="https://www.bloomandwolf.com/en" target="_blank" rel="noopener" class="external-link">bloomandwolf.com</a></p>
                <p>premium silk flower service disrupting the $35 billion fresh flower industry with beautiful, sustainable alternatives. creates ultra-realistic floral arrangements that help b2b and d2c customers maintain beautiful spaces with less effort, lower cost, and significantly reduced environmental impact. leading the shift from perishable to permanent while delivering the same emotional experience.</p>
            </div>
            <div class="investment-detail-item" id="detail-vibrant">
                <p class="investment-url"><a href="https://www.vibrantpractice.com/" target="_blank" rel="noopener" class="external-link">vibrantpractice.com</a></p>
                <p>ai-native operating system built for functional, integrative, and longevity medicine practitioners moving beyond symptom management to root-cause care. designed to help modern clinicians work faster, think deeper, and deliver precision medicine tailored to unique biology and lifestyle without drowning in outdated systems.</p>
            </div>
            <div class="investment-detail-item" id="detail-healthtap">
                <p class="investment-url"><a href="https://www.healthtap.com/" target="_blank" rel="noopener" class="external-link">healthtap.com</a></p>
                <p>virtual primary care practice available nationwide, offering affordable long-term care to millions with or without insurance. places quality primary care doctors at everyone's fingertips, proven to decrease death rates and emergency room visits while improving overall health outcomes.</p>
            </div>
            <div class="investment-detail-item" id="detail-boam">
                <p class="investment-url"><a href="https://boam.ai/" target="_blank" rel="noopener" class="external-link">boam.ai</a></p>
                <p>ai company transforming sales processes by aggregating billions of fragmented merchant data points from reviews, articles, mapping services, and government sources. turns messy smb data into actionable insights, providing substantially more effective targeting tools than existing market solutions.</p>
            </div>
            <div class="investment-detail-item" id="detail-pixaera">
                <p class="investment-url"><a href="https://www.pixaera.com/" target="_blank" rel="noopener" class="external-link">pixaera.com</a></p>
                <p>holistic safety training platform empowering frontline workers through engaging, immersive experiences. integrates virtual reality, pc simulations, and traditional classroom methods to enhance knowledge retention and promote proactive safety culture.</p>
            </div>
            <div class="investment-detail-item" id="detail-deel">
                <p class="investment-url"><a href="https://www.deel.com/" target="_blank" rel="noopener" class="external-link">deel.com</a></p>
                <p>all-in-one platform for global workforces, enabling instant hiring across 150+ countries without local entities. handles contracts, payroll, and compliance automatically while eliminating traditional barriers to international talent. transforming how companies access and manage distributed teams worldwide.</p>
            </div>
            <div class="investment-detail-item" id="detail-upwage">
                <p class="investment-url"><a href="https://www.upwage.com/" target="_blank" rel="noopener" class="external-link">upwage.com</a></p>
                <p>ai platform leveling the playing field for 53 million hourly workers facing job displacement from ai automation. uses big data and bias-reducing interview agents to help at-risk workers find better jobs and secure $1 trillion in new wealth.</p>
            </div>
            <div class="investment-detail-item" id="detail-copper">
                <p class="investment-url"><a href="https://www.getcopper.com/" target="_blank" rel="noopener" class="external-link">getcopper.com</a></p>
                <p>financial education platform helping young people earn, save, invest, and spend while learning real-world money skills. provides multiple income opportunities through their app, helping members earn over $3 million to date while building financial stability across generations.</p>
            </div>
            <div class="investment-detail-item" id="detail-raeden">
                <p class="investment-url"><a href="https://raeden.com/" target="_blank" rel="noopener" class="external-link">raeden.com</a></p>
                <p>redefining digital infrastructure by adaptively reusing underutilized micro-resources in existing real estate portfolios for edge computing. partners with real estate investors to convert unused space, power, and connectivity into revenue-generating digital infrastructure for major technology and telecom companies.</p>
            </div>
            <div class="investment-detail-item" id="detail-marine-snow">
                <p class="investment-url"><a href="https://marine-snow.co/" target="_blank" rel="noopener" class="external-link">marine-snow.co</a></p>
                <p>music discovery platform reimagining how people find and connect to new music. offers 90-day exclusive songs with upfront artist payments, curated selection focused on culturally important tracks, and game-like discovery mechanics. designed for music lovers seeking active engagement over passive algorithm-fed consumption.</p>
            </div>
            
            <!-- Syndicate Investment Details -->
            <div class="investment-detail-item" id="detail-sesh">
                <p class="investment-url"><a href="https://joinsesh.ai/" target="_blank" rel="noopener" class="external-link">joinsesh.ai</a></p>
                <p>ai-native engagement platform for superfans with wallet-based member cards and push notifications</p>
            </div>
            <div class="investment-detail-item" id="detail-cal">
                <p class="investment-url"><a href="https://cal.com/" target="_blank" rel="noopener" class="external-link">cal.com</a></p>
                <p>open scheduling infrastructure for the internet, customizable and developer-first</p>
            </div>
            <div class="investment-detail-item" id="detail-acquire">
                <p class="investment-url"><a href="https://acquire.com/" target="_blank" rel="noopener" class="external-link">acquire.com</a></p>
                <p>marketplace to buy and sell startups, streamlining exits in days not months</p>
            </div>
            <div class="investment-detail-item" id="detail-ocho">
                <p class="investment-url"><a href="https://www.carry.com/" target="_blank" rel="noopener" class="external-link">carry.com</a></p>
                <p>retirement platform for entrepreneurs with tax-optimized solo 401(k) and self-directed savings</p>
            </div>
            <div class="investment-detail-item" id="detail-matter">
                <p class="investment-url"><a href="https://matterhealthcare.com/" target="_blank" rel="noopener" class="external-link">matterhealthcare.com</a></p>
                <p>primary care model for older adults with data-driven monitoring and proactive interventions</p>
            </div>
            <div class="investment-detail-item" id="detail-laylo">
                <p class="investment-url"><a href="https://laylo.com/" target="_blank" rel="noopener" class="external-link">laylo.com</a></p>
                <p>drop-delivery system automating creator launches across sms, email, and dms</p>
            </div>
            <div class="investment-detail-item" id="detail-thirdweb">
                <p class="investment-url"><a href="https://thirdweb.com/" target="_blank" rel="noopener" class="external-link">thirdweb.com</a></p>
                <p>developer toolkit for web3 simplifying smart contracts and blockchain app deployment</p>
            </div>
            <div class="investment-detail-item" id="detail-bonsai">
                <p class="investment-url"><a href="https://hellobonsai.com/" target="_blank" rel="noopener" class="external-link">hellobonsai.com</a></p>
                <p>financial operating system for independent workers unifying contracts, invoicing, and payments</p>
            </div>
            <div class="investment-detail-item" id="detail-softr">
                <p class="investment-url"><a href="https://softr.io/" target="_blank" rel="noopener" class="external-link">softr.io</a></p>
                <p>no-code platform turning airtable and google sheets into apps and marketplaces</p>
            </div>
            <div class="investment-detail-item" id="detail-ens">
                <p class="investment-url"><a href="https://ens.domains/" target="_blank" rel="noopener" class="external-link">ens.domains</a></p>
                <p>decentralized naming protocol mapping human-readable names to ethereum addresses</p>
            </div>
            <div class="investment-detail-item" id="detail-solace">
                <p class="investment-url"><a href="https://solace.health/" target="_blank" rel="noopener" class="external-link">solace.health</a></p>
                <p>ai-native operating system for mental health integrating therapy and personalized digital support</p>
            </div>
            <div class="investment-detail-item" id="detail-casa">
                <p class="investment-url"><a href="https://casa.io/" target="_blank" rel="noopener" class="external-link">casa.io</a></p>
                <p>self-custody platform making crypto ownership secure with multisig wallets and inheritance planning</p>
            </div>
            <div class="investment-detail-item" id="detail-rainbow">
                <p class="investment-url"><a href="https://rainbow.me/" target="_blank" rel="noopener" class="external-link">rainbow.me</a></p>
                <p>consumer crypto wallet with playful ux making tokens accessible to the next hundred million users</p>
            </div>
            <div class="investment-detail-item" id="detail-syndicate-co">
                <p class="investment-url"><a href="https://syndicate.io/" target="_blank" rel="noopener" class="external-link">syndicate.io</a></p>
                <p>investment protocol turning any group into a venture fund or dao with automated compliance</p>
            </div>
            <div class="investment-detail-item" id="detail-grain">
                <p class="investment-url"><a href="https://grain.com/" target="_blank" rel="noopener" class="external-link">grain.com</a></p>
                <p>ai-native notetaker for revenue teams capturing conversations and generating actionable intelligence</p>
            </div>
        </div>
    `;
    
    // setup investment nav
    initializeInvestmentNavigation();
}

function initializeInvestmentNavigation() {
    // get all investment items
    const allInvestmentNames = document.querySelectorAll('.investment-name-inline, .syndicate-name');
    const investmentDetails = document.querySelectorAll('.investment-detail-item');
    
    allInvestmentNames.forEach(name => {
        name.addEventListener('click', () => {
            const target = name.getAttribute('data-target');
            const targetDetail = document.getElementById(`detail-${target}`);
            
            // Clear all active/selected states and set all to inactive
            allInvestmentNames.forEach(n => {
                n.classList.remove('active', 'selected');
                n.classList.add('inactive');
            });
            investmentDetails.forEach(d => d.classList.remove('active'));
            
            // Add active state to clicked name and show corresponding detail
            name.classList.remove('inactive');
            name.classList.add('active');
            if (targetDetail) {
                targetDetail.classList.add('active');
            }
        });
    });
}

let currentTasteListIndex = 0;
let availableTasteLists = [];

function showGoatRappers(container) {
    // Find taste lists from availableLists
    if (window.siteData && window.siteData.tasteMusicLists) {
        const lists = window.siteData.tasteMusicLists.value || window.siteData.tasteMusicLists;
        const goatRappersList = lists.find(list => list.title.toLowerCase().includes('goat rappers'));
        const favoriteAlbumsList = lists.find(list => list.title.toLowerCase().includes('favorite albums'));
        
        availableTasteLists = [];
        if (favoriteAlbumsList) availableTasteLists.push(favoriteAlbumsList);
        if (goatRappersList) availableTasteLists.push(goatRappersList);
        
        if (availableTasteLists.length > 0) {
            currentTasteListIndex = 0;
            container.innerHTML = `
                <div class="taste-lists-navigation">
                    <button class="nav-arrow nav-arrow-left" id="prev-taste" ${availableTasteLists.length <= 1 ? 'disabled' : ''}>‹</button>
                    <div class="taste-list-content">
                        <h4 class="goat-rappers-title" id="taste-list-title">loading...</h4>
                        <div class="taste-content-with-thumbnails">
                            <div class="album-thumbnails left-thumbnails" id="left-thumbnails"></div>
                            <ol class="numbered-list goat-rappers-list" id="taste-list-items">
                                <li>loading...</li>
                            </ol>
                            <div class="album-thumbnails right-thumbnails" id="right-thumbnails"></div>
                        </div>
                    </div>
                    <button class="nav-arrow nav-arrow-right" id="next-taste" ${availableTasteLists.length <= 1 ? 'disabled' : ''}>›</button>
                </div>
            `;
            
            // add nav handlers
            document.getElementById('prev-taste').addEventListener('click', () => navigateTasteList(-1));
            document.getElementById('next-taste').addEventListener('click', () => navigateTasteList(1));
            
            displayCurrentTasteList();
        } else {
            container.innerHTML = `
                <div class="goat-rappers-container">
                    <p class="loading-message">loading taste lists...</p>
                </div>
            `;
        }
    } else {
        container.innerHTML = `
            <div class="goat-rappers-container">
                <p class="loading-message">loading taste lists...</p>
            </div>
        `;
    }
}

function navigateTasteList(direction) {
    if (availableTasteLists.length === 0) return;
    
    currentTasteListIndex = (currentTasteListIndex + direction + availableTasteLists.length) % availableTasteLists.length;
    displayCurrentTasteList();
    updateTasteListNavigation();
}

function displayCurrentTasteList() {
    if (availableTasteLists.length === 0) return;
    
    const currentList = availableTasteLists[currentTasteListIndex];
    const titleEl = document.getElementById('taste-list-title');
    const itemsEl = document.getElementById('taste-list-items');
    const leftThumbnailsEl = document.getElementById('left-thumbnails');
    const rightThumbnailsEl = document.getElementById('right-thumbnails');
    
    if (titleEl && itemsEl && currentList) {
        titleEl.textContent = currentList.title.toLowerCase();
        
        if (currentList.items && currentList.items.length > 0) {
            itemsEl.innerHTML = currentList.items.map(item => {
                // handle rappers (strings) and albums (objects)
                if (typeof item === 'object' && item.name) {
                    if (item.url) {
                        return `<li><a href="${item.url}" target="_blank" rel="noopener" class="external-link">${item.name.toLowerCase()}</a></li>`;
                    } else {
                        return `<li>${item.name.toLowerCase()}</li>`;
                    }
                } else {
                    // Fallback for string items
                    return `<li>${typeof item === 'string' ? item.toLowerCase() : String(item)}</li>`;
                }
            }).join('');
            
            // Show album thumbnails only for albums list
            if (currentList.title.toLowerCase().includes('favorite albums') && leftThumbnailsEl && rightThumbnailsEl) {
                const albumsWithImages = currentList.items.filter(item => 
                    typeof item === 'object' && item.image && item.url
                );
                
                // Check if mobile
                const isMobile = window.innerWidth <= 768;
                console.log('Album display - isMobile:', isMobile, 'width:', window.innerWidth);
                
                if (isMobile) {
                    // Mobile: create single grid container below the list
                    leftThumbnailsEl.innerHTML = '';
                    rightThumbnailsEl.innerHTML = '';
                    
                    // Create mobile albums grid container
                    const mobileGridId = 'mobile-albums-grid';
                    let mobileGrid = document.getElementById(mobileGridId);
                    
                    // Remove existing mobile grid
                    if (mobileGrid) {
                        console.log('Removing existing mobile grid');
                        mobileGrid.remove();
                    }
                    
                    // Create new mobile grid after the items list
                    mobileGrid = document.createElement('div');
                    mobileGrid.id = mobileGridId;
                    mobileGrid.className = 'mobile-albums-grid';
                    
                    console.log('Creating mobile album grid with', albumsWithImages.length, 'albums');
                    
                    // Add all 10 albums to mobile grid
                    mobileGrid.innerHTML = albumsWithImages.slice(0, 10).map(album => 
                        `<a href="${album.url}" target="_blank" rel="noopener" class="album-thumbnail">
                            <img src="${album.image}" alt="${album.name}" />
                        </a>`
                    ).join('');
                    
                    // Insert after the items container - try multiple insertion methods
                    const itemsContainer = itemsEl.parentElement;
                    console.log('Items container:', itemsContainer);
                    
                    // Try inserting after the taste-list-items container itself
                    const tasteContent = document.querySelector('.taste-content');
                    if (tasteContent) {
                        console.log('Appending to taste-content container');
                        tasteContent.appendChild(mobileGrid);
                    } else {
                        console.log('Appending to items parent container');
                        itemsContainer.appendChild(mobileGrid);
                    }
                } else {
                    // Desktop: split albums for left and right sides (5 each)
                    const leftAlbums = albumsWithImages.slice(0, 5);
                    const rightAlbums = albumsWithImages.slice(5, 10);
                    
                    leftThumbnailsEl.innerHTML = leftAlbums.map(album => 
                        `<a href="${album.url}" target="_blank" rel="noopener" class="album-thumbnail">
                            <img src="${album.image}" alt="${album.name}" />
                        </a>`
                    ).join('');
                    
                    rightThumbnailsEl.innerHTML = rightAlbums.map(album => 
                        `<a href="${album.url}" target="_blank" rel="noopener" class="album-thumbnail">
                            <img src="${album.image}" alt="${album.name}" />
                        </a>`
                    ).join('');
                }
            } else {
                // Clear thumbnails for non-album lists
                if (leftThumbnailsEl) leftThumbnailsEl.innerHTML = '';
                if (rightThumbnailsEl) rightThumbnailsEl.innerHTML = '';
                
                // Remove mobile grid if it exists
                const mobileGrid = document.getElementById('mobile-albums-grid');
                if (mobileGrid) mobileGrid.remove();
            }
        } else {
            itemsEl.innerHTML = '<li>no items found</li>';
            if (leftThumbnailsEl) leftThumbnailsEl.innerHTML = '';
            if (rightThumbnailsEl) rightThumbnailsEl.innerHTML = '';
        }
    }
}

function updateTasteListNavigation() {
    const prevButton = document.getElementById('prev-taste');
    const nextButton = document.getElementById('next-taste');
    
    if (prevButton && nextButton) {
        prevButton.disabled = availableTasteLists.length <= 1;
        nextButton.disabled = availableTasteLists.length <= 1;
    }
}

let currentMusicListIndex = 0;
let availableMusicLists = [];

function showMusicLists(container) {
    // Get music lists (albums and songs) from the stored data  
    if (window.siteData && window.siteData.tasteMusicLists) {
        const lists = window.siteData.tasteMusicLists.value || window.siteData.tasteMusicLists;
        // Filter to only albums and songs lists (not rappers)
        availableMusicLists = lists.filter(list => 
            list.title.toLowerCase().includes('favorite albums') || 
            list.title.toLowerCase().includes('favorite songs')
        );
        currentMusicListIndex = 0;
        
        if (availableMusicLists.length > 0) {
            container.innerHTML = `
                <div class="music-lists-navigation">
                    <button class="nav-arrow nav-arrow-left" id="prev-music-list">‹</button>
                    <h4 class="music-list-title" id="current-music-list-title">loading...</h4>
                    <button class="nav-arrow nav-arrow-right" id="next-music-list">›</button>
                </div>
                
                <div class="music-list-content">
                    <ol class="numbered-list music-list-items" id="current-music-list-items">
                        <li>loading...</li>
                    </ol>
                </div>
            `;
            
            // setup nav
            const prevButton = document.getElementById('prev-music-list');
            const nextButton = document.getElementById('next-music-list');
            
            if (prevButton && nextButton) {
                prevButton.addEventListener('click', () => navigateMusicList(-1));
                nextButton.addEventListener('click', () => navigateMusicList(1));
            }
            
            displayCurrentMusicList();
            updateMusicListNavigation();
        }
    } else {
        container.innerHTML = `
            <div class="music-lists-container">
                <p class="loading-message">loading music lists...</p>
            </div>
        `;
    }
}

function navigateMusicList(direction) {
    if (availableMusicLists.length === 0) return;
    
    currentMusicListIndex = (currentMusicListIndex + direction + availableMusicLists.length) % availableMusicLists.length;
    displayCurrentMusicList();
    updateMusicListNavigation();
}

function displayCurrentMusicList() {
    if (availableMusicLists.length === 0) return;
    
    const currentList = availableMusicLists[currentMusicListIndex];
    const titleEl = document.getElementById('current-music-list-title');
    const itemsEl = document.getElementById('current-music-list-items');
    
    if (titleEl && itemsEl && currentList) {
        // Show title with playlist link if available
        if (currentList.playlistUrl) {
            titleEl.innerHTML = `<a href="${currentList.playlistUrl}" target="_blank" rel="noopener" class="music-list-title-link">${currentList.title} <img src="assets/spotify.svg" alt="Spotify" class="list-spotify-icon"></a>`;
        } else {
            titleEl.innerHTML = `<span class="music-list-title-no-link">${currentList.title}</span>`;
        }
        
        // Clear existing items
        itemsEl.innerHTML = '';
        
        // Add numbered items
        currentList.items.forEach(item => {
            const li = document.createElement('li');
            li.textContent = item;
            itemsEl.appendChild(li);
        });
    }
}

function updateMusicListNavigation() {
    const prevButton = document.getElementById('prev-music-list');
    const nextButton = document.getElementById('next-music-list');
    
    if (prevButton && nextButton) {
        const hasMultipleLists = availableMusicLists.length > 1;
        prevButton.disabled = !hasMultipleLists;
        nextButton.disabled = !hasMultipleLists;
    }
}

// Music playlist navigation variables
let currentPlaylistIndex = 0;
let availablePlaylists = [];
let playlistYears = [];

function showFavoriteMusic(container) {
    // Get music playlists from the stored data
    if (window.siteData && window.siteData.musicPlaylists) {
        const playlists = window.siteData.musicPlaylists.value || window.siteData.musicPlaylists;
        
        // Create ordered list of years for navigation
        playlistYears = ['current', 'all-time', '2024', '2023', '2022', '2021', '2020', '2019', '2018', '2017', '2016', '2015'];
        availablePlaylists = playlistYears.filter(year => {
            const playlist = playlists[year];
            // tracks are nested in the response
            const tracks = playlist?.tracks?.tracks || playlist?.tracks || [];
            return tracks.length > 0;
        });
        currentPlaylistIndex = 0;
        
        if (availablePlaylists.length > 0) {
            // Get Spotify stats for intro sentence
            const spotifyStats = window.siteData?.spotifyStats?.value;
            let statsText = "";
            
            if (spotifyStats) {
                const { topArtists, topAlbums } = spotifyStats;
                const artistsList = topArtists.length > 2 ? 
                    topArtists.slice(0, -1).join(", ") + ", and " + topArtists.slice(-1) :
                    topArtists.join(" and ");
                const albumsList = topAlbums.length > 2 ? 
                    topAlbums.slice(0, -1).join(", ") + ", and " + topAlbums.slice(-1) :
                    topAlbums.join(" and ");
                statsText = `over the last six months, my top artists are ${artistsList} and my top albums are ${albumsList}.`;
            }
            
            container.innerHTML = `
                ${statsText ? `<div class="music-stats"><p class="stats-text">${statsText}</p></div>` : ""}
                
                <div class="music-nav-container">
                    ${availablePlaylists.map((year, index) => 
                        `<span class="music-nav-item clickable" data-year="${year}">${year.replace('-', '‑')}</span>`
                    ).join('<span class="separator">|</span>')}
                </div>
                
                <div class="music-playlist-content">
                    <div class="playlist-thumbnail" id="playlist-thumbnail" style="float: left; margin-right: 16px; margin-bottom: 16px;">
                        <img src="" alt="Playlist artwork" id="playlist-image" style="width: 120px; height: 120px; border-radius: 8px; object-fit: cover; display: none;" />
                    </div>
                    <div class="playlist-details" style="margin-left: 136px;">
                        <div class="playlist-title-navigation" style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                            <div class="nav-arrow nav-arrow-left" id="music-prev">‹</div>
                            <h4 class="playlist-title" id="current-playlist-title" style="margin: 0; flex-grow: 1; text-align: center;">
                                <a href="#" target="_blank" rel="noopener" class="playlist-title-link" id="playlist-link">loading...</a>
                            </h4>
                            <div class="nav-arrow nav-arrow-right" id="music-next">›</div>
                        </div>
                        <ol class="numbered-list playlist-tracks" id="current-playlist-tracks" style="margin: 0; text-align: left; padding-left: 0;">
                            <li>loading...</li>
                        </ol>
                    </div>
                    <div style="clear: both;"></div>
                </div>
            `;
            
            // year nav clicks
            const yearElements = container.querySelectorAll('.music-nav-item');
            yearElements.forEach((el, index) => {
                el.addEventListener('click', () => {
                    currentPlaylistIndex = index;
                    updateMusicPlaylistDisplay();
                    updateMusicPlaylistNavigation();
                });
            });
            
            // Add arrow navigation
            const prevArrow = container.querySelector('#music-prev');
            const nextArrow = container.querySelector('#music-next');
            
            if (prevArrow) {
                prevArrow.addEventListener('click', () => {
                    currentPlaylistIndex = (currentPlaylistIndex - 1 + availablePlaylists.length) % availablePlaylists.length;
                    updateMusicPlaylistDisplay();
                    updateMusicPlaylistNavigation();
                });
            }
            
            if (nextArrow) {
                nextArrow.addEventListener('click', () => {
                    currentPlaylistIndex = (currentPlaylistIndex + 1) % availablePlaylists.length;
                    updateMusicPlaylistDisplay();
                    updateMusicPlaylistNavigation();
                });
            }
            
            updateMusicPlaylistDisplay();
            updateMusicPlaylistNavigation();
        }
    } else {
        container.innerHTML = `
            <div class="music-playlists-container">
                <p class="loading-message">loading music playlists...</p>
            </div>
        `;
    }
}

function updateMusicPlaylistDisplay() {
    if (availablePlaylists.length === 0) return;
    
    const currentYear = availablePlaylists[currentPlaylistIndex];
    const playlists = window.siteData.musicPlaylists.value || window.siteData.musicPlaylists;
    const currentPlaylist = playlists[currentYear];
    
    const titleEl = document.getElementById('current-playlist-title');
    const tracksEl = document.getElementById('current-playlist-tracks');
    const linkEl = document.getElementById('playlist-link');
    const imageEl = document.getElementById('playlist-image');
    const thumbnailEl = document.getElementById('playlist-thumbnail');
    
    if (titleEl && tracksEl && linkEl && currentPlaylist) {
        // currentPlaylist.tracks has the actual data
        const playlistData = currentPlaylist.tracks || currentPlaylist;
        const tracks = playlistData.tracks || [];
        const playlistId = playlistData.playlistId || currentPlaylist.playlistId;
        
        // Update title and Spotify link
        const playlistUrl = `https://open.spotify.com/playlist/${playlistId}`;
        linkEl.href = playlistUrl;
        const playlistName = playlistData.name ? playlistData.name.toLowerCase() : 
                           (currentYear === 'all-time' ? 'all-time favorites' : 
                            currentYear === 'current' ? 'current favorites' : 
                            `favorites from ${currentYear}`);
        linkEl.innerHTML = `${playlistName} <img src="assets/spotify.svg" alt="Spotify" class="list-spotify-icon">`;
        
        // Update playlist thumbnail
        if (imageEl && thumbnailEl && playlistData.image) {
            imageEl.src = playlistData.image;
            imageEl.style.display = 'block';
            thumbnailEl.style.cursor = 'pointer';
            thumbnailEl.onclick = () => window.open(playlistUrl, '_blank');
        } else if (imageEl) {
            imageEl.style.display = 'none';
        }
        
        // Display tracks
        if (tracks && tracks.length > 0) {
            tracksEl.innerHTML = tracks.map((track, index) => 
                `<li>${track.title.toLowerCase()} - ${track.artist.toLowerCase()}</li>`
            ).join('');
        } else {
            tracksEl.innerHTML = '<li>no tracks found</li>';
        }
    }
}

function updateMusicPlaylistNavigation() {
    const yearElements = document.querySelectorAll('.music-nav-item');
    yearElements.forEach((el, index) => {
        if (index === currentPlaylistIndex) {
            el.classList.add('selected');
        } else {
            el.classList.remove('selected');
        }
    });
}

let currentReadIndex = 0;
let availableReads = [];
let currentReadList = 'recent'; // 'recent' or 'lastFiveYears'
let currentAnnualIndex = 0; // For annual reading lists navigation

function showFavoriteReads(container) {
    // Get favorite reads and annual reading lists from stored data
    const readsData = window.siteData?.favoriteReads?.value || window.siteData?.favoriteReads;
    const annualLists = window.siteData?.annualReadingLists?.value || [];
    
    // If no data yet, fetch it
    if (!window.siteData) {
        console.log('No siteData available, fetching...');
        container.innerHTML = `
            <div class="reads-container">
                <p class="loading-message">loading favorite reads...</p>
            </div>
        `;
        
        // Fetch the data
        fetchData().then(() => {
            // call again after data loads
            showFavoriteReads(container);
        });
        return;
    }
    
    if (readsData) {
        // handle old and new data formats
        const recentReads = readsData.recentReads || readsData.items || [];
        const lastFiveYearsReads = readsData.lastFiveYearsReads || [];
        
        // Set initial list based on currentReadList, default to recent
        if (!currentReadList) currentReadList = 'recent';
        
        if (currentReadList === 'recent') {
            availableReads = recentReads;
            currentReadIndex = 0;
        } else if (currentReadList === 'lastFiveYears') {
            availableReads = lastFiveYearsReads;
            currentReadIndex = 0;
        } else if (currentReadList === 'thisYear') {
            // For "this year", show the monthly list format instead of cards
            // Don't return early - let the HTML structure be created first
        }
        
        // Generate stats text
        let statsText = "";
        if (readsData.stats) {
            const s = readsData.stats;
            statsText = `i've read ${s.total} books so far in ${s.year} (${s.nonFiction} non-fiction, ${s.fiction} fiction). some recent favorites below, and <a href="https://docs.google.com/spreadsheets/d/13AxX67tM8fFc_aPIbTVJx_yC5MbOZx-CLNJyNTyT3cQ/edit?gid=393005093#gid=393005093" target="_blank" rel="noopener" class="external-link">full list here</a>.`;
        }

        // Build navigation items for annual lists + this year
        const thisYearReadsData = window.siteData?.thisYearReads?.value || window.siteData?.thisYearReads;
        const uniqueYears = [...new Set(annualLists.map(list => list.year))].sort((a, b) => b - a);
        
        // Create navigation items starting with "this year" if we have thisYearReads data
        let navItems = [];
        if (thisYearReadsData && thisYearReadsData.type === 'thisYear') {
            navItems.push(`<span class="reads-nav-item ${currentReadList === 'thisYear' ? 'active' : 'inactive'}" data-list="thisYear">this year</span>`);
        }
        
        // Add regular annual navigation items (excluding 2025 since we're showing "this year" instead)
        const yearNavItems = uniqueYears
            .filter(year => year !== 2025) // Exclude 2025, use "this year" instead
            .map(year => `<span class="reads-nav-item ${currentReadList === `annual-${year}` ? 'active' : 'inactive'}" data-list="annual-${year}">${year}</span>`);
        
        navItems = navItems.concat(yearNavItems);
        const annualNavItems = navItems.join('<span class="separator">|</span>');
        
        console.log('Annual nav items generated:', annualNavItems);
        console.log('Line break will be added:', annualNavItems.length > 0);
        
        container.innerHTML = `
            ${statsText ? `<div class="reading-stats"><p class="stats-text">${statsText}</p></div>` : ""}
            
            <div class="reads-nav-container">
                <span class="reads-nav-item ${currentReadList === 'recent' ? 'active' : 'inactive'}" data-list="recent">recent favs</span>
                ${lastFiveYearsReads.length > 0 ? `
                    <span class="separator">|</span>
                    <span class="reads-nav-item ${currentReadList === 'lastFiveYears' ? 'active' : 'inactive'}" data-list="lastFiveYears">last five years favs</span>
                ` : ''}
                ${annualNavItems.length > 0 ? '<br>' : ''}
                ${annualNavItems.length > 0 ? annualNavItems : ''}
            </div>
            
            <div style="margin-top: 20px;"></div>
            
            <div class="read-content">
                <div class="read-card-navigation">
                    <button class="nav-arrow nav-arrow-left" id="prev-read">‹</button>
                    <div class="read-card">
                        <p class="read-title-with-rating" id="read-title-rating">loading...</p>
                        <p class="read-author" id="read-author">loading...</p>
                        <p class="read-genre-rating" id="read-genre-rating">loading...</p>
                        <p class="read-summary" id="read-summary">loading...</p>
                    </div>
                    <button class="nav-arrow nav-arrow-right" id="next-read">›</button>
                </div>
            </div>
        `;
        
        // setup list nav
        attachReadNavListeners();
        
        // If currentReadList is 'thisYear', display the this year view instead of cards
        if (currentReadList === 'thisYear') {
            displayThisYearReads();
            updateReadNavigation();
        } else {
            // arrow nav for cards
            const prevButton = document.getElementById('prev-read');
            const nextButton = document.getElementById('next-read');
            
            if (prevButton && nextButton) {
                prevButton.addEventListener('click', () => navigateRead(-1));
                nextButton.addEventListener('click', () => navigateRead(1));
            }
            
            displayCurrentRead();
            updateReadNavigation();
        }
    } else {
        container.innerHTML = `
            <div class="reads-container">
                <p class="loading-message">loading favorite reads...</p>
            </div>
        `;
    }
}

// reattach nav listeners
function attachReadNavListeners() {
    const readNavItems = document.querySelectorAll('.reads-nav-item');
    console.log('ATTACHING LISTENERS TO', readNavItems.length, 'nav items');
    readNavItems.forEach(item => {
        console.log('Adding listener to:', item.textContent, 'with data-list:', item.getAttribute('data-list'));
        item.addEventListener('click', () => {
            const listType = item.getAttribute('data-list');
            console.log('CLICKED nav item:', item.textContent, 'listType:', listType);
            switchReadList(listType);
        });
    });
}

function switchReadList(listType) {
    console.log('SWITCH READ LIST CALLED:', listType, 'current state:', {
        currentReadList,
        currentAnnualYear,
        currentYearData
    });
    
    // Clean up any existing thisYear keyboard listeners when switching views
    if (window.thisYearKeyHandler) {
        document.removeEventListener('keydown', window.thisYearKeyHandler);
        window.thisYearKeyHandler = null;
    }
    
    const readsData = window.siteData?.favoriteReads?.value || window.siteData?.favoriteReads;
    const annualLists = window.siteData?.annualReadingLists?.value || [];
    if (!readsData) return;
    
    currentReadList = listType;
    
    // Update available reads based on selected list
    if (listType === 'recent') {
        // Reset annual view state
        console.log('SWITCHING TO RECENT - resetting annual state');
        currentAnnualYear = null;
        currentYearData = null;
        availableReads = readsData.recentReads || readsData.items || [];
        console.log('Recent reads loaded:', availableReads.length);
        currentReadIndex = 0; // Start at beginning for recent reads
        console.log('Starting at index:', currentReadIndex);
        // Show card-based display
        displayCurrentRead();
        updateReadNavigation();
        // Need to rebuild the entire reading section to switch from annual list view to card view
        console.log('CALLING showFavoriteReads to rebuild UI');
        const container = document.getElementById('dynamic-content');
        if (container) {
            showFavoriteReads(container);
        }
    } else if (listType === 'lastFiveYears') {
        // Reset annual view state
        console.log('SWITCHING TO LAST FIVE YEARS - resetting annual state');
        currentAnnualYear = null;
        currentYearData = null;
        availableReads = readsData.lastFiveYearsReads || [];
        console.log('Last five years reads loaded:', availableReads.length);
        // Randomize starting index for last five years
        currentReadIndex = availableReads.length > 0 ? Math.floor(Math.random() * availableReads.length) : 0;
        console.log('Starting at index:', currentReadIndex);
        // Show card-based display
        displayCurrentRead();
        updateReadNavigation();
        // Need to rebuild the entire reading section to switch from annual list view to card view
        console.log('CALLING showFavoriteReads to rebuild UI');
        const container = document.getElementById('dynamic-content');
        if (container) {
            showFavoriteReads(container);
        }
    } else if (listType === 'thisYear') {
        // this year monthly format
        console.log('SWITCHING TO THIS YEAR - showing monthly format');
        currentAnnualYear = null;
        currentYearData = null;
        displayThisYearReads();
        // Don't return early - let navigation styling update below
    } else if (listType.startsWith('annual-')) {
        // annual lists - show as tracklist not cards
        const year = parseInt(listType.replace('annual-', ''));
        console.log('SWITCHING TO ANNUAL YEAR:', year);
        
        // Find the annual list for this year and populate availableReads
        console.log('Available annual lists:', annualLists);
        const yearLists = annualLists.filter(list => list.year === year);
        console.log('Year lists for', year, ':', yearLists);
        
        if (yearLists.length > 0) {
            // Combine fiction and nonfiction books from all lists for this year
            availableReads = [];
            yearLists.forEach(list => {
                if (list.items && Array.isArray(list.items)) {
                    availableReads = availableReads.concat(list.items);
                } else if (list.books && Array.isArray(list.books)) {
                    availableReads = availableReads.concat(list.books);
                } else {
                    console.log('Unknown list structure:', list);
                }
            });
            currentAnnualIndex = 0;
            currentReadIndex = 0;
            console.log('Annual reads populated:', availableReads.length, 'books from', yearLists.length, 'lists');
        } else {
            console.log('No annual data found for year:', year);
            availableReads = [];
            currentAnnualIndex = 0;
            currentReadIndex = 0;
        }
        
        displayAnnualReadingLists(year, annualLists);
        // Don't return early - let navigation styling update below
    }
    
    // Update navigation styling
    const navItems = document.querySelectorAll('.reads-nav-item');
    navItems.forEach(item => {
        if (item.getAttribute('data-list') === listType) {
            item.classList.add('active');
            item.classList.remove('inactive');
        } else {
            item.classList.remove('active');
            item.classList.add('inactive');
        }
    });
}

function navigateRead(direction) {
    if (availableReads.length === 0) return;
    
    console.log('navigateRead called with direction:', direction, 'currentIndex:', currentReadIndex);
    currentReadIndex = (currentReadIndex + direction + availableReads.length) % availableReads.length;
    console.log('navigateRead new index:', currentReadIndex);
    displayCurrentRead();
    updateReadNavigation();
}

function displayCurrentRead() {
    if (availableReads.length === 0) return;
    
    const currentRead = availableReads[currentReadIndex];
    const titleEl = document.getElementById('read-title-rating');
    const authorEl = document.getElementById('read-author');
    const genreRatingEl = document.getElementById('read-genre-rating');
    const summaryEl = document.getElementById('read-summary');
    
    if (titleEl && authorEl && genreRatingEl && summaryEl && currentRead) {
        // Only show numbers for recent reads, not last five years or annual lists
        const titleText = currentReadList === 'recent' 
            ? `${currentReadIndex + 1}. ${currentRead.title.toLowerCase()}`
            : currentRead.title.toLowerCase();
        
        titleEl.textContent = titleText;
        authorEl.textContent = `by ${currentRead.author.toLowerCase()}`;
        
        // annual lists dont always have genre/summary
        if (currentRead.genre && currentRead.summary) {
            // Recent/lastFiveYears format with full data
            genreRatingEl.textContent = `${currentRead.genre.toLowerCase()}, ${currentRead.rating}/5`;
            summaryEl.textContent = currentRead.summary.toLowerCase();
        } else {
            // Annual lists format with minimal data
            genreRatingEl.textContent = `${currentRead.rating}/5`;
            summaryEl.textContent = "";
        }
    }
}

function updateReadNavigation() {
    const prevButton = document.getElementById('prev-read');
    const nextButton = document.getElementById('next-read');
    
    if (prevButton && nextButton) {
        prevButton.disabled = availableReads.length <= 1;
        nextButton.disabled = availableReads.length <= 1;
    }
}

let currentAnnualListIndex = 0;
let currentAnnualPageIndex = 0;
let availableAnnualLists = [];
let currentAnnualYear = null;

// Global variables for annual reading lists
let currentAnnualGenre = 'fiction'; // 'fiction' or 'nonfiction'
let currentAnnualPage = 1;
let currentYearData = null;

// Global variables for this year pagination
let currentThisYearPage = 0;
let thisYearPages = [];

// Function to find a book in favorite reads by title and author (for star display only)
function findBookInFavoriteReads(bookTitle, bookAuthor) {
    const readsData = window.siteData?.favoriteReads?.value || window.siteData?.favoriteReads;
    if (!readsData || !readsData.recentReads) {
        return -1;
    }
    
    const normalizeString = (str) => str.toLowerCase().trim().replace(/[^\w\s]/g, '');
    const normalizedTitle = normalizeString(bookTitle);
    const normalizedAuthor = normalizeString(bookAuthor);
    
    // Always search in recentReads, not the currently selected list
    return readsData.recentReads.findIndex(book => {
        const bookNormalizedTitle = normalizeString(book.title || '');
        const bookNormalizedAuthor = normalizeString(book.author || '');
        return bookNormalizedTitle === normalizedTitle && bookNormalizedAuthor === normalizedAuthor;
    });
}

function displayThisYearReads() {
    const thisYearReadsData = window.siteData?.thisYearReads?.value || window.siteData?.thisYearReads;
    const readContentEl = document.querySelector('.read-content');
    
    if (!readContentEl || !thisYearReadsData) {
        return;
    }
    
    const monthlyReads = thisYearReadsData.monthlyReads || [];
    
    if (monthlyReads.length === 0) {
        readContentEl.innerHTML = `
            <div class="monthly-reads-container">
                <p class="no-reads-message">no completed reads found for this year yet...</p>
            </div>
        `;
        return;
    }
    
    // Calculate pagination: max 15 lines, don't cut months in half
    thisYearPages = [];
    let currentPage = [];
    let currentLineCount = 0;
    const maxLinesPerPage = 15;
    
    for (const monthData of monthlyReads) {
        const monthName = monthData.month;
        const books = monthData.books || [];
        
        // Each month takes 1 line for header + 1 line per book
        const monthLines = 1 + books.length;
        
        // If adding this month would exceed limit, start new page
        if (currentLineCount > 0 && currentLineCount + monthLines > maxLinesPerPage) {
            thisYearPages.push([...currentPage]);
            currentPage = [];
            currentLineCount = 0;
        }
        
        currentPage.push(monthData);
        currentLineCount += monthLines;
    }
    
    // Add the last page
    if (currentPage.length > 0) {
        thisYearPages.push(currentPage);
    }
    
    // Reset to first page
    currentThisYearPage = 0;
    
    // Display initial page
    displayCurrentThisYearPage();
}

function displayCurrentThisYearPage() {
    const readContentEl = document.querySelector('.read-content');
    if (!readContentEl || thisYearPages.length === 0) return;
    
    const currentPageData = thisYearPages[currentThisYearPage] || [];
    const showNavigation = thisYearPages.length > 1;
    
    // Build monthly reading list HTML for current page
    const monthlyHtml = currentPageData.map(monthData => {
        const monthName = monthData.month;
        const books = monthData.books || [];
        
        const booksHtml = books.map(book => {
            const favoriteReadIndex = findBookInFavoriteReads(book.title, book.author);
            const isFavoriteRead = favoriteReadIndex !== -1;
            
            if (isFavoriteRead) {
                return `<div class="monthly-book">
                    <span class="book-title-author">
                        ⭐ <u>${book.title}</u> by ${book.author}
                    </span>
                </div>`;
            } else {
                return `<div class="monthly-book">
                    <span class="book-title-author"><u>${book.title}</u> by ${book.author}</span>
                </div>`;
            }
        }).join('');
        
        return `
            <div class="monthly-section">
                <h4 class="month-heading">${monthName}:</h4>
                <div class="monthly-books">${booksHtml}</div>
            </div>
        `;
    }).join('');
    
    readContentEl.innerHTML = `
        <div class="thisyear-book-container">
            ${currentThisYearPage > 0 && showNavigation ? `<button class="thisyear-arrow thisyear-arrow-left" id="thisyear-prev">‹</button>` : '<div class="thisyear-arrow-placeholder"></div>'}
            <div class="monthly-reads-list">
                ${monthlyHtml}
            </div>
            ${currentThisYearPage < thisYearPages.length - 1 && showNavigation ? `<button class="thisyear-arrow thisyear-arrow-right" id="thisyear-next">›</button>` : '<div class="thisyear-arrow-placeholder"></div>'}
        </div>
    `;
    
    // Starred books are now just visual indicators, no longer clickable
    
    // Add arrow navigation event listeners
    if (showNavigation) {
        const prevArrow = readContentEl.querySelector('#thisyear-prev');
        const nextArrow = readContentEl.querySelector('#thisyear-next');
        
        if (prevArrow) {
            prevArrow.addEventListener('click', () => {
                currentThisYearPage--;
                displayCurrentThisYearPage();
            });
        }
        
        if (nextArrow) {
            nextArrow.addEventListener('click', () => {
                currentThisYearPage++;
                displayCurrentThisYearPage();
            });
        }
        
        // Add keyboard arrow key support
        const handleKeyDown = (e) => {
            if (e.key === 'ArrowLeft' && currentThisYearPage > 0) {
                currentThisYearPage--;
                displayCurrentThisYearPage();
                e.preventDefault();
            } else if (e.key === 'ArrowRight' && currentThisYearPage < thisYearPages.length - 1) {
                currentThisYearPage++;
                displayCurrentThisYearPage();
                e.preventDefault();
            }
        };
        
        // Remove any existing keydown listeners for this year to prevent duplicates
        document.removeEventListener('keydown', window.thisYearKeyHandler);
        
        // store handler ref for cleanup
        window.thisYearKeyHandler = handleKeyDown;
        document.addEventListener('keydown', handleKeyDown);
    } else {
        // Remove keyboard listener if no navigation
        if (window.thisYearKeyHandler) {
            document.removeEventListener('keydown', window.thisYearKeyHandler);
            window.thisYearKeyHandler = null;
        }
    }
}

function displayAnnualReadingLists(year, annualLists) {
    const yearLists = annualLists.filter(list => list.year === year);
    const readContentEl = document.querySelector('.read-content');
    
    if (!readContentEl) return;
    
    if (yearLists.length === 0) {
        readContentEl.innerHTML = `<p>No books found for ${year}</p>`;
        return;
    }
    
    // Store current year data
    currentAnnualYear = year;
    currentYearData = {
        fiction: yearLists.find(list => list.type === 'fiction'),
        nonfiction: yearLists.find(list => list.type === 'nonfiction')
    };
    
    // Default to fiction
    currentAnnualGenre = 'fiction';
    currentAnnualPage = 1;
    
    // Display the initial view
    displayCurrentAnnualView();
    
    // update nav styling
    const navItems = document.querySelectorAll('.reads-nav-item');
    navItems.forEach(item => {
        if (item.getAttribute('data-list') === `annual-${year}`) {
            item.classList.add('active');
            item.classList.remove('inactive');
        } else {
            item.classList.remove('active');
            item.classList.add('inactive');
        }
    });
    
    // Reattach event listeners since navigation items might have been updated
    attachReadNavListeners();
}

function displayCurrentAnnualView() {
    const readContentEl = document.querySelector('.read-content');
    if (!readContentEl || !currentYearData) return;
    
    const currentList = currentYearData[currentAnnualGenre];
    if (!currentList) return;
    
    const books = currentList.items || [];
    const booksPerPage = 12;
    const totalPages = Math.ceil(books.length / booksPerPage);
    
    // Calculate books for current page
    const startIdx = (currentAnnualPage - 1) * booksPerPage;
    const endIdx = Math.min(startIdx + booksPerPage, books.length);
    const pageBooks = books.slice(startIdx, endIdx);
    
    // Build fiction/non-fiction buttons
    const genreButtons = `
        <div class="genre-nav-container">
            <span class="genre-nav-item ${currentAnnualGenre === 'fiction' ? 'active' : 'inactive'}" onclick="switchGenre('fiction')">fiction</span>
            <span class="separator">|</span>
            <span class="genre-nav-item ${currentAnnualGenre === 'nonfiction' ? 'active' : 'inactive'}" onclick="switchGenre('nonfiction')">non-fiction</span>
        </div>
    `;
    
    // Build book list with arrows positioned in vertical middle
    const canGoPrev = currentAnnualPage > 1;
    const canGoNext = currentAnnualPage < totalPages;
    
    let content = `
        ${genreButtons}
        <div class="annual-book-container">
            ${canGoPrev ? `<button class="annual-arrow annual-arrow-left" onclick="prevAnnualPage()">‹</button>` : '<div class="annual-arrow-placeholder"></div>'}
            <ol class="numbered-list annual-book-list" style="counter-reset: list-counter ${startIdx};">`;
    
    // add books (css handles numbering)
    pageBooks.forEach((book, index) => {
        content += `<li><span class="book-title">${book.title.toLowerCase()}</span> by ${book.author.toLowerCase()} (${book.rating}/5)</li>`;
    });
    
    content += `</ol>
            ${canGoNext ? `<button class="annual-arrow annual-arrow-right" onclick="nextAnnualPage()">›</button>` : '<div class="annual-arrow-placeholder"></div>'}
        </div>
    `;
    
    readContentEl.innerHTML = content;
}

function switchGenre(genre) {
    currentAnnualGenre = genre;
    currentAnnualPage = 1; // Reset to first page when switching genres
    displayCurrentAnnualView();
}

function nextAnnualPage() {
    if (!currentYearData || !currentYearData[currentAnnualGenre]) return;
    
    const books = currentYearData[currentAnnualGenre].items || [];
    const totalPages = Math.ceil(books.length / 12);
    
    if (currentAnnualPage < totalPages) {
        currentAnnualPage++;
        displayCurrentAnnualView();
    }
}

function prevAnnualPage() {
    if (currentAnnualPage > 1) {
        currentAnnualPage--;
        displayCurrentAnnualView();
    }
}

function displayCurrentAnnualList() {
    const readContentEl = document.querySelector('.read-content');
    if (!readContentEl || !availableAnnualLists || availableAnnualLists.length === 0) return;
    
    const currentList = availableAnnualLists[currentAnnualListIndex];
    const year = currentList.year;
    const genre = currentList.type;
    const books = currentList.items || [];
    
    // Build title with pagination if needed
    let titleText = `${year} ${genre}`;
    if (currentList.isPartial) {
        titleText += ` (${currentList.pageNumber} of ${currentList.totalPages})`;
    }
    
    // Always show arrows, disable if at boundaries
    const isFirstList = currentAnnualListIndex === 0;
    const isLastList = currentAnnualListIndex === availableAnnualLists.length - 1;
    
    // Build content with arrows next to title
    let content = `
        <div class="read-list-header">
            <button class="nav-arrow nav-arrow-left" onclick="prevAnnualList()" ${isFirstList ? 'disabled' : ''}>‹</button>
            <h4 class="read-list-title">${titleText}</h4>
            <button class="nav-arrow nav-arrow-right" onclick="nextAnnualList()" ${isLastList ? 'disabled' : ''}>›</button>
        </div>
        <ol class="numbered-list annual-book-list">`;
    
    // Calculate global index for numbering
    const booksPerPage = 12;
    const baseIndex = currentList.pageNumber > 1 ? (currentList.pageNumber - 1) * booksPerPage : 0;
    
    books.forEach((book, index) => {
        const globalIndex = baseIndex + index + 1;
        content += `<li><span class="book-number">${globalIndex}.</span> ${book.title.toLowerCase()} by ${book.author.toLowerCase()} (${book.rating}/5)</li>`;
    });
    
    content += `</ol>`;
    readContentEl.innerHTML = content;
}

function nextAnnualList() {
    if (currentAnnualListIndex < availableAnnualLists.length - 1) {
        currentAnnualListIndex++;
        displayCurrentAnnualList();
    }
}

function prevAnnualList() {
    if (currentAnnualListIndex > 0) {
        currentAnnualListIndex--;
        displayCurrentAnnualList();
    }
}

function showRecordCollection(container) {
    container.innerHTML = `
        <div class="record-swiper-container">
            <div class="swiper record-swiper">
                <div class="swiper-wrapper" id="dynamic-record-carousel">
                    <!-- Records will be populated by JavaScript -->
                </div>
                <div class="swiper-button-next"></div>
                <div class="swiper-button-prev"></div>
            </div>
        </div>
    `;
    // init records - wait for page readiness
    waitForReadyThenInitialize(() => initializeRecordCollection('dynamic-record-carousel'), 'records');
}

function showShoeCollection(container) {
    container.innerHTML = `
        <div class="shoe-swiper-container">
            <div class="swiper shoe-swiper">
                <div class="swiper-wrapper" id="dynamic-shoe-carousel">
                    <!-- Shoes will be populated by JavaScript -->
                </div>
                <div class="swiper-button-next"></div>
                <div class="swiper-button-prev"></div>
            </div>
        </div>
    `;
    // init shoes - wait for page readiness  
    waitForReadyThenInitialize(() => initializeShoeCollection('dynamic-shoe-carousel'), 'shoes');
}

function showJerseyCollection(container) {
    container.innerHTML = `
        <div class="jersey-swiper-container">
            <div class="swiper jersey-swiper">
                <div class="swiper-wrapper" id="dynamic-jersey-carousel">
                    <!-- Jerseys will be populated by JavaScript -->
                </div>
                <div class="swiper-button-next"></div>
                <div class="swiper-button-prev"></div>
            </div>
        </div>
    `;
    // init jerseys - wait for page readiness
    waitForReadyThenInitialize(() => initializeJerseyCollection('dynamic-jersey-carousel'), 'jerseys');
}

function showCreativeWork(container, type) {
    if (type === 'builds') {
        container.innerHTML = `
            <div class="weird-ideas-content">
                <p class="play-category-description">remember as a kid, being obsessed with making things? this is me, trying to hold onto that. more side quests than side hustles. one part creative wonder, one part disciplined tinkering.</p>
                
                <p class="weird-ideas-link">see more at <a href="https://www.weirdlittleideas.com" target="_blank" rel="noopener" class="section-link">weirdlittleideas.com</a></p>
                
                <div class="weird-ideas-gif">
                    <a href="https://www.weirdlittleideas.com" target="_blank" rel="noopener">
                        <img src="https://weirdlittleideas.com/img/wli-guy-footer.gif" alt="Weird Little Ideas" class="weird-ideas-image" />
                    </a>
                </div>
            </div>
        `;
    } else if (type === 'music') {
        container.innerHTML = `
            <div class="wait-what-content">
                <p class="play-category-description">created a record sampling biggie and the xx when i was 24. a million downloads in 10 days, coverage in rolling stone, new york magazine, guardian uk. started playing shows and getting booked for festivals. traveled all over to play music with my friends.</p>
                
                <p class="wait-what-link">listen at <a href="http://www.waitwhatmusic.com/" target="_blank" rel="noopener" class="section-link">waitwhatmusic.com</a></p>
                
                <div class="wait-what-image">
                    <a href="http://www.waitwhatmusic.com/" target="_blank" rel="noopener">
                        <img src="assets/albums.jpg" alt="Wait What Album Covers" class="wait-what-album" />
                    </a>
                </div>
            </div>
        `;
    } else if (type === 'writing') {
        container.innerHTML = `
            <div class="writing-content">
                <p class="play-category-description">ideas that pique my interest and feel worth thinking more about. strong emphasis on interesting human behavior, where trends are heading, and our collective experiences and cultural touchstones. all viewed through the lens of the internet.</p>
                
                <p class="writing-link">read <a href="https://ckubal.substack.com/" target="_blank" rel="noopener" class="section-link">things i think about</a></p>
                
                <div class="writing-image">
                    <a href="https://ckubal.substack.com/" target="_blank" rel="noopener">
                        <img src="assets/writing.webp" alt="Things I Think About" class="writing-brain-image" />
                    </a>
                </div>
            </div>
        `;
    } else if (type === 'cirque-disobey') {
        container.innerHTML = `
            <div class="cirque-disobey-content">
                <p class="play-category-description">nearly 300 cartoons paired with rap lyrics for comedic effect. created and sold physical copies with proceeds benefiting urban gateways. unedited parodies intended for mature audiences who appreciate both art and hip hop.</p>
                
                <p class="cirque-disobey-link">download free <a href="https://weirdlittleideas.com/img/objects/cirquedisobey/cirquedisobey_v2.pdf" target="_blank" rel="noopener" class="section-link">cirque disobey pdf</a></p>
                
                <div class="cirque-disobey-image">
                    <a href="https://weirdlittleideas.com/img/objects/cirquedisobey/cirquedisobey_v2.pdf" target="_blank" rel="noopener">
                        <img src="assets/cirque-disobey.png" alt="Cirque Disobey Book Cover" class="cirque-disobey-book" />
                    </a>
                </div>
            </div>
        `;
    }
}


// Lists navigation functionality
function initializeListNavigation() {
    const prevButton = document.getElementById('prev-list');
    const nextButton = document.getElementById('next-list');
    
    if (prevButton && nextButton) {
        prevButton.addEventListener('click', () => navigateList(-1));
        nextButton.addEventListener('click', () => navigateList(1));
    }
}

function navigateList(direction) {
    if (availableLists.length === 0) return;
    
    currentListIndex += direction;
    
    // Wrap around
    if (currentListIndex < 0) {
        currentListIndex = availableLists.length - 1;
    } else if (currentListIndex >= availableLists.length) {
        currentListIndex = 0;
    }
    
    displayCurrentList();
    updateNavigationButtons();
}

function displayCurrentList() {
    if (availableLists.length === 0) return;
    
    const currentList = availableLists[currentListIndex];
    const titleEl = document.getElementById('current-list-title');
    const itemsEl = document.getElementById('current-list-items');
    
    if (titleEl && itemsEl && currentList) {
        // Show title with playlist link if available
        if (currentList.playlistUrl) {
            titleEl.innerHTML = `<a href="${currentList.playlistUrl}" target="_blank" rel="noopener" class="list-title-link">${currentList.title} <img src="assets/spotify.svg" alt="Spotify" class="list-spotify-icon"></a>`;
        } else {
            titleEl.innerHTML = `<span class="list-title-no-link">${currentList.title}</span>`;
        }
        
        // Clear existing items
        itemsEl.innerHTML = '';
        
        // Add numbered items
        currentList.items.forEach(item => {
            const li = document.createElement('li');
            li.textContent = item;
            itemsEl.appendChild(li);
        });
    }
}

function updateNavigationButtons() {
    const prevButton = document.getElementById('prev-list');
    const nextButton = document.getElementById('next-list');
    
    if (prevButton && nextButton) {
        // Disable buttons if only one list or no lists
        const hasMultipleLists = availableLists.length > 1;
        prevButton.disabled = !hasMultipleLists;
        nextButton.disabled = !hasMultipleLists;
    }
}

function initializeLists(data) {
    // Extract taste music lists from API data
    const tasteLists = data.tasteMusicLists?.value || data.tasteMusicLists;
    
    if (tasteLists && Array.isArray(tasteLists)) {
        availableLists = tasteLists;
        currentListIndex = 0;
        displayCurrentList();
        updateNavigationButtons();
    }
}

let currentPodcastIndex = 0;
let availablePodcasts = [];


function showPodcastEpisodes(container) {
    console.log('showPodcastEpisodes called, siteData:', window.siteData);
    console.log('podcastEpisodes in siteData:', window.siteData?.podcastEpisodes);
    
    // Get podcast episodes from the stored data  
    const podcastData = window.siteData?.podcastEpisodes?.value || window.siteData?.podcastEpisodes;
    if (podcastData && Array.isArray(podcastData)) {
        availablePodcasts = podcastData;
        currentPodcastIndex = 0;
        console.log('Found podcast episodes:', availablePodcasts.length);
        
        container.innerHTML = `
            <h4 class="podcast-title">
                <a href="https://open.spotify.com/playlist/0kcYF4CGf8G9BlzZSqXHyW" target="_blank" rel="noopener" class="podcast-playlist-link">
                    favorite podcast episodes <img src="assets/spotify.svg" alt="Spotify" class="list-spotify-icon">
                </a>
            </h4>
            
            <div class="podcast-content">
                <div class="podcast-episode-navigation">
                    <button class="nav-arrow nav-arrow-left" id="prev-podcast">‹</button>
                    <div class="podcast-episode" id="current-podcast-episode">
                        <div class="podcast-episode-content">
                            <div class="podcast-thumbnail" id="podcast-thumbnail">
                                <img src="" alt="Podcast artwork" id="podcast-artwork">
                            </div>
                            <div class="podcast-text">
                                <h5 class="episode-title" id="episode-title">loading...</h5>
                                <p class="episode-show" id="episode-show">loading...</p>
                                <p class="episode-description" id="episode-description">loading...</p>
                            </div>
                        </div>
                    </div>
                    <button class="nav-arrow nav-arrow-right" id="next-podcast">›</button>
                </div>
            </div>
        `;
        
        // Initialize navigation
        document.getElementById('prev-podcast').addEventListener('click', () => navigatePodcast(-1));
        document.getElementById('next-podcast').addEventListener('click', () => navigatePodcast(1));
        
        displayCurrentPodcast();
        updatePodcastNavigation();
    } else {
        container.innerHTML = `
            <h4 class="podcast-title">favorite podcast episodes</h4>
            <p>loading podcast data...</p>
        `;
        
        // Try again in a moment if data isn't loaded yet
        setTimeout(() => {
            if (window.siteData && window.siteData.podcastEpisodes) {
                showPodcastEpisodes(container);
            }
        }, 1000);
    }
}

function navigatePodcast(direction) {
    if (availablePodcasts.length === 0) return;
    
    currentPodcastIndex = (currentPodcastIndex + direction + availablePodcasts.length) % availablePodcasts.length;
    displayCurrentPodcast();
    updatePodcastNavigation();
}

function cleanEpisodeDescription(description) {
    if (!description || description === "no description available") return description;
    
    // split into sentences - handles weird spacing
    // regex is gnarly but catches most cases
    const sentences = description.split(/(?<=[.!?])(?:\s+|(?=[A-Z]))/);
    const cleanSentences = [];
    
    for (let i = 0; i < sentences.length && cleanSentences.length < 6; i++) {
        const sentence = sentences[i].trim();
        if (!sentence) continue;
        
        // Always include at least the first sentence
        if (cleanSentences.length === 0) {
            cleanSentences.push(sentence);
            continue;
        }
        
        // For subsequent sentences, apply filtering rules
        // Check for URLs
        if (sentence.includes('http') || sentence.includes('www.') || sentence.includes('.com') || sentence.includes('.org')) {
            break;
        }
        
        // Check for full names (firstname lastname pattern)
        if (/\b[A-Z][a-z]+ [A-Z][a-z]+\b/.test(sentence)) {
            break;
        }
        
        // Check for credits/production indicators
        if (/\b(written by|credits|produced by|add choices)\b/i.test(sentence)) {
            break;
        }
        
        // Check for period followed immediately by capital letter (no space)
        // This catches malformed sentences like "end of sentence.Start of next"
        if (/\.[A-Z]/.test(sentence)) {
            break;
        }
        
        cleanSentences.push(sentence);
    }
    
    // Ensure minimum of 1 sentence
    if (cleanSentences.length === 0) {
        return sentences[0] || "no description available";
    }
    
    return cleanSentences.join(' ').substring(0, 500); // Also limit total length
}

function displayCurrentPodcast() {
    if (availablePodcasts.length === 0) return;
    
    const currentEpisode = availablePodcasts[currentPodcastIndex];
    const titleEl = document.getElementById('episode-title');
    const showEl = document.getElementById('episode-show');
    const descEl = document.getElementById('episode-description');
    
    if (titleEl && showEl && descEl && currentEpisode) {
        // Remove #number prefix from episode titles
        const cleanTitle = currentEpisode.name.replace(/^#\d+\s*/, '');
        
        // Put number and title on same line
        if (currentEpisode.url) {
            titleEl.innerHTML = `${currentPodcastIndex + 1}. <a href="${currentEpisode.url}" target="_blank" rel="noopener" class="episode-title-link">${cleanTitle} <img src="assets/spotify.svg" alt="Spotify" class="list-spotify-icon"></a>`;
        } else {
            titleEl.textContent = `${currentPodcastIndex + 1}. ${cleanTitle}`;
        }
        
        showEl.textContent = currentEpisode.show;
        const cleanedDescription = cleanEpisodeDescription(currentEpisode.description || currentEpisode.synopsis || "no description available");
        descEl.textContent = cleanedDescription;
        
        // Update podcast artwork
        const artworkEl = document.getElementById('podcast-artwork');
        if (artworkEl && currentEpisode.showArtwork) {
            artworkEl.src = currentEpisode.showArtwork;
            artworkEl.style.display = 'block';
        } else if (artworkEl) {
            artworkEl.style.display = 'none';
        }
    }
}

function updatePodcastNavigation() {
    const prevButton = document.getElementById('prev-podcast');
    const nextButton = document.getElementById('next-podcast');
    
    if (prevButton && nextButton) {
        prevButton.disabled = availablePodcasts.length <= 1;
        nextButton.disabled = availablePodcasts.length <= 1;
    }
}

// Function to initialize everything after ensuring resources are loaded
function initializeEverything() {
    initializeLoading();
    initializeBioNavigation();
    initializeDynamicContent();
    initializeExperienceItems();
    initializePlayCategories();
    initializeTasteCategories();
    initializeExpandButtons();
    initializeShoeCollection();
    initializeCollectionToggle();
    
    // Fetch data after UI is initialized
    fetchData();
    
    // Refresh every 5 minutes
    setInterval(fetchData, 5 * 60 * 1000);
}

// Theme toggle functionality
function initializeThemeToggle() {
    const themeToggle = document.getElementById('theme-toggle');
    const themeIcon = themeToggle?.querySelector('img');
    
    if (!themeToggle) return;
    
    // Check for saved theme preference or default to dark
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);
    
    themeToggle.addEventListener('click', (e) => {
        e.preventDefault(); // Prevent default anchor behavior
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        setTheme(newTheme);
        localStorage.setItem('theme', newTheme);
    });
    
    function setTheme(theme) {
        if (theme === 'light') {
            document.documentElement.setAttribute('data-theme', 'light');
            themeIcon.textContent = '●'; // Dot for both modes - border/fill provides the visual cue
        } else {
            document.documentElement.removeAttribute('data-theme');
            themeIcon.textContent = '●'; // Dot for both modes - border/fill provides the visual cue
        }
    }
}

// Initial load - wait for everything to be ready
document.addEventListener('DOMContentLoaded', () => {
    // Track page load time for swiper initialization timing
    window.pageLoadTime = Date.now();
    
    // Initialize theme toggle first
    initializeThemeToggle();
    
    // Check if fonts are loaded, otherwise wait a bit
    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => {
            setTimeout(initializeEverything, 100);
        });
    } else {
        // Fallback for browsers without font loading API
        setTimeout(initializeEverything, 300);
    }
});

// Optional: Add click to refresh
document.addEventListener('keydown', (e) => {
    if (e.key === 'r' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        initializeLoading();
        fetchData();
    }
    
    // Arrow key navigation for music playlists (when favorite-music is active)
    if (document.querySelector('.highlight.clickable[data-target="favorite-music"].active')) {
        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            currentPlaylistIndex = currentPlaylistIndex > 0 ? currentPlaylistIndex - 1 : availablePlaylists.length - 1;
            updateMusicPlaylistDisplay();
            updateMusicPlaylistNavigation();
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            currentPlaylistIndex = currentPlaylistIndex < availablePlaylists.length - 1 ? currentPlaylistIndex + 1 : 0;
            updateMusicPlaylistDisplay();
            updateMusicPlaylistNavigation();
        }
    }
    
    // Arrow key navigation for reading lists (when favorite-reads is active)
    // Only handle thisYear and annual lists here - recent/lastFiveYears handled by main handler above
    if (document.querySelector('.highlight.clickable[data-target="favorite-reads"].active')) {
        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            if (currentReadList === 'thisYear') {
                // This year pagination navigation
                if (currentThisYearPage > 0) {
                    currentThisYearPage--;
                    displayCurrentThisYearPage();
                }
            } else if (currentReadList && currentReadList.startsWith('annual-')) {
                // Annual list navigation
                console.log('Annual left navigation - currentAnnualIndex:', currentAnnualIndex, 'availableReads:', availableReads?.length);
                if (currentAnnualIndex > 0) {
                    currentAnnualIndex--;
                    // For annual lists, we need to update currentReadIndex to match currentAnnualIndex
                    currentReadIndex = currentAnnualIndex;
                    displayCurrentRead();
                    updateReadNavigation();
                }
            } else if (availableReads && availableReads.length > 0 && currentReadList !== 'recent' && currentReadList !== 'lastFiveYears') {
                // Regular reading list navigation - SKIP recent/lastFiveYears (handled by main handler)
                currentReadIndex = currentReadIndex > 0 ? currentReadIndex - 1 : availableReads.length - 1;
                displayCurrentRead();
                updateReadNavigation();
            }
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            if (currentReadList === 'thisYear') {
                // This year pagination navigation
                if (currentThisYearPage < thisYearPages.length - 1) {
                    currentThisYearPage++;
                    displayCurrentThisYearPage();
                }
            } else if (currentReadList && currentReadList.startsWith('annual-')) {
                // Annual list navigation
                console.log('Annual right navigation - currentAnnualIndex:', currentAnnualIndex, 'availableReads:', availableReads?.length);
                console.log('Current availableReads:', availableReads);
                console.log('Condition check:', availableReads && currentAnnualIndex < availableReads.length - 1);
                if (availableReads && currentAnnualIndex < availableReads.length - 1) {
                    console.log('NAVIGATING ANNUAL: from index', currentAnnualIndex, 'to', currentAnnualIndex + 1);
                    currentAnnualIndex++;
                    // For annual lists, we need to update currentReadIndex to match currentAnnualIndex
                    currentReadIndex = currentAnnualIndex;
                    console.log('Updated currentReadIndex to:', currentReadIndex);
                    console.log('About to display book:', availableReads[currentReadIndex]);
                    displayCurrentRead();
                    updateReadNavigation();
                } else {
                    console.log('ANNUAL NAVIGATION BLOCKED - at end or no data');
                }
            } else if (availableReads && availableReads.length > 0 && currentReadList !== 'recent' && currentReadList !== 'lastFiveYears') {
                // Regular reading list navigation - SKIP recent/lastFiveYears (handled by main handler)
                currentReadIndex = currentReadIndex < availableReads.length - 1 ? currentReadIndex + 1 : 0;
                displayCurrentRead();
                updateReadNavigation();
            }
        }
    }
    
    // Arrow key navigation for podcasts (when podcasts is active)
    if (document.querySelector('.highlight.clickable[data-target="podcasts"].active')) {
        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            navigatePodcast(-1);
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            navigatePodcast(1);
        }
    }
    
    // Arrow key navigation for books - ONLY for recent/lastFiveYears (not annual lists)
    const isFavoriteReadsActive = document.querySelector('.highlight.clickable[data-target="favorite-reads"].active');
    const hasReadNavButtons = document.querySelector('.read-nav-buttons');
    const isInFavoritesView = (currentReadList === 'recent' || currentReadList === 'lastFiveYears') && availableReads && availableReads.length > 0;
    
    // Debug logging
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        console.log('Arrow key pressed:', e.key);
        console.log('isFavoriteReadsActive:', !!isFavoriteReadsActive);
        console.log('hasReadNavButtons:', !!hasReadNavButtons);
        console.log('currentReadList:', currentReadList);
        console.log('availableReads length:', availableReads ? availableReads.length : 'undefined');
        console.log('isInFavoritesView:', isInFavoritesView);
        console.log('currentReadIndex before:', currentReadIndex);
    }
    
    // ONLY handle recent/lastFiveYears here - annual lists handled below
    if (isFavoriteReadsActive && isInFavoritesView) {
        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            console.log('Navigating left, calling navigateRead(-1)');
            navigateRead(-1);
            console.log('currentReadIndex after:', currentReadIndex);
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            console.log('Navigating right, calling navigateRead(1)');
            navigateRead(1);
            console.log('currentReadIndex after:', currentReadIndex);
        }
    }
    
    // Arrow key navigation for work experience (when work-[company] is active)
    const activeWorkHighlight = document.querySelector('.highlight.clickable[data-target^="work-"].active');
    if (activeWorkHighlight) {
        const experienceNames = Array.from(document.querySelectorAll('.experience-name-inline'));
        const activeExperience = document.querySelector('.experience-name-inline.active');
        
        if (activeExperience && experienceNames.length > 0) {
            const currentIndex = experienceNames.indexOf(activeExperience);
            
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                const prevIndex = currentIndex > 0 ? currentIndex - 1 : experienceNames.length - 1;
                experienceNames[prevIndex].click();
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                const nextIndex = currentIndex < experienceNames.length - 1 ? currentIndex + 1 : 0;
                experienceNames[nextIndex].click();
            }
        }
    }
    
    // Arrow key navigation for investments (when investing is active)
    if (document.querySelector('.highlight.clickable[data-target="investing"].active')) {
        const allInvestmentNames = Array.from(document.querySelectorAll('.investment-name-inline.active, .syndicate-name.active'));
        const activeInvestment = allInvestmentNames[0];
        
        if (activeInvestment) {
            const allNames = Array.from(document.querySelectorAll('.investment-name-inline, .syndicate-name'));
            const currentIndex = allNames.indexOf(activeInvestment);
            
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                const prevIndex = currentIndex > 0 ? currentIndex - 1 : allNames.length - 1;
                allNames[prevIndex].click();
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                const nextIndex = currentIndex < allNames.length - 1 ? currentIndex + 1 : 0;
                allNames[nextIndex].click();
            }
        }
    }
    
    // Arrow key navigation for Swiper collections (when records or sneakers is active)
    const recordsActive = document.querySelector('.highlight.clickable[data-target="records"].active');
    const sneakersActive = document.querySelector('.highlight.clickable[data-target="sneakers"].active');
    
    if (recordsActive || sneakersActive) {
        // Let Swiper handle the arrow keys - no need to prevent default
        // The Swiper keyboard module will automatically work when enabled
    }
    
    // Arrow key navigation for taste lists (when goat-rappers is active)
    if (document.querySelector('.highlight.clickable[data-target="goat-rappers"].active')) {
        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            navigateTasteList(-1);
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            navigateTasteList(1);
        }
    }
});