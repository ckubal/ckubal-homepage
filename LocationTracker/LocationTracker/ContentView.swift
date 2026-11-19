import SwiftUI
import CoreLocation
import HealthKit

struct ContentView: View {
    @ObservedObject private var locationManager = LocationManager.shared
    @ObservedObject private var healthManager = HealthDataManager.shared
    @State private var overrideText = ""
    @State private var showingAlert = false
    
    var body: some View {
        NavigationView {
            GeometryReader { geometry in
                ZStack {
                    Color.black.ignoresSafeArea(.all)
                    
                    ScrollView {
                        LazyVStack(spacing: 24) {
                // Header
                VStack(spacing: 16) {
                    Text("🚶‍♂️")
                        .font(.system(size: 40))
                        .opacity(0.8)
                    
                    VStack(spacing: 6) {
                        Text("Location Tracker")
                            .font(.system(size: 28, weight: .bold, design: .rounded))
                            .foregroundColor(.white)
                        
                        Text("Auto-updates your homepage location")
                            .font(.system(size: 15, weight: .medium))
                            .foregroundColor(.gray)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 20)
                    }
                }
                
                // Live Firebase Location Status
                VStack(spacing: 12) {
                    HStack {
                        Text("🌍")
                            .font(.system(size: 20))
                        Text("Live Location")
                            .font(.system(size: 17, weight: .semibold))
                            .foregroundColor(.white)
                        Spacer()
                    }
                    
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            if let firebaseCity = locationManager.firebaseCity {
                                Text(firebaseCity.capitalized)
                                    .font(.system(size: 22, weight: .bold))
                                    .foregroundColor(.white)
                            } else {
                                Text("Loading...")
                                    .font(.system(size: 22, weight: .bold))
                                    .foregroundColor(.gray)
                            }
                            
                            Text(!locationManager.locationOverride.isEmpty ? "Manual Override" : "GPS Location")
                                .font(.system(size: 13, weight: .medium))
                                .foregroundColor(.gray)
                        }
                        Spacer()
                    }
                }
                .padding(20)
                .background(Color.white.opacity(0.05))
                .overlay(
                    RoundedRectangle(cornerRadius: 16)
                        .stroke(Color.white.opacity(0.1), lineWidth: 1)
                )
                .cornerRadius(16)
            
                // Location Override Section
                VStack(spacing: 16) {
                    HStack {
                        Text("✏️")
                            .font(.system(size: 20))
                        Text("Manual Override")
                            .font(.system(size: 17, weight: .semibold))
                            .foregroundColor(.white)
                        Spacer()
                    }
                    
                    Text("Set a custom location or use GPS")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(.gray)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    
                    TextField("Tokyo, Paris, etc.", text: $overrideText)
                        .textFieldStyle(PlainTextFieldStyle())
                        .padding(16)
                        .background(Color.white.opacity(0.08))
                        .overlay(
                            RoundedRectangle(cornerRadius: 12)
                                .stroke(Color.white.opacity(0.15), lineWidth: 1)
                        )
                        .foregroundColor(.white)
                        .font(.system(size: 16, weight: .medium))
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.words)
                        .cornerRadius(12)
                        .onSubmit {
                            updateOverride()
                        }
                    
                    HStack(spacing: 12) {
                        Button(action: updateOverride) {
                            Text(overrideText.isEmpty ? "Clear Override" : "Save Override")
                                .font(.system(size: 15, weight: .semibold))
                                .frame(maxWidth: .infinity)
                                .padding(14)
                                .background(Color.blue.opacity(0.2))
                                .foregroundColor(.blue)
                                .cornerRadius(10)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 10)
                                        .stroke(Color.blue.opacity(0.3), lineWidth: 1)
                                )
                        }
                        
                        Button(action: {
                            locationManager.updateLocation()
                        }) {
                            Text("Use GPS")
                                .font(.system(size: 15, weight: .semibold))
                                .frame(maxWidth: .infinity)
                                .padding(14)
                                .background(Color.white.opacity(0.1))
                                .foregroundColor(.white)
                                .cornerRadius(10)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 10)
                                        .stroke(Color.white.opacity(0.2), lineWidth: 1)
                                )
                        }
                    }
                }
                .padding(20)
                .background(Color.white.opacity(0.05))
                .overlay(
                    RoundedRectangle(cornerRadius: 16)
                        .stroke(Color.white.opacity(0.1), lineWidth: 1)
                )
                .cornerRadius(16)
            
                // Health (Apple Health) Section
                VStack(spacing: 16) {
                    HStack {
                        Text("❤️")
                            .font(.system(size: 20))
                        Text("Health")
                            .font(.system(size: 17, weight: .semibold))
                            .foregroundColor(.white)
                        Spacer()
                    }
                    
                    if !healthManager.healthKitAvailable {
                        VStack(spacing: 12) {
                            Text("❌")
                                .font(.system(size: 32))
                            Text("Health app not available on this device")
                                .font(.system(size: 15, weight: .medium))
                                .foregroundColor(.gray)
                                .multilineTextAlignment(.center)
                        }
                        .padding(.vertical, 20)
                    } else if !healthManager.healthKitAuthorized {
                        VStack(spacing: 16) {
                            Text("🔒")
                                .font(.system(size: 32))
                            Text("Health access needed for steps, sleep, calories, workouts, and more")
                                .font(.system(size: 15, weight: .medium))
                                .foregroundColor(.gray)
                                .multilineTextAlignment(.center)
                            
                            Button(action: {
                                healthManager.requestHealthKitPermissions()
                            }) {
                                Text("Enable Health Access")
                                    .font(.system(size: 15, weight: .semibold))
                                    .frame(maxWidth: .infinity)
                                    .padding(14)
                                    .background(Color.blue.opacity(0.2))
                                    .foregroundColor(.blue)
                                    .cornerRadius(10)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 10)
                                            .stroke(Color.blue.opacity(0.3), lineWidth: 1)
                                    )
                            }
                        }
                        .padding(.vertical, 12)
                    } else {
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Today")
                                    .font(.system(size: 13, weight: .medium))
                                    .foregroundColor(.gray)
                                
                                Text("\(healthManager.todaySteps.formatted()) steps")
                                    .font(.system(size: 22, weight: .bold))
                                    .foregroundColor(.white)
                                
                                if healthManager.todayDietaryCalories != nil {
                                    Text("\(healthManager.todayDietaryCalories!) cal logged")
                                        .font(.system(size: 13, weight: .medium))
                                        .foregroundColor(.gray)
                                }
                            }
                            Spacer()
                        }
                        
                        Button(action: {
                            healthManager.syncHealthToFirebase()
                        }) {
                            Text("Sync to Homepage")
                                .font(.system(size: 15, weight: .semibold))
                                .frame(maxWidth: .infinity)
                                .padding(14)
                                .background(Color.green.opacity(0.2))
                                .foregroundColor(.green)
                                .cornerRadius(10)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 10)
                                        .stroke(Color.green.opacity(0.3), lineWidth: 1)
                                )
                        }
                    }
                }
                .padding(20)
                .background(Color.white.opacity(0.05))
                .overlay(
                    RoundedRectangle(cornerRadius: 16)
                        .stroke(Color.white.opacity(0.1), lineWidth: 1)
                )
                .cornerRadius(16)

                // Status Info
                VStack(spacing: 16) {
                    HStack {
                        Text("📊")
                            .font(.system(size: 20))
                        Text("System Status")
                            .font(.system(size: 17, weight: .semibold))
                            .foregroundColor(.white)
                        Spacer()
                    }
                    
                    VStack(spacing: 12) {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("GPS Location")
                                    .font(.system(size: 12, weight: .medium))
                                    .foregroundColor(.gray)
                                Text((locationManager.gpsCity ?? "Unknown").capitalized)
                                    .font(.system(size: 15, weight: .semibold))
                                    .foregroundColor(.white)
                            }
                            Spacer()
                            Circle()
                                .fill(locationManager.gpsCity != nil ? Color.green : Color.gray)
                                .frame(width: 8, height: 8)
                        }
                        
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Monitoring")
                                    .font(.system(size: 12, weight: .medium))
                                    .foregroundColor(.gray)
                                Text(locationManager.isMonitoring ? "Active" : "Inactive")
                                    .font(.system(size: 15, weight: .semibold))
                                    .foregroundColor(locationManager.isMonitoring ? .white : .gray)
                            }
                            Spacer()
                            Circle()
                                .fill(locationManager.isMonitoring ? Color.green : Color.red)
                                .frame(width: 8, height: 8)
                        }
                        
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Last Update")
                                    .font(.system(size: 12, weight: .medium))
                                    .foregroundColor(.gray)
                                Text(locationManager.lastUpdate ?? "Never")
                                    .font(.system(size: 15, weight: .semibold))
                                    .foregroundColor(.white)
                            }
                            Spacer()
                        }
                        
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Website Last Updated")
                                    .font(.system(size: 12, weight: .medium))
                                    .foregroundColor(.gray)
                                Text(locationManager.websiteLastUpdate ?? "Loading...")
                                    .font(.system(size: 15, weight: .semibold))
                                    .foregroundColor(.white)
                            }
                            Spacer()
                        }
                    }
                }
                .padding(20)
                .background(Color.white.opacity(0.05))
                .overlay(
                    RoundedRectangle(cornerRadius: 16)
                        .stroke(Color.white.opacity(0.1), lineWidth: 1)
                )
                .cornerRadius(16)
                
                        }
                        .padding(.horizontal, 20)
                        .padding(.top, geometry.safeAreaInsets.top)
                        .padding(.bottom, geometry.safeAreaInsets.bottom)
                    }
                }
            }
            .navigationBarHidden(true)
            .onTapGesture {
                hideKeyboard()
            }
        }
        .navigationViewStyle(StackNavigationViewStyle())
        .onAppear {
            locationManager.startLocationUpdates()
            locationManager.fetchCurrentFirebaseLocation()
            overrideText = locationManager.locationOverride
            healthManager.checkAuthorizationStatus()
            healthManager.syncHealthToFirebase()
        }
        .onReceive(NotificationCenter.default.publisher(for: UIApplication.willEnterForegroundNotification)) { _ in
            print("App entering foreground - forcing all data sync")
            locationManager.forceLocationUpdate()
            if healthManager.healthKitAuthorized {
                healthManager.lastHealthSyncTime = Date(timeIntervalSince1970: 0)
                healthManager.syncHealthToFirebase()
            }
        }
        .alert("location updated", isPresented: $showingAlert) {
            Button("ok", role: .cancel) { }
        } message: {
            Text("your homepage location has been updated!")
                .textCase(.lowercase)
        }
    }
    
    private func updateOverride() {
        let trimmedText = overrideText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        locationManager.setLocationOverride(trimmedText)
        
        if trimmedText.isEmpty {
            // Clearing override - get real location
            locationManager.updateLocation()
        } else {
            // Setting override - send city name only (no coordinates for manual overrides)
            locationManager.sendLocationToFirebase(city: trimmedText)
        }
        
        showingAlert = true
        hideKeyboard()
    }
    
    private func hideKeyboard() {
        UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
    }
}

