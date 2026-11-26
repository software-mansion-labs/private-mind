package expo.modules.shareimage

import android.content.ClipData
import android.content.Intent
import android.net.Uri
import androidx.core.content.FileProvider
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

private const val SHARING_PROVIDER_SUFFIX = ".SharingFileProvider"
private const val IMAGE_MIME_TYPE = "image/png"

class ShareImageModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ShareImage")

    AsyncFunction("share") { fileUri: String, text: String, dialogTitle: String ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      val path = Uri.parse(fileUri).path ?: throw IllegalArgumentException("No file path in $fileUri")
      val contentUri = FileProvider.getUriForFile(
        context,
        context.packageName + SHARING_PROVIDER_SUFFIX,
        File(path)
      )
      val send = Intent(Intent.ACTION_SEND).apply {
        type = IMAGE_MIME_TYPE
        putExtra(Intent.EXTRA_STREAM, contentUri)
        putExtra(Intent.EXTRA_TEXT, text)
        clipData = ClipData.newRawUri(null, contentUri)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      }
      val chooser = Intent.createChooser(send, dialogTitle).apply {
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      }
      appContext.throwingActivity.startActivity(chooser)
    }
  }
}
