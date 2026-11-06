package expo.modules.turvioocr

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import androidx.exifinterface.media.ExifInterface
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.Text
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class OcrFailedException(message: String) : CodedException("ERR_OCR", message, null)

/**
 * Parcel-label text recognition with Google ML Kit (bundled model, runs on the device).
 * Labels are often photographed sideways: if the upright pass finds little text, the
 * image is analysed again at 90/270/180 degrees and the richest result is returned.
 */
class TurvioOcrModule : Module() {
  private val recognizer by lazy { TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS) }

  override fun definition() = ModuleDefinition {
    Name("TurvioOcr")

    AsyncFunction("recognizeAsync") { uri: String ->
      val context = appContext.reactContext ?: throw OcrFailedException("No React context")
      val parsed = Uri.parse(uri)
      val bitmap = context.contentResolver.openInputStream(parsed)?.use { BitmapFactory.decodeStream(it) }
        ?: throw OcrFailedException("Could not read image")
      val exifRotation = try {
        context.contentResolver.openInputStream(parsed)?.use {
          when (ExifInterface(it).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)) {
            ExifInterface.ORIENTATION_ROTATE_90 -> 90
            ExifInterface.ORIENTATION_ROTATE_180 -> 180
            ExifInterface.ORIENTATION_ROTATE_270 -> 270
            else -> 0
          }
        } ?: 0
      } catch (e: Exception) {
        0
      }
      var best: Pair<Int, Text>? = null
      for (extra in listOf(0, 90, 270, 180)) {
        val rotation = (exifRotation + extra) % 360
        val text = Tasks.await(recognizer.process(InputImage.fromBitmap(bitmap, rotation)))
        if (best == null || text.text.length > best.second.text.length) best = Pair(extra, text)
        // Enough text found: stop early to save time and battery.
        if (text.text.count { it.isLetterOrDigit() } >= 40) break
      }
      bitmap.recycle()
      val (rotation, text) = best!!
      val lines = mutableListOf<Map<String, Any?>>()
      text.textBlocks.forEachIndexed { blockIndex, block ->
        for (line in block.lines) {
          val box = line.boundingBox
          lines.add(
            mapOf(
              "text" to line.text,
              "confidence" to line.confidence.toDouble(),
              "block" to blockIndex,
              "frame" to box?.let { mapOf("x" to it.left, "y" to it.top, "width" to it.width(), "height" to it.height()) },
            ),
          )
        }
      }
      mapOf("engine" to "mlkit", "rotation" to rotation, "lines" to lines)
    }
  }
}
