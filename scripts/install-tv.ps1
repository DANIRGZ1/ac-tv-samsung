#!/usr/bin/env pwsh
[CmdletBinding(DefaultParameterSetName='Check')]
param(
    [Parameter(Mandatory=$true)][string]$TvIp,
    [Parameter(Mandatory=$true)][string]$SecurityProfile,
    [Parameter(ParameterSetName='Install', Mandatory=$true)][switch]$Install,
    [Parameter(ParameterSetName='Check')][switch]$CheckOnly,
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
$parsedIp = $null
if (![Net.IPAddress]::TryParse($TvIp, [ref]$parsedIp) -or $parsedIp.AddressFamily -ne [Net.Sockets.AddressFamily]::InterNetwork) { Stop-With 'TvIp debe ser una dirección IPv4 literal.' }
if ([string]::IsNullOrWhiteSpace($SecurityProfile) -or $SecurityProfile -notmatch '^[A-Za-z0-9_.-]+$') { Stop-With 'SecurityProfile debe ser el nombre de un perfil propio ya existente (sin contraseña).' }
$tizen = Resolve-Tool $TizenPath 'tizen'
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
Write-Output "Herramientas: tizen=$tizen ; sdb=$sdb"
Write-Output "Perfil de firma: $SecurityProfile"
Write-Output 'Comprobación local correcta. No se ha conectado a la TV ni se ha firmado/instalado nada.'
if (!$Install) { exit 0 }
$stage = Join-Path ([IO.Path]::GetTempPath()) ('acetv-install-' + [guid]::NewGuid().ToString('N'))
try {
    $null = New-Item -ItemType Directory -Path $stage
    Invoke-Tool $tizen @('package','-t','wgt','-s',$SecurityProfile,'-o',$stage,'--',$appDir)
    $packages = @(Get-ChildItem -LiteralPath $stage -Filter '*.wgt' -File)
    if ($packages.Count -ne 1) { Stop-With "La firma debía producir exactamente un WGT; produjo $($packages.Count)." }
    $package = $packages[0].FullName
    $endpoint = $parsedIp.ToString() + ':26101'
    Invoke-Tool $sdb @('connect',$endpoint)
    if (!$TargetSerial) {
        $deviceLines = @(& $sdb devices)
        if ($LASTEXITCODE -ne 0) { Stop-With 'No se pudo consultar sdb devices.' }
        $serials = @($deviceLines | ForEach-Object { if ($_ -match '^\s*(\S+)\s+device(?:\s|$)') { $Matches[1] } } | Where-Object { $_ -eq $endpoint })
        if ($serials.Count -ne 1) { Stop-With "No se detectó de forma única la TV ($endpoint); usa -TargetSerial con el identificador que muestra sdb devices." }
        $TargetSerial = $serials[0]
    }
    if ($TargetSerial -notmatch '^[A-Za-z0-9_.:-]+$') { Stop-With 'TargetSerial contiene caracteres no válidos.' }
    Invoke-Tool $tizen @('install','-n',$packages[0].Name,'-s',$TargetSerial,'--',$stage)
    if ($Launch) { Invoke-Tool $tizen @('run','-p',$applicationId,'-s',$TargetSerial) }
    Write-Output "Instalación completada en $TargetSerial. No se ha desinstalado ninguna aplicación."
}
finally {
    $tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
    $resolvedStage = [IO.Path]::GetFullPath($stage)
    if (!$resolvedStage.StartsWith($tempRoot, [StringComparison]::OrdinalIgnoreCase) -or [IO.Path]::GetFileName($resolvedStage) -notmatch '^acetv-install-[a-f0-9]{32}$') { throw 'La ruta temporal no se puede limpiar de forma segura.' }
    if (Test-Path -LiteralPath $resolvedStage) { Remove-Item -LiteralPath $resolvedStage -Recurse -Force }
}
