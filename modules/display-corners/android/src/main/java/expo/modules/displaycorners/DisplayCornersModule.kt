package expo.modules.displaycorners

import android.os.Build
import android.view.RoundedCorner
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val STRAIGHT_CORNER_RADIUS = 0.0

class DisplayCornersModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("DisplayCorners")

    AsyncFunction("getCornerRadius") { promise: Promise ->
      promise.resolve(readCornerRadius())
    }.runOnQueue(Queues.MAIN)
  }

  private fun readCornerRadius(): Double {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return STRAIGHT_CORNER_RADIUS
    val activity = appContext.currentActivity ?: return STRAIGHT_CORNER_RADIUS
    val insets = activity.window.decorView.rootWindowInsets ?: return STRAIGHT_CORNER_RADIUS
    val smallestRadiusPx = listOf(
      RoundedCorner.POSITION_TOP_LEFT,
      RoundedCorner.POSITION_TOP_RIGHT,
      RoundedCorner.POSITION_BOTTOM_LEFT,
      RoundedCorner.POSITION_BOTTOM_RIGHT
    ).minOf { insets.getRoundedCorner(it)?.radius ?: 0 }
    return smallestRadiusPx / activity.resources.displayMetrics.density.toDouble()
  }
}
