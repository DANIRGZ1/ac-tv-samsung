# Compatibilidad y ayuda

| Entorno | Estado |
| --- | --- |
| Samsung BU8500 de 2022 (`UE50BU8500KXXC`, Tizen 6.5) | Instalación física de la versión pública 0.13.0 e importación M3U comprobadas con datos ficticios. |
| Otras versiones de Samsung Tizen | Pendientes de verificar por modelo y versión de software. |
| Android TV, Google TV y LG webOS | Fuera del alcance del paquete Samsung Tizen. |
| Navegador de escritorio y SDK simulado | Permiten comprobar la interfaz y el flujo del instalador. La reproducción y la instalación física requieren pruebas en un televisor. |

En la BU8500 se verificó la vista previa, la cancelación con Atrás, la importación por texto y la lectura de un archivo de prueba suministrado al selector mediante el depurador. Los canales importados y los favoritos persistieron tras cerrar y abrir la app. La navegación del selector USB con el mando y la reproducción de canales en esta versión quedan por comprobar.

Si la instalación falla, empieza por el [diagnóstico de conexión](INSTALL.md#2-diagnosticar-la-conexión-con-la-tv). Si llegas a reproducir vídeo, comprueba también el sonido y que la imagen ocupe la pantalla.

Puedes compartir el resultado en [GitHub Issues](https://github.com/DANIRGZ1/ac-tv-samsung/issues/new/choose). Indica el modelo comercial, la versión de software de la TV, la versión de AC TV y hasta qué paso llegaste. Omite números de serie, direcciones IP, certificados, enlaces Ace Stream y listas personales.

Para resolver fallos habituales, consulta la [guía de solución de problemas](TROUBLESHOOTING.md).