// Geofence place definitions (tight ~100m radius; iOS minimum)
private let kGeofenceRadius: CLLocationDistance = 100

private struct GeofencePlace {
    let identifier: String
    let label: String  // Sent to Firebase / Cosmo
    let latitude: CLLocationDegrees
    let longitude: CLLocationDegrees
    var coordinate: CLLocationCoordinate2D { CLLocationCoordinate2D(latitude: latitude, longitude: longitude) }
}

private let kGeofencePlaces: [GeofencePlace] = [
    GeofencePlace(identifier: "22nd_st_home", label: "22nd St Home", latitude: 37.7560, longitude: -122.4310),   // 4048 22nd St, SF 94114
    GeofencePlace(identifier: "henry_st_home", label: "Henry St Home", latitude: 37.7580, longitude: -122.4070),  // 70A Henry St, SF 94114
    GeofencePlace(identifier: "roblox", label: "Roblox", latitude: 37.5440, longitude: -122.2970),                 // 2750 S Delaware St, San Mateo 94403
]

private let kBackgroundRefreshTimeout: TimeInterval = 25  // Max wait for location in BG task

class LocationManager: NSObject, ObservableObject, CLLocationManagerDelegate {
    static let shared = LocationManager()
    
    private let locationManager = CLLocationManager()
    private let geocoder = CLGeocoder()
    
