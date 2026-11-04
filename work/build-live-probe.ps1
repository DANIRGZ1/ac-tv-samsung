$ErrorActionPreference='Stop'
$taskRoot=Split-Path $PSScriptRoot -Parent
$sdk=Join-Path $PSScriptRoot 'toolchain/samsung-emscripten/emscripten-release-bundle/emsdk'
Push-Location $taskRoot
try {
  $null=New-Item -ItemType Directory -Path work/acetv-live-probe/app/core -Force
  Copy-Item -Path work/acetv-wire-probe/app/core/* -Destination work/acetv-live-probe/app/core -Force
  Copy-Item -LiteralPath work/acetv-live-probe/src/worker-bridge.js -Destination work/acetv-live-probe/app/worker-bridge.js -Force
  $env:EM_CONFIG=Join-Path $PSScriptRoot 'toolchain/samsung-emscripten-local.py'
  $env:EM_CACHE=Join-Path $sdk '.emscripten_cache'
  $env:EMCC_WASM_BACKEND='0'
  & (Join-Path $sdk 'python/2.7.13.1_64bit/python-2.7.13.amd64/python.exe') (Join-Path $sdk 'fastcomp/emscripten/emcc') work/acetv-live-probe/src/network.cpp work/acetv-live-probe/src/loopback.cpp -Os -s TOTAL_MEMORY=33554432 -s ENVIRONMENT_MAY_BE_TIZEN=1 --proxy-to-worker --pre-js work/acetv-live-probe/src/pre.js -s 'EXPORTED_FUNCTIONS=["_main","_net_connect","_net_connect_udp","_net_ready","_net_write","_net_read","_net_close","_stream_open","_stream_enqueue","_stream_buffered","_stream_end","_stream_close","_malloc","_free"]' -s 'EXTRA_EXPORTED_RUNTIME_METHODS=["ccall"]' -o work/acetv-live-probe/app/network.js
  if($LASTEXITCODE -ne 0){throw 'Samsung networking compilation failed'}
  Compress-Archive -Path work/acetv-live-probe/* -DestinationPath work/AceTVLiveProbe.zip -Force
  Move-Item -LiteralPath work/AceTVLiveProbe.zip -Destination work/AceTVLiveProbe-unsigned.wgt -Force
  & work/sign-wgt.ps1 -InputPackage "$taskRoot/work/AceTVLiveProbe-unsigned.wgt" -OutputPackage "$taskRoot/work/AceTVLiveProbe-signed.wgt"
} finally {Pop-Location}
