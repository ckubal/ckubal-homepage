const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");
const { google } = require("googleapis"); // eslint-disable-line no-unused-vars

// Initialize Firebase Admin SDK (only needs to be done once)
admin.initializeApp();
const db = admin.firestore();

// --- Helper Functions for API Calls (Implement details later) ---

// Helper function to ensure Spotify token is valid
async function ensureSpotifyToken() {
    const tokenDoc = await db.collection("config").doc("spotify").get();
    if (!tokenDoc.exists) {
        throw new Error("No Spotify refresh token found");
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

    // Update refresh token if Spotify provides a new one
    if (tokenResponse.data.refresh_token && tokenResponse.data.refresh_token !== refreshToken) {
        functions.logger.info("Spotify provided new refresh token, updating...");
        await db.collection("config").doc("spotify").update({
            refresh_token: tokenResponse.data.refresh_token,
            updated_at: new Date(),
        });
    }

    return tokenResponse.data.access_token;
}

async function getSpotifyData() {
    functions.logger.info("Fetching Spotify data...");

    try {
        const accessToken = await ensureSpotifyToken();

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
                spotifyUrl: track.external_urls?.spotify || "",
                fetchedAt: new Date(),
            };
        }

        return { title: "Playlist empty", artist: "", fetchedAt: new Date() };
    } catch (error) {
        functions.logger.error("Error fetching Spotify data:", error.response?.data || error.message);
        // Check if it's a token error
        if (error.response?.status === 400 && error.response?.data?.error === "invalid_grant") {
            functions.logger.error("Spotify refresh token expired or revoked - needs reauthorization");
            return { title: "Reauthorize Spotify", artist: "Token expired", fetchedAt: new Date() };
        }

        // Check if it's a rate limit error
        if (error.response?.status === 429) {
            functions.logger.warn("Spotify API rate limited");
            return { title: "Spotify rate limited", artist: "Try again later", fetchedAt: new Date() };
        }

        return { title: "Spotify unavailable", artist: "", fetchedAt: new Date() };
    }
}

async function getSpotifyListeningStats() {
    functions.logger.info("Fetching Spotify listening stats for last 6 months...");
    try {
        const accessToken = await ensureSpotifyToken();

        // Get top artists and tracks from last 6 months (medium_term = ~6 months)
        const [topArtistsResponse, topTracksResponse] = await Promise.all([
            axios.get("https://api.spotify.com/v1/me/top/artists?limit=3&time_range=medium_term", {
                headers: { "Authorization": `Bearer ${accessToken}` },
            }),
            axios.get("https://api.spotify.com/v1/me/top/tracks?limit=50&time_range=medium_term", {
                headers: { "Authorization": `Bearer ${accessToken}` },
            }),
        ]);

        const topArtists = topArtistsResponse.data.items.slice(0, 3).map((artist) => artist.name.toLowerCase());

        // Get top albums from tracks (group by album)
        const albumCounts = {};
        topTracksResponse.data.items.forEach((track) => {
            const albumName = track.album.name.toLowerCase();
            albumCounts[albumName] = (albumCounts[albumName] || 0) + 1;
        });

        const topAlbums = Object.keys(albumCounts)
            .sort((a, b) => albumCounts[b] - albumCounts[a])
            .slice(0, 3);

        // Return just the top artists and albums (no unreliable minute estimates)
        return {
            topArtists: topArtists,
            topAlbums: topAlbums,
            fetchedAt: new Date(),
        };
    } catch (error) {
        functions.logger.error("Error fetching Spotify stats:", error.response?.data || error.message);
        return {
            topArtists: ["kanye west", "mac miller", "drake"],
            topAlbums: ["my beautiful dark twisted fantasy", "circles", "views"],
            fetchedAt: new Date(),
        };
    }
}

/* eslint-disable no-unused-vars */
async function getWhoopData() {
    functions.logger.info("Fetching WHOOP data...");

    try {
        // Check if WHOOP tokens exist
        const tokenDoc = await db.collection("config").doc("whoop").get();
        if (!tokenDoc.exists) {
            functions.logger.warn("No WHOOP tokens found");
            return { status: "Connect WHOOP", performance: null, fetchedAt: new Date() };
        }

        const { refresh_token: refreshToken, access_token: accessToken, expires_at: expiresAt } = tokenDoc.data();
        const clientId = functions.config().whoop?.client_id;
        const clientSecret = functions.config().whoop?.client_secret;

        if (!clientId || !clientSecret) {
            return { status: "WHOOP not configured", performance: null, fetchedAt: new Date() };
        }

        let currentAccessToken = accessToken;

        // Check if token needs refresh
        if (Date.now() / 1000 > expiresAt) {
            functions.logger.info("Refreshing WHOOP token...");
            const refreshResponse = await axios.post("https://api.prod.whoop.com/oauth/oauth2/token",
                new URLSearchParams({
                    grant_type: "refresh_token",
                    refresh_token: refreshToken,
                    client_id: clientId,
                    client_secret: clientSecret,
                }), {
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                    },
                });

            currentAccessToken = refreshResponse.data.access_token;

            // Update stored tokens
            await db.collection("config").doc("whoop").update({
                access_token: refreshResponse.data.access_token,
                refresh_token: refreshResponse.data.refresh_token,
                expires_at: Math.floor(Date.now() / 1000) + refreshResponse.data.expires_in,
            });
        }

        // Get latest recovery data using WHOOP API v2
        const recoveryResponse = await axios.get("https://api.prod.whoop.com/developer/v2/recovery", {
            headers: { "Authorization": `Bearer ${currentAccessToken}` },
            params: { limit: 1 },
        });

        const latestRecovery = recoveryResponse.data.records[0];
        if (!latestRecovery) {
            return { status: "No recent recovery data", performance: null, strain: null, fetchedAt: new Date() };
        }

        const performance = latestRecovery.score?.recovery_score;
        let status = "unknown";

        if (performance > 85) status = "great";
        else if (performance >= 70) status = "good";
        else if (performance >= 55) status = "okay";
        else if (performance < 55) status = "not the best";

        // Get today's cycle data for strain
        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
        const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();

        let todaysStrain = null;
        try {
            const cycleResponse = await axios.get("https://api.prod.whoop.com/developer/v2/cycle", {
                headers: { "Authorization": `Bearer ${currentAccessToken}` },
                params: {
                    limit: 1,
                    start: startOfDay,
                    end: endOfDay,
                },
            });

            const todaysCycle = cycleResponse.data.records[0];
            if (todaysCycle && todaysCycle.score) {
                todaysStrain = Math.round(todaysCycle.score.strain * 10) / 10; // Round to 1 decimal
            }
        } catch (strainError) {
            functions.logger.warn("Could not fetch strain data:", strainError.message);
        }

        return {
            status,
            performance: Math.round(performance),
            strain: todaysStrain,
            fetchedAt: new Date(),
        };
    } catch (error) {
        functions.logger.error("Error fetching WHOOP data:", error);
        return { status: "WHOOP unavailable", performance: null, strain: null, fetchedAt: new Date() };
    }
}