    /// Monitored geofence regions (so we can check if a location is inside one)
    private var monitoredRegions: [CLCircularRegion] = []
    
    /// Used by BGAppRefreshTask to know when we're done and to complete the task
    private var backgroundFetchCompletion: ((UIBackgroundFetchResult) -> Void)?
    private var backgroundRefreshTimeout: DispatchWorkItem?
    
    @Published var gpsCity: String?
    @Published var firebaseCity: String?
    @Published var lastUpdate: String?
    @Published var websiteLastUpdate: String?
    @Published var isMonitoring = false
    @Published var locationOverride: String = ""
    
    override init() {
        super.init()
        locationManager.delegate = self
        // Block-level accuracy (~100m) for recommendations and menu/photo context; Best when user taps "Use GPS"
        locationManager.desiredAccuracy = kCLLocationAccuracyHundredMeters
        locationManager.distanceFilter = 100 // 100m so we get updates at roughly block scale
        
        // Load saved override from UserDefaults
        locationOverride = UserDefaults.standard.string(forKey: "locationOverride") ?? ""
    }
    
    func startLocationUpdates() {
        switch locationManager.authorizationStatus {
        case .notDetermined:
            locationManager.requestAlwaysAuthorization()
        case .authorizedAlways:
            startMonitoring()
        case .authorizedWhenInUse:
            // Request always authorization for background updates
            locationManager.requestAlwaysAuthorization()
        case .denied, .restricted:
            print("Location access denied")
        @unknown default:
            break
        }
    }
    
    private func startMonitoring() {
        // Start significant location changes - very battery efficient, works when app is backgrounded/killed
        if CLLocationManager.significantLocationChangeMonitoringAvailable() {
            locationManager.startMonitoringSignificantLocationChanges()
            isMonitoring = true
            print("Started monitoring significant location changes")
        }
        
        // Register geofences so we get enter/exit callbacks and can correct reverse-geocode mistakes
        for place in kGeofencePlaces {
            let region = CLCircularRegion(center: place.coordinate, radius: kGeofenceRadius, identifier: place.identifier)
            region.notifyOnEntry = true
            region.notifyOnExit = true
            locationManager.startMonitoring(for: region)
            monitoredRegions.append(region)
        }
        print("Started monitoring \(kGeofencePlaces.count) geofences")
        
        // Get initial location
        updateLocation()
        
        // Add a timer for periodic location checks - every 30 minutes when app is active (foreground only)
        Timer.scheduledTimer(withTimeInterval: 1800, repeats: true) { [weak self] _ in
            print("Timer location check triggered")
            if self?.locationOverride.isEmpty == true {
                self?.updateLocation()
            }
        }
    }
    
    func updateLocation() {
        guard locationManager.authorizationStatus == .authorizedAlways ||
              locationManager.authorizationStatus == .authorizedWhenInUse else {
            print("Location authorization not granted, can't update location")
            return
        }
        
        print("Requesting location update...")
        locationManager.requestLocation()
    }
    
    func forceLocationUpdate() {
        // Force an immediate location update (called when app becomes active)
        print("Forcing location update on app foreground")
        updateLocation()
        
        // Also refresh Firebase location status
        fetchCurrentFirebaseLocation()
    }
    
    /// Call from BGAppRefreshTask to request a location update and call completion when done (or after timeout).
    func performBackgroundRefresh(completion: @escaping (UIBackgroundFetchResult) -> Void) {
        guard locationManager.authorizationStatus == .authorizedAlways ||
              locationManager.authorizationStatus == .authorizedWhenInUse else {
            completion(.noData)
            return
        }
        if !locationOverride.isEmpty {
            completion(.noData)
            return
        }
        backgroundFetchCompletion = completion
        backgroundRefreshTimeout?.cancel()
        let work = DispatchWorkItem { [weak self] in
            guard let self = self else { return }
            if let comp = self.backgroundFetchCompletion {
                self.backgroundFetchCompletion = nil
                comp(.noData)
            }
        }
        backgroundRefreshTimeout = work
        DispatchQueue.main.asyncAfter(deadline: .now() + kBackgroundRefreshTimeout, execute: work)
        locationManager.requestLocation()
    }
    
    private func finishBackgroundRefresh(result: UIBackgroundFetchResult) {
        backgroundRefreshTimeout?.cancel()
        backgroundRefreshTimeout = nil
        backgroundFetchCompletion?(result)
        backgroundFetchCompletion = nil
    }
    
