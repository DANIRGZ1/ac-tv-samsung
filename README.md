<p align="center"><img src="docs/images/cover.png" alt="AC TV, reproductor para Samsung Tizen" width="100%"></p>

<h1 align="center">AC TV para Samsung</h1>
<p align="center"><strong>Añade tus enlaces. Guarda tus canales. Reproduce con el mando.</strong></p>
<p align="center">Reproductor experimental para Samsung Tizen con motor P2P integrado y vídeo nativo AVPlay.</p>

<p align="center"><img alt="Versión 0.11.1" src="https://img.shields.io/badge/versi%C3%B3n-0.11.1-a0ff32?labelColor=182016"> <img alt="Tizen 6.5 base comprobada" src="https://img.shields.io/badge/Tizen-6.5_base_comprobada-91b8df?labelColor=182016"> <a href="LICENSE"><img alt="Licencia AGPL 3.0" src="https://img.shields.io/badge/licencia-AGPL--3.0-cccccc?labelColor=182016"></a></p>

<p align="center"><a href="#galería">Galería</a> · <a href="docs/INSTALL.md">Instalación</a> · <a href="docs/RESPONSIBLE_USE.md">Uso responsable</a> · <a href="CONTRIBUTING.md">Contribuir</a></p>

> **Experimental · Instalación en modo desarrollador.** La versión pública 0.11.1 se inicia vacía. No incluye catálogo de canales ni importa catálogos externos o del PC.

## Instalar con ayuda de una IA

Elige tu guía:

- **[Instalar con Codex](docs/INSTALL_WITH_CODEX.md)** — aplicación local o CLI, con instrucciones para copiar.
- **[Instalar con Claude Code](docs/INSTALL_WITH_CLAUDE.md)** — desde el ordenador conectado a la misma red que la TV.
- **[Instalación manual](docs/INSTALL.md)** — comandos del asistente de instalación.

Los tutoriales explican qué puede automatizar la IA y qué debes completar tú: activar el modo desarrollador y preparar tus certificados Samsung.

## Cómo empezar

En **Ajustes → Añadir un canal**, introduce individualmente un enlace Ace Stream compatible. Ponle el nombre que quieras y guárdalo o reprodúcelo. Los canales guardados y favoritos se buscan localmente en la TV. Las listas M3U no están implementadas.

Añade solo enlaces cuya reproducción y, cuando corresponda, redistribución estén autorizadas. Tú eres responsable de los enlaces que introduces. La app no exige casillas ni una pantalla de aceptación. Esta descripción informa del uso responsable; no verifica permisos sobre los contenidos. Consulta [Uso responsable](docs/RESPONSIBLE_USE.md). P2P puede comunicar tu dirección IP a otros pares.

## Galería

![Inicio](docs/images/home.png)

<table><tr><td width="50%"><strong>Canales</strong><br><img src="docs/images/channels.png" alt="Listado de demostración con nombres genéricos" width="100%"></td><td width="50%"><strong>Favoritos</strong><br><img src="docs/images/favorites.png" alt="Favoritos de demostración" width="100%"></td></tr><tr><td><strong>Búsqueda</strong><br><img src="docs/images/search-results.png" alt="Resultados sintéticos" width="100%"></td><td><strong>Reproducción</strong><br><img src="docs/images/loading.png" alt="Carga de canal de demostración" width="100%"></td></tr></table>

[Ver capturas y pantallas de demostración →](docs/GALLERY.md)

*Imágenes de interfaz con datos ficticios. “Fútbol1” y “Campeones1” son nombres de demostración; los identificadores sintéticos no funcionan. No representan canales ni emisiones reales.*

## Estado

La versión pública 0.11.1 se probó en escritorio. La base del motor Tizen 6.5 se comprobó previamente; eso no significa que esta versión 0.11.1 se haya instalado físicamente en un televisor. Otros modelos requieren verificación.

El proyecto es independiente, no está afiliado a Samsung, Ace Stream ni titulares de marcas. Código bajo AGPL-3.0-or-later; consulta [LICENSE](LICENSE) y avisos upstream. No se incluyen logotipos de canales ni recursos promocionales de TV de pago.

Consulta [compilación](docs/BUILD.md), [recursos](docs/ASSETS.md) y [estructura del repositorio](docs/REPOSITORY.md).

Al solicitar explícitamente la reproducción de un enlace, el motor puede consultar servicios externos de metadatos, DNS, trackers y pares para resolverlo. Esas conexiones son distintas de descargar un listado de canales; no verifican que el contenido tenga autorización y pueden comunicar la IP y el identificador del enlace a terceros.
