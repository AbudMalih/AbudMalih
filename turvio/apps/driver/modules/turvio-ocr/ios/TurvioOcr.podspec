Pod::Spec.new do |s|
  s.name           = 'TurvioOcr'
  s.version        = '0.1.0'
  s.summary        = 'On-device parcel-label text recognition (Apple Vision)'
  s.description    = s.summary
  s.license        = 'UNLICENSED'
  s.author         = 'Lunapact Technologies'
  s.homepage       = 'https://turvio.invalid'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks     = 'Vision'
  s.source_files   = '**/*.{h,m,swift}'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES', 'SWIFT_COMPILATION_MODE' => 'wholemodule' }
end
