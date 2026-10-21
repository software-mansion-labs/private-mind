import ExpoModulesCore

@_silgen_name("pm_mlx_release_cache") private func pmMlxReleaseCache()

private final class MemoryPressureWatch {
  static let shared = MemoryPressureWatch()

  private let queue = DispatchQueue(label: "pm.memory-pressure")
  private let source: DispatchSourceMemoryPressure
  private let lock = NSLock()
  private var level = "normal"
  private var lastStrainAt = -1.0

  private init() {
    source = DispatchSource.makeMemoryPressureSource(
      eventMask: [.normal, .warning, .critical], queue: queue
    )
    source.setEventHandler { [weak self] in
      guard let self else { return }
      let event = self.source.data
      self.lock.lock()
      if event.contains(.critical) {
        self.level = "critical"
      } else if event.contains(.warning) {
        self.level = "warning"
      } else {
        self.level = "normal"
      }
      if self.level != "normal" {
        self.lastStrainAt = Date().timeIntervalSince1970 * 1000
      }
      self.lock.unlock()
    }
    source.resume()
  }

  func snapshot() -> [String: Any] {
    lock.lock()
    defer { lock.unlock() }
    return ["level": level, "lastStrainAt": lastStrainAt]
  }
}

public class MemoryProbeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("MemoryProbe")

    OnCreate {
      _ = MemoryPressureWatch.shared
    }

    Function("getMemoryPressure") { () -> [String: Any] in
      MemoryPressureWatch.shared.snapshot()
    }

    Function("releaseMlxCache") {
      pmMlxReleaseCache()
    }

    Function("getPhysFootprintBytes") { () -> Double in
      var info = task_vm_info_data_t()
      var count = mach_msg_type_number_t(
        MemoryLayout<task_vm_info_data_t>.size / MemoryLayout<natural_t>.size
      )

      let status = withUnsafeMutablePointer(to: &info) { pointer in
        pointer.withMemoryRebound(to: integer_t.self, capacity: Int(count)) { rebound in
          task_info(mach_task_self_, task_flavor_t(TASK_VM_INFO), rebound, &count)
        }
      }

      guard status == KERN_SUCCESS else { return -1 }
      return Double(info.phys_footprint)
    }
  }
}
