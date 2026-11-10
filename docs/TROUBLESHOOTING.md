# Solución de problemas

Esta guía reúne comprobaciones breves. Para instalar desde cero, sigue la [guía de instalación](INSTALL.md); para funciones de la biblioteca, consulta [canales y favoritos](LIBRARY.md).

## El ordenador no detecta la TV

- Enciende la TV y comprueba que el modo desarrollador está activo y tiene la IP actual del ordenador.
- Conecta ambos equipos a la misma red y confirma cualquier solicitud de autorización que aparezca en la TV.
- Ejecuta el diagnóstico indicado en [Instalación: diagnosticar la conexión](INSTALL.md#2-diagnosticar-la-conexión-con-la-tv). Si falta `sdb`, instala el SDK o indica su ruta con `-SdbPath`.
- Si la conexión funciona pero falla la firma, revisa en Certificate Manager que tu perfil incluya esa TV y que los certificados sigan vigentes.

## Un canal no carga o no se oye

- La biblioteca solo guarda enlaces compatibles; guardarlo no confirma que el emisor siga disponible ni que la TV admita su formato.
- Comprueba que la TV tenga conexión de red. Si el canal no abre en un minuto, usa **Reintentar** o pulsa **Atrás** para volver a la lista. **Probar otro enlace** aparece si tienes un segundo enlace guardado con el mismo nombre.
- La reproducción inicia conexiones externas y P2P puede comunicar tu IP a otros pares. Revisa [uso responsable y privacidad](RESPONSIBLE_USE.md).
- La reproducción física de la versión pública aún no está verificada en todos los modelos. Consulta el estado por modelo en [Compatibilidad](COMPATIBILITY.md).

## La lista M3U no añade algunos canales

- AC TV importa enlaces Ace Stream compatibles desde texto o archivos `.m3u`/`.m3u8`; no importa listas IPTV o HLS genéricas.
- El límite es 2 MiB y 5000 canales. Revisa la vista previa y el recuento de entradas omitidas antes de confirmar.
- La lista se importa como una copia local. Si el archivo cambia, vuelve a importarlo; los duplicados se omiten.
- Consulta el formato y los pasos en [Importar una lista M3U](LIBRARY.md#importar-una-lista-m3u).

## El mando no responde como esperaba

- En las vistas de canales, usa las flechas para moverte, **OK** para abrir, el botón amarillo para favoritos y **CH+/CH−** para cambiar de canal.
- Durante la reproducción, **OK** pausa o reanuda y **Atrás** vuelve a los canales. El comportamiento de algunos botones puede variar según el mando y el modelo.
- La navegación del selector USB con el mando no está verificada en la TV de referencia; si falla, prueba pegar el texto M3U desde Ajustes.

## Compartir un problema sin exponer datos privados

Abre un issue desde [GitHub Issues](https://github.com/DANIRGZ1/ac-tv-samsung/issues/new/choose) e indica el modelo comercial, versión de software/Tizen, versión de AC TV, sistema operativo del ordenador si aplica y el paso en que falla. Añade pasos para reproducir y el mensaje de error después de quitar datos personales.

No publiques números de serie, DUID, direcciones IP, certificados, contraseñas, enlaces Ace Stream, listas personales ni capturas que los muestren. Para vulnerabilidades, sigue la vía privada descrita en [Seguridad](../SECURITY.md); no las reportes en un issue público.
