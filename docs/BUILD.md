# Reconstrucción y empaquetado

La aplicación integra una interfaz Tizen, un motor P2P WebAssembly y reproducción mediante AVPlay. Los runtimes precompilados incluidos permiten empaquetar sin reconstruir Rust ni el puente Samsung.

Desde la raíz del repositorio:

```powershell
pwsh -File work/build-native-app.ps1
```

El resultado es un WGT sin firmar. Para firmar e instalar necesitas Tizen Studio, extensiones Samsung y certificados propios válidos para el televisor. No se incluyen claves ni perfiles. Consulta [Instalación](INSTALL.md).

La reconstrucción de componentes requiere Rust nightly-2026-03-15, wasm-bindgen 0.2.105 y el SDK WebAssembly de Samsung compatible con sockets Tizen. El SDK no se redistribuye. Los scripts `work/build-wire-probe.ps1` y `work/build-live-probe.ps1` describen las rutas de reconstrucción.

El código del motor conserva avisos y licencias upstream. Consulta `LICENSE`, `NOTICE.txt` y el [estado de compatibilidad](COMPATIBILITY.md).

Al solicitar explícitamente la reproducción de un enlace, el motor puede consultar servicios externos de metadatos, DNS, trackers y pares para resolverlo. Esas conexiones son distintas de descargar un listado de canales; no verifican que el contenido tenga autorización y pueden comunicar la IP y el identificador del enlace a terceros.
