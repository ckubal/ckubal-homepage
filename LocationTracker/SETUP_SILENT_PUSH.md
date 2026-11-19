# Silent push setup checklist

The app and backend are configured for silent push. To have it **actually working** on a device, complete these steps once.

## Done in code (no action needed)

- **Backend**: `saveFCMToken` and `sendLocationTrackerSilentPush` (every 20 min) are deployed.
- **Xcode**: Firebase Swift package (FirebaseCore, FirebaseMessaging) and Push Notifications entitlement (`aps-environment`) are added to the project.

**First time:** Open `LocationTracker.xcodeproj` in Xcode so it can resolve the Firebase Swift package (File → Packages → Resolve Package Versions if needed).

## You need to do (one-time)

### 1. Add the iOS app in Firebase Console

1. Open [Firebase Console](https://console.firebase.google.com/) → project **ckubal-homepage-be**.
2. Project settings (gear) → **General** → **Your apps**.
3. Click **Add app** → **iOS**.
4. Bundle ID: `com.charliekubal.locationtracker`.
5. Register app, then **Download `GoogleService-Info.plist`**.

### 2. Add GoogleService-Info.plist to Xcode

1. Drag `GoogleService-Info.plist` into the **LocationTracker** group in Xcode (under the yellow folder).
2. In the dialog, check **Copy items if needed** and ensure **LocationTracker** target is checked.
3. Click Finish.

### 3. Upload APNs key to Firebase

1. **Apple Developer**: [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/authkeys/list) → **Keys** → create a key with **Apple Push Notifications service (APNs)** enabled. Download the `.p8` file (only once) and note **Key ID**.
2. **Firebase Console**: Project settings → **Cloud Messaging** tab → **Apple app configuration**.
3. Under **APNs Authentication Key**, upload the `.p8` file and enter your **Key ID**, **Team ID**, and **Bundle ID** (`com.charliekubal.locationtracker`).

### 4. Push Notifications capability in Xcode

1. In Xcode, select the **LocationTracker** target → **Signing & Capabilities**.
2. Click **+ Capability** and add **Push Notifications** (if not already present).  
   The entitlements file already has `aps-environment`; adding the capability ensures the provisioning profile includes push.

### 5. Run on a device once

Build and run LocationTracker on a **physical device** (silent push does not work on simulator). The app will register for remote notifications and send its FCM token to the backend. After that, the scheduled function will send a silent push every 20 minutes.

---

**Release builds**: For archive/App Store builds, ensure the **Release** configuration uses an entitlement with `aps-environment` = `production` (Xcode often adds this when you have Push Notifications capability and a production provisioning profile).
