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
Stand at the intended entrance QR location and face the first direction. Start becomes available after at least one second of continuous fresh tracking with a usable heading. Start recording, walk, mark landmarks with names and instructions, and finish at the restroom. Export the completed JSON with the Android document picker. A completed recording is also retained in app-private storage; an export failure can be retried without repeating the walk.

Tracking loss, backgrounding, a frame gap, a pose jump or a recording limit interrupts the walk. Return to the entrance and restart; an interrupted walk cannot be exported as complete. Restart discards the current in-memory walk, not the previously completed file. Clearing app data removes the saved file.

## Recording Contract

Schema version 1 uses source `android-arcore` and coordinate frame `arcore-session-relative`. Coordinates are measured in meters relative to the entrance camera position, with the initial horizontal camera heading retained. They are not geospatial coordinates or a persistent AR map. No camera images are stored or exported, and the app has no Internet permission.

The envelope contains ordered samples and entrance/landmark/destination points. Segment distances sum accepted camera movement; a 5 cm deadband reduces stationary jitter but does not establish real-world accuracy. Limits: 10 minutes, 3000 samples, 20 steps, 1000 meters, 80-character labels, 500-character instructions and a 1 MB export. A segment must measure at least 0.2 meters. Imported guidance still needs a walkthrough and activation; export alone never publishes it.

## Verification Status

Latest finding (2026-09-19): the app now declares `HIGH_SAMPLING_RATE_SENSORS`. On Flip7, a temporary 30-second timing probe showed 5 ms accelerometer/gyroscope registration requests failing without this permission, including ARCore's own uncalibrated-sensor registration. A 20 ms probe request succeeded, receiving approximately 8 ms samples with median callback age about 2.3 ms. With the permission and the original 5 ms request, sensor registration succeeded, reported minimum delay changed from 8 ms to 2 ms, and observed sample intervals were about 4 ms. Longest continuous tracking increased from 0.28 seconds to 28.2 seconds in the 30-second probe. The retrieved permission-enabled process log contained none of the previously checked registration/desynchronization errors. These are device observations, not a guarantee for every Flip7 firmware.

The timing probe collected no images or motion coordinates and has been removed. The permission-enabled APK without instrumentation was built, signature-verified and installed on Flip7 on 2026-09-19; all nine core tests were rerun successfully. UI inspection confirmed `Ready at entrance` and an enabled Start button. An approximately 30-second process log showed no sensor-registration, clock-desynchronization or timestamp-too-new errors; one not-tracking event occurred about two seconds after launch, before the ready-state inspection. The user subsequently confirmed completion of the physical recording flow through JSON export on Flip7. This verifies the tested recording workflow, not measured distance accuracy or compatibility across all firmware versions. The earlier unsuccessful experiments below are historical evidence, not proof that this requires a firmware fix. The official sample also lacked this permission, so its failure alone did not rule out an app-manifest solution.

The recorder core has nine passing JVM tests, including stable readiness, tracking loss, same-millisecond updates, stale/jumping frames, bounds and serialization. The debug APK builds with JDK 17 and SDK 35, and passes `apksigner verify`. Initial Galaxy Z Flip7 testing reported immediate tracking loss; the permission change above was followed by user-confirmed recording and JSON export. Tracking failures now retain ARCore's reason, such as insufficient light or visual detail. Do not treat build or JVM results as physical tracking accuracy evidence.

Android and Kotlin plugin versions are declared together in the root build file; app modules apply them without repeating versions. This avoids Kotlin's unknown-version and Android classpath errors. The app manifest explicitly overrides SceneView's optional AR metadata because recording requires ARCore.

On 2026-09-18, USB testing on Galaxy Z Flip7 / Android 16 reproduced alternating `TRACKING` and `PAUSED` with failure reason `NONE`, preventing stable readiness. A temporary ARCore-only activity without SceneView or recorder logic reproduced the same behavior and IMU timestamp errors (`Passed timestamp ... is too new` and an empty or insufficient IMU buffer). Changing camera updates to `BLOCKING` did not resolve it. Both diagnostic changes were removed. At that stage the cause remained unresolved; the later permission comparison above identified the app-level fix. Tested combination: ARCore SDK 1.48.0 and Google Play Services for AR 1.56.262080393.

After a device reboot, the timestamp synchronization errors persisted. A single-variable comparison using ARCore SDK 1.56.0 built and installed successfully (Gradle confirmed the selected runtime dependency), but reproduced the same IMU timestamp errors. The SDK override was reverted; neither rebooting nor changing the SDK established a fix. Further physical investigation is scoped to the Flip7, not a second phone.

An existing completed recording on Galaxy Note20 / Android 13 was inspected: 70 samples, 4 landmarks and about 5.84 recorded meters (not an accuracy measurement). Its Google Play Services for AR version was also 1.56.262080393. The user confirmed walking, finishing and JSON export on that device.

A subsequent Flip7 focus comparison used the same diagnostic APK, restarting the session between AUTO and FIXED. Focus was configured after SceneView's resume-time AUTO assignment, and the session configuration reported the requested mode. Over approximately the first 40 seconds of frame callbacks, the longest continuous TRACKING runs were 279 ms (AUTO) and 412 ms (FIXED); neither met the one-second readiness gate. FIXED still produced IMU timestamp errors. This single, non-controlled scene comparison does not establish a meaningful improvement or actual lens behavior. The focus override and temporary instrumentation were removed; recording safety conditions were unchanged.

Google's official `hello_ar_java` sample at tag `1.56.0` (commit `3abfeb18669c2cbb2d07057f135d117ee9d91826`) was built separately and installed on the Flip7. Only `compileSdkVersion` and `targetSdkVersion` were changed from 37 to 35 because platform 37 was unavailable locally; all tracking and rendering code remained unchanged. In an approximately 51-second sample-process log window, ARCore reported `FEATURE_DSP_CAM_IMU_DESYNC` 18 times and `VIO_OUTPUT_NOT_TRACKING` twice. One clock-offset report was 28.2 ms against a 5 ms threshold. This reproduces synchronization errors and tracking loss without Lechigo or SceneView, but does not establish whether firmware, ARCore device integration, or hardware is responsible. Flip7 environment: Android 16, firmware F766NKSS9AZCT, security patch 2026-04-05, power saving off. The sample is a separate app (`com.google.ar.core.examples.java.helloar`); Lechigo recordings were not modified.
