# homepage backend

firebase functions for charliekubal.com

## setup
```bash
cd functions
npm install
```

## config
credentials live in `functions/.env` (gitignored; the firebase cli loads it at deploy time):

```bash
cp functions/.env.example functions/.env   # then fill in
```
keys: `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `WHOOP_CLIENT_ID`, `WHOOP_CLIENT_SECRET`


## deploy
```bash
firebase deploy --only functions
```

## endpoints
- `/getSiteData` - main endpoint with all the data
- `/spotifyCallback` - spotify oauth
- `/stravaExchangeToken` - strava token exchange
- `/whoopCallback` - whoop oauth

the old location/steps/health write endpoints are commented out in `index.js` (they had no auth).