import ExpoModulesCore

public class MemoryProbeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("MemoryProbe")

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
