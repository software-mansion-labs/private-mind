Pod::Spec.new do |s|
  s.name           = 'MemoryProbe'
  s.version        = '1.0.0'
  s.summary        = 'Reads the process phys_footprint, the metric iOS kills on'
  s.description    = 'Reads the process phys_footprint, the metric iOS kills on'
  s.author         = 'Software Mansion'
  s.homepage       = 'https://github.com/software-mansion-labs/private-mind'
  s.license        = { :type => 'MIT' }
  s.platforms      = { :ios => '15.1' }
  s.source         = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = '**/*.{h,m,mm,swift,hpp,cpp}'
end
