package com.lechigo.recorder

import android.app.AlertDialog
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.os.SystemClock
import android.provider.Settings
import android.util.AtomicFile
import android.view.View
import android.widget.*
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.lifecycle.lifecycleScope
import com.google.ar.core.TrackingState
import io.github.sceneview.ar.ARSceneView
import java.io.File
import java.time.Instant
import java.util.Locale
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class RecorderActivity : ComponentActivity() {
    private val recorder = RouteRecorder()
    private lateinit var status: TextView
    private lateinit var progress: TextView
    private lateinit var scene: ARSceneView
    private var cameraError: String? = null
    private var lastUiTime = 0L
    private var exporting = false
    private val savedRecording by lazy { AtomicFile(File(filesDir, "completed-route.json")) }
    private val exportDocument = registerForActivityResult(ActivityResultContracts.CreateDocument("application/json")) { uri ->
        if (uri != null) lifecycleScope.launch {
            exporting = true; render()
            try {
                withContext(Dispatchers.IO) {
                    val bytes = savedRecording.readFully()
                    check(bytes.size <= 1_000_000) { "Saved recording exceeds the export limit." }
                    contentResolver.openOutputStream(uri)?.use { it.write(bytes) }
                        ?: error("Could not open the selected document.")
                }
                Toast.makeText(this@RecorderActivity, "Recording exported", Toast.LENGTH_LONG).show()
            } catch (_: Exception) {
                AlertDialog.Builder(this@RecorderActivity).setMessage("Export failed. The recording remains on this device; try another document location.")
                    .setPositiveButton("OK", null).show()
            } finally { exporting = false; render() }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.recorder)
        val root = findViewById<View>(R.id.root)
        ViewCompat.setOnApplyWindowInsetsListener(root) { view, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom); insets
        }
        status = findViewById(R.id.status); progress = findViewById(R.id.progress)
        button(R.id.start).setOnClickListener { action { recorder.start(Instant.now().toString(), now()) } }
        button(R.id.restart).setOnClickListener {
            AlertDialog.Builder(this).setMessage("Discard this walk and return to the entrance?")
                .setNegativeButton("Keep recording", null)
                .setPositiveButton("Restart") { _, _ -> recorder.reset(); render() }.show()
        }
        button(R.id.mark).setOnClickListener { markDialog(false) }
        button(R.id.finish).setOnClickListener { markDialog(true) }
        button(R.id.export).setOnClickListener { action {
            if (recorder.state == RecorderState.FINISHED) saveCompleted()
            exportDocument.launch("lechigo-recording.json")
        } }
        button(R.id.settings).setOnClickListener {
            startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$packageName")))
        }
        scene = ARSceneView(this, sharedActivity = this, sharedLifecycle = lifecycle).apply {
            onSessionFailed = {
                cameraError = "Camera or AR unavailable. Check camera permission and Google Play Services for AR."
                recorder.interrupt("AR session failed. Restart at the entrance.")
                render()
            }
            onSessionUpdated = { _, frame ->
                val camera = frame.camera
                val pose = camera.pose
                val forward = pose.getTransformedAxis(2, -1f)
                recorder.update(Vec3(pose.tx().toDouble(), pose.ty().toDouble(), pose.tz().toDouble()),
                    Vec3(forward[0].toDouble(), forward[1].toDouble(), forward[2].toDouble()),
                    camera.trackingState == TrackingState.TRACKING, now())
                cameraError = null
                if (now() - lastUiTime >= 250) { lastUiTime = now(); render() }
            }
        }
        findViewById<FrameLayout>(R.id.camera).addView(scene)
        render()
    }

    override fun onPause() {
        recorder.interrupt("Recording paused by the system. Restart at the entrance.")
        super.onPause()
    }

    private fun markDialog(destination: Boolean) {
        val fields = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(24, 0, 24, 0) }
        val name = EditText(this).apply { hint = "Landmark name"; setSingleLine(); if (destination) setText("Restroom") }
        val instruction = EditText(this).apply { hint = "Instruction from the previous point"; minLines = 2 }
        fields.addView(name); fields.addView(instruction)
        val dialog = AlertDialog.Builder(this).setTitle(if (destination) "Finish route" else "Mark landmark")
            .setView(fields).setNegativeButton("Cancel", null).setPositiveButton("Save", null).create()
        dialog.setOnShowListener {
            dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener {
                try {
                    recorder.mark(name.text.toString(), instruction.text.toString(), destination, now())
                    dialog.dismiss()
                    if (destination) action { saveCompleted() }
                } catch (error: Exception) { instruction.error = error.message ?: "Could not save this point." }
                render()
            }
        }
        dialog.show()
    }

    private fun saveCompleted() {
        val bytes = recorder.exportJson().toByteArray(Charsets.UTF_8)
        check(bytes.size <= 1_000_000) { "Recording exceeds the export limit." }
        val stream = savedRecording.startWrite()
        try { stream.write(bytes); savedRecording.finishWrite(stream) }
        catch (error: Exception) { savedRecording.failWrite(stream); throw error }
    }

    private fun action(block: () -> Unit) {
        try { block() } catch (error: Exception) {
            AlertDialog.Builder(this).setMessage(error.message).setPositiveButton("OK", null).show()
        }
        render()
    }

    private fun render() {
        status.text = cameraError ?: when (recorder.state) {
            RecorderState.IDLE -> if (recorder.canStart(now())) "Ready at entrance" else "Waiting for tracking"
            RecorderState.RECORDING -> "Recording"
            RecorderState.INTERRUPTED -> recorder.reason
            RecorderState.FINISHED -> "Route complete"
        }
        progress.text = String.format(Locale.ROOT, "%d points | %.1f meters", recorder.pointCount, recorder.distanceMeters)
        button(R.id.start).isEnabled = recorder.canStart(now()) && !exporting
        button(R.id.restart).isEnabled = recorder.state != RecorderState.IDLE && !exporting
        button(R.id.mark).isEnabled = recorder.state == RecorderState.RECORDING
        button(R.id.finish).isEnabled = recorder.state == RecorderState.RECORDING
        button(R.id.export).text = if (recorder.state == RecorderState.FINISHED) "Export recording" else "Export saved recording"
        button(R.id.export).isEnabled = !exporting && (recorder.state == RecorderState.FINISHED ||
            (recorder.state == RecorderState.IDLE && savedRecording.baseFile.exists()))
        button(R.id.settings).visibility = if (cameraError == null) View.GONE else View.VISIBLE
    }

    private fun button(id: Int) = findViewById<Button>(id)
    private fun now() = SystemClock.elapsedRealtime()
}
