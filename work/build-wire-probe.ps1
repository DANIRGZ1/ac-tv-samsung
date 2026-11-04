$ErrorActionPreference='Stop'
$taskRoot=Split-Path $PSScriptRoot -Parent
Push-Location $taskRoot
try {
  $previousRustFlags=$env:RUSTFLAGS
  $env:RUSTFLAGS='-C target-cpu=mvp -C target-feature=+mutable-globals'
  cargo +nightly-2026-03-15-x86_64-pc-windows-gnu build --manifest-path work/acetv-wire-wasm/Cargo.toml --target wasm32-unknown-unknown --release --locked -Z build-std=std,panic_abort
  if($LASTEXITCODE -ne 0){throw 'Rust compilation failed'}
  & work/toolchain/wasm-bindgen-0.2.105/wasm-bindgen-0.2.105-x86_64-pc-windows-msvc/wasm-bindgen.exe --target no-modules --no-typescript --out-dir work/acetv-wire-probe/app/core --out-name ace_wire work/acetv-wire-wasm/target/wasm32-unknown-unknown/release/acetv_wire_wasm.wasm
  if($LASTEXITCODE -ne 0){throw 'wasm-bindgen failed'}
  Compress-Archive -Path work/acetv-wire-probe/* -DestinationPath work/AceTVWireProbe.zip -Force
  Move-Item -LiteralPath work/AceTVWireProbe.zip -Destination work/AceTVWireProbe-unsigned.wgt -Force
  & work/sign-wgt.ps1 -InputPackage "$taskRoot/work/AceTVWireProbe-unsigned.wgt" -OutputPackage "$taskRoot/work/AceTVWireProbe-signed.wgt"
} finally {
  $env:RUSTFLAGS=$previousRustFlags
  Pop-Location
}
