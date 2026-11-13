$ErrorActionPreference = 'Stop'
$app = Join-Path $PSScriptRoot 'acetv-native-app'
[xml]$manifest = Get-Content -LiteralPath (Join-Path $app 'config.xml') -Raw
$version = $manifest.widget.version
if ($version -notmatch '^\d+\.\d+\.\d+$') { throw 'Versión de la aplicación no válida.' }

$output = Join-Path $PSScriptRoot "AceTV-$version-unsigned.wgt"
$temporary = "$output.$([guid]::NewGuid().ToString('N')).tmp"
try {
    [IO.Compression.ZipFile]::CreateFromDirectory($app, $temporary)
    Move-Item -LiteralPath $temporary -Destination $output -Force
    Write-Output $output
} finally {
    if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary }
}