    // MARK: - CLLocationManagerDelegate
    
    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else { return }
        
        // Reject stale or low-accuracy fixes so one bad update doesn't overwrite correct state
        let maxAge: TimeInterval = 300  // 5 minutes
        let maxHorizontalAccuracy: CLLocationAccuracy = 200  // meters
        if location.timestamp.timeIntervalSinceNow < -maxAge {
            print("Ignoring stale location (age \(Int(-location.timestamp.timeIntervalSinceNow))s)")
            return
        }
        if location.horizontalAccuracy < 0 || location.horizontalAccuracy > maxHorizontalAccuracy {
            print("Ignoring low-accuracy location (accuracy \(location.horizontalAccuracy)m)")
            return
        }
        
        // If we're inside a known geofence, prefer that label (avoids wrong reverse-geocode e.g. 22nd St when at Henry St)
        if let place = geofencePlace(containing: location) {
            DispatchQueue.main.async { [weak self] in
                guard self?.locationOverride.isEmpty == true else {
                    print("Override active, ignoring geofence update: \(place.label)")
                    self?.finishBackgroundRefresh(result: .noData)
                    return
                }
                self?.gpsCity = place.label
                let cityChanged = self?.firebaseCity != place.label
                if cityChanged {
                    self?.lastUpdate = DateFormatter.localizedString(from: Date(), dateStyle: .none, timeStyle: .short)
                }
                let coordLocation = CLLocation(latitude: place.latitude, longitude: place.longitude)
                self?.sendLocationToFirebase(city: place.label, location: coordLocation)
                if cityChanged { print("Geofence match: \(place.label) (avoids bad reverse-geocode)") }
                self?.finishBackgroundRefresh(result: .newData)
            }
            return
        }
        
        geocoder.reverseGeocodeLocation(location) { [weak self] placemarks, error in
            guard let placemark = placemarks?.first,
                  let city = placemark.locality else { return }
            
            let lowercaseCity = city.lowercased()
            
            DispatchQueue.main.async {
                self?.gpsCity = lowercaseCity
                
                if self?.locationOverride.isEmpty == true {
                    let cityChanged = self?.firebaseCity != lowercaseCity
                    if cityChanged {
                        self?.lastUpdate = DateFormatter.localizedString(from: Date(), dateStyle: .none, timeStyle: .short)
                    }
                    self?.sendLocationToFirebase(city: lowercaseCity, location: location)
                    if cityChanged { print("GPS city changed to: \(lowercaseCity)") }
                    self?.finishBackgroundRefresh(result: .newData)
                } else {
                    print("Override active, ignoring GPS update: \(lowercaseCity)")
                    self?.finishBackgroundRefresh(result: .noData)
                }
            }
        }
    }
    
    /// Returns the geofence place that contains the location, if any (uses same radius as monitored regions).
    private func geofencePlace(containing location: CLLocation) -> GeofencePlace? {
        for place in kGeofencePlaces {
            let placeLocation = CLLocation(latitude: place.latitude, longitude: place.longitude)
            if location.distance(from: placeLocation) <= kGeofenceRadius {
                return place
            }
        }
        return nil
    }
    
    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        print("Location error: \(error.localizedDescription)")
        finishBackgroundRefresh(result: .failed)
    }
    
    func locationManager(_ manager: CLLocationManager, didChangeAuthorization status: CLAuthorizationStatus) {
        DispatchQueue.main.async {
            switch status {
            case .authorizedAlways:
                self.startMonitoring()
            case .authorizedWhenInUse:
                self.locationManager.requestAlwaysAuthorization()
            case .denied, .restricted:
                self.isMonitoring = false
                print("Location access denied")
            default:
                break
            }
        }
    }
    
    func locationManager(_ manager: CLLocationManager, didEnterRegion region: CLRegion) {
        guard let circular = region as? CLCircularRegion,
              let place = kGeofencePlaces.first(where: { $0.identifier == circular.identifier }) else { return }
        DispatchQueue.main.async { [weak self] in
            self?.lastUpdate = DateFormatter.localizedString(from: Date(), dateStyle: .none, timeStyle: .short)
            let location = CLLocation(latitude: place.latitude, longitude: place.longitude)
            self?.sendLocationToFirebase(city: place.label, location: location)
            self?.firebaseCity = place.label
            self?.gpsCity = place.label
            print("Entered geofence: \(place.label)")
        }
    }
    
    func locationManager(_ manager: CLLocationManager, didExitRegion region: CLRegion) {
        DispatchQueue.main.async { [weak self] in
            self?.sendLocationToFirebase(city: "in_transit", location: nil)
            self?.firebaseCity = "in_transit"
            self?.lastUpdate = DateFormatter.localizedString(from: Date(), dateStyle: .none, timeStyle: .short)
            print("Exited geofence - set in_transit")
        }
    }
    
    // MARK: - Firebase Integration
    
    func setLocationOverride(_ override: String) {
        let trimmedOverride = override.trimmingCharacters(in: .whitespacesAndNewlines)
        locationOverride = trimmedOverride
        UserDefaults.standard.set(trimmedOverride, forKey: "locationOverride")
        print("Location override set to: '\(trimmedOverride)'")
    }
    
    func fetchCurrentFirebaseLocation() {
        guard let url = URL(string: "https://us-central1-ckubal-homepage-be.cloudfunctions.net/getSiteData") else {
            return
        }
        
        URLSession.shared.dataTask(with: url) { [weak self] data, response, error in
            guard let data = data,
                  let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let city = json["currentCity"] as? String else {
                print("Error fetching Firebase location: \(error?.localizedDescription ?? "Unknown error")")
                return
            }
            
            DispatchQueue.main.async {
                self?.firebaseCity = city
                
                // Also get the website's last updated time
                if let lastUpdatedData = json["lastUpdated"] as? [String: Any],
                   let seconds = lastUpdatedData["_seconds"] as? Double {
                    let date = Date(timeIntervalSince1970: seconds)
                    let formatter = DateFormatter()
                    formatter.dateStyle = .short
                    formatter.timeStyle = .short
                    self?.websiteLastUpdate = formatter.string(from: date)
                }
            }
        }.resume()
    }
    
    func sendLocationToFirebase(city: String, location: CLLocation? = nil) {
        // Send city name
        guard let cityUrl = URL(string: "https://us-central1-ckubal-homepage-be.cloudfunctions.net/updateCity") else {
            return
        }
        
        var cityRequest = URLRequest(url: cityUrl)
        cityRequest.httpMethod = "POST"
        cityRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let cityBody = ["city": city]
        cityRequest.httpBody = try? JSONSerialization.data(withJSONObject: cityBody)
        
        URLSession.shared.dataTask(with: cityRequest) { [weak self] data, response, error in
            if let error = error {
                print("Firebase city update error: \(error.localizedDescription)")
                return
            }
            
            DispatchQueue.main.async {
                self?.firebaseCity = city
                self?.lastUpdate = DateFormatter.localizedString(from: Date(), dateStyle: .none, timeStyle: .short)
            }
            
            print("City sent to Firebase: \(city)")
        }.resume()
        
        // Send coordinates for weather (if available)
        if let location = location {
            guard let locationUrl = URL(string: "https://us-central1-ckubal-homepage-be.cloudfunctions.net/updateLocation") else {
                return
            }
            
            var locationRequest = URLRequest(url: locationUrl)
            locationRequest.httpMethod = "POST"
            locationRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
            
            let locationBody = [
                "lat": location.coordinate.latitude,
                "lng": location.coordinate.longitude
            ] as [String : Any]
            locationRequest.httpBody = try? JSONSerialization.data(withJSONObject: locationBody)
            
            URLSession.shared.dataTask(with: locationRequest) { data, response, error in
                if let error = error {
                    print("Firebase location update error: \(error.localizedDescription)")
                } else {
                    print("Coordinates sent to Firebase: \(location.coordinate.latitude), \(location.coordinate.longitude)")
                }
            }.resume()
        }
    }
}

