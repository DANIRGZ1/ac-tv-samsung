# Instalar en Samsung Tizen

AC TV es experimental y requiere modo desarrollador y herramientas del SDK de Samsung. La instalación necesita un perfil y certificados de Samsung propios, válidos para el televisor de destino. No se distribuyen certificados.

## Comprobar

Desde la raíz del repositorio, con PowerShell 7:

```powershell
pwsh -File ./scripts/install-tv.ps1 -TvIp 192.168.1.42 -SecurityProfile MiPerfilTV
```

La comprobación predeterminada valida parámetros y herramientas localmente; no conecta con la TV, firma ni instala.

## Instalar

```powershell
pwsh -File ./scripts/install-tv.ps1 -TvIp 192.168.1.42 -SecurityProfile MiPerfilTV -Install -Launch
```

Configura Developer Mode en la TV, conecta ordenador y televisor a la misma red y crea un perfil de firma que incluya el dispositivo. El nombre y ruta de los menús varían por modelo. El script no crea certificados ni guarda contraseñas. Una instalación con el mismo ID puede actualizarse conforme al SDK y al televisor.

El instalador se ha verificado con herramientas simuladas; la instalación real requiere el SDK y certificados compatibles. La base de Tizen 6.5 se probó antes, pero no se afirma que la versión pública 0.11.0 se haya instalado físicamente en una TV.

## Primer uso

La aplicación empieza sin canales. En **Ajustes → Añadir un canal**, introduce un enlace Ace Stream individual compatible, asigna un nombre y elige guardarlo o reproducirlo. Los canales guardados y favoritos permanecen en la TV y se buscan localmente. M3U no está implementado. Añade únicamente contenido autorizado bajo tu responsabilidad; detalles en [Uso responsable](RESPONSIBLE_USE.md).

La compatibilidad de formato no garantiza que el enlace esté disponible o se reproduzca. El uso P2P puede comunicar tu IP a otros pares.

Referencias: [conectar TV y SDK](https://developer.samsung.com/smarttv/develop/getting-started/using-sdk/tv-device.html), [CLI Samsung](https://developer.samsung.com/smarttv/develop/getting-started/using-sdk/command-line-interface.html).
