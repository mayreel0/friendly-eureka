# Android Route Recorder

The merchant recorder uses SceneView 2.3.0 and ARCore to display the camera and collect a walked route. This is not a native guest navigation app. Android recording is now the first available-device path; iOS remains a separate planned surface.

## Build

Use JDK 17, Android SDK platform 35 and build tools 35.0.0. Accept the SDK license yourself or explicitly authorize installation. Set `ANDROID_HOME` to the SDK directory; do not commit `local.properties` or SDK files.

```sh
./gradlew :recorder-core:test :app:assembleDebug
```

The APK is `app/build/outputs/apk/debug/app-debug.apk`. For JVM-only checks without an Android SDK:

```sh
./gradlew -PcoreOnly :recorder-core:test
```

## Device Flow

Install the debug APK on an ARCore-supported Android 8+ device and allow camera access. Google Play Services for AR must be available.
Stand at the intended entrance QR location and face the first direction. Start recording, walk, mark landmarks with names and instructions, and finish at the restroom. Export the completed JSON with the Android document picker. A completed recording is also retained in app-private storage; an export failure can be retried without repeating the walk.

Tracking loss, backgrounding, a frame gap, a pose jump or a recording limit interrupts the walk. Return to the entrance and restart; an interrupted walk cannot be exported as complete. Restart discards the current in-memory walk, not the previously completed file. Clearing app data removes the saved file.

## Recording Contract

Schema version 1 uses source `android-arcore` and coordinate frame `arcore-session-relative`. Coordinates are measured in meters relative to the entrance camera position, with the initial horizontal camera heading retained. They are not geospatial coordinates or a persistent AR map. No camera images are stored or exported, and the app has no Internet permission.

The envelope contains ordered samples and entrance/landmark/destination points. Segment distances sum accepted camera movement; a 5 cm deadband reduces stationary jitter but does not establish real-world accuracy. Limits: 10 minutes, 3000 samples, 20 steps, 1000 meters, 80-character labels, 500-character instructions and a 1 MB export. A segment must measure at least 0.2 meters. Imported guidance still needs a walkthrough and activation; export alone never publishes it.

## Verification Status

The recorder core has six passing JVM tests, including tracking loss, stale/jumping frames, bounds and serialization. SDK installation approval is pending in this environment, so the Android APK and physical camera/permission lifecycle have not been verified yet. Do not treat JVM results as a successful Galaxy Z Flip7 recording.
