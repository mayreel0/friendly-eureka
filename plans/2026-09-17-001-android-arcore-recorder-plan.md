---
title: Android ARCore route recorder and pilot import
date: 2026-09-17
type: implementation
status: implementation-ready
---

## Goal Capsule

Let the available Android phone record a real walked route, export a bounded local recording, and import its guidance into the existing merchant pilot.
This advances original R5/R6 without claiming cross-session AR alignment or guest AR replay.

## Product Contract

- R1. Show an actual ARCore camera stream and tracking status; handle unavailable AR services and denied permission visibly.
- R2. Start at the entrance, mark named landmarks with instructions, finish at the restroom, and export JSON using Android's document picker.
- R3. Distances come from bounded tracking samples, not fixed seeded values. Coordinates are local to the recording session and must not be presented as globally reusable AR anchors.
- R4. Tracking loss, app backgrounding, stale frames, excessive pose jumps, or recording limits interrupt recording. An interrupted recording cannot be published/exported as complete; restart requires discarding it.
- R5. Export contains no camera images, account identifiers, guest tokens or secrets. The recorder makes no application network requests.
- R6. Imported recordings become drafts and require the existing test/activation gates. Invalid files cannot overwrite an existing route.

## Planning Contract

Use SceneView 2.3.0's Android view adapter over ARCore, matching its published Kotlin 2.0.21/AGP 8.9.1/SDK 35 baseline. Keep recording state and JSON serialization in a JVM module with unit tests, independent of Android permissions and GPU rendering.
Native Android is first for this execution because the available physical device is Android; iOS remains deferred, not deleted from product scope.
SDK license acceptance is a user prerequisite for installing build tools. Do not claim an APK was built or a phone was tested without evidence.

The recorder captures bounded samples and named points. It preserves the entry position and heading in an explicit versioned recording envelope. The first import supports manual guidance; replay calibration is a separate prerequisite for guest AR.
Keep edits under `apps/android/`, the specific recording import contract, and existing merchant import entry points. No unrelated UI redesign or new QA dashboard.

## Implementation Units

### U1. Native recorder and export

Files: `apps/android/recorder-core/`, `apps/android/app/`, Gradle wrapper/config, Android README.
Implement tracking-gated recording, bounded samples, landmark capture, finish, restart confirmation, permission/service errors, and document export.
Unit tests in `apps/android/recorder-core/src/test/` cover measured distances, input validation, tracking interruption, stale/jumping samples, limits, and export gating.
Build debug APK and run JVM tests; disclose missing physical-device verification.
Ship one PR with the usable recorder, not a scaffolding-only PR.

### U2. Validated recording import

Depends on U1's versioned export shape.
Files: `packages/route-core/` recording parser and tests; focused merchant API/UI import files and browser test.
Validate size, version, source, point chain, finite geometry, distances, instructions and bounds. Convert to draft guidance with the existing route-version/test invalidation path, retaining recording provenance without treating it as calibrated AR geometry.
Exercise real file selection, invalid-file preservation, import persistence and guest preview in Chromium. Ship a separate PR.

## Verification Contract

Use failing unit tests before recording logic, Gradle debug compilation and JVM tests for Android, existing TypeScript tests/typecheck/format, and browser coverage for import.
Physical tracking accuracy, permission UI and GPU camera rendering on Galaxy Z Flip7 remain explicit device checks. An emulator or JVM test cannot establish physical AR accuracy.

## Definition of Done

Each unit has its own reviewed commit/PR and records executed checks and remaining device checks. No auto-merge.
The end-to-end import remains draft-only until merchant testing passes. No simulated record is labeled as a physical-device result.

## Sources

- [ARCore Android setup](https://developers.google.com/ar/develop/java/enable-arcore)
- [SceneView 2.3.0 Android AR adapter](https://github.com/SceneView/sceneview/tree/v2.3.0/arsceneview)
