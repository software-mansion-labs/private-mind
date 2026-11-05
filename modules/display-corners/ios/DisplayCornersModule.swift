import ExpoModulesCore
import UIKit

private let straightCornerRadius = 0.0

public class DisplayCornersModule: Module {
  public func definition() -> ModuleDefinition {
    Name("DisplayCorners")

    AsyncFunction("getCornerRadius") { () -> Double in
      guard #available(iOS 26.0, *), let window = Self.activeWindow() else {
        return straightCornerRadius
      }
      let probe = UIView(frame: window.bounds)
      probe.isUserInteractionEnabled = false
      probe.isHidden = true
      probe.cornerConfiguration = .corners(radius: .containerConcentric())
      window.addSubview(probe)
      defer { probe.removeFromSuperview() }
      // iOS 27 reports a concentric radius of 0 until the view has been laid out.
      probe.layoutIfNeeded()
      return Double(probe.effectiveRadius(corner: .topLeft))
    }.runOnQueue(.main)
  }

  private static func activeWindow() -> UIWindow? {
    let windows = UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .flatMap { $0.windows }
    return windows.first { $0.isKeyWindow } ?? windows.first
  }
}
