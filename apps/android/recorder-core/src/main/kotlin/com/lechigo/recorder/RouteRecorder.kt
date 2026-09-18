package com.lechigo.recorder

import java.time.Instant
import kotlinx.serialization.encodeToString
import kotlin.math.hypot

enum class RecorderState { IDLE, RECORDING, INTERRUPTED, FINISHED }

class RouteRecorder {
    var state = RecorderState.IDLE; private set
    var reason = ""; private set
    var distanceMeters = 0.0; private set
    val pointCount get() = landmarks.size
    private var latestPosition: Vec3? = null
    private var latestHeading: Vec3? = null
    private var latestTime = -1L
    private var tracking = false
    private var trackingSince: Long? = null
    private var origin = Vec3(0.0, 0.0, 0.0)
    private var heading = Vec3(0.0, 0.0, -1.0)
    private var startedAt = ""
    private var startTime = 0L
    private var lastSampleTime = 0L
    private var markedDistance = 0.0
    private val samples = mutableListOf<RecordedSample>()
    private val landmarks = mutableListOf<RecordedLandmark>()

    fun canStart(now: Long) = state == RecorderState.IDLE && fresh(now) && latestHeading != null &&
        trackingSince?.let { latestTime - it >= 1000 } == true

    fun update(position: Vec3?, forward: Vec3?, isTracking: Boolean, now: Long,
        trackingFailure: String = "Tracking lost.") {
        val previousTime = latestTime
        val wasFresh = fresh(now)
        tracking = isTracking && position?.isValid() == true
        if (!tracking) {
            trackingSince = null
            interrupt("$trackingFailure Restart at the entrance.")
            return
        }
        latestPosition = position
        latestTime = now
        if (forward != null) {
            val length = hypot(forward.x, forward.z)
            latestHeading = if (forward.isValid() && length >= 0.1) Vec3(forward.x / length, 0.0, forward.z / length) else null
        }
        if (latestHeading == null) trackingSince = null
        else if (!wasFresh || trackingSince == null) trackingSince = now
        if (state != RecorderState.RECORDING) return
        if (now < previousTime || now - previousTime > 2000 || now - startTime > 600_000) {
            interrupt("Recording interrupted or time limit reached. Restart at the entrance."); return
        }
        if (now - lastSampleTime >= 200) capture(now)
    }

    fun start(recordedAt: String, now: Long) {
        check(canStart(now)) { "Wait for stable tracking while facing the route." }
        Instant.parse(recordedAt)
        origin = latestPosition!!
        heading = latestHeading!!
        startedAt = recordedAt
        startTime = now
        lastSampleTime = now
        samples.add(RecordedSample(0, Vec3(0.0, 0.0, 0.0)))
        landmarks.add(RecordedLandmark("entrance", "Entrance", "", samples[0].position, 0, 0.0))
        state = RecorderState.RECORDING
    }

    fun mark(label: String, instruction: String, destination: Boolean, now: Long) {
        check(state == RecorderState.RECORDING) { "Start a new recording first." }
        if (!fresh(now)) interrupt("No fresh camera frame. Restart at the entrance.")
        check(state == RecorderState.RECORDING) { reason }
        require(label.trim().length in 1..80) { "Landmark name must contain 1-80 characters." }
        require(instruction.trim().length in 1..500) { "Instruction must contain 1-500 characters." }
        require(landmarks.size < if (destination) 21 else 20) { "Finish the route: 20 steps maximum." }
        capture(now)
        check(state == RecorderState.RECORDING) { reason }
        val segmentDistance = distanceMeters - markedDistance
        require(segmentDistance >= 0.2) { "Walk at least 0.2 meters before marking the next point." }
        landmarks.add(RecordedLandmark(if (destination) "destination" else "landmark", label.trim(), instruction.trim(),
            samples.last().position, samples.lastIndex, segmentDistance))
        markedDistance = distanceMeters
        if (destination) state = RecorderState.FINISHED
    }

    fun interrupt(message: String) {
        tracking = false
        trackingSince = null
        if (state == RecorderState.RECORDING) { state = RecorderState.INTERRUPTED; reason = message }
    }

    fun reset() {
        state = RecorderState.IDLE; reason = ""; distanceMeters = 0.0; markedDistance = 0.0
        samples.clear(); landmarks.clear(); latestPosition = null; latestHeading = null; latestTime = -1; tracking = false
        trackingSince = null
    }

    fun exportJson(): String {
        check(state == RecorderState.FINISHED) { "Finish a tracked route before exporting." }
        return RecordingJson.encodeToString(Recording(startedAt, heading, samples.toList(), landmarks.toList(), distanceMeters))
    }

    private fun fresh(now: Long) = tracking && latestPosition != null && now >= latestTime && now - latestTime <= 1000

    private fun capture(now: Long) {
        val point = latestPosition!!.relativeTo(origin)
        val distance = point.distanceTo(samples.last().position)
        if (distance > 2.0 || samples.size >= 3000 || distanceMeters + distance > 1000) {
            interrupt("Pose jump or recording limit reached. Restart at the entrance."); return
        }
        lastSampleTime = now
        // Ignore small stationary motion, retaining the previous accepted position as the baseline.
        if (distance < 0.05) return
        distanceMeters += distance
        samples.add(RecordedSample(now - startTime, point))
    }
}
