const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");

// Initialize Firebase Admin SDK (only needs to be done once)
admin.initializeApp();
const db = admin.firestore();

// --- Helper Functions for API Calls (Implement details later) ---

async function getSpotifyData() {
    functions.logger.info("Fetching Spotify data...");

    try {
        // Get stored refresh token from Firestore
        const tokenDoc = await db.collection("config").doc("spotify").get();
        if (!tokenDoc.exists) {
            functions.logger.warn("No Spotify refresh token found");
            return { title: "Connect Spotify", artist: "Setup needed", fetchedAt: new Date() };
        }

        const refreshToken = tokenDoc.data().refresh_token;
        const clientId = functions.config().spotify.client_id;
        const clientSecret = functions.config().spotify.client_secret;

        // Get fresh access token using refresh token
        const tokenResponse = await axios.post("https://accounts.spotify.com/api/token",
            new URLSearchParams({
                grant_type: "refresh_token",
                refresh_token: refreshToken,
            }), {
                headers: {
                    "Authorization": `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
                    "Content-Type": "application/x-www-form-urlencoded",
                },
            },
        );

        const accessToken = tokenResponse.data.access_token;

        // Get first track from specific playlist
        const playlistId = "78o6nYffU84LaDXu5V3tIh";

        // First, get playlist details to confirm we have the right one
        const playlistDetailsResponse = await axios.get(`https://api.spotify.com/v1/playlists/${playlistId}`, {
            headers: { "Authorization": `Bearer ${accessToken}` },
        });

        functions.logger.info(`Fetching from playlist: ${playlistDetailsResponse.data.name}`);

        const playlistResponse = await axios.get(`https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=1`, {
            headers: { "Authorization": `Bearer ${accessToken}` },
        });

        if (playlistResponse.data?.items?.length > 0) {
            const track = playlistResponse.data.items[0].track;
            functions.logger.info(`First track: ${track.name} by ${track.artists[0].name}`);
            return {
                title: track.name,
                artist: track.artists[0].name,
                playlistName: playlistDetailsResponse.data.name,
                fetchedAt: new Date(),
            };
        }

        return { title: "Playlist empty", artist: "", fetchedAt: new Date() };
    } catch (error) {
        functions.logger.error("Error fetching Spotify data:", error);
        return { title: "Spotify unavailable", artist: "", fetchedAt: new Date() };
    }
}

async function getWhoopData() {
    // TODO: Implement Whoop API call using OAuth refresh token
    // Needs secure storage for refresh token
    functions.logger.info("Fetching Whoop data...");
    // Example structure based on previous discussion
    // (Sleep Performance %):
    // const response = await axios.get('WHOOP_API_ENDPOINT/v1/activity/sleep?limit=1',
    // { headers: { 'Authorization': `Bearer ${accessToken}` }});
    // const performance = response.data.records[0]?.score?.sleep_performance_percentage;
    // let status = "unknown";
    // if (performance > 85) status = "great";
    // else if (performance >= 70) status = "good";
    // else if (performance >= 55) status = "okay";
    // else if (performance < 55) status = "not the best";
    // return { status: status, performance: performance };
    return { status: "good", performance: 80, fetchedAt: new Date() }; // Placeholder
}

async function getBookData() {
    // TODO: Implement Google Sheets API call (or other chosen method)
    functions.logger.info("Fetching Book data...");
    // Example for Google Sheets (requires googleapis library and auth)
    // return { title: "Example Book", author: "Example Author" };
    return { title: "Designing Data-Intensive Applications",
        author: "Martin Kleppmann", fetchedAt: new Date() }; // Placeholder
}

async function getWeatherData() {
    functions.logger.info("Fetching Weather data...");
    const apiKey = functions.config().openweathermap?.key;

    if (!apiKey) {
        functions.logger.error("OpenWeatherMap API Key not set.");
        return { error: "Weather API key missing" };
    }

    try {
        // Get stored location
        const locationDoc = await db.collection("config").doc("location").get();
        let lat = 33.7749; // Default to SF
        let lng = -122.4194;

        if (locationDoc.exists) {
            const locationData = locationDoc.data();
            lat = locationData.lat;
            lng = locationData.lng;
        }

        const baseUrl = "https://api.openweathermap.org/data/2.5/weather";
        const url = `${baseUrl}?lat=${lat}&lon=${lng}&appid=${apiKey}&units=imperial`;

        const response = await axios.get(url);
        return {
            city: response.data.name,
            temp: Math.round(response.data.main.temp),
            description: response.data.weather[0]?.description,
            icon: response.data.weather[0]?.icon,
            fetchedAt: new Date(),
        };
    } catch (error) {
        functions.logger.error("Error fetching weather:", error);
        return { error: "Could not fetch weather" };
    }
}

// --- Main Scheduled Function ---

// --- Main Scheduled Function ---

exports.fetchAndStoreData = functions.pubsub.schedule("every 15 minutes").onRun(async (context) => {
// Or use functions.https.onCall or functions.https.onRequest if triggered via HTTP from Cloud Scheduler
// exports.fetchAndStoreDataHttp = functions.https.onRequest(async (req, res) => { // If using HTTP Trigger
// Or use functions.https.onCall or functions.https.onRequest if triggered via HTTP from Cloud Scheduler
// exports.fetchAndStoreDataHttp = functions.https.onRequest(async (req, res) => { // If using HTTP Trigger

    functions.logger.info("Starting data fetch cycle...");

    try {
        // Fetch data from all sources in parallel
        const [spotifyData, whoopData, bookData, weatherData] = await Promise.all([
            getSpotifyData(),
            getWhoopData(),
            getBookData(),
            getWeatherData(),
        ]);

        // Prepare data object to save
        const dataToStore = {
            currentSong: spotifyData,
            sleepStatus: whoopData,
            currentBook: bookData,
            weatherInfo: weatherData,
            lastUpdated: new Date(), // Timestamp of the whole update cycle
        };

        // Get a reference to the document
        const docRef = db.collection("siteData").doc("latest");

        // Write data to Firestore
        await docRef.set(dataToStore);

        functions.logger.info("Successfully fetched and stored data:", dataToStore);
        // If using HTTP Trigger, send a success response
        // res.status(200).send("Data fetched and stored successfully."); // Only for HTTP trigger

        return null; // Required for Pub/Sub triggered functions
    } catch (error) {
        functions.logger.error("Error in fetchAndStoreData:", error);
        // If using HTTP Trigger, send an error response
        // res.status(500).send("Error fetching or storing data."); // Only for HTTP trigger
        return null; // Required for Pub/Sub triggered functions
    }
});

// --- HTTP Function to Serve Data to Frontend ---

exports.getSiteData = functions.https.onRequest(async (req, res) => {
    // Set CORS headers to allow requests from your frontend domain
    // Replace '*' with your actual frontend URL in production for security
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET");
    res.set("Access-Control-Allow-Headers", "Content-Type");

    // Handle preflight requests for CORS
    if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
    }

    try {
        const docRef = db.collection("siteData").doc("latest");
        const doc = await docRef.get();

        if (!doc.exists) {
            functions.logger.warn("Document siteData/latest does not exist.");
            res.status(404).send("No site data found.");
        } else {
            functions.logger.info("Serving site data to frontend.");
            res.status(200).json(doc.data());
        }
    } catch (error) {
        functions.logger.error("Error getting site data:", error);
        res.status(500).send("Internal Server Error");
    }
});

