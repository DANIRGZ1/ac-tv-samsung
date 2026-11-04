$ErrorActionPreference='Stop'
$taskRoot=Split-Path $PSScriptRoot -Parent
Push-Location $taskRoot
try {
  [xml]$manifest=Get-Content work/acetv-native-app/config.xml -Raw
  $version=$manifest.widget.version
  if($version -notmatch '^\d+\.\d+\.\d+$'){throw 'Invalid app version'}
  $target='work/acetv-native-app/p2p'
  $null=New-Item -ItemType Directory -Path $target -Force
  foreach($name in @('network.js','network.worker.js','network.wasm','discovery.js','peer-selector.js')) {
    if(Test-Path "work/acetv-live-probe/app/$name"){Copy-Item "work/acetv-live-probe/app/$name" $target -Force}
  }
  Copy-Item work/acetv-live-probe/src/worker-bridge.js "$target/worker-bridge.js" -Force
  $null=New-Item -ItemType Directory -Path "$target/core" -Force
  Copy-Item work/acetv-live-probe/app/core/* "$target/core" -Force
  Copy-Item work/transport-main.js "$target/transport-main.js" -Force
  [IO.File]::WriteAllText((Join-Path $taskRoot "$target/fixture-config.json"),'{"externalControl":true}',[Text.UTF8Encoding]::new($false))
  [IO.File]::WriteAllText((Join-Path $taskRoot "$target/transport.html"),'<!doctype html><meta charset="utf-8"><canvas id="canvas" width="1" height="1"></canvas><script src="transport-main.js"></script><script src="network.js"></script>',[Text.UTF8Encoding]::new($false))
  Compress-Archive -Path work/acetv-native-app/* -DestinationPath "work/AceTV-$version.zip" -Force
  Move-Item "work/AceTV-$version.zip" "work/AceTV-$version-unsigned.wgt" -Force
  if($env:TIZEN_SECURITY_PROFILE) { & work/sign-wgt.ps1 -InputPackage "$taskRoot/work/AceTV-$version-unsigned.wgt" -OutputPackage "$taskRoot/work/AceTV-$version-signed.wgt" }
} finally {Pop-Location}