// MARK: - Health Data Manager (Apple Health → Firebase)
private let kHealthSyncInterval: TimeInterval = 15 * 60 // 15 min so calorie intake stays up to date (workouts come from WHOOP only)
private let kHealthDaysToQuery = 14

private func workoutActivityName(_ type: HKWorkoutActivityType) -> String {
    let s = String(describing: type)
    let name = s.contains(".") ? String(s.split(separator: ".").last ?? Substring(s)) : s
    return name.prefix(1).uppercased() + name.dropFirst()
}

class HealthDataManager: ObservableObject {
    static let shared = HealthDataManager()
    
    private let healthStore = HKHealthStore()
    @Published var todaySteps: Int = 0
    @Published var todayDietaryCalories: Int?
    @Published var lastSyncDate: String?
    @Published var healthKitAuthorized: Bool = false
    @Published var healthKitAvailable: Bool = false
    
    /// Last time we synced health to Firebase; used to throttle to every 15–30 min.
    var lastHealthSyncTime: Date = Date(timeIntervalSince1970: 0)
    private var healthSyncTimer: Timer?
    
    init() {
        healthKitAvailable = HKHealthStore.isHealthDataAvailable()
        checkAuthorizationStatus()
    }
    
    private static var readTypes: Set<HKObjectType> {
        var types: Set<HKObjectType> = []
        if let step = HKQuantityType.quantityType(forIdentifier: .stepCount) { types.insert(step) }
        if let sleep = HKCategoryType.categoryType(forIdentifier: .sleepAnalysis) { types.insert(sleep) }
        if let heart = HKQuantityType.quantityType(forIdentifier: .heartRate) { types.insert(heart) }
        if let active = HKQuantityType.quantityType(forIdentifier: .activeEnergyBurned) { types.insert(active) }
        if let dietary = HKQuantityType.quantityType(forIdentifier: .dietaryEnergyConsumed) { types.insert(dietary) }
        if let exercise = HKQuantityType.quantityType(forIdentifier: .appleExerciseTime) { types.insert(exercise) }
        if let stand = HKQuantityType.quantityType(forIdentifier: .appleStandTime) { types.insert(stand) }
        types.insert(HKObjectType.workoutType())
        return types
    }
    
    func requestHealthKitPermissions() {
        guard HKHealthStore.isHealthDataAvailable() else {
            print("HealthKit not available on this device")
            return
        }
        healthStore.requestAuthorization(toShare: nil, read: Self.readTypes) { [weak self] success, error in
            DispatchQueue.main.async {
                if success {
                    print("HealthKit authorization granted")
                    self?.healthKitAuthorized = true
                    self?.refreshTodayFromHealthKit()
                    self?.startPeriodicHealthSync()
                } else {
                    print("HealthKit authorization denied: \(error?.localizedDescription ?? "Unknown error")")
                    self?.healthKitAuthorized = false
                }
            }
        }
    }
    