async function getBookData() {
    functions.logger.info("Fetching Book data from Google Sheets CSV...");

    try {
        // Use the working CSV URL from your weird little ideas site
        const csvUrl = "https://docs.google.com/spreadsheets/d/e/" +
            "2PACX-1vQjPR6atSEfc5ItyFLmzEzabJeXG_Tit6_Bbmwu31_JptS4trGGtDR0zla6Q99yNtK9j9VS3VVsf5Ug/" +
            "pub?gid=1869146893&single=true&output=csv";

        const response = await axios.get(csvUrl);
        const csvText = response.data;

        // Split into rows and filter out empty ones
        const rows = csvText.split("\n").filter((row) => row.trim() !== "");

        if (rows.length === 0) {
            return { title: "No data found", author: "", fetchedAt: new Date() };
        }

        // Look for "In progress" in column N (index 13) starting from row 25 (index 24)
        let currentBook = null;

        // Start from row 25 (0-indexed = 24) and go up to row 500 or end of data
        for (let i = 24; i < Math.min(500, rows.length); i++) {
            const row = rows[i];
            const columns = row.split(",");

            // Status is in column N (0-indexed = 13)
            const status = columns[13] ? columns[13].trim().replace(/"/g, "") : "";

            if (status === "In progress") {
                currentBook = columns;
                functions.logger.info(`Found book in progress at row ${i + 1}: ${columns[10]} by ${columns[11]}`);
                break;
            }
        }

        if (!currentBook) {
            return { title: "No book in progress", author: "", fetchedAt: new Date() };
        }

        // Extract title from column K (index 10) and author from column L (index 11)
        const title = currentBook[10] ? currentBook[10].trim().replace(/"/g, "") : "Unknown";
        const author = currentBook[11] ? currentBook[11].trim().replace(/"/g, "") : "Unknown";

        functions.logger.info(`Current book: ${title} by ${author}`);

        return {
            title,
            author,
            fetchedAt: new Date(),
        };
    } catch (error) {
        functions.logger.error("Error fetching book data:", error);
        // Return a fallback book instead of showing error to users
        return {
            title: "Playland",
            author: "Andrew Carlin",
            fetchedAt: new Date(),
        };
    }
}

async function getFavoriteRappers() {
    functions.logger.info("Fetching favorite rappers from Google Sheets CSV...");

    try {
        // Use the same CSV URL as books
        const csvUrl = "https://docs.google.com/spreadsheets/d/e/" +
            "2PACX-1vQjPR6atSEfc5ItyFLmzEzabJeXG_Tit6_Bbmwu31_JptS4trGGtDR0zla6Q99yNtK9j9VS3VVsf5Ug/" +
            "pub?gid=1869146893&single=true&output=csv";

        const response = await axios.get(csvUrl);
        const csvText = response.data;

        // Split into rows and filter out empty ones
        const rows = csvText.split("\n").filter((row) => row.trim() !== "");

        functions.logger.info(`Total CSV rows: ${rows.length}`);

        if (rows.length === 0) {
            return [];
        }

        const rappers = [];

        // Extract rappers from column A (index 0), rows 101-110 (spreadsheet A101:A110)
        // Row 100 (0-indexed 99) contains the title
        // Rows 101-110 (0-indexed 100-109) contain the actual rappers
        for (let i = 99; i < Math.min(111, rows.length); i++) {
            const row = rows[i];
            const columns = row.split(",");

            // Column A is index 0
            const rapper = columns[0] ? columns[0].trim().replace(/"/g, "") : "";

            functions.logger.info(
                `Row ${i + 1} (spreadsheet), Column A (index 0): "${rapper}" | Full row length: ${columns.length}`,
            );

            // Skip the title row but include all actual rapper entries
            if (i === 99) {
                functions.logger.info(`Title row: "${rapper}"`);
                continue; // Skip title row
            }

            // Add any non-empty value
            if (rapper && rapper !== "" && rapper !== "F") {
                rappers.push(rapper.toLowerCase());
                functions.logger.info(`Added rapper #${rappers.length}: ${rapper}`);
            } else {
                functions.logger.info(`Skipped empty/invalid rapper: "${rapper}"`);
            }
        }

        functions.logger.info(`Total rappers found: ${rappers.length}, List: [${rappers.join(", ")}]`);
        return rappers;
    } catch (error) {
        functions.logger.error("Error fetching favorite rappers:", error);
        return [];
    }
}

async function getTasteMusicLists() {
    functions.logger.info("Fetching taste music lists...");

    try {
        // Get spreadsheet data for column V title and rappers
        const csvUrl = "https://docs.google.com/spreadsheets/d/e/" +
            "2PACX-1vQjPR6atSEfc5ItyFLmzEzabJeXG_Tit6_Bbmwu31_JptS4trGGtDR0zla6Q99yNtK9j9VS3VVsf5Ug/" +
            "pub?gid=1869146893&single=true&output=csv";

        const response = await axios.get(csvUrl);
        const csvText = response.data;
        const rows = csvText.split("\n").filter((row) => row.trim() !== "");

        const tasteLists = [];

        if (rows.length >= 100) {
            // Get titles from row 100 (0-indexed = 99) for columns A and B
            const headerRow = rows[99];
            const headerColumns = headerRow.split(",");
            const titleA = headerColumns[0] ? headerColumns[0].trim().replace(/"/g, "") : "";
            const titleB = headerColumns[1] ? headerColumns[1].trim().replace(/"/g, "") : "";

            // Get rappers from column A, rows 101-110
            const rappersList = [];
            for (let i = 100; i < Math.min(111, rows.length); i++) {
                const row = rows[i];
                const columns = row.split(",");
                const rapper = columns[0] ? columns[0].trim().replace(/"/g, "") : "";

                if (rapper && rapper !== "F" && rapper.length > 0) {
                    rappersList.push(rapper.toLowerCase());
                }
            }

            if (titleA && rappersList.length > 0) {
                tasteLists.push({
                    title: titleA.toLowerCase(),
                    items: rappersList,
                });
            }

            // Get albums from column B, rows 101-110
            const albumsList = [];
            for (let i = 100; i < Math.min(111, rows.length); i++) {
                const row = rows[i];
                const columns = row.split(",");
                const album = columns[1] ? columns[1].trim().replace(/"/g, "") : "";

                if (album && album.length > 0) {
                    albumsList.push(album.toLowerCase());
                }
            }

            if (titleB && albumsList.length > 0) {
                // Create albums with Spotify URLs and images
                const albumsWithUrls = await Promise.all(albumsList.map(async (albumText) => {
                    const spotifyData = await searchSpotifyAlbum(albumText);
                    return {
                        name: albumText,
                        url: spotifyData?.url || null,
                        image: spotifyData?.image || null,
                    };
                }));

                tasteLists.push({
                    title: titleB.toLowerCase(),
                    items: albumsWithUrls,
                });
            }
        }

        // Get songs from Spotify playlist 6MpHzCTg0si4e63LU6yC0l
        const playlistTracks = await getSpotifyPlaylistTracks("6MpHzCTg0si4e63LU6yC0l", 10);
        if (playlistTracks && playlistTracks.length > 0) {
            const songsList = playlistTracks.map((track) => {
                // Remove parentheses and everything after them
                const cleanTitle = track.title.split("(")[0].trim();
                return `${cleanTitle.toLowerCase()} - ${track.artist.toLowerCase()}`;
            });

            tasteLists.push({
                title: "favorite songs of all time",
                items: songsList,
                playlistUrl: "https://open.spotify.com/playlist/6MpHzCTg0si4e63LU6yC0l",
            });
        }

        // Get favorite podcast episodes from Spotify playlist 0kcYF4CGf8G9BlzZSqXHyW
        const podcastEpisodes = await getPodcastEpisodes("0kcYF4CGf8G9BlzZSqXHyW", 10);
        if (podcastEpisodes && podcastEpisodes.length > 0) {
            const episodesList = podcastEpisodes.map((episode) =>
                `${episode.name} - ${episode.show}`,
            );

            tasteLists.push({
                title: "favorite podcast episodes",
                items: episodesList,
                playlistUrl: "https://open.spotify.com/playlist/0kcYF4CGf8G9BlzZSqXHyW",
            });
        }

        functions.logger.info(`Found ${tasteLists.length} taste music lists`);
        return tasteLists;
    } catch (error) {
        functions.logger.error("Error fetching taste music lists:", error);
        return [];
    }
}

async function searchSpotifyAlbum(albumText) {
    try {
        // Special handling for specific albums with known Spotify IDs
        const albumIdMappings = {
            "watch the throne - jay-z & kanye west": "2if1gb3t6IkhiKzrtS9Glc",
        };

        // Check if this is a special case where we know the album ID
        if (albumIdMappings[albumText.toLowerCase()]) {
            const albumId = albumIdMappings[albumText.toLowerCase()];
            const accessToken = await ensureSpotifyToken();

            // Get album details directly by ID
            const albumResponse = await axios.get(`https://api.spotify.com/v1/albums/${albumId}`, {
                headers: { "Authorization": `Bearer ${accessToken}` },
            });

            if (albumResponse.data) {
                return {
                    url: albumResponse.data.external_urls.spotify,
                    image: albumResponse.data.images && albumResponse.data.images.length > 0 ?
                        albumResponse.data.images[0].url :
                        null,
                };
            }
        }

        // Hardcoded mappings for albums that might not be found by search
        const hardcodedAlbums = {
            "2001 - dr. dre": {
                url: "https://open.spotify.com/album/7q2B4M5EiBkqrlsNW8lB7N",
                image: "https://i.scdn.co/image/ab67616d00001e029b19c107109de740bad72df5",
            },
        };

        if (hardcodedAlbums[albumText.toLowerCase()]) {
            return hardcodedAlbums[albumText.toLowerCase()];
        }

        const accessToken = await ensureSpotifyToken();

        // Parse album text format "album title - artist"
        const parts = albumText.split(" - ");
        if (parts.length < 2) {
            functions.logger.warn(`Invalid album format: ${albumText}`);
            return null;
        }

        const albumName = parts[0].trim();
        const artistName = parts[1].trim();

        // Search for album on Spotify
        const searchQuery = `album:"${albumName}" artist:"${artistName}"`;
        const searchUrl = `https://api.spotify.com/v1/search?q=${encodeURIComponent(searchQuery)}&type=album&limit=1`;

        const response = await axios.get(searchUrl, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        if (response.data.albums.items && response.data.albums.items.length > 0) {
            const album = response.data.albums.items[0];
            return {
                url: album.external_urls.spotify,
                image: album.images && album.images.length > 0 ? album.images[0].url : null,
            };
        }

        functions.logger.warn(`No Spotify album found for: ${albumText}`);
        return null;
    } catch (error) {
        functions.logger.error(`Error searching for album ${albumText}:`, error);
        return null;
    }
}

async function getThisYearReads() {
    functions.logger.info("Fetching this year reads from recents tab I24:N90 range...");

    // Use "recents" sheet GID for "this year" data
    const gid = "1869146893";
    const csvUrl = "https://docs.google.com/spreadsheets/d/e/" +
        "2PACX-1vQjPR6atSEfc5ItyFLmzEzabJeXG_Tit6_Bbmwu31_JptS4trGGtDR0zla6Q99yNtK9j9VS3VVsf5Ug/" +
        `pub?gid=${gid}&single=true&output=csv`;

    try {
        const response = await axios.get(csvUrl, {
            maxRedirects: 5,
            timeout: 10000,
        });
        const rows = response.data.trim().split("\n");

        const booksByMonth = {};
        const monthNames = ["january", "february", "march", "april", "may", "june",
            "july", "august", "september", "october", "november", "december"];

        // Process rows 24-90 (I24:N90 range) for recents tab
        let debugCount = 0;

        // Debug: Log the first few rows to understand the structure
        if (rows.length > 23) {
            functions.logger.info(`Recents sheet has ${rows.length} total rows, checking rows 24-90`);
            for (let i = 23; i < Math.min(29, rows.length); i++) {
                const cols = parseCSVRow(rows[i]);
                functions.logger.info(`Row ${i+1} has ${cols.length} columns`);
                if (cols.length >= 14) {
                    functions.logger.info(
                        `Row ${i+1} Col I(8)='${cols[8]}' K(10)='${cols[10]}' ` +
                        `L(11)='${cols[11]}' N(13)='${cols[13]}'`,
                    );
                } else if (cols.length > 0) {
                    // Log what we have for debugging
                    functions.logger.info(`Row ${i+1} data: ${cols.slice(0, Math.min(15, cols.length)).join(" | ")}`);
                }
            }
        }

        for (let i = 23; i < Math.min(90, rows.length); i++) { // 0-indexed, so row 24 = index 23
            const columns = parseCSVRow(rows[i]);

            // Column mapping for recents tab I24:N90:
            // I = month number (index 8), K = title (index 10), L = author (index 11), N = status (index 13)
            const monthNumber = columns[8] ? parseInt(columns[8].trim()) : 0;
            const title = columns[10] ? columns[10].trim().toLowerCase() : ""; // Column K = title
            const author = columns[11] ? columns[11].trim().toLowerCase() : ""; // Column L = author
            const status = columns[13] ? columns[13].trim() : ""; // Column N = status

            // Debug logging for first 5 rows
            if (debugCount < 5 && title) {
                functions.logger.info(
                    `Row ${i+1}: month=${monthNumber}, status='${status}', title='${title}'`,
                );
                debugCount++;
            }

            // Convert month number to month name
            const month = monthNumber > 0 && monthNumber <= 12 ? monthNames[monthNumber - 1] : "";

            // Only include completed books - check various status formats (including capital C)
            const isCompleted = status === "Completed" || status === "completed" ||
                                status === "complete" || status === "✓" || status === "done";
            if (isCompleted && title && month) {
                if (!booksByMonth[month]) {
                    booksByMonth[month] = [];
                }

                booksByMonth[month].push({
                    title: title,
                    author: author,
                    month: month,
                });
            }
        }

        // Convert to array and sort by month (most recent first)
        const monthlyReads = [];
        const currentMonth = new Date().getMonth(); // 0-11

        // Add months in reverse order (most recent first)
        for (let i = currentMonth; i >= 0; i--) {
            const monthName = monthNames[i];
            if (booksByMonth[monthName] && booksByMonth[monthName].length > 0) {
                monthlyReads.push({
                    month: monthName,
                    books: booksByMonth[monthName].reverse(), // Most recent books first within month
                });
            }
        }

        functions.logger.info(`Found ${monthlyReads.length} months with completed reads`);
        return {
            type: "thisYear",
            year: new Date().getFullYear(),
            monthlyReads: monthlyReads,
        };
    } catch (error) {
        functions.logger.error("Error fetching this year reads:", error);
        return null;
    }
}

async function getAnnualReadingLists() {
    functions.logger.info("Fetching annual reading lists from published Google Sheets...");

    // Now that document is published, we can access individual sheets by GID
    const yearSheets = {
        2024: "82205515",
        2023: "1354905140",
        2022: "0",
        2021: "1481213422",
        // Removed 2025 since it's now handled by getThisYearReads()
    };

    const allYearLists = [];

    try {
        for (const [year, gid] of Object.entries(yearSheets)) {
            const csvUrl = "https://docs.google.com/spreadsheets/d/e/" +
                "2PACX-1vQjPR6atSEfc5ItyFLmzEzabJeXG_Tit6_Bbmwu31_JptS4trGGtDR0zla6Q99yNtK9j9VS3VVsf5Ug/" +
                `pub?gid=${gid}&single=true&output=csv`;

            functions.logger.info(`Fetching ${year} data from GID ${gid}`);

            try {
                const response = await axios.get(csvUrl, {
                    maxRedirects: 5,
                    timeout: 10000,
                });
                const rows = response.data.trim().split("\n");

                const fictionBooks = [];
                const nonfictionBooks = [];

                // Parse books based on sheet structure
                const booksWithMonth = [];

                for (let i = 1; i < rows.length; i++) { // Skip header row (i=0)
                    const columns = parseCSVRow(rows[i], 8);

                    // Check if this is 2025 sheet (has year column) or individual year sheet
                    let month;
                    let rating;
                    let title;
                    let author;
                    let genre;
                    if (year === "2025") {
                        // 2025 structure: A=year, B=month, C=rating, D=title, E=author, G=genre
                        const yearCol = columns[0] ? columns[0].trim() : "";
                        month = columns[1] ? parseInt(columns[1]) : null;
                        rating = columns[2] ? columns[2].trim() : "";
                        title = columns[3] ? columns[3].trim() : "";
                        author = columns[4] ? columns[4].trim() : "";
                        genre = columns[6] ? columns[6].trim() : "";
                        // Skip if not a valid year row for 2025
                        if (!yearCol || isNaN(parseInt(yearCol))) continue;
                    } else if (year === "2024") {
                        // 2024 structure: B=month, C=rating, D=title, E=author, G=F/NF
                        month = columns[1] ? parseInt(columns[1]) : null;
                        rating = columns[2] ? columns[2].trim() : "";
                        title = columns[3] ? columns[3].trim() : "";
                        author = columns[4] ? columns[4].trim() : "";
                        genre = columns[6] ? columns[6].trim() : "";
                    } else if (year === "2022") {
                        // 2022 structure: A=rating, B=title, C=author, E=F/NF
                        rating = columns[0] ? columns[0].trim() : "";
                        title = columns[1] ? columns[1].trim() : "";
                        author = columns[2] ? columns[2].trim() : "";
                        genre = columns[4] ? columns[4].trim() : "";
                        month = null;
                    } else if (year === "2021") {
                        // 2021 structure: A=title, B=author, C=F/NF, D=rating
                        title = columns[0] ? columns[0].trim() : "";
                        author = columns[1] ? columns[1].trim() : "";
                        genre = columns[2] ? columns[2].trim() : "";
                        rating = columns[3] ? columns[3].trim() : "";
                        month = null;
                    } else {
                        // Fallback: assume 2023 structure
                        month = columns[0] ? parseInt(columns[0]) : null;
                        rating = columns[1] ? columns[1].trim() : "";
                        title = columns[2] ? columns[2].trim() : "";
                        author = columns[3] ? columns[3].trim() : "";
                        genre = columns[5] ? columns[5].trim() : "";
                    }

                    if (i < 5) { // Debug first 5 rows
                        functions.logger.info(`${year} Row ${i}: ` +
                            `month="${month}" rating="${rating}" title="${title}" author="${author}" genre="${genre}"`);
                    }

                    // Only include valid book data
                    if (title && author && rating && genre) {
                        booksWithMonth.push({
                            title: title.toLowerCase(),
                            author: author.toLowerCase(),
                            rating: rating,
                            month: month || 0,
                            genre: genre.toLowerCase(),
                        });
                    }
                }

                // Sort by month descending for 2025, keep original order for other years
                if (year === "2025") {
                    booksWithMonth.sort((a, b) => b.month - a.month);
                }

                // Group into fiction/nonfiction
                booksWithMonth.forEach((book) => {
                    const bookData = {
                        title: book.title,
                        author: book.author,
                        rating: book.rating,
                    };

                    if (book.genre === "fiction") {
                        fictionBooks.push(bookData);
                    } else if (book.genre === "non-fiction") {
                        nonfictionBooks.push(bookData);
                    }
                });

                functions.logger.info(`${year}: Found ${fictionBooks.length} fiction, ` +
                    `${nonfictionBooks.length} nonfiction books`);

                // Create lists for each genre if they have books
                if (fictionBooks.length > 0) {
                    allYearLists.push({
                        title: `${year} fiction`,
                        year: parseInt(year),
                        type: "fiction",
                        page: 1,
                        totalPages: 1,
                        items: fictionBooks,
                        startNumber: 1,
                    });
                }

                if (nonfictionBooks.length > 0) {
                    allYearLists.push({
                        title: `${year} nonfiction`,
                        year: parseInt(year),
                        type: "nonfiction",
                        page: 1,
                        totalPages: 1,
                        items: nonfictionBooks,
                        startNumber: 1,
                    });
                }
            } catch (yearError) {
                functions.logger.error(`Error fetching data for year ${year}:`, yearError.message);
            }
        }

        functions.logger.info(`Found ${allYearLists.length} annual reading lists total`);
        return allYearLists;
    } catch (error) {
        functions.logger.error("Error fetching annual reading lists:", error);
        return [];
    }
}

async function getPodcastEpisodes(playlistId = "0kcYF4CGf8G9BlzZSqXHyW", limit = 10) {
    functions.logger.info(`Fetching podcast episodes from Spotify playlist: ${playlistId}`);

    try {
        const accessToken = await ensureSpotifyToken();

        // Get episodes from playlist with episode details
        const fieldsParam = "items(track(id,name,description,duration_ms,release_date," +
            "external_urls,show.name,album.name,type))";
        const playlistResponse = await axios.get(
            `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=${limit}&fields=${fieldsParam}`,
            {
                headers: { "Authorization": `Bearer ${accessToken}` },
            },
        );

        if (playlistResponse.data?.items?.length > 0) {
            const episodePromises = playlistResponse.data.items
                .filter((item) => item.track && item.track.type === "episode")
                .slice(0, limit)
                .map(async (item) => {
                    const episode = item.track;

                    // Fetch individual episode details to get description
                    try {
                        const episodeDetailResponse = await axios.get(
                            `https://api.spotify.com/v1/episodes/${episode.id}`,
                            {
                                headers: { "Authorization": `Bearer ${accessToken}` },
                            },
                        );

                        const episodeDetail = episodeDetailResponse.data;
                        const description = episodeDetail.description || "";

                        // Fetch show artwork
                        let showArtwork = null;
                        if (episodeDetail.show?.id) {
                            try {
                                const showResponse = await axios.get(
                                    `https://api.spotify.com/v1/shows/${episodeDetail.show.id}`,
                                    {
                                        headers: { "Authorization": `Bearer ${accessToken}` },
                                    },
                                );

                                const showData = showResponse.data;
                                if (showData.images && showData.images.length > 0) {
                                    // Get medium-sized image (usually index 1, or largest available)
                                    showArtwork = showData.images[1]?.url || showData.images[0]?.url;
                                }
                            } catch (showError) {
                                functions.logger.warn(
                                    `Could not fetch show artwork for ${episodeDetail.show.id}:`,
                                    showError.message,
                                );
                            }
                        }
                        return {
                            name: episode.name.toLowerCase(),
                            show: (episode.album?.name || episode.show?.name || "unknown podcast").toLowerCase(),
                            description: description,
                            duration: episode.duration_ms,
                            releaseDate: episode.release_date || new Date().toISOString(),
                            url: episode.external_urls?.spotify || "",
                            synopsis: description ?
                                generateSynopsis(description).toLowerCase() : "no description available",
                            formattedDuration: formatDuration(episode.duration_ms),
                            formattedDate: formatDate(episode.release_date),
                            showArtwork: showArtwork,
                        };
                    } catch (error) {
                        functions.logger.error(`Error fetching episode ${episode.id}:`, error);
                        // Fallback to playlist data
                        const description = episode.description || "";
                        return {
                            name: episode.name.toLowerCase(),
                            show: (episode.album?.name || episode.show?.name || "unknown podcast").toLowerCase(),
                            description: description,
                            duration: episode.duration_ms,
                            releaseDate: episode.release_date || new Date().toISOString(),
                            url: episode.external_urls?.spotify || "",
                            synopsis: description ?
                                generateSynopsis(description).toLowerCase() : "no description available",
                            formattedDuration: formatDuration(episode.duration_ms),
                            formattedDate: formatDate(episode.release_date),
                            showArtwork: null,
                        };
                    }
                });

            const episodes = await Promise.all(episodePromises);

            functions.logger.info(`Found ${episodes.length} podcast episodes`);
            return episodes;
        }

        return [];
    } catch (error) {
        functions.logger.error("Error fetching podcast episodes:", error);
        return [];
    }
}

function parseCSVRow(row, maxColumns = null) {
    const result = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < row.length; i++) {
        const char = row[i];
        const nextChar = row[i + 1];

        if (char === "\"") {
            if (inQuotes && nextChar === "\"") {
                // Escaped quote
                current += "\"";
                i++; // Skip next quote
            } else {
                // Toggle quote state
                inQuotes = !inQuotes;
            }
        } else if (char === "," && !inQuotes) {
            // End of field
            result.push(current.trim());
            current = "";
            // Stop parsing if we've reached the max columns needed
            if (maxColumns && result.length >= maxColumns) {
                break;
            }
        } else {
            current += char;
        }
    }

    // Add the last field if we haven't reached max columns
    if (!maxColumns || result.length < maxColumns) {
        result.push(current.trim());
    }

    return result;
}

async function getFavoriteReads() {
    functions.logger.info("Fetching favorite reads from Google Sheets CSV...");

    try {
        const csvUrl = "https://docs.google.com/spreadsheets/d/e/" +
            "2PACX-1vQjPR6atSEfc5ItyFLmzEzabJeXG_Tit6_Bbmwu31_JptS4trGGtDR0zla6Q99yNtK9j9VS3VVsf5Ug/" +
            "pub?gid=1869146893&single=true&output=csv";

        const response = await axios.get(csvUrl);
        const csvText = response.data;
        const rows = csvText.split("\n").filter((row) => row.trim() !== "");

        const recentReads = [];
        const lastFiveYearsReads = [];

        if (rows.length >= 1) {
            // Use fixed title instead of reading from spreadsheet
            const title = "favorite recent reads";

            functions.logger.info(`Using fixed title: "${title}"`);

            // Get reading stats from A18 (row 17, column 0)
            let readingStats = null;
            if (rows.length > 17) {
                const statsRow = rows[17]; // Row 18 (0-indexed as 17)
                const statsColumns = parseCSVRow(statsRow);
                const statsText = statsColumns[0] ? statsColumns[0].trim().replace(/"/g, "") : "";

                functions.logger.info(`Reading stats from A18: "${statsText}"`);

                // Parse "NF: Y | F: Z" format
                const match = statsText.match(/NF:\s*(\d+)\s*\|\s*F:\s*(\d+)/);
                if (match) {
                    const nf = parseInt(match[1]);
                    const f = parseInt(match[2]);
                    const total = nf + f;

                    readingStats = {
                        total: total,
                        nonFiction: nf,
                        fiction: f,
                        year: new Date().getFullYear(),
                    };

                    functions.logger.info(`Parsed stats: ${total} total (${nf} NF, ${f} F)`);
                }
            }

            // Debug: log first few raw rows to understand structure
            functions.logger.info(`Total rows available: ${rows.length}`);
            for (let debugIdx = 0; debugIdx < Math.min(3, rows.length); debugIdx++) {
                const debugRow = rows[debugIdx];
                const debugCols = parseCSVRow(debugRow);
                functions.logger.info(`Debug Row ${debugIdx}: C="${debugCols[2]}" D="${debugCols[3]}"`);
            }

            // Get books from C1 onwards (max 10) using proper CSV parsing
            for (let i = 0; i < Math.min(10, rows.length); i++) {
                const row = rows[i];
                const columns = parseCSVRow(row);

                const rating = columns[2] ? columns[2].trim().replace(/"/g, "") : "";
                const bookTitle = columns[3] ? columns[3].trim().replace(/"/g, "") : "";
                const author = columns[4] ? columns[4].trim().replace(/"/g, "") : "";
                const summary = columns[5] ? columns[5].trim().replace(/"/g, "") : "";
                const genre = columns[6] ? columns[6].trim().replace(/"/g, "") : "";

                functions.logger.info(`Row ${i} (sheet row ${i+1}): Title="${bookTitle}", Author="${author}"`);

                // Stop if we hit a gap (empty title)
                if (!bookTitle || bookTitle.length === 0) {
                    functions.logger.info(`Stopping at row ${i} due to empty title`);
                    break;
                }

                if (author) { // Only require author, make rating and genre optional
                    recentReads.push({
                        title: bookTitle.toLowerCase(),
                        author: author.toLowerCase(),
                        rating: rating || "",
                        summary: summary || "",
                        genre: genre || "",
                    });
                }
            }

            // Now get "last five years" books from C52:G62 (rows 51-61, columns 2-6)
            functions.logger.info("Fetching last five years books from C52:G62");
            for (let i = 51; i < Math.min(62, rows.length); i++) {
                const row = rows[i];
                // Only parse up to column G (index 6) to avoid comma issues in later columns
                const columns = parseCSVRow(row, 7);

                functions.logger.info(`Row ${i+1} limited parsed columns (${columns.length} total):`,
                    columns.slice(0, 7).map((col, idx) => `[${idx}]="${col}"`));

                // C=index 2, D=index 3, E=index 4, F=index 5, G=index 6
                const rating = columns[2] ? columns[2].trim().replace(/"/g, "") : "";
                const bookTitle = columns[3] ? columns[3].trim().replace(/"/g, "") : "";
                const author = columns[4] ? columns[4].trim().replace(/"/g, "") : "";
                const summary = columns[5] ? columns[5].trim().replace(/"/g, "") : "";
                const genre = columns[6] ? columns[6].trim().replace(/"/g, "") : "";

                functions.logger.info(`Row ${i} (sheet row ${i+1}): Title="${bookTitle}", Author="${author}"`);

                // Stop if we hit a gap (empty title)
                if (!bookTitle || bookTitle.length === 0) {
                    functions.logger.info(`Stopping at row ${i} due to empty title`);
                    break;
                }

                if (author) { // Only require author
                    lastFiveYearsReads.push({
                        title: bookTitle.toLowerCase(),
                        author: author.toLowerCase(),
                        rating: rating || "",
                        summary: summary || "",
                        genre: genre || "",
                    });
                }
            }

            functions.logger.info(
                `Found ${recentReads.length} recent reads and ${lastFiveYearsReads.length} last five years reads`,
            );
            return {
                title: title.toLowerCase(),
                recentReads: recentReads,
                lastFiveYearsReads: lastFiveYearsReads,
                stats: readingStats,
            };
        }

        return null;
    } catch (error) {
        functions.logger.error("Error fetching favorite reads:", error);
        return null;
    }
}


function generateSynopsis(description) {
    // Simple synopsis generation - take first two sentences or first 150 chars, more casual
    if (!description) return "no description available";
    // Remove common podcast intro phrases and make more casual
    const cleanDesc = description
        .replace(/In this episode,?\s*/gi, "")
        .replace(/Today we discuss\s*/gi, "")
        .replace(/Listen as\s*/gi, "")
        .replace(/Join us\s*/gi, "")
        .trim();
    const sentences = cleanDesc.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    if (sentences.length >= 2) {
        return sentences.slice(0, 2).join(". ").trim() + ".";
    } else if (sentences.length === 1) {
        return sentences[0].trim() + ".";
    } else {
        // Fallback to first 150 characters - shorter for single line format
        return cleanDesc.substring(0, 150).trim() + (cleanDesc.length > 150 ? "..." : "");
    }
}

function formatDuration(durationMs) {
    const totalSeconds = Math.floor(durationMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    } else {
        return `${minutes}m`;
    }
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const month = (date.getMonth() + 1).toString();
    const day = date.getDate().toString();
    const year = date.getFullYear().toString().slice(-2);
    return `${month}/${day}/${year}`;
}

async function getSpotifyPlaylistTracks(playlistId, limit = 10) {
    functions.logger.info(`Fetching tracks from Spotify playlist: ${playlistId}`);

    try {
        const accessToken = await ensureSpotifyToken();

        // Get playlist info and tracks
        const [playlistResponse, tracksResponse] = await Promise.all([
            axios.get(`https://api.spotify.com/v1/playlists/${playlistId}`, {
                headers: { "Authorization": `Bearer ${accessToken}` },
            }),
            axios.get(`https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=${limit}`, {
                headers: { "Authorization": `Bearer ${accessToken}` },
            }),
        ]);

        const tracks = tracksResponse.data.items.map((item) => ({
            title: item.track.name,
            artist: item.track.artists[0].name,
            uri: item.track.uri,
        }));

        const playlistInfo = {
            name: playlistResponse.data.name,
            description: playlistResponse.data.description,
            image: playlistResponse.data.images && playlistResponse.data.images.length > 0 ?
                playlistResponse.data.images[0].url :
                null,
            tracks: tracks,
            playlistId: playlistId,
        };

        functions.logger.info(`Retrieved ${tracks.length} tracks from playlist ${playlistId}`);
        return playlistInfo;
    } catch (error) {
        functions.logger.error(`Error fetching Spotify playlist ${playlistId}:`, error);
        return { tracks: [], playlistId: playlistId, name: null, image: null };
    }
}

async function getMusicPlaylists() {
    functions.logger.info("Fetching music playlists...");

    const playlists = {
        "current": "78o6nYffU84LaDXu5V3tIh",
        "all-time": "6MpHzCTg0si4e63LU6yC0l",
        "2024": "4DVC4v8cIx73Ym1zSKJwhB",
        "2023": "4efiAHCeCZkvikFpsa4sgj",
        "2022": "1QIt5jA8cWTEMU33Lflgia",
        "2021": "0RUgKC663B8wU7qaoEbZMA",
        "2020": "0rxI2BfACjyrDHUNuOKBKc",
        "2019": "2W61X8pZKymtxWHgPAZ9HO",
        "2018": "30ssyPGT2rlIef4fvtIVhy",
        "2017": "3gqwJU8LgDQePS2wXwJBDW",
        "2016": "3F6xL3Iqp5WDjjDIaBgLWW",
        "2015": "7cqGfXyey0Ty3awvmuIYPK",
    };

    try {
        const results = {};

        // Fetch all playlists in parallel, but only get first 10 tracks for each
        const promises = Object.entries(playlists).map(async ([year, playlistId]) => {
            try {
                const tracks = await getSpotifyPlaylistTracks(playlistId, 10);
                return [year, { tracks, playlistId }];
            } catch (error) {
                functions.logger.error(`Error fetching playlist for ${year}:`, error);
                return [year, { tracks: [], playlistId }];
            }
        });

        const responses = await Promise.allSettled(promises);
        responses.forEach((response) => {
            if (response.status === "fulfilled") {
                const [year, data] = response.value;
                results[year] = data;
            }
        });

        return results;
    } catch (error) {
        functions.logger.error("Error fetching music playlists:", error);
        return {};
    }
}


async function getStravaData() {
    functions.logger.info("Fetching Strava data from RunMusic endpoint...");

    try {
        const response = await axios.get(
            "https://us-central1-runmusic-be.cloudfunctions.net/myLatestWorkout",
        );

        if (response.data.success && response.data.activity) {
            const activity = response.data.activity;

            // Check if activity is longer than 10 minutes and within last 7 days
            const durationMinutes = Math.floor(activity.duration / 60);
            const activityDate = new Date(activity.date);
            const now = new Date();
            const sevenDaysAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));

            // Filter out short activities and old activities
            if (durationMinutes < 10 || activityDate < sevenDaysAgo) {
                functions.logger.info(`Activity filtered out: ${durationMinutes}m duration, date: ${activity.date}`);
                return null; // Return null instead of placeholder
            }

            // Format duration from seconds to minutes
            const durationText = `${durationMinutes}m`;

            const activityName = activity.name || activity.type;
            functions.logger.info(`Latest activity: ${activityName}, ${activity.distance}${activity.distanceUnit}`);

            return {
                activity: activity.name || activity.type,
                type: activity.type || null,
                distance: `${activity.distance}${activity.distanceUnit}`,
                duration: durationText,
                date: activity.date,
                stats: response.data.stats,
                fetchedAt: new Date(),
            };
        } else {
            functions.logger.warn("No activity data available from RunMusic endpoint, trying direct Strava API...");
            return await getStravaDataDirect();
        }
    } catch (error) {
        functions.logger.error("Error with RunMusic endpoint, trying direct Strava API:", error);
        return await getStravaDataDirect();
    }
}

async function getStravaDataDirect() {
    functions.logger.info("Fetching Strava data directly from Strava API...");

    try {
        // Get stored Strava tokens
        const stravaDoc = await db.collection("config").doc("strava").get();
        if (!stravaDoc.exists) {
            functions.logger.warn("No Strava tokens found");
            return null;
        }

        const stravaData = stravaDoc.data();
        let accessToken = stravaData.access_token;
        const refreshToken = stravaData.refresh_token;
        const expiresAt = stravaData.expires_at;

        // Check if token needs refresh
        const now = Math.floor(Date.now() / 1000);
        if (expiresAt <= now) {
            functions.logger.info("Strava token expired, refreshing...");

            const clientId = functions.config().strava?.client_id;
            const clientSecret = functions.config().strava?.client_secret;

            const refreshResponse = await axios.post("https://www.strava.com/oauth/token", {
                client_id: clientId,
                client_secret: clientSecret,
                refresh_token: refreshToken,
                grant_type: "refresh_token",
            });

            accessToken = refreshResponse.data.access_token;
            const newRefreshToken = refreshResponse.data.refresh_token;
            const newExpiresAt = refreshResponse.data.expires_at;

            // Update stored tokens
            await db.collection("config").doc("strava").update({
                access_token: accessToken,
                refresh_token: newRefreshToken,
                expires_at: newExpiresAt,
                updated_at: new Date(),
            });

            functions.logger.info("Strava token refreshed successfully");
        }

        // Get recent activities
        const activitiesResponse = await axios.get("https://www.strava.com/api/v3/athlete/activities", {
            headers: { "Authorization": `Bearer ${accessToken}` },
            params: {
                per_page: 10,
                after: Math.floor((Date.now() - (7 * 24 * 60 * 60 * 1000)) / 1000), // Last 7 days
            },
        });

        const activities = activitiesResponse.data;
        // Find first activity >10 minutes
        for (const activity of activities) {
            const durationMinutes = Math.floor(activity.moving_time / 60);
            if (durationMinutes >= 10) {
                functions.logger.info(`Found activity: ${activity.name}, ${durationMinutes}m`);
                return {
                    activity: activity.name,
                    type: activity.type,
                    distance: `${(activity.distance / 1000).toFixed(1)}km`,
                    duration: `${durationMinutes}m`,
                    date: activity.start_date,
                    fetchedAt: new Date(),
                };
            }
        }

        functions.logger.info("No recent activities >10 minutes found");
        return null;
    } catch (error) {
        functions.logger.error("Error with direct Strava API:", error);
        return null;
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
        // Get daily steps data
        // const stepsDoc = await db.collection("config").doc("daily_steps").get();
        // const dailySteps = stepsDoc.exists ? stepsDoc.data() : null;

        // Fetch data from all sources in parallel
        const [
            spotifyData,
            // whoopData,
            bookData,
            stravaData,
            favoriteRappers,
            musicPlaylists,
            tasteMusicLists,
            podcastEpisodes,
            favoriteReads,
            annualReadingLists,
            thisYearReads,
            spotifyStats,
        ] = await Promise.allSettled([
            getSpotifyData(),
            // getWhoopData(), // Commented out - sleep not used in current narrative
            getBookData(),
            getStravaData(),
            getFavoriteRappers(),
            getMusicPlaylists(), // All music playlists for navigation
            getTasteMusicLists(),
            getPodcastEpisodes(),
            getFavoriteReads(),
            getAnnualReadingLists(),
            getThisYearReads(),
            getSpotifyListeningStats(),
        ]);

        // Prepare data object to save
        const dataToStore = {
            currentSong: spotifyData,
            // sleepStatus: whoopData, // Commented out - sleep not used
            currentBook: bookData,
            activityData: stravaData,
            // dailySteps: dailySteps, // Commented out - steps not used in narrative
            favoriteRappers,
            musicPlaylists,
            tasteMusicLists,
            podcastEpisodes,
            favoriteReads,
            annualReadingLists,
            thisYearReads,
            spotifyStats,
            podcastPlaylistUrl: "https://open.spotify.com/playlist/0kcYF4CGf8G9BlzZSqXHyW",
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
            functions.logger.info("Serving site data to frontend with music playlists.");
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
    const scopes = "user-read-currently-playing user-read-recently-played user-top-read";

    const authUrl = "https://accounts.spotify.com/authorize?" +
        `client_id=${clientId}&` +
        "response_type=code&" +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `scope=${encodeURIComponent(scopes)}`;

    res.redirect(authUrl);
});

// --- Manual Data Refresh Function ---
exports.refreshData = functions.https.onRequest(async (req, res) => {
    // Set CORS headers
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
    }

    functions.logger.info("Manual data refresh triggered");

    try {
        // Get daily steps data
        // const stepsDoc = await db.collection("config").doc("daily_steps").get();
        // const dailySteps = stepsDoc.exists ? stepsDoc.data() : null;

        // Fetch data from all sources in parallel
        const [
            spotifyData,
            // whoopData,
            bookData,
            stravaData,
            favoriteRappers,
            musicPlaylists,
            tasteMusicLists,
            podcastEpisodes,
            favoriteReads,
            annualReadingLists,
            thisYearReads,
            spotifyStats,
        ] = await Promise.allSettled([
            getSpotifyData(),
            // getWhoopData(), // Commented out - sleep not used in current narrative
            getBookData(),
            getStravaData(),
            getFavoriteRappers(),
            getMusicPlaylists(), // All music playlists for navigation
            getTasteMusicLists(),
            getPodcastEpisodes(),
            getFavoriteReads(),
            getAnnualReadingLists(),
            getThisYearReads(),
            getSpotifyListeningStats(),
        ]);

        // Prepare data object to save
        const dataToStore = {
            currentSong: spotifyData,
            // sleepStatus: whoopData, // Commented out - sleep not used
            currentBook: bookData,
            activityData: stravaData,
            // dailySteps: dailySteps, // Commented out - steps not used in narrative
            favoriteRappers,
            musicPlaylists,
            tasteMusicLists,
            podcastEpisodes,
            favoriteReads,
            annualReadingLists,
            thisYearReads,
            spotifyStats,
            podcastPlaylistUrl: "https://open.spotify.com/playlist/0kcYF4CGf8G9BlzZSqXHyW",
            lastUpdated: new Date(), // Timestamp of the whole update cycle
        };

        // Get a reference to the document
        const docRef = db.collection("siteData").doc("latest");

        // Write data to Firestore
        await docRef.set(dataToStore);

        functions.logger.info("Manual data refresh successful:", dataToStore);
        res.status(200).json({ success: true, message: "Data refreshed successfully", data: dataToStore });
    } catch (error) {
        functions.logger.error("Error in manual data refresh:", error);
        res.status(500).json({ success: false, error: "Error refreshing data" });
    }
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

// Simple city name update function for mobile app
exports.updateCity = functions.https.onRequest(async (req, res) => {
    // Set CORS headers
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
    }

    try {
        const { city } = req.body;

        if (!city) {
            res.status(400).send("Missing city name");
            return;
        }

        // Store city name
        await db.collection("config").doc("current_city").set({
            city: city.toLowerCase(),
            updated_at: new Date(),
        });

        functions.logger.info(`City updated: ${city}`);
        res.status(200).json({ success: true, message: "City updated", city });
    } catch (error) {
        functions.logger.error("Error updating city:", error);
        res.status(500).send("Error updating city");
    }
});

// Step count update function for iOS app
exports.updateSteps = functions.https.onRequest(async (req, res) => {
    // Set CORS headers
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
    }

    try {
        const { steps, date } = req.body;

        if (steps === undefined || steps === null) {
            res.status(400).send("Missing steps count");
            return;
        }

        const stepData = {
            steps: parseInt(steps),
            date: date || new Date().toISOString().split("T")[0], // Use YYYY-MM-DD format
            updated_at: new Date(),
        };

        // Store steps for today
        await db.collection("config").doc("daily_steps").set(stepData);

        functions.logger.info(`Steps updated: ${steps} for ${stepData.date}`);
        res.status(200).json({ success: true, message: "Steps updated", steps: stepData.steps });
    } catch (error) {
        functions.logger.error("Error updating steps:", error);
        res.status(500).send("Error updating steps");
    }
});

// Configure Google Sheets for book data
exports.configureGoogleSheets = functions.https.onRequest(async (req, res) => {
    // Set CORS headers
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
    }

    try {
        const { spreadsheet_id: spreadsheetId, range = "A1:B1" } = req.body;

        if (!spreadsheetId) {
            res.status(400).send("Missing spreadsheet_id");
            return;
        }

        // Store Google Sheets configuration
        await db.collection("config").doc("google_sheets").set({
            spreadsheet_id: spreadsheetId,
            range,
            updated_at: new Date(),
        });

        res.status(200).send("Google Sheets configured successfully");
    } catch (error) {
        functions.logger.error("Error configuring Google Sheets:", error);
        res.status(500).send("Failed to configure Google Sheets");
    }
});

// Strava OAuth callback handler - accepts code from external redirect
exports.stravaExchangeToken = functions.https.onRequest(async (req, res) => {
    // Set CORS headers
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
    }

    const { code } = req.body;

    if (!code) {
        res.status(400).json({ error: "Authorization code missing" });
        return;
    }

    try {
        const clientId = functions.config().strava?.client_id;
        const clientSecret = functions.config().strava?.client_secret;

        // Exchange code for tokens
        const tokenResponse = await axios.post("https://www.strava.com/oauth/token", {
            client_id: clientId,
            client_secret: clientSecret,
            code: code,
            grant_type: "authorization_code",
        });

        const { access_token: accessToken, refresh_token: refreshToken, expires_at: expiresAt } = tokenResponse.data;

        // Store tokens in Firestore
        await db.collection("config").doc("strava").set({
            access_token: accessToken,
            refresh_token: refreshToken,
            expires_at: expiresAt,
            athlete_id: tokenResponse.data.athlete.id,
            updated_at: new Date(),
        });

        functions.logger.info("Strava connected successfully");
        res.status(200).json({ success: true, message: "Strava connected successfully" });
    } catch (error) {
        functions.logger.error("Strava OAuth error:", error);
        res.status(500).json({ error: "Failed to connect Strava" });
    }
});

// Legacy callback (keeping for compatibility)
exports.stravaCallback = functions.https.onRequest(async (req, res) => {
    const { code } = req.query;

    if (!code) {
        res.status(400).send("Authorization code missing");
        return;
    }

    try {
        const clientId = functions.config().strava?.client_id;
        const clientSecret = functions.config().strava?.client_secret;

        // Exchange code for tokens
        const tokenResponse = await axios.post("https://www.strava.com/oauth/token", {
            client_id: clientId,
            client_secret: clientSecret,
            code: code,
            grant_type: "authorization_code",
        });

        const { access_token: accessToken, refresh_token: refreshToken, expires_at: expiresAt } = tokenResponse.data;

        // Store tokens in Firestore
        await db.collection("config").doc("strava").set({
            access_token: accessToken,
            refresh_token: refreshToken,
            expires_at: expiresAt,
            athlete_id: tokenResponse.data.athlete.id,
            updated_at: new Date(),
        });

        functions.logger.info("Strava connected successfully");

        res.status(200).send(`
            <html>
                <body style="font-family: system-ui; padding: 20px; background: #0a0a0a; color: #fff;">
                    <h2>Strava Connected Successfully!</h2>
                    <p>You can close this window and return to your homepage.</p>
                    <script>setTimeout(() => window.close(), 3000);</script>
                </body>
            </html>
        `);
    } catch (error) {
        functions.logger.error("Strava OAuth error:", error);
        res.status(500).send("Failed to connect Strava");
    }
});

// Strava auth URL generator
exports.getStravaAuthUrl = functions.https.onRequest((req, res) => {
    // Set CORS headers
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
    }

    const clientId = functions.config().strava?.client_id;

    if (!clientId) {
        res.status(500).send("Strava not configured");
        return;
    }

    const redirectUri = "https://us-central1-ckubal-homepage-be.cloudfunctions.net/stravaCallback";
    const scope = "activity:read";

    const authUrl = `https://www.strava.com/oauth/authorize?client_id=${clientId}` +
        `&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}`;

    res.json({ authUrl });
});

// WHOOP OAuth callback
exports.whoopCallback = functions.https.onRequest(async (req, res) => {
    const { code } = req.query;

    if (!code) {
        res.status(400).send("Authorization code missing");
        return;
    }

    try {
        const clientId = functions.config().whoop?.client_id;
        const clientSecret = functions.config().whoop?.client_secret;
        const redirectUri = "https://us-central1-ckubal-homepage-be.cloudfunctions.net/whoopCallback";

        // Exchange code for tokens
        const tokenResponse = await axios.post("https://api.prod.whoop.com/oauth/oauth2/token",
            new URLSearchParams({
                grant_type: "authorization_code",
                code: code,
                redirect_uri: redirectUri,
                client_id: clientId,
                client_secret: clientSecret,
            }), {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
            });

        const { access_token: accessToken, refresh_token: refreshToken, expires_in: expiresIn } = tokenResponse.data;

        // Store tokens in Firestore (WHOOP may not return refresh_token)
        const tokenData = {
            access_token: accessToken,
            expires_at: Math.floor(Date.now() / 1000) + expiresIn,
            updated_at: new Date(),
        };

        if (refreshToken) {
            tokenData.refresh_token = refreshToken;
        }

        await db.collection("config").doc("whoop").set(tokenData);

        functions.logger.info("WHOOP connected successfully");

        res.status(200).send(`
            <html>
                <body style="font-family: system-ui; padding: 20px; background: #0a0a0a; color: #fff;">
                    <h2>WHOOP Connected Successfully!</h2>
                    <p>You can close this window and return to your homepage.</p>
                    <script>setTimeout(() => window.close(), 3000);</script>
                </body>
            </html>
        `);
    } catch (error) {
        functions.logger.error("WHOOP OAuth error:", error);
        res.status(500).send("Failed to connect WHOOP");
    }
});

// WHOOP auth URL generator
exports.getWhoopAuthUrl = functions.https.onRequest((req, res) => {
    // Set CORS headers
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
    }

    const clientId = functions.config().whoop?.client_id;

    if (!clientId) {
        res.status(500).send("WHOOP not configured");
        return;
    }

    const redirectUri = "https://us-central1-ckubal-homepage-be.cloudfunctions.net/whoopCallback";
    const scope = "read:recovery read:sleep read:workout read:profile";

    const authUrl = "https://api.prod.whoop.com/oauth/oauth2/auth?" +
        "response_type=code" +
        `&client_id=${clientId}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&scope=${encodeURIComponent(scope)}` +
        "&state=homepage-auth";

    res.json({ authUrl });
});

// WHOOP webhook handler for v2
exports.whoopWebhook = functions.https.onRequest(async (req, res) => {
    // Set CORS headers
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
    }

    try {
        const { type, data } = req.body;

        functions.logger.info("WHOOP webhook received:", { type, data });

        // Handle different webhook event types
        if (type === "recovery.updated") {
            // Trigger data refresh when recovery data is updated
            functions.logger.info("Recovery data updated, triggering refresh");

            // You could trigger the fetchAndStoreData function here
            // or update specific data in Firestore
        }

        res.status(200).json({ received: true });
    } catch (error) {
        functions.logger.error("WHOOP webhook error:", error);
        res.status(500).json({ error: "Webhook processing failed" });
    }
});

// Export annual reading lists function for direct access
exports.getAnnualReadingLists = functions.https.onRequest(async (req, res) => {
    // Set CORS headers
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
    }

    try {
        const annualLists = await getAnnualReadingLists();
        res.status(200).json(annualLists);
    } catch (error) {
        functions.logger.error("Error in getAnnualReadingLists endpoint:", error);
        res.status(500).json({ error: "Failed to fetch annual reading lists" });
    }
});
