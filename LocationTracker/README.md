# LocationTracker

iOS app that updates your homepage with current location and Apple Health data (steps, calories, sleep, workouts). Works in the background so you rarely need to open the app.

## How updates work

- **Location**: Significant location changes + geofences (22nd St, Henry St, Roblox) keep location accurate; bad GPS fixes are rejected. When the app wakes (see below), it also requests a fresh location.
- **Health**: Synced to Firebase when the app opens, when it comes to foreground, and when the app is woken in the background.

**Background wake-up (so health/location update every ~15–30 min without opening the app):**

1. **Silent push (recommended)** – Backend sends a silent FCM push every 20 minutes. The app wakes, syncs health + location, then goes back to sleep. Reliable and predictable.
2. **BG App Refresh** – iOS may also run a background task from time to time; when it does, we sync health + location. Not guaranteed every 15–30 min.

## Enabling silent push (optional but recommended)

Silent push gives you **reliable ~20 min** health + location sync. Without it, updates only happen when you open the app or when iOS decides to run the background task (unpredictable).

**Quick checklist:** See **[SETUP_SILENT_PUSH.md](SETUP_SILENT_PUSH.md)** for the exact steps. Summary below.

### 1. Firebase project

- Use the same Firebase project as the backend (`ckubal-homepage-be`). In Firebase Console → Project settings → General, add an **iOS app** with bundle ID `com.charliekubal.locationtracker`.
- Download **GoogleService-Info.plist** and add it to the LocationTracker target in Xcode.

### 2. APNs key in Firebase

- In Firebase Console → Project settings → Cloud Messaging → **Apple app configuration**, upload your **APNs authentication key** (.p8 from Apple Developer) and set Key ID, Team ID, Bundle ID. Without this, FCM cannot deliver to your device.

### 3. Xcode

- **Push Notifications**: Signing & Capabilities → + Capability → **Push Notifications**.
- **Add Firebase SDK**: File → Add Package Dependencies → `https://github.com/firebase/firebase-ios-sdk`. Add **FirebaseCore** and **FirebaseMessaging** to the LocationTracker target.
- Ensure **GoogleService-Info.plist** is in the target and that the app builds.

### 4. Backend (already implemented)

- `saveFCMToken` – stores the device FCM token in Firestore (`config/fcm_token`).
- `sendLocationTrackerSilentPush` – runs every 20 minutes and sends a silent push to that token. No backend changes needed unless you want a different schedule.

After setup, open the app once so it can register for remote notifications and send its FCM token to the backend. Then silent pushes will wake the app about every 20 minutes to sync health and location.

## Battery

- Location uses significant location changes and geofences (low power).
- Silent push and BG App Refresh only run periodically; each wake does one location request and one health sync then exits.
