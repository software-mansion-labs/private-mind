import ExpoModulesCore
import UIKit

internal final class ImageNotReadableException: GenericException<String> {
  override var reason: String {
    "Cannot read an image from \(param)"
  }
}

public class ImagePixelsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ImagePixels")

    AsyncFunction("decodeRgba") { (uri: String, maxSide: Int) throws -> [String: Any] in
      let path = URL(string: uri).flatMap { $0.isFileURL ? $0.path : nil } ?? uri
      guard let image = UIImage(contentsOfFile: path), image.size.width > 0, image.size.height > 0 else {
        throw ImageNotReadableException(uri)
      }
      let scale = min(1, CGFloat(maxSide) / max(image.size.width, image.size.height))
      let width = max(1, Int((image.size.width * scale).rounded()))
      let height = max(1, Int((image.size.height * scale).rounded()))
      var pixels = Data(count: width * height * 4)
      let drawn = pixels.withUnsafeMutableBytes { buffer -> Bool in
        guard let context = CGContext(
          data: buffer.baseAddress,
          width: width,
          height: height,
          bitsPerComponent: 8,
          bytesPerRow: width * 4,
          space: CGColorSpaceCreateDeviceRGB(),
          bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue
        ) else {
          return false
        }
        context.translateBy(x: 0, y: CGFloat(height))
        context.scaleBy(x: 1, y: -1)
        UIGraphicsPushContext(context)
        image.draw(in: CGRect(x: 0, y: 0, width: width, height: height))
        UIGraphicsPopContext()
        return true
      }
      guard drawn else {
        throw ImageNotReadableException(uri)
      }
      return ["width": width, "height": height, "data": pixels]
    }
  }
}
