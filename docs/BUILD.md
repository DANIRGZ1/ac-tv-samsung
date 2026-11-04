# Reconstrucción

La aplicación usa un Worker WebAssembly para red P2P, entrega bytes al servidor HTTP de bucle local de la TV y reproduce su URL mediante AVPlay. Los mensajes técnicos se conservan en diagnósticos, no en la pantalla de carga.

Para empaquetar basta el árbol `work/acetv-native-app` y los runtimes precompilados incluidos. El script build-native-app reúne los componentes y genera un WGT sin firmar. Si se configura TIZEN_SECURITY_PROFILE, intenta firmar con la CLI local. No se incluyen claves, perfiles ni certificados personales.

Para reconstruir el motor Rust instala el toolchain nightly indicado, target wasm32-unknown-unknown y wasm-bindgen 0.2.105 en la ruta del script build-wire-probe. Ese script compila las dependencias locales de Outpace y genera el runtime `ace_wire`.

Para recompilar sockets/servidor de bucle local, instala el SDK WebAssembly de Samsung en `work/toolchain/samsung-emscripten/emscripten-release-bundle/emsdk`. La configuración Python usa rutas relativas al propio repositorio. Ejecuta build-live-probe después del motor Rust. Este SDK antiguo no forma parte del repositorio; no se afirma compatibilidad con Emscripten genérico moderno.

Firma e instalación: utiliza tus propios certificados Samsung. La identidad de ejemplo del paquete público es AcTVPublic.AceTV. No modifica firmware, no requiere root y no desactiva protecciones.

## Diagnósticos

AceTV.diagnostics() expone el estado del reproductor, el último error y el transporte. AceCatalog.diagnostics() muestra sección, cantidad de canales y favoritos. No hace falta abrir estos diagnósticos para usar la TV.

Los tests TLS de Outpace contienen certificados y una clave de prueba ya públicos en su upstream; son fixtures de pruebas, no credenciales del propietario de esta aplicación.
