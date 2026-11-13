package expo.modules.imagepixels

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.media.ExifInterface
import android.net.Uri
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.nio.ByteBuffer
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

class ImageNotReadableException(uri: String) :
  CodedException("Cannot read an image from $uri")

class ImagePixelsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ImagePixels")

    AsyncFunction("decodeRgba") { uri: String, maxSide: Int ->
      val path = Uri.parse(uri).takeIf { it.scheme == "file" }?.path ?: uri
      val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
      BitmapFactory.decodeFile(path, bounds)
      if (bounds.outWidth <= 0 || bounds.outHeight <= 0) throw ImageNotReadableException(uri)

      var sampleSize = 1
      while (max(bounds.outWidth, bounds.outHeight) / (sampleSize * 2) >= maxSide) sampleSize *= 2
      val decoded = BitmapFactory.decodeFile(
        path,
        BitmapFactory.Options().apply {
          inSampleSize = sampleSize
          inPreferredConfig = Bitmap.Config.ARGB_8888
        }
      ) ?: throw ImageNotReadableException(uri)

      val upright = uprightBitmap(decoded, path)
      val scale = min(1f, maxSide.toFloat() / max(upright.width, upright.height))
      val width = max(1, (upright.width * scale).roundToInt())
      val height = max(1, (upright.height * scale).roundToInt())
      val sized = if (width == upright.width && height == upright.height) upright
        else Bitmap.createScaledBitmap(upright, width, height, true)
      val argb = if (sized.config == Bitmap.Config.ARGB_8888) sized
        else sized.copy(Bitmap.Config.ARGB_8888, false)

      val pixels = ByteBuffer.allocate(width * height * 4)
      argb.copyPixelsToBuffer(pixels)
      mapOf("width" to width, "height" to height, "data" to pixels.array())
    }
  }

  private fun uprightBitmap(bitmap: Bitmap, path: String): Bitmap {
    val degrees = when (
      runCatching { ExifInterface(path).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL) }
        .getOrDefault(ExifInterface.ORIENTATION_NORMAL)
    ) {
      ExifInterface.ORIENTATION_ROTATE_90 -> 90f
      ExifInterface.ORIENTATION_ROTATE_180 -> 180f
      ExifInterface.ORIENTATION_ROTATE_270 -> 270f
      else -> 0f
    }
    if (degrees == 0f) return bitmap
    val matrix = Matrix().apply { postRotate(degrees) }
    return Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
  }
}
