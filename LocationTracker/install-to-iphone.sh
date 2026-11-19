#!/usr/bin/env bash
# Build LocationTracker and install it to a connected iPhone.
#
# Written 2026-08-11 to land the HealthKit read-authorization fix (health data
# stopped reaching Firebase on 2026-04-22 and nothing surfaced an error).
#
# Usage:
#   ./install-to-iphone.sh          # waits up to 3 min for a phone to appear
#   ./install-to-iphone.sh --nowait # fail immediately if none connected
#
# Notes:
# - Uses -allowProvisioningUpdates. Without it the build fails with
#   "Provisioning profile ... doesn't include signing certificate", because the
#   cached profile goes stale relative to the dev certificate.
# - Unlock the phone and tap Trust if prompted.
set -uo pipefail
cd "$(dirname "$0")"

WAIT=180
[ "${1:-}" = "--nowait" ] && WAIT=0

# Pick a device that is actually CONNECTED.
#
# Two traps here, both hit on 2026-08-11:
#  1. Device names and models contain spaces ("ck iPhone 17", "iPhone 17 Pro
#     (iPhone18,1)"), so positional awk fields are unreliable. Match the UUID.
#  2. `devicectl device info details` happily returns full hardware specs for a
#     device that is NOT connected — it reads a cached pairing record. Only an
#     actual operation fails, with CoreDeviceError 1011. So trust the State
#     column: "unavailable" means unavailable, however detailed the cached info.
device_id() {
  xcrun devicectl list devices 2>/dev/null \
    | grep -E "iPhone|iPad" \
    | grep -viE "unavailable" \
    | grep -oE "[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}" \
    | head -1
}

echo "==> looking for a connected device"
ID=$(device_id)
WAITED=0
while [ -z "$ID" ] && [ "$WAITED" -lt "$WAIT" ]; do
  printf "\r    none yet, waiting... %ss" "$WAITED"
  sleep 5; WAITED=$((WAITED+5)); ID=$(device_id)
done
echo
if [ -z "$ID" ]; then
  echo "No connected iPhone found."
  echo "Plug it in (or pair for wireless debugging), unlock it, tap Trust, and re-run."
  xcrun devicectl list devices 2>/dev/null | head -8
  exit 1
fi
echo "    device: $ID"

echo "==> building (signed, for device)"
if ! xcodebuild -scheme LocationTracker -project LocationTracker.xcodeproj \
      -destination "platform=iOS,id=$ID" -configuration Debug \
      -allowProvisioningUpdates build > /tmp/lt-build.log 2>&1; then
  echo "BUILD FAILED. Last errors:"
  grep -E "error:" /tmp/lt-build.log | head -10
  echo "(full log: /tmp/lt-build.log)"
  exit 1
fi
echo "    BUILD SUCCEEDED"

APP=$(find "$HOME/Library/Developer/Xcode/DerivedData" -name "LocationTracker.app" \
        -path "*Debug-iphoneos*" -maxdepth 6 2>/dev/null | head -1)
[ -z "$APP" ] && { echo "could not locate built .app"; exit 1; }

echo "==> installing"
if ! xcrun devicectl device install app --device "$ID" "$APP" 2>&1 | tail -5; then
  echo "install failed — is the phone unlocked and trusted?"
  exit 1
fi

cat <<'TXT'

==> installed. Now, on the phone:
    1. Open LocationTracker (the fix re-requests HealthKit auth on launch; no prompt
       is expected since the toggles are already on).
    2. Leave it foregrounded for a few seconds so the first sync runs.

Then verify from the laptop — this hits the public Cloud Function, no Mini needed:

    node ~/Dropbox/coding-projects-25/cosmo/scripts/check-health-sync.js

Exit 0 = healthy. It should report updatedAt within the last hour instead of
2026-04-22. Cosmo's today-context picks it up within 15 minutes after that.
TXT
