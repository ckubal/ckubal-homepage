// API endpoint
const API_URL = 'https://us-central1-ckubal-homepage-be.cloudfunctions.net/getSiteData';

// DOM elements
const currentSongEl = document.getElementById('current-song');
const currentBookEl = document.getElementById('current-book');
const weatherInfoEl = document.getElementById('weather-info');
const sleepInfoEl = document.getElementById('sleep-info');
const lastUpdatedEl = document.getElementById('last-updated');

// Utility functions
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
        'great': 'slept great',
        'good': 'slept good',
        'okay': 'slept okay',
        'not the best': 'slept not the best'
    };
    
    const statusText = statusMap[status] || status;
    return performance ? `${statusText} (${performance}%)` : statusText;
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
        showError();
    }
}

function updateUI(data) {
    // Update current song
    if (data.currentSong) {
        const { title, artist } = data.currentSong;
        currentSongEl.textContent = `${title} by ${artist}`;
        currentSongEl.classList.remove('loading');
    }
    
    // Update current book
    if (data.currentBook) {
        const { title, author } = data.currentBook;
        currentBookEl.textContent = `${title} by ${author}`;
        currentBookEl.classList.remove('loading');
    }
    
    // Update weather
    if (data.weatherInfo) {
        const { temp, description, city } = data.weatherInfo;
        if (temp && description && city) {
            weatherInfoEl.textContent = `${temp}°c, ${description} in ${city.toLowerCase()}`;
        } else if (data.weatherInfo.error) {
            weatherInfoEl.textContent = 'weather unavailable';
        }
        weatherInfoEl.classList.remove('loading');
    }
    
    // Update sleep status
    if (data.sleepStatus) {
        const { status, performance } = data.sleepStatus;
        sleepInfoEl.textContent = mapSleepStatus(status, performance);
        sleepInfoEl.classList.remove('loading');
    }
    
    // Update last updated time
    if (data.lastUpdated) {
        const timeAgo = getTimeSince(data.lastUpdated);
        lastUpdatedEl.textContent = `last updated ${timeAgo}`;
    }
}

function showError() {
    currentSongEl.textContent = 'unable to load';
    currentBookEl.textContent = 'unable to load';
    weatherInfoEl.textContent = 'unable to load';
    sleepInfoEl.textContent = 'unable to load';
    lastUpdatedEl.textContent = 'connection error';
    
    // Remove loading classes
    document.querySelectorAll('.loading').forEach(el => {
        el.classList.remove('loading');
    });
}

// Initialize loading states
function initializeLoading() {
    currentSongEl.classList.add('loading');
    currentBookEl.classList.add('loading');
    weatherInfoEl.classList.add('loading');
    sleepInfoEl.classList.add('loading');
}

// Initial load
document.addEventListener('DOMContentLoaded', () => {
    initializeLoading();
    fetchData();
    
    // Refresh every 5 minutes
    setInterval(fetchData, 5 * 60 * 1000);
});

// Optional: Add click to refresh
document.addEventListener('keydown', (e) => {
    if (e.key === 'r' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        initializeLoading();
        fetchData();
    }
});