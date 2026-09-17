package com.lechigo.recorder

import kotlin.test.*

class RouteRecorderTest {
    private fun ready(): RouteRecorder = RouteRecorder().apply {
        update(Vec3(10.0, 1.0, 10.0), Vec3(0.0, 0.0, -1.0), true, 0)
        start("2026-09-17T00:00:00Z", 0)
    }

    @Test fun recordsWalkedDistancesAndExportsOnlyCompletedRoutes() {
        val recorder = ready()
        assertFailsWith<IllegalStateException> { recorder.exportJson() }
        recorder.update(Vec3(11.0, 1.0, 10.0), null, true, 500)
        recorder.mark("Reception", "Walk to reception.", false, 500)
        recorder.update(Vec3(11.0, 1.0, 11.0), null, true, 1000)
        recorder.mark("Restroom", "Turn left to the restroom.", true, 1000)
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
            if (lostByFrame) recorder.update(null, null, false, 200) else recorder.interrupt("App left foreground.")
            recorder.update(Vec3(11.0, 1.0, 10.0), null, true, 500)
            assertEquals(RecorderState.INTERRUPTED, recorder.state)
            assertFailsWith<IllegalStateException> { recorder.mark("Door", "Walk.", true, 500) }
            assertFailsWith<IllegalStateException> { recorder.exportJson() }
        }
    }

    @Test fun rejectsStaleFramesJumpsAndInvalidSamples() {
        val stale = ready()
        assertFailsWith<IllegalStateException> { stale.mark("Door", "Walk.", true, 2001) }
        assertEquals(RecorderState.INTERRUPTED, stale.state)
        for (position in listOf(Vec3(100.0, 1.0, 10.0), Vec3(Double.NaN, 1.0, 10.0))) {
            val recorder = ready()
            recorder.update(position, null, true, 200)
            assertEquals(RecorderState.INTERRUPTED, recorder.state)
        }
    }

    @Test fun stationaryNoiseDoesNotCreateASegmentAndNamesAreBounded() {
        val recorder = ready()
        recorder.update(Vec3(10.01, 1.0, 10.0), null, true, 200)
        assertFailsWith<IllegalArgumentException> { recorder.mark("Door", "Walk.", true, 200) }
        recorder.update(Vec3(11.0, 1.0, 10.0), null, true, 500)
        assertFailsWith<IllegalArgumentException> { recorder.mark("x".repeat(81), "Walk.", true, 500) }
        assertFailsWith<IllegalArgumentException> { recorder.mark("Door", " ", true, 500) }
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
        expired.update(Vec3(10.5, 1.0, 10.0), null, true, 600_001)
        assertEquals(RecorderState.INTERRUPTED, expired.state)
        val recorder = ready()
        for (index in 1..19) {
            recorder.update(Vec3(10.0 + index, 1.0, 10.0), null, true, index * 500L)
            recorder.mark("Point $index", "Walk.", false, index * 500L)
        }
        recorder.update(Vec3(30.0, 1.0, 10.0), null, true, 10_000)
        assertFailsWith<IllegalArgumentException> { recorder.mark("Extra", "Walk.", false, 10_000) }
        recorder.mark("Restroom", "Walk.", true, 10_000)
        assertEquals(21, recorder.pointCount)
        assertEquals(RecorderState.FINISHED, recorder.state)
    }
}
