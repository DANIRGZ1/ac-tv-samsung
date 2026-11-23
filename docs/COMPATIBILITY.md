# Compatibilidad y ayuda

La compatibilidad se registra por modelo y por tipo de prueba. Un resultado en un modelo no implica que otros televisores Tizen se hayan probado.

## Matriz de pruebas físicas

| Modelo y software de TV | Instalación | Mando | M3U desde USB físico | P2P sostenido |
| --- | --- | --- | --- | --- |
| Samsung BU8500 2022 (`UE50BU8500KXXC`), Tizen 6.5 | Beta pública 0.15.0 instalada en la TV | Vista previa y cancelación con Atrás comprobadas. La navegación del selector USB con el mando está pendiente. | Pendiente en USB físico. En 0.13.0 se comprobó pegar texto M3U y se leyó un archivo de prueba inyectado al selector mediante el depurador; esto no verifica acceso real a una memoria USB. | No verificado en sesiones largas. En 0.15.0 el reproductor nativo inició dos veces, durante pruebas cortas, el mismo enlace en la TV de referencia. |
| Otros modelos/versiones de Samsung Tizen | Pendiente por modelo | Pendiente por modelo | Pendiente por modelo | Pendiente por modelo |

En la BU8500, los canales importados y los favoritos persistieron tras cerrar y volver a abrir la app. La prueba de P2P demuestra únicamente dos inicios breves del mismo enlace con la beta 0.15.0; no demuestra reproducción continua, estabilidad prolongada ni compatibilidad general de enlaces.

## Entornos no físicos

El navegador de escritorio y el SDK simulado sirven para comprobar la interfaz y el flujo del instalador. Son pruebas separadas de la matriz física: no demuestran instalación en un televisor, funcionamiento del mando, acceso a USB ni reproducción en una TV.

Android TV, Google TV y LG webOS quedan fuera del alcance del paquete Samsung Tizen.

## Informar de un resultado

Si la instalación falla, empieza por el [diagnóstico de conexión](INSTALL.md#2-diagnosticar-la-conexión-con-la-tv). Si llegas a reproducir vídeo, comprueba también el sonido y que la imagen ocupe la pantalla.

Comparte los resultados en [GitHub Issues](https://github.com/DANIRGZ1/ac-tv-samsung/issues/new/choose). Indica modelo comercial, versión de software de la TV, versión de AC TV y el tipo de prueba que hiciste. Omite números de serie, direcciones IP, certificados, enlaces Ace Stream y listas personales.

Para resolver fallos habituales, consulta la [guía de solución de problemas](TROUBLESHOOTING.md).

## Beta pública 0.15.1

La compilación y las pruebas automatizadas cubren el inicio con la biblioteca vacía, la importación M3U, la navegación con el mando, la reconexión y la restauración de la biblioteca. Sigue pendiente validar en la beta pública la reproducción P2P prolongada y el regreso tras apagar y encender físicamente la TV.
