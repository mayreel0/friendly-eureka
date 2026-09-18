package com.lechigo.recorder

import kotlin.test.*

class RouteRecorderTest {
    @Test fun readinessRequiresSustainedTrackingRatherThanOneGoodFrame() {
        val recorder = RouteRecorder()
        val point = Vec3(0.0, 0.0, 0.0)
        val forward = Vec3(0.0, 0.0, -1.0)
        recorder.update(point, forward, true, 0)
        assertFalse(recorder.canStart(0))
        assertFalse(recorder.canStart(1000), "Waiting without new frames is not stable tracking")
        recorder.update(point, forward, true, 500)
        assertFalse(recorder.canStart(500))
        recorder.update(null, null, false, 600)
        recorder.update(point, forward, true, 700)
        assertFalse(recorder.canStart(1000))
        recorder.update(point, forward, true, 1200)
        recorder.update(point, forward, true, 1700)
        assertTrue(recorder.canStart(1700))
        recorder.interrupt("App left foreground.")
        assertFalse(recorder.canStart(1700), "Backgrounding must invalidate readiness immediately")
        recorder.update(point, forward, true, 4000)
        assertFalse(recorder.canStart(4000), "A gap must restart the stability window")
    }

    @Test fun repeatedMillisecondDoesNotInterruptARecording() {
        val recorder = ready()
        recorder.update(Vec3(10.0, 1.0, 10.0), null, true, 1000)
        assertEquals(RecorderState.RECORDING, recorder.state)
        recorder.update(Vec3(10.5, 1.0, 10.0), null, true, 1500)
        assertEquals(0.5, recorder.distanceMeters, 0.0001)
    }

    @Test fun interruptionRetainsTheActualTrackingFailureAfterRecovery() {
        val recorder = ready()
        recorder.update(null, null, false, 1200, "Not enough visual detail.")
        recorder.update(Vec3(10.5, 1.0, 10.0), null, true, 1500)
        assertEquals("Not enough visual detail. Restart at the entrance.", recorder.reason)
        assertEquals(RecorderState.INTERRUPTED, recorder.state)
        assertEquals(0.0, recorder.distanceMeters)
        assertFailsWith<IllegalStateException> { recorder.exportJson() }
    }

    private fun ready(): RouteRecorder = RouteRecorder().apply {
        update(Vec3(10.0, 1.0, 10.0), Vec3(0.0, 0.0, -1.0), true, 0)
        update(Vec3(10.0, 1.0, 10.0), Vec3(0.0, 0.0, -1.0), true, 500)
        update(Vec3(10.0, 1.0, 10.0), Vec3(0.0, 0.0, -1.0), true, 1000)
        start("2026-09-17T00:00:00Z", 1000)
    }

    @Test fun recordsWalkedDistancesAndExportsOnlyCompletedRoutes() {
        val recorder = ready()
        assertFailsWith<IllegalStateException> { recorder.exportJson() }
        recorder.update(Vec3(11.0, 1.0, 10.0), null, true, 1500)
        recorder.mark("Reception", "Walk to reception.", false, 1500)
        recorder.update(Vec3(11.0, 1.0, 11.0), null, true, 2000)
        recorder.mark("Restroom", "Turn left to the restroom.", true, 2000)
        val result = RecordingJson.decodeFromString<Recording>(recorder.exportJson())
        assertEquals(2.0, result.distanceMeters, 0.0001)
        assertEquals(listOf("entrance", "landmark", "destination"), result.landmarks.map { it.kind })
        assertEquals(Vec3(1.0, 0.0, 1.0), result.landmarks.last().position)
        assertEquals(1.0, result.landmarks.last().distanceMeters, 0.0001)
        assertEquals("arcore-session-relative", result.coordinateFrame)
        assertEquals(RecorderState.FINISHED, recorder.state)
        System.getenv("LECHIGO_EXPORT_FIXTURE")?.let { java.io.File(it).writeText(recorder.exportJson()) }
    }

    @Test fun trackingLossAndBackgroundingNeverBridgeMissingGeometry() {
        for (lostByFrame in listOf(true, false)) {
            val recorder = ready()
            if (lostByFrame) recorder.update(null, null, false, 1200) else recorder.interrupt("App left foreground.")
            recorder.update(Vec3(11.0, 1.0, 10.0), null, true, 1500)
            assertEquals(RecorderState.INTERRUPTED, recorder.state)
            assertFailsWith<IllegalStateException> { recorder.mark("Door", "Walk.", true, 1500) }
            assertFailsWith<IllegalStateException> { recorder.exportJson() }
        }
    }

    @Test fun rejectsStaleFramesJumpsAndInvalidSamples() {
        val stale = ready()
        assertFailsWith<IllegalStateException> { stale.mark("Door", "Walk.", true, 3001) }
        assertEquals(RecorderState.INTERRUPTED, stale.state)
        for (position in listOf(Vec3(100.0, 1.0, 10.0), Vec3(Double.NaN, 1.0, 10.0))) {
            val recorder = ready()
            recorder.update(position, null, true, 1200)
            assertEquals(RecorderState.INTERRUPTED, recorder.state)
        }
    }

    @Test fun stationaryNoiseDoesNotCreateASegmentAndNamesAreBounded() {
        val recorder = ready()
        recorder.update(Vec3(10.01, 1.0, 10.0), null, true, 1200)
        assertFailsWith<IllegalArgumentException> { recorder.mark("Door", "Walk.", true, 1200) }
        recorder.update(Vec3(11.0, 1.0, 10.0), null, true, 1500)
        assertFailsWith<IllegalArgumentException> { recorder.mark("x".repeat(81), "Walk.", true, 1500) }
        assertFailsWith<IllegalArgumentException> { recorder.mark("Door", " ", true, 1500) }
        assertEquals(RecorderState.RECORDING, recorder.state)
    }

    @Test fun startRequiresFreshTrackingAndRestartClearsPriorPoints() {
        val recorder = RouteRecorder()
        assertFailsWith<IllegalStateException> { recorder.start("2026-09-17T00:00:00Z", 0) }
        recorder.update(Vec3(0.0, 0.0, 0.0), Vec3(0.0, 0.0, -1.0), true, 0)
        assertFailsWith<IllegalStateException> { recorder.start("2026-09-17T00:00:00Z", 2001) }
        recorder.reset()
        assertEquals(RecorderState.IDLE, recorder.state)
        assertEquals(0, recorder.pointCount)
    }

    @Test fun boundsTimeAndLandmarksWithoutPublishingAPartialRoute() {
        val expired = ready()
        expired.update(Vec3(10.5, 1.0, 10.0), null, true, 601_001)
        assertEquals(RecorderState.INTERRUPTED, expired.state)
        val recorder = ready()
        for (index in 1..19) {
            recorder.update(Vec3(10.0 + index, 1.0, 10.0), null, true, 1000 + index * 500L)
            recorder.mark("Point $index", "Walk.", false, 1000 + index * 500L)
        }
        recorder.update(Vec3(30.0, 1.0, 10.0), null, true, 11_000)
        assertFailsWith<IllegalArgumentException> { recorder.mark("Extra", "Walk.", false, 11_000) }
        recorder.mark("Restroom", "Walk.", true, 11_000)
        assertEquals(21, recorder.pointCount)
        assertEquals(RecorderState.FINISHED, recorder.state)
    }
}
