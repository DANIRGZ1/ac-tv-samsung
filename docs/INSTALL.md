# Instalar Ace TV en una Samsung Tizen TV

Este ayudante firma el paquete con un perfil Samsung que ya sea tuyo, instala el WGT y, opcionalmente, inicia la app. No incluye certificados ni pide contraseñas. La aplicación se ha probado en Tizen 6.5. La herramienta de instalación se verifica con herramientas simuladas; aún requiere una prueba completa con el SDK y certificados de otra TV.

## ¿Necesito una lista de canales?

**No es obligatorio aportar una lista propia.** En la versión actual puedes usar el catálogo público que descarga AC TV o abrir un enlace Ace Stream individual.

| Forma de usarla | Qué tienes que aportar |
| --- | --- |
| **Catálogo de la aplicación** | Conexión a Internet. En la bienvenida, pulsa **Preparar mis canales**; AC TV consulta el buscador público de Ace Stream y guarda los resultados en la TV. |
| **Enlace propio** | Un enlace `acestream://…` o un identificador compatible de 40 caracteres. Abre **Ajustes → Abrir un enlace**, pégalo y pulsa **Reproducir**. |
| **Lista M3U o URL de proveedor** | **Todavía no se puede importar directamente.** No es un requisito de instalación ni una función disponible en la versión 0.10.0. |

La instalación añade el reproductor y su motor. El catálogo se obtiene después desde Internet; no hay una lista personal de canales incluida en el paquete. Que un canal aparezca en el catálogo no garantiza que esté emitiendo o que su enlace funcione.

Para reproducir desde la Samsung no necesitas mantener Ace Stream abierto en el ordenador. El ordenador se usa para firmar e instalar la app; la opción de importar un catálogo desde el PC es un respaldo opcional.

## Preparación

1. Instala Samsung Certificate Extension y Tizen Studio/Samsung TV SDK en el ordenador.
2. En Certificate Manager crea tu propio perfil de certificados **Samsung** para TV y selecciónalo como perfil activo. El perfil debe incluir el certificado de autor y el de distribuidor adecuado para tu televisor. El script no crea ni copia certificados.
3. En la TV, abre **Apps → App Settings** y escribe **12345** con el mando o el teclado numérico en pantalla. Activa Developer Mode, indica la IP del ordenador y reinicia la TV. El nombre y ruta del menú pueden cambiar según el modelo. Mantén la TV y ordenador en la misma red.
4. Comprueba que `tizen` y `sdb` están en `PATH`, o localiza sus ejecutables para pasarlos explícitamente.

## Comprobar (predeterminado, sin conexión)

Desde la raíz del repositorio con PowerShell 7:

```powershell
pwsh -File ./scripts/install-tv.ps1 -TvIp 192.168.1.42 -SecurityProfile MiPerfilTV
```

Esto valida la IP, encuentra ambos ejecutables y verifica manifiesto e ID. No contacta la TV, firma ni modifica nada. `-CheckOnly` se puede indicar explícitamente.

## Firmar e instalar

```powershell
pwsh -File ./scripts/install-tv.ps1 -TvIp 192.168.1.42 -SecurityProfile MiPerfilTV -Install
```

Para abrirla al terminar, añade `-Launch`. Si el SDK no está en `PATH`, pasa rutas con `-TizenPath` y `-SdbPath`; para elegir el destino cuando hay varias sesiones, usa `-TargetSerial` con el serial que muestra `sdb devices`.

El modo de instalación ejecuta el empaquetado oficial `tizen package -t wgt`, conecta `sdb` al puerto de depuración de Tizen (26101), instala el WGT identificado y solo ejecuta la app si se pidió `-Launch`. No desinstala aplicaciones, no cambia ajustes/firmware/certificados y no usa acceso root. Una instalación existente con el mismo ID puede actualizarse según el comportamiento del SDK/TV.

## Límites

- Se requiere una IPv4 literal; no se aceptan nombres de host ni IPv6.
- El perfil debe existir localmente y tener permisos de distribución para esa TV. El script no solicita ni guarda contraseñas.
- El SDK, la red, el Developer Mode, la compatibilidad del modelo y las restricciones de firma pueden impedir la instalación.
- La comprobación local no acredita conexión ni compatibilidad real con una TV.
- El ID instalado es `AcTVPublic.AceTV`, tomado de `work/acetv-native-app/config.xml`.

Referencia oficial: [conectar la TV y el SDK](https://developer.samsung.com/smarttv/develop/getting-started/using-sdk/tv-device.html) y [CLI Samsung](https://developer.samsung.com/smarttv/develop/getting-started/using-sdk/command-line-interface.html).

La comprobación local valida el nombre del perfil; que exista y sirva para esa TV se comprueba durante la firma real.

## Al abrir AC TV por primera vez

Si la instalación no tiene canales guardados, la guía de inicio te da la bienvenida. Pulsa Preparar mis canales para descargar el catálogo, marca favoritos con OK y termina con Listo, ver mis canales. Puedes cancelar o hacerlo más tarde. La guía vuelve a estar disponible desde Ajustes → Guía de inicio. Una actualización conserva los canales y favoritos existentes y no fuerza a repetir estos pasos.

## Abrir un enlace propio

1. En la portada, entra en **Ajustes** (icono de engranaje).
2. En **Abrir un enlace**, introduce el enlace Ace Stream o su identificador compatible de 40 caracteres.
3. Pulsa **Reproducir**. La TV intentará conectarse con su motor integrado.
4. Pulsa **Atrás** para volver a los canales.

Se aceptan enlaces `acestream://…`, identificadores hexadecimales de 40 caracteres y el formato `https://acestreamui.app/?f=…` con ese identificador. Esta compatibilidad de formato no garantiza la disponibilidad o reproducción de cualquier emisión. No se importan archivos M3U, listas JSON de proveedores, enlaces HTTP de vídeo genéricos ni accesos Xtream Codes en esta versión.