    func checkAuthorizationStatus() {
        // DO NOT gate read access on healthStore.authorizationStatus(for:).
        //
        // That call reports SHARE (write) authorization only. This app requests
        // read-only access (`toShare: nil`), so it can never return
        // .sharingAuthorized — Apple deliberately hides read status so an app
        // cannot learn which types the user allowed.
        //
        // The old code did `healthKitAuthorized = (status == .sharingAuthorized)`,
        // which therefore evaluated to FALSE on every launch (this runs from
        // init()). Both refreshTodayFromHealthKit() and syncHealthToFirebase()
        // start with `guard healthKitAuthorized else { return }`, so health sync
        // silently stopped: no error, no prompt, location kept working.
        // Health data stopped reaching Firebase 2026-04-22 and was not noticed
        // until 2026-08-11.
        //
        // requestAuthorization is idempotent and does NOT re-prompt when access
        // has already been granted, so it is the correct way to re-establish the
        // flag on launch.
        guard HKHealthStore.isHealthDataAvailable() else {
            DispatchQueue.main.async { self.healthKitAuthorized = false }
            return
        }
        healthStore.requestAuthorization(toShare: nil, read: Self.readTypes) { [weak self] success, error in
            DispatchQueue.main.async {
                guard let self = self else { return }
                self.healthKitAuthorized = success
                if success {
                    self.refreshTodayFromHealthKit()
                    self.startPeriodicHealthSync()
                    // Sync immediately, don't wait out kHealthSyncInterval (15 min).
                    // This also closes a race: .onAppear calls checkAuthorizationStatus()
                    // and then syncHealthToFirebase() on the next line, but this callback
                    // is async — so that call sees healthKitAuthorized == false and returns.
                    // Firing here is the only path that reliably syncs on launch.
                    self.lastHealthSyncTime = Date(timeIntervalSince1970: 0)
                    self.syncHealthToFirebase()
                } else {
                    print("HealthKit authorization check failed: \(error?.localizedDescription ?? "unknown")")
                }
            }
        }
    }
    
    /// Refresh today's steps and dietary calories for UI only.
    private func refreshTodayFromHealthKit() {
        guard healthKitAuthorized else { return }
        let calendar = Calendar.current
        let now = Date()
        let startOfDay = calendar.startOfDay(for: now)
        
        if let stepType = HKQuantityType.quantityType(forIdentifier: .stepCount) {
            let predicate = HKQuery.predicateForSamples(withStart: startOfDay, end: now, options: .strictStartDate)
            let query = HKStatisticsQuery(quantityType: stepType, quantitySamplePredicate: predicate, options: .cumulativeSum) { [weak self] _, result, _ in
                guard let result = result, let sum = result.sumQuantity() else { return }
                let steps = Int(sum.doubleValue(for: HKUnit.count()))
                DispatchQueue.main.async { self?.todaySteps = steps }
            }
            healthStore.execute(query)
        }
        
        if let dietaryType = HKQuantityType.quantityType(forIdentifier: .dietaryEnergyConsumed) {
            let predicate = HKQuery.predicateForSamples(withStart: startOfDay, end: now, options: .strictStartDate)
            let query = HKSampleQuery(sampleType: dietaryType, predicate: predicate, limit: HKObjectQueryNoLimit, sortDescriptors: nil) { [weak self] _, samples, _ in
                guard let samples = samples as? [HKQuantitySample] else { return }
                let total = samples.reduce(0.0) { $0 + $1.quantity.doubleValue(for: HKUnit.kilocalorie()) }
                DispatchQueue.main.async { self?.todayDietaryCalories = total > 0 ? Int(round(total)) : nil }
            }
            healthStore.execute(query)
        }
    }
    
