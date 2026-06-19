package expo.modules.timemarkvideo

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Handler
import android.os.Looper
import androidx.media3.common.Effect
import androidx.media3.common.MediaItem
import androidx.media3.common.audio.AudioProcessor
import androidx.media3.common.util.UnstableApi
import androidx.media3.effect.BitmapOverlay
import androidx.media3.effect.OverlayEffect
import androidx.media3.effect.TextureOverlay
import androidx.media3.transformer.Composition
import androidx.media3.transformer.EditedMediaItem
import androidx.media3.transformer.Effects
import androidx.media3.transformer.ExportException
import androidx.media3.transformer.ExportResult
import androidx.media3.transformer.Transformer
import com.google.common.collect.ImmutableList
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

@OptIn(UnstableApi::class)
class TimemarkVideoModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("TimemarkVideo")

    // Kích thước hiển thị (đã áp rotation) của video.
    AsyncFunction("getVideoSize") { uri: String, promise: Promise ->
      try {
        val (w, h) = readDisplaySize(stripFile(uri))
        promise.resolve(mapOf("width" to w, "height" to h))
      } catch (e: Exception) {
        promise.reject(CodedException("ERR_VIDEO_SIZE", e.message ?: "Không đọc được kích thước video", e))
      }
    }

    // Ghi cứng overlay PNG lên toàn khung video, trả về file:// video mới trong cache.
    AsyncFunction("burnOverlay") { videoUri: String, overlayPngUri: String, promise: Promise ->
      // Transformer cần chạy trên thread có Looper.
      Handler(Looper.getMainLooper()).post {
        try {
          burn(stripFile(videoUri), stripFile(overlayPngUri), promise)
        } catch (e: Exception) {
          promise.reject(CodedException("ERR_BURN", e.message ?: "Đóng dấu video thất bại", e))
        }
      }
    }
  }

  private fun stripFile(uri: String): String =
    if (uri.startsWith("file://")) (Uri.parse(uri).path ?: uri.removePrefix("file://")) else uri

  private fun readDisplaySize(path: String): Pair<Int, Int> {
    val r = MediaMetadataRetriever()
    try {
      r.setDataSource(path)
      val w = r.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH)?.toIntOrNull() ?: 0
      val h = r.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT)?.toIntOrNull() ?: 0
      val rot = r.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION)?.toIntOrNull() ?: 0
      return if (rot == 90 || rot == 270) Pair(h, w) else Pair(w, h)
    } finally {
      r.release()
    }
  }

  private fun burn(videoPath: String, overlayPath: String, promise: Promise) {
    val context = appContext.reactContext ?: throw IllegalStateException("Không có context")

    val (dw, dh) = readDisplaySize(videoPath)
    val raw = BitmapFactory.decodeFile(overlayPath)
      ?: throw IllegalStateException("Không giải mã được ảnh overlay")
    // Scale overlay đúng bằng kích thước hiển thị của video để phủ kín khung (vẽ ở giữa, kích thước native).
    val overlayBitmap =
      if (dw > 0 && dh > 0 && (raw.width != dw || raw.height != dh))
        Bitmap.createScaledBitmap(raw, dw, dh, true)
      else raw

    val bitmapOverlay = BitmapOverlay.createStaticBitmapOverlay(overlayBitmap)
    val overlayEffect = OverlayEffect(ImmutableList.of<TextureOverlay>(bitmapOverlay))

    val editedMediaItem = EditedMediaItem.Builder(MediaItem.fromUri(Uri.fromFile(File(videoPath))))
      .setEffects(Effects(emptyList<AudioProcessor>(), listOf<Effect>(overlayEffect)))
      .build()

    val outputFile = File(context.cacheDir, "timemark_${System.currentTimeMillis()}.mp4")

    val transformer = Transformer.Builder(context)
      .addListener(object : Transformer.Listener {
        override fun onCompleted(composition: Composition, exportResult: ExportResult) {
          promise.resolve("file://${outputFile.absolutePath}")
        }

        override fun onError(
          composition: Composition,
          exportResult: ExportResult,
          exportException: ExportException
        ) {
          promise.reject(CodedException("ERR_EXPORT", exportException.message ?: "Xuất video thất bại", exportException))
        }
      })
      .build()

    transformer.start(editedMediaItem, outputFile.absolutePath)
  }
}
