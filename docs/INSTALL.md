# Instalar en Samsung Tizen

AC TV es experimental y requiere modo desarrollador y herramientas del SDK de Samsung. La instalación necesita un perfil y certificados de Samsung propios, válidos para el televisor de destino. No se distribuyen certificados.

## Instalar con un asistente

Puedes seguir el [tutorial para Codex](INSTALL_WITH_CODEX.md) o el [tutorial para Claude Code](INSTALL_WITH_CLAUDE.md). Ambos incluyen un mensaje de diagnóstico y otro de instalación para copiar, trabajando desde tu ordenador en la misma red que la TV.

## 1. Comprobar el ordenador

Desde la raíz del repositorio, con PowerShell 7:

```powershell
pwsh -File ./scripts/install-tv.ps1 -TvIp 192.168.1.42 -SecurityProfile MiPerfilTV
```

La comprobación predeterminada valida los parámetros, las rutas de las herramientas y el manifiesto de la app. El perfil indicado se comprueba al firmar.

## 2. Diagnosticar la conexión con la TV

Con el televisor encendido y en modo desarrollador, ejecuta:

```powershell
pwsh -File ./scripts/install-tv.ps1 -TvIp 192.168.1.42 -Diagnose
```

Esto comprueba si `sdb` detecta la TV indicada. Puedes hacerlo antes de crear el perfil de firma. El diagnóstico no instala ni abre aplicaciones.

| Resultado | Qué revisar |
| --- | --- |
| Falta `sdb` | Instala el SDK o indica la ruta al ejecutable con `-SdbPath`. |
| TV no detectada | Comprueba la IP de la TV, que ambos equipos estén en la misma red y que el modo desarrollador tenga la IP actual del ordenador. |
| TV detectada pero sin conexión | Reinicia la TV tras configurar el modo desarrollador. Confirma cualquier autorización que aparezca en pantalla y repite la prueba. |
| Conexión correcta, pero la instalación falla | Revisa en Certificate Manager que el perfil incluya el televisor y que los certificados sigan vigentes. |

## 3. Instalar

```powershell
pwsh -File ./scripts/install-tv.ps1 -TvIp 192.168.1.42 -SecurityProfile MiPerfilTV -Install -Launch
```

Configura Developer Mode en la TV, conecta ordenador y televisor a la misma red y crea un perfil de firma que incluya el dispositivo. El nombre y ruta de los menús varían por modelo. El script no crea certificados ni guarda contraseñas. Una instalación con el mismo ID puede actualizarse conforme al SDK y al televisor.

El instalador comprueba que la TV indicada en `-TvIp` esté disponible en SDB. Si especificas `-TargetSerial`, debe coincidir con la dirección de esa TV y el puerto `26101`.

Consulta la [compatibilidad y el estado de las pruebas](COMPATIBILITY.md).

## Primer uso

La aplicación empieza sin canales. En **Ajustes → Añadir un canal**, introduce un enlace Ace Stream individual compatible, asigna un nombre y elige guardarlo o reproducirlo. Los canales guardados y favoritos permanecen en la TV y se buscan localmente. M3U no está implementado. Añade únicamente contenido autorizado bajo tu responsabilidad; detalles en [Uso responsable](RESPONSIBLE_USE.md).

La compatibilidad de formato no garantiza que el enlace esté disponible o se reproduzca. El uso P2P puede comunicar tu IP a otros pares.

Referencias: [conectar TV y SDK](https://developer.samsung.com/smarttv/develop/getting-started/using-sdk/tv-device.html), [CLI Samsung](https://developer.samsung.com/smarttv/develop/getting-started/using-sdk/command-line-interface.html).
