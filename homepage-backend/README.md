# homepage backend

firebase functions for charliekubal.com

## setup
```bash
cd functions
npm install
```

## config
needs firebase config for:
- spotify (client_id, client_secret)
- strava (client_id, client_secret)  
- whoop (client_id, client_secret)

set em with:
```bash
firebase functions:config:set spotify.client_id="..." spotify.client_secret="..."
```

## deploy
```bash
firebase deploy --only functions
```

## endpoints
- `/getSiteData` - main endpoint with all the data
- `/spotifyCallback` - spotify oauth
- `/stravaExchangeToken` - strava token exchange
- `/whoopCallback` - whoop oauth