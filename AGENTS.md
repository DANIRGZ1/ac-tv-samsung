# Trabajar en AC TV para Samsung

- Este repositorio contiene la app pública `AcTVPublic.AceTV`. Conserva el ID y el inicio sin canales. Usa nombres e identificadores ficticios para pruebas y capturas.
- Mantén la base de Tizen 6.5 y Chromium 85. La reproducción usa AVPlay y el motor integrado. El ordenador interviene en la instalación, el desarrollo y las pruebas de escritorio.
- Para ayudar con una instalación, sigue [la guía](docs/INSTALL.md). Comprueba el entorno con `-CheckOnly`. Usa `-Diagnose` solo contra la dirección indicada por el usuario cuando solicite una prueba de conexión. Ejecuta `-Install` únicamente si el usuario ha solicitado instalar la app en esa TV.
- Deja que el usuario gestione localmente las credenciales, los certificados y las autorizaciones de la TV. Mantén fuera del repositorio los enlaces privados, los certificados y los datos personales.
- Ejecuta `npm test` para cambios de lógica, `npm run test:ui` para cambios de interfaz y `npm run test:installer` para cambios del instalador. Distingue las pruebas simuladas de las realizadas en un televisor.
