Pod::Spec.new do |s|
  s.name           = 'DisplayCorners'
  s.version        = '1.0.0'
  s.summary        = 'Reads the display corner radius through public UIKit API'
  s.description    = 'Reads the display corner radius through public UIKit API'
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
