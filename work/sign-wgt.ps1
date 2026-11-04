param([Parameter(Mandatory=$true)][string]$InputPackage,[Parameter(Mandatory=$true)][string]$OutputPackage)
$ErrorActionPreference='Stop'
$profile=$env:TIZEN_SECURITY_PROFILE
if([string]::IsNullOrWhiteSpace($profile)){throw 'Set TIZEN_SECURITY_PROFILE to your own Samsung certificate profile, or use tizen package directly.'}
$null=Get-Command tizen -ErrorAction Stop
$stage=Join-Path $PSScriptRoot ('signing-stage-'+[guid]::NewGuid().ToString('N'))
$null=New-Item -ItemType Directory -Path $stage
Add-Type -AssemblyName System.IO.Compression.FileSystem
[IO.Compression.ZipFile]::ExtractToDirectory((Resolve-Path -LiteralPath $InputPackage).Path,$stage)
& tizen package -t wgt -s $profile -o $stage -- $stage
if($LASTEXITCODE -ne 0){throw 'Tizen signing failed'}
$signed=Get-ChildItem -LiteralPath $stage -Filter '*.wgt' | Select-Object -First 1
if(!$signed){throw 'Tizen CLI did not produce a signed WGT'}
Copy-Item -LiteralPath $signed.FullName -Destination $OutputPackage -Force
Write-Output ('Signed package: '+$OutputPackage)