    func syncHealthToFirebase() {
        guard healthKitAuthorized else { return }
        let now = Date()
        if now.timeIntervalSince(lastHealthSyncTime) < 60 {
            print("Skipping health sync: last sync was less than 1 minute ago")
            return
        }
        lastHealthSyncTime = now
        
        let calendar = Calendar.current
        let endDate = Date()
        guard let startDate = calendar.date(byAdding: .day, value: -kHealthDaysToQuery, to: endDate) else { return }
        
        var daysByDate: [String: [String: Any]] = [:]
        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "yyyy-MM-dd"
        
        for dayOffset in 0..<kHealthDaysToQuery {
            guard let day = calendar.date(byAdding: .day, value: dayOffset, to: startDate) else { continue }
            let dayStart = calendar.startOfDay(for: day)
            guard let dayEnd = calendar.date(byAdding: .day, value: 1, to: dayStart) else { continue }
            let dateStr = dateFormatter.string(from: dayStart)
            daysByDate[dateStr] = [:]
        }
        
        let group = DispatchGroup()
        
        // Steps
        if let stepType = HKQuantityType.quantityType(forIdentifier: .stepCount) {
            group.enter()
            let predicate = HKQuery.predicateForSamples(withStart: startDate, end: endDate, options: .strictStartDate)
            let query = HKStatisticsCollectionQuery(quantityType: stepType, quantitySamplePredicate: predicate, options: .cumulativeSum, anchorDate: calendar.startOfDay(for: startDate), intervalComponents: DateComponents(day: 1))
            query.initialResultsHandler = { _, results, _ in
                defer { group.leave() }
                results?.enumerateStatistics(from: startDate, to: endDate) { stats, _ in
                    let dateStr = dateFormatter.string(from: stats.startDate)
                    let sum = stats.sumQuantity()?.doubleValue(for: HKUnit.count()) ?? 0
                    if daysByDate[dateStr] != nil { daysByDate[dateStr]?["steps"] = Int(sum) }
                }
            }
            healthStore.execute(query)
        }
        
        // Sleep (total asleep hours per day)
        if let sleepType = HKCategoryType.categoryType(forIdentifier: .sleepAnalysis) {
            group.enter()
            let predicate = HKQuery.predicateForSamples(withStart: startDate, end: endDate, options: .strictStartDate)
            let query = HKSampleQuery(sampleType: sleepType, predicate: predicate, limit: HKObjectQueryNoLimit, sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true)]) { _, samples, _ in
                defer { group.leave() }
                guard let samples = samples as? [HKCategorySample] else { return }
                for sample in samples {
                    let value = sample.value
                    guard value == HKCategoryValueSleepAnalysis.asleepUnspecified.rawValue || value == HKCategoryValueSleepAnalysis.asleepCore.rawValue || value == HKCategoryValueSleepAnalysis.asleepDeep.rawValue || value == HKCategoryValueSleepAnalysis.asleepREM.rawValue else { continue }
                    let dateStr = dateFormatter.string(from: sample.startDate)
                    let hours = sample.endDate.timeIntervalSince(sample.startDate) / 3600
                    if daysByDate[dateStr] != nil {
                        let current = (daysByDate[dateStr]?["sleepHours"] as? Double) ?? 0
                        daysByDate[dateStr]?["sleepHours"] = current + hours
                    }
                }
            }
            healthStore.execute(query)
        }
        
        // Heart rate (average per day)
        if let heartType = HKQuantityType.quantityType(forIdentifier: .heartRate) {
            group.enter()
            let predicate = HKQuery.predicateForSamples(withStart: startDate, end: endDate, options: .strictStartDate)
            let query = HKSampleQuery(sampleType: heartType, predicate: predicate, limit: HKObjectQueryNoLimit, sortDescriptors: nil) { _, samples, _ in
                defer { group.leave() }
                guard let samples = samples as? [HKQuantitySample] else { return }
                var sumByDate: [String: (Double, Int)] = [:]
                for s in samples {
                    let dateStr = dateFormatter.string(from: s.startDate)
                    let bpm = s.quantity.doubleValue(for: HKUnit(from: "count/min"))
                    var t = sumByDate[dateStr] ?? (0.0, 0)
                    t.0 += bpm
                    t.1 += 1
                    sumByDate[dateStr] = t
                }
                for (dateStr, (sum, count)) in sumByDate where daysByDate[dateStr] != nil && count > 0 {
                    daysByDate[dateStr]?["heartRateAvg"] = round(sum / Double(count))
                }
            }
            healthStore.execute(query)
        }
        
        // Active energy
        if let activeType = HKQuantityType.quantityType(forIdentifier: .activeEnergyBurned) {
            group.enter()
            let predicate = HKQuery.predicateForSamples(withStart: startDate, end: endDate, options: .strictStartDate)
            let query = HKStatisticsCollectionQuery(quantityType: activeType, quantitySamplePredicate: predicate, options: .cumulativeSum, anchorDate: calendar.startOfDay(for: startDate), intervalComponents: DateComponents(day: 1))
            query.initialResultsHandler = { _, results, _ in
                defer { group.leave() }
                results?.enumerateStatistics(from: startDate, to: endDate) { stats, _ in
                    let dateStr = dateFormatter.string(from: stats.startDate)
                    let sum = stats.sumQuantity()?.doubleValue(for: HKUnit.kilocalorie()) ?? 0
                    if daysByDate[dateStr] != nil { daysByDate[dateStr]?["activeCalories"] = Int(round(sum)) }
                }
            }
            healthStore.execute(query)
        }
        
        // Dietary energy
        if let dietaryType = HKQuantityType.quantityType(forIdentifier: .dietaryEnergyConsumed) {
            group.enter()
            let predicate = HKQuery.predicateForSamples(withStart: startDate, end: endDate, options: .strictStartDate)
            let query = HKSampleQuery(sampleType: dietaryType, predicate: predicate, limit: HKObjectQueryNoLimit, sortDescriptors: nil) { _, samples, _ in
                defer { group.leave() }
                guard let samples = samples as? [HKQuantitySample] else { return }
                var sumByDate: [String: Double] = [:]
                for s in samples {
                    let dateStr = dateFormatter.string(from: s.startDate)
                    sumByDate[dateStr, default: 0] += s.quantity.doubleValue(for: HKUnit.kilocalorie())
                }
                for (dateStr, sum) in sumByDate where daysByDate[dateStr] != nil && sum > 0 {
                    daysByDate[dateStr]?["dietaryCalories"] = Int(round(sum))
                }
            }
            healthStore.execute(query)
        }
        
        // Apple exercise time (minutes)
        if let exerciseType = HKQuantityType.quantityType(forIdentifier: .appleExerciseTime) {
            group.enter()
            let predicate = HKQuery.predicateForSamples(withStart: startDate, end: endDate, options: .strictStartDate)
            let query = HKStatisticsCollectionQuery(quantityType: exerciseType, quantitySamplePredicate: predicate, options: .cumulativeSum, anchorDate: calendar.startOfDay(for: startDate), intervalComponents: DateComponents(day: 1))
            query.initialResultsHandler = { _, results, _ in
                defer { group.leave() }
                results?.enumerateStatistics(from: startDate, to: endDate) { stats, _ in
                    let dateStr = dateFormatter.string(from: stats.startDate)
                    let minutes = stats.sumQuantity()?.doubleValue(for: HKUnit.minute()) ?? 0
                    if daysByDate[dateStr] != nil { daysByDate[dateStr]?["exerciseMinutes"] = Int(round(minutes)) }
                }
            }
            healthStore.execute(query)
        }
        
        // Apple stand time (stand hours = count of hours with at least one stand minute)
        if let standType = HKQuantityType.quantityType(forIdentifier: .appleStandTime) {
            group.enter()
            let predicate = HKQuery.predicateForSamples(withStart: startDate, end: endDate, options: .strictStartDate)
            let query = HKStatisticsCollectionQuery(quantityType: standType, quantitySamplePredicate: predicate, options: .cumulativeSum, anchorDate: calendar.startOfDay(for: startDate), intervalComponents: DateComponents(day: 1))
            query.initialResultsHandler = { _, results, _ in
                defer { group.leave() }
                results?.enumerateStatistics(from: startDate, to: endDate) { stats, _ in
                    let dateStr = dateFormatter.string(from: stats.startDate)
                    let minutes = stats.sumQuantity()?.doubleValue(for: HKUnit.minute()) ?? 0
                    let standHours = min(24, Int(round(minutes / 60)))
                    if daysByDate[dateStr] != nil { daysByDate[dateStr]?["standHours"] = standHours }
                }
            }
            healthStore.execute(query)
        }
        
        // Workouts
        var allWorkouts: [[String: Any]] = []
        group.enter()
        let workoutPredicate = HKQuery.predicateForSamples(withStart: startDate, end: endDate, options: .strictStartDate)
        let workoutQuery = HKSampleQuery(sampleType: HKWorkoutType.workoutType(), predicate: workoutPredicate, limit: HKObjectQueryNoLimit, sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: false)]) { _, samples, _ in
            defer { group.leave() }
            guard let workouts = samples as? [HKWorkout] else { return }
            for w in workouts {
                let dateStr = dateFormatter.string(from: w.startDate)
                let durationMinutes = Int(round(w.duration / 60))
                let name = workoutActivityName(w.workoutActivityType)
                var workout: [String: Any] = [
                    "date": dateStr,
                    "name": name,
                    "durationMinutes": durationMinutes,
                ]
                if let energy = w.totalEnergyBurned?.doubleValue(for: HKUnit.kilocalorie()) {
                    workout["activeCalories"] = Int(round(energy))
                }
                if let dist = w.totalDistance?.doubleValue(for: HKUnit.meter()) {
                    workout["distance"] = round(dist * 100) / 100
                }
                allWorkouts.append(workout)
                if daysByDate[dateStr] != nil {
                    var list = daysByDate[dateStr]?["workouts"] as? [[String: Any]] ?? []
                    var w: [String: Any] = ["name": name, "durationMinutes": durationMinutes]
                    if let c = workout["activeCalories"] { w["activeCalories"] = c }
                    if let d = workout["distance"] { w["distance"] = d }
                    list.append(w)
                    daysByDate[dateStr]?["workouts"] = list
                }
            }
        }
        healthStore.execute(workoutQuery)
        
        group.notify(queue: .main) { [weak self] in
            let sortedDates = daysByDate.keys.sorted()
            let days: [[String: Any]] = sortedDates.map { dateStr in
                var day: [String: Any] = ["date": dateStr]
                if let d = daysByDate[dateStr] {
                    if let v = d["steps"] { day["steps"] = v }
                    if let v = d["sleepHours"] { day["sleepHours"] = round((v as! Double) * 10) / 10 }
                    if let v = d["heartRateAvg"] { day["heartRateAvg"] = v }
                    if let v = d["activeCalories"] { day["activeCalories"] = v }
                    if let v = d["dietaryCalories"] { day["dietaryCalories"] = v }
                    if let v = d["exerciseMinutes"] { day["exerciseMinutes"] = v }
                    if let v = d["standHours"] { day["standHours"] = v }
                    // Workouts: not sent here — WHOOP is the source of truth for workouts; avoid double-pull from Apple Health
                }
                return day
            }
            let payload: [String: Any] = ["days": days]
            self?.sendHealthToFirebase(payload: payload)
            self?.refreshTodayFromHealthKit()
        }
    }
    
    private func sendHealthToFirebase(payload: [String: Any]) {
        guard let url = URL(string: "https://us-central1-ckubal-homepage-be.cloudfunctions.net/updateHealth") else { return }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        do {
            request.httpBody = try JSONSerialization.data(withJSONObject: payload)
        } catch {
            print("Health payload encode error: \(error)")
            return
        }
        URLSession.shared.dataTask(with: request) { [weak self] data, response, error in
            if let error = error {
                print("Firebase health update error: \(error.localizedDescription)")
                return
            }
            DispatchQueue.main.async {
                let formatter = DateFormatter()
                formatter.dateStyle = .none
                formatter.timeStyle = .short
                self?.lastSyncDate = formatter.string(from: Date())
                print("Health synced to Firebase (\((payload["days"] as? [[String: Any]])?.count ?? 0) days)")
            }
        }.resume()
    }
    
    private func startPeriodicHealthSync() {
        healthSyncTimer?.invalidate()
        healthSyncTimer = Timer.scheduledTimer(withTimeInterval: kHealthSyncInterval, repeats: true) { [weak self] _ in
            print("Periodic health sync triggered")
            self?.syncHealthToFirebase()
        }
        RunLoop.main.add(healthSyncTimer!, forMode: .common)
        
        // When user logs food (or steps) in another app, Health notifies us — sync so dietary calories stay current.
        if let dietaryType = HKQuantityType.quantityType(forIdentifier: .dietaryEnergyConsumed) {
            healthStore.enableBackgroundDelivery(for: dietaryType, frequency: .immediate) { [weak self] success, error in
                if success {
                    let query = HKObserverQuery(sampleType: dietaryType, predicate: nil) { [weak self] _, _, _ in
                        DispatchQueue.main.async {
                            self?.lastHealthSyncTime = Date(timeIntervalSince1970: 0)
                            self?.syncHealthToFirebase()
                        }
                    }
                    self?.healthStore.execute(query)
                }
            }
        }
    }
}

#Preview {
    ContentView()
}