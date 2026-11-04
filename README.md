# AC TV para Samsung

Reproductor experimental para televisores Samsung Tizen, con motor P2P ejecutado en la propia TV y reproducción nativa mediante AVPlay. Una vez instalada, la reproducción no necesita Ace Stream abierto en el ordenador.

![Inicio de AC TV](docs/images/home.png)

## Qué incluye

- Portada, favoritos y categorías con navegación por mando.
- Búsqueda por nombre sobre el catálogo guardado en la TV; actualización directa desde el buscador público de Ace Stream.
- Selección redondeada con animación suave y soporte de movimiento reducido.
- Logos locales para 59 variantes de canales; nombre legible cuando no hay un logo adecuado.
- Pantalla «Cargando canal…», cancelación con Atrás y recuperación automática de interrupciones.
- Nombre del canal y controles durante la reproducción. Botón amarillo para añadir o quitar favoritos, incluso mientras ves el canal.

Las capturas son vistas de la interfaz renderizada en Chromium con datos de demostración. No incluyen listas personales ni identificadores reales de contenido del usuario.

## Estado y compatibilidad

Versión 0.9.0. Comprobada en un Samsung UE50BU8500KXXC con Tizen 6.5 / Chromium 85. Otros modelos y versiones de Tizen no están verificados. Es una aplicación experimental para instalar mediante modo desarrollador; no está publicada en Samsung Apps y no es una aplicación oficial de Ace Stream, Samsung ni de las cadenas.

El catálogo y los favoritos se almacenan en la TV. No se distribuye una lista personal de canales ni enlaces de contenido. La disponibilidad de las emisiones depende de sus fuentes. El refresco del catálogo usa un servicio público que puede cambiar.

## Instalar en tu propia TV

Necesitas Tizen Studio, Samsung TV Extension, Samsung Certificate Extension y un perfil de firma propio que incluya el dispositivo de destino. Activa el modo desarrollador de la TV y conéctala con las herramientas del SDK.

```powershell
# Con los runtimes precompilados incluidos:
pwsh -File work/build-native-app.ps1
# Firma con TU perfil; no se incluyen certificados:
tizen package -t wgt -s TU_PERFIL -o work -- work/acetv-native-app
# Selecciona tu TV y usa el instalador de Tizen Studio o la CLI:
tizen install -n AceTV.wgt -t NOMBRE_DE_TU_TV -- work
```

El nombre del WGT firmado puede variar según la CLI: usa el archivo que indique `tizen package`. La instalación en otra TV requiere su certificado de distribuidor; el WGT de un desarrollador no es un instalador universal.

Documentación oficial: [CLI de Samsung](https://developer.samsung.com/smarttv/develop/getting-started/using-sdk/command-line-interface.html) y [pruebas de aplicaciones](https://developer.samsung.com/smarttv/develop/faq/application-testing.html).

## Pruebas

Node.js 22 o posterior:

```sh
npm test
npm install
# Requiere Google Chrome instalado para las pruebas visuales.
npm run test:ui
```

Las pruebas cubren búsqueda, catálogo local/directo, persistencia de favoritos, errores de almacenamiento, selección, cancelación, reintentos, pausa, congelación, callbacks antiguos, encuadre y flujo de carga. Las pruebas de navegador usan datos sintéticos y no necesitan conexiones P2P.

## Código y motor

- `work/acetv-native-app`: interfaz, catálogo, favoritos y adaptador AVPlay.
- `work/acetv-wire-wasm`: receptor de protocolo en Rust compilado a WebAssembly.
- `work/acetv-live-probe/src`: puente Worker, sockets y servidor HTTP de bucle local.
- `work/outpace-research`: fuentes upstream de Outpace conservadas para la licencia y para reconstruir el motor.
- `work/build-wire-probe.ps1`, `work/build-live-probe.ps1`: reconstrucción de componentes. Requieren Rust nightly-2026-03-15, wasm-bindgen 0.2.105 y el SDK WebAssembly de Samsung compatible con sockets Tizen. El SDK y los certificados no se redistribuyen.

Los runtimes generados incluidos permiten empaquetar la aplicación sin recompilar Rust ni el puente Samsung. Consulta [arquitectura y compilación](docs/BUILD.md).

## Licencias y recursos

Código AC TV y componentes de Outpace: **AGPL-3.0-or-later**; consulta [LICENSE](LICENSE), los avisos `NOTICE.txt` y las licencias upstream. Outpace: [jamezrin/outpace](https://github.com/jamezrin/outpace), revisión `dba774d870e08d2778748196e145455c74f22152`.

Los logos identifican a sus respectivas cadenas y pertenecen a sus titulares; no implican afiliación. Se obtuvieron de [tv-logo/tv-logos](https://github.com/tv-logo/tv-logos); procedencia individual en `work/acetv-native-app/assets/logos/SOURCES.json`. No se presentan como creación propia ni como recursos licenciados bajo AGPL. Fondos de estadio y categorías generados para este proyecto; descripción en [recursos visuales](docs/ASSETS.md).