// --- OAuth Callback Functions ---

exports.spotifyCallback = functions.https.onRequest(async (req, res) => {
    const { code } = req.query;

    if (!code) {
        res.status(400).send("Authorization code missing");
        return;
    }

    try {
        const clientId = functions.config().spotify.client_id;
        const clientSecret = functions.config().spotify.client_secret;
        const redirectUri = "https://us-central1-ckubal-homepage-be.cloudfunctions.net/spotifyCallback";

        // Exchange code for tokens
        const tokenResponse = await axios.post("https://accounts.spotify.com/api/token",
            new URLSearchParams({
                grant_type: "authorization_code",
                code: code,
                redirect_uri: redirectUri,
            }), {
                headers: {
                    "Authorization": `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
                    "Content-Type": "application/x-www-form-urlencoded",
                },
            },
        );

        const { refresh_token: refreshToken } = tokenResponse.data;

        // Store refresh token in Firestore
        await db.collection("config").doc("spotify").set({
            refresh_token: refreshToken,
            updated_at: new Date(),
        });

        functions.logger.info("Spotify tokens stored successfully");
        res.send("Spotify connected successfully! You can close this tab.");
    } catch (error) {
        functions.logger.error("Error in Spotify callback:", error);
        res.status(500).send("Error connecting to Spotify");
    }
});

exports.spotifyAuth = functions.https.onRequest(async (req, res) => {
    const clientId = functions.config().spotify.client_id;
    const redirectUri = "https://us-central1-ckubal-homepage-be.cloudfunctions.net/spotifyCallback";
    const scopes = "user-read-currently-playing user-read-recently-played";

    const authUrl = "https://accounts.spotify.com/authorize?" +
        `client_id=${clientId}&` +
        "response_type=code&" +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `scope=${encodeURIComponent(scopes)}`;

    res.redirect(authUrl);
});

// --- Location Update Function ---
exports.updateLocation = functions.https.onRequest(async (req, res) => {
    // Set CORS headers
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
    }

    try {
        const { lat, lng } = req.body;

        if (!lat || !lng) {
            res.status(400).send("Missing lat/lng coordinates");
            return;
        }

        // Store location data
        await db.collection("config").doc("location").set({
            lat: parseFloat(lat),
            lng: parseFloat(lng),
            updated_at: new Date(),
        });

        functions.logger.info(`Location updated: ${lat}, ${lng}`);
        res.status(200).json({ success: true, message: "Location updated" });
    } catch (error) {
        functions.logger.error("Error updating location:", error);
        res.status(500).send("Error updating location");
    }
});
