#!/usr/bin/env pwsh
[CmdletBinding(DefaultParameterSetName='Check')]
param(
    [Parameter(Mandatory=$true)][string]$TvIp,
    [string]$SecurityProfile,
    [Parameter(ParameterSetName='Install', Mandatory=$true)][switch]$Install,
    [Parameter(ParameterSetName='Check')][switch]$CheckOnly,
    [Parameter(ParameterSetName='Diagnose', Mandatory=$true)][switch]$Diagnose,
    [Parameter(ParameterSetName='Install')][switch]$Launch,
    [string]$TargetSerial,
    [string]$SdbPath,
    [string]$TizenPath
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
function Stop-With([string]$Message) { [Console]::Error.WriteLine("ERROR: $Message"); exit 1 }
function Resolve-Tool([string]$ExplicitPath, [string]$Name) {
    if ($ExplicitPath) {
        if (!(Test-Path -LiteralPath $ExplicitPath -PathType Leaf)) { Stop-With "No existe el ejecutable indicado: $ExplicitPath" }
        return (Resolve-Path -LiteralPath $ExplicitPath).Path
    }
    $command = Get-Command $Name -ErrorAction SilentlyContinue
    if (!$command) { Stop-With "No se encuentra $Name en PATH. Instala el SDK de Samsung/Tizen o indica su ruta." }
    return $command.Source
}
function Invoke-Tool([string]$Executable, [string[]]$Arguments) {
    & $Executable @Arguments
    $code = $LASTEXITCODE
    if ($null -eq $code -or $code -ne 0) { Stop-With "Falló $([IO.Path]::GetFileName($Executable)) (código $code)." }
}
function Confirm-TvConnection([string]$Sdb, [string]$Endpoint) {
    $null = & $Sdb connect $Endpoint 2>&1
    if ($LASTEXITCODE -ne 0) { Stop-With "No se pudo conectar con $Endpoint. Comprueba la IP, la red y el modo desarrollador de la TV." }
    $deviceLines = @(& $Sdb devices 2>&1)
    if ($LASTEXITCODE -ne 0) { Stop-With 'No se pudo consultar sdb devices. Comprueba el SDK y vuelve a intentarlo.' }
    $targetLines = @($deviceLines | Where-Object { $_ -match ('^\s*' + [regex]::Escape($Endpoint) + '\s+') })
    if ($targetLines.Count -eq 0) { Stop-With "La TV $Endpoint no aparece en SDB. Verifica su IP y que el modo desarrollador incluya la IP del ordenador." }
    if ($targetLines.Count -ne 1) { Stop-With "SDB devolvió más de una entrada para $Endpoint. Revisa la conexión en el SDK." }
    if ($targetLines[0] -match '^\s*\S+\s+offline(?:\s|$)') { Stop-With "La TV $Endpoint aparece offline en SDB. Reinicia la TV y revisa si hay una autorización pendiente en pantalla." }
    if ($targetLines[0] -notmatch '^\s*\S+\s+device(?:\s|$)') { Stop-With "La TV $Endpoint no está disponible en SDB. Revisa el modo desarrollador y la autorización de la TV." }
}
$parsedIp = $null
if (![Net.IPAddress]::TryParse($TvIp, [ref]$parsedIp) -or $parsedIp.AddressFamily -ne [Net.Sockets.AddressFamily]::InterNetwork) { Stop-With 'TvIp debe ser una dirección IPv4 literal.' }
if (!$Diagnose -and ([string]::IsNullOrWhiteSpace($SecurityProfile) -or $SecurityProfile -notmatch '^[A-Za-z0-9_.-]+$')) { Stop-With 'SecurityProfile debe ser el nombre de un perfil propio ya existente (sin contraseña).' }
$tizen = $null
if (!$Diagnose) { $tizen = Resolve-Tool $TizenPath 'tizen' }
$sdb = Resolve-Tool $SdbPath 'sdb'
$appDir = Join-Path (Split-Path -Parent $PSScriptRoot) 'work/acetv-native-app'
$manifest = Join-Path $appDir 'config.xml'
if (!(Test-Path -LiteralPath $manifest -PathType Leaf)) { Stop-With "No se encuentra el manifiesto: $manifest" }
[xml]$xml = Get-Content -LiteralPath $manifest -Raw
$ns = [System.Xml.XmlNamespaceManager]::new($xml.NameTable)
$ns.AddNamespace('tizen', 'http://tizen.org/ns/widgets')
$ns.AddNamespace('w', 'http://www.w3.org/ns/widgets')
$applicationNode = $xml.SelectSingleNode('/w:widget/tizen:application', $ns)
$applicationId = [string]$applicationNode.GetAttribute('id')
if ($applicationId -ne 'AcTVPublic.AceTV') { Stop-With "El manifiesto no tiene el ID público esperado (encontrado: $applicationId)." }
$version = [string]$xml.DocumentElement.GetAttribute('version')
Write-Output "Aplicación: Ace TV $version ($applicationId)"
$endpoint = $parsedIp.ToString() + ':26101'
if ($Diagnose) {
    Confirm-TvConnection $sdb $endpoint
    Write-Output "Diagnóstico correcto: TV $endpoint conectada y disponible. No se ha firmado ni instalado nada."
    exit 0
}
Write-Output "Herramientas: tizen=$tizen ; sdb=$sdb"
Write-Output "Perfil de firma: $SecurityProfile"
Write-Output 'Comprobación local correcta. No se ha conectado a la TV ni se ha firmado/instalado nada.'
if (!$Install) { exit 0 }
if ($TargetSerial -and $TargetSerial -ne $endpoint) { Stop-With "El TargetSerial no coincide con la TV indicada ($endpoint)." }
$stage = Join-Path ([IO.Path]::GetTempPath()) ('acetv-install-' + [guid]::NewGuid().ToString('N'))
try {
    $null = New-Item -ItemType Directory -Path $stage
    Invoke-Tool $tizen @('package','-t','wgt','-s',$SecurityProfile,'-o',$stage,'--',$appDir)
    $packages = @(Get-ChildItem -LiteralPath $stage -Filter '*.wgt' -File)
    if ($packages.Count -ne 1) { Stop-With "La firma debía producir exactamente un WGT; produjo $($packages.Count)." }
    Confirm-TvConnection $sdb $endpoint
    Invoke-Tool $tizen @('install','-n',$packages[0].Name,'-s',$endpoint,'--',$stage)
    if ($Launch) { Invoke-Tool $tizen @('run','-p',$applicationId,'-s',$endpoint) }
    Write-Output "Instalación completada en $endpoint. No se ha desinstalado ninguna aplicación."
}
finally {
    $tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
    $resolvedStage = [IO.Path]::GetFullPath($stage)
    if (!$resolvedStage.StartsWith($tempRoot, [StringComparison]::OrdinalIgnoreCase) -or [IO.Path]::GetFileName($resolvedStage) -notmatch '^acetv-install-[a-f0-9]{32}$') { throw 'La ruta temporal no se puede limpiar de forma segura.' }
    if (Test-Path -LiteralPath $resolvedStage) { Remove-Item -LiteralPath $resolvedStage -Recurse -Force }
}
