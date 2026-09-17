package com.lechigo.recorder

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlin.math.sqrt

val RecordingJson = Json { encodeDefaults = true; prettyPrint = true }

@Serializable data class Vec3(val x: Double, val y: Double, val z: Double) {
    fun distanceTo(other: Vec3) = sqrt((x - other.x) * (x - other.x) + (y - other.y) * (y - other.y) + (z - other.z) * (z - other.z))
    fun relativeTo(origin: Vec3) = Vec3(x - origin.x, y - origin.y, z - origin.z)
    fun isValid() = listOf(x, y, z).all { it.isFinite() && kotlin.math.abs(it) <= 10_000 }
}

@Serializable data class RecordedSample(val elapsedMs: Long, val position: Vec3)
@Serializable data class RecordedLandmark(
    val kind: String, val label: String, val instruction: String,
    val position: Vec3, val sampleIndex: Int, val distanceMeters: Double,
)
@Serializable data class Recording(
    val recordedAt: String,
    val heading: Vec3,
    val samples: List<RecordedSample>,
    val landmarks: List<RecordedLandmark>,
    val distanceMeters: Double,
    val schemaVersion: Int = 1,
    val source: String = "android-arcore",
    val coordinateFrame: String = "arcore-session-relative",
)
