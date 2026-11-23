<p align="center"><img src="docs/images/readme-cover.jpg" alt="AC TV para Samsung Tizen" width="100%"></p>

<h1 align="center">AC TV para Samsung</h1>
<p align="center">Reproduce tus enlaces Ace Stream, importa listas M3U y navega con el mando de la tele.</p>

<p align="center">
  <img alt="Versión pública 0.15.1" src="https://img.shields.io/badge/beta-0.15.1-A0FF32?labelColor=182016">
  <img alt="Samsung Tizen" src="https://img.shields.io/badge/Samsung-Tizen-687665?labelColor=182016">
  <a href="LICENSE"><img alt="Licencia AGPL 3.0" src="https://img.shields.io/badge/licencia-AGPL--3.0-CCCCCC?labelColor=182016"></a>
</p>

<p align="center"><a href="#instalación">Instalación</a> · <a href="#galería">Galería</a> · <a href="#preguntas-frecuentes">Preguntas frecuentes</a> · <a href="docs/COMPATIBILITY.md">Compatibilidad y ayuda</a></p>

> **Instalación en modo desarrollador.** AC TV se instala desde este repositorio con el SDK y un perfil de firma de Samsung. Al abrirla por primera vez, la biblioteca está vacía.

## Qué puedes hacer

| Listas M3U | Conexión en directo | Copia de biblioteca |
| :--- | :--- | :--- |
| Importa tus enlaces Ace Stream, búscalos por nombre y guarda tus favoritos. | Consulta el progreso al abrir un canal. Si falla una fuente, AC TV puede probar otro enlace guardado. | Guarda una copia local al actualizar. Puedes restaurarla y deshacer la restauración. |

[Leer la guía de canales y favoritos](docs/LIBRARY.md)

## Galería

<table>
  <tr>
    <th width="50%">Explora tus canales</th>
    <th width="50%">Abriendo canal</th>
  </tr>
  <tr>
    <td><a href="docs/images/readme-home.jpg"><img src="docs/images/readme-home.jpg" alt="Inicio de AC TV con favoritos y categorías" width="100%"></a></td>
    <td><a href="docs/images/readme-loading.jpg"><img src="docs/images/readme-loading.jpg" alt="Pantalla de carga con el mensaje Buscando conexiones P2P" width="100%"></a></td>
  </tr>
</table>

*Capturas de la interfaz con canales ficticios. El progreso de conexión está simulado.* [Ver todas las pantallas](docs/GALLERY.md)

## Instalación

1. **Prepara la TV y el ordenador.** Activa el modo desarrollador, conecta ambos a la misma red y prepara un perfil de firma Samsung válido para tu televisor.
2. **Comprueba la conexión e instala.** El instalador separa el diagnóstico con `-Diagnose` de la firma e instalación.
3. **Crea tu biblioteca.** En la TV, abre **Ajustes** para añadir un canal o importar una lista M3U de enlaces Ace Stream.

| Elige cómo instalar | |
| --- | --- |
| **Con Codex** | [Tutorial con instrucciones para copiar](docs/INSTALL_WITH_CODEX.md) |
| **Con Claude Code** | [Tutorial desde el ordenador de tu red local](docs/INSTALL_WITH_CLAUDE.md) |
| **Manual** | [Requisitos, diagnóstico y comandos](docs/INSTALL.md) |

## Prueba la beta

Comprueba si puedes instalar, importar una lista M3U de prueba y navegar con el mando. Si pruebas la reproducción, usa un enlace autorizado y comprueba la imagen, el sonido y la opción de volver al catálogo con **Atrás**. Comparte el modelo, la versión de software y el paso que has podido comprobar. [Plantilla de compatibilidad](.github/ISSUE_TEMPLATE/compatibilidad.md) · [Resultados verificados](docs/COMPATIBILITY.md)

## Preguntas frecuentes

**¿Está en la tienda Samsung?** La instalación pública se hace en modo desarrollador. [Ver la guía](docs/INSTALL.md)

**¿Tengo que dejar el PC encendido?** El ordenador se usa para instalar. El motor de reproducción funciona en la TV.

**¿Qué listas M3U admite?** Puedes pegar el texto o seleccionar un archivo `.m3u` o `.m3u8`. Se añaden las entradas Ace Stream compatibles, se omiten los duplicados y los enlaces IPTV o HLS genéricos, y se conservan tus favoritos. [Cómo importar una lista](docs/LIBRARY.md#importar-una-lista-m3u)

**¿Qué modelos están comprobados?** La Samsung BU8500 de 2022 es el modelo de referencia. Las pruebas se detallan por versión. [Consultar compatibilidad o compartir una prueba](docs/COMPATIBILITY.md)

## Uso responsable y código

Añade únicamente contenido cuya reproducción y, cuando corresponda, redistribución estén autorizadas. Tú eres responsable de los enlaces que utilizas. Al reproducir, el motor puede consultar metadatos, DNS, trackers y pares. P2P puede compartir tu dirección IP y el identificador del enlace con terceros. [Uso responsable](docs/RESPONSIBLE_USE.md)

AC TV es un proyecto independiente publicado bajo AGPL-3.0-or-later. [Licencia](LICENSE) · [Compilación](docs/BUILD.md) · [Cómo contribuir](CONTRIBUTING.md)

| Si buscas… | Dónde mirar |
| --- | --- |
| Cambios entre versiones | [Historial](CHANGELOG.md) |
| Ayuda con la instalación, M3U o el mando | [Solución de problemas](docs/TROUBLESHOOTING.md) |
| Cómo reportar un fallo de seguridad | [Política de seguridad](SECURITY.md) |
