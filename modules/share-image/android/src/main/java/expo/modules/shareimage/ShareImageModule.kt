package expo.modules.shareimage

import android.content.ClipData
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import androidx.core.content.FileProvider
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

private const val SHARING_PROVIDER_SUFFIX = ".SharingFileProvider"
private const val IMAGE_MIME_TYPE = "image/png"

class ShareImageModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("ShareImage")

    Function("isInstalled") { packageName: String ->
      try {
        context.packageManager.getPackageInfo(packageName, 0)
        true
      } catch (error: PackageManager.NameNotFoundException) {
        false
      }
    }

    AsyncFunction("share") { fileUri: String, text: String, dialogTitle: String ->
      val send = imageIntent(fileUri, text)
      val chooser = Intent.createChooser(send, dialogTitle).apply {
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      }
      appContext.throwingActivity.startActivity(chooser)
    }

    AsyncFunction("shareToPackage") { fileUri: String, text: String, packageName: String ->
      val send = imageIntent(fileUri, text).apply { setPackage(packageName) }
      appContext.throwingActivity.startActivity(send)
    }
  }

  private fun imageIntent(fileUri: String, text: String): Intent {
    val path = Uri.parse(fileUri).path ?: throw IllegalArgumentException("No file path in $fileUri")
    val contentUri = FileProvider.getUriForFile(
      context,
      context.packageName + SHARING_PROVIDER_SUFFIX,
      File(path)
    )
    return Intent(Intent.ACTION_SEND).apply {
      type = IMAGE_MIME_TYPE
      putExtra(Intent.EXTRA_STREAM, contentUri)
      putExtra(Intent.EXTRA_TEXT, text)
      clipData = ClipData.newRawUri(null, contentUri)
      addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }
  }
}
