import UIKit
import BackgroundTasks
import UserNotifications
#if canImport(FirebaseCore)
import FirebaseCore
import FirebaseMessaging
#endif

private let kBackgroundRefreshTaskIdentifier = "com.ckubal.LocationTracker.locationRefresh"
private let kBackgroundRefreshInterval: TimeInterval = 15 * 60  // 15 min minimum; iOS may delay
private let kSaveFCMTokenURL = "https://us-central1-ckubal-homepage-be.cloudfunctions.net/saveFCMToken"

final class AppDelegate: NSObject, UIApplicationDelegate {
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        #if canImport(FirebaseCore)
        // Firebase is used ONLY for silent push (FirebaseMessaging). Every piece of
        // real data — location, health — is written to Cloud Functions over plain
        // HTTPS with URLSession, so the app is fully functional without Firebase.
        //
        // There is no GoogleService-Info.plist in this project and there never has
        // been (checked the full git history and every archive on 2026-08-11), so
        // FirebaseApp.configure() throws an uncaught exception and the app dies on
        // launch. Guard it: no plist means no silent push, but location and health
        // sync keep working, and background refresh still runs via BGAppRefreshTask
        // and the in-app timer.
        if Bundle.main.url(forResource: "GoogleService-Info", withExtension: "plist") != nil {
            FirebaseApp.configure()
            UNUserNotificationCenter.current().delegate = self
            Messaging.messaging().delegate = self
            application.registerForRemoteNotifications()
        } else {
            print("LocationTracker: no GoogleService-Info.plist — skipping Firebase. Silent push disabled; location and health sync are unaffected.")
        }
        #endif
        registerBackgroundTasks()
        scheduleLocationRefresh()
        return true
    }

    /// Called when a silent (or any) remote notification arrives. Sync health + location then tell iOS we're done.
    func application(_ application: UIApplication, didReceiveRemoteNotification userInfo: [AnyHashable: Any], fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
        guard userInfo["sync"] as? String == "1" else {
            completionHandler(.noData)
            return
        }
        // Sync health so calories/steps update every ~20 min without opening app
        if HealthDataManager.shared.healthKitAuthorized {
            HealthDataManager.shared.lastHealthSyncTime = Date(timeIntervalSince1970: 0)
            HealthDataManager.shared.syncHealthToFirebase()
        }
        // Refresh location (uses same completion as BG task: location or timeout)
        LocationManager.shared.performBackgroundRefresh(completion: completionHandler)
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        #if canImport(FirebaseCore)
        Messaging.messaging().apnsToken = deviceToken
        #endif
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        print("Remote notifications registration failed: \(error.localizedDescription)")
    }

    private func registerBackgroundTasks() {
        BGTaskScheduler.shared.register(forTaskWithIdentifier: kBackgroundRefreshTaskIdentifier, using: nil) { [weak self] task in
            self?.handleLocationRefresh(task: task as! BGAppRefreshTask)
        }
    }

    private func handleLocationRefresh(task: BGAppRefreshTask) {
        scheduleLocationRefresh() // Schedule next run first

        // Sync health to Firebase whenever iOS gives us background time (steps, calories, etc.)
        if HealthDataManager.shared.healthKitAuthorized {
            HealthDataManager.shared.lastHealthSyncTime = Date(timeIntervalSince1970: 0)
            HealthDataManager.shared.syncHealthToFirebase()
        }

        let completion: (UIBackgroundFetchResult) -> Void = { result in
            task.setTaskCompleted(success: result != .failed)
        }
        LocationManager.shared.performBackgroundRefresh(completion: completion)
    }

    /// Call when app launches and after each BG task so iOS can wake us periodically.
    func scheduleLocationRefresh() {
        let request = BGAppRefreshTaskRequest(identifier: kBackgroundRefreshTaskIdentifier)
        request.earliestBeginDate = Date(timeIntervalSinceNow: kBackgroundRefreshInterval)
        do {
            try BGTaskScheduler.shared.submit(request)
            print("Scheduled next location refresh in ~\(Int(kBackgroundRefreshInterval / 60)) min")
        } catch {
            print("Could not schedule location refresh: \(error)")
        }
    }

    private func sendFCMTokenToBackend(_ token: String) {
        guard let url = URL(string: kSaveFCMTokenURL) else { return }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONSerialization.data(withJSONObject: ["token": token])
        URLSession.shared.dataTask(with: request) { _, _, error in
            if let error = error {
                print("Failed to save FCM token: \(error.localizedDescription)")
            } else {
                print("FCM token saved to backend for silent push")
            }
        }.resume()
    }
}

// MARK: - UNUserNotificationCenterDelegate (required for silent push to wake app)
extension AppDelegate: UNUserNotificationCenterDelegate {
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification, withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler([])
    }
}

// MARK: - MessagingDelegate (FCM token for silent push)
#if canImport(FirebaseMessaging)
extension AppDelegate: MessagingDelegate {
    func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
        guard let token = fcmToken else { return }
        sendFCMTokenToBackend(token)
    }
}
#endif
