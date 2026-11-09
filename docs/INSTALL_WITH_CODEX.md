# Instalar con Codex

Esta guía usa Codex para trabajar sobre el repositorio en tu ordenador. El chat en la nube, por sí solo, no puede acceder a la red local de tu casa ni instalar una app en la TV. El ordenador y el televisor deben estar en la misma red.

La instalación necesita herramientas del SDK de Samsung/Tizen, PowerShell 7, el modo desarrollador de la TV y un perfil de firma propio que autorice esa TV. Codex puede guiarte; completa personalmente el inicio de sesión de Samsung y la autorización del certificado.

## 1. Preparar el televisor y el ordenador

1. En la TV, activa **Developer Mode** y añade la dirección IP del ordenador. En muchos modelos se encuentra en **Apps → Settings**: pulsa `12345` con el mando y activa Developer Mode. Los menús varían según modelo.
2. En el PC, instala Samsung TV Extension/SDK y PowerShell 7. Crea en Certificate Manager tu perfil de firma e incluye el certificado del televisor. Completa tú mismo los inicios de sesión y confirmaciones del navegador y de la TV.
3. Anota la IP de la TV (`TV_IP`) y el nombre exacto de tu perfil de firma (`MI_PERFIL`). No compartas contraseñas, certificados ni claves privadas con Codex ni los subas a GitHub.

## 2. Clonar y abrir el proyecto local

En PowerShell 7:

```powershell
git clone https://github.com/DANIRGZ1/ac-tv-samsung.git
cd ac-tv-samsung
```

Si aún no tienes la aplicación local, sigue el [inicio oficial de OpenAI](https://learn.chatgpt.com/docs/quickstart), instala la aplicación e inicia sesión. Selecciona Codex y abre la carpeta clonada en tu ordenador. También puedes usar Codex CLI desde la carpeta del proyecto ejecutando `codex`; consulta la [guía oficial de Codex CLI](https://learn.chatgpt.com/docs/cli). La aplicación Codex puede trabajar con una [carpeta local](https://learn.chatgpt.com/docs/quickstart).

## 3. Primero pide solo un diagnóstico

Pega este texto en Codex y sustituye los dos valores. Esta fase comprueba el ordenador y prueba la conexión con la TV indicada.

```text
Trabaja en este repositorio local de ac-tv-samsung. Quiero instalar la app incluida en mi televisor Samsung Tizen, que está en la misma red local que este PC.

Valores: TV_IP=192.168.1.42; MI_PERFIL=MiPerfilTV

Primero, inspecciona docs/INSTALL.md y scripts/install-tv.ps1. Puedes ejecutar únicamente estos dos comandos:
pwsh -File ./scripts/install-tv.ps1 -TvIp 192.168.1.42 -SecurityProfile MiPerfilTV -CheckOnly
pwsh -File ./scripts/install-tv.ps1 -TvIp 192.168.1.42 -Diagnose

No uses -Install ni -Launch en esta fase. No cambies archivos, certificados, configuración de la TV ni otras aplicaciones. Si falta algo o el diagnóstico falla, explica cómo resolverlo y espera.
```

`-CheckOnly` comprueba el entorno local. `-Diagnose` usa `sdb` para comprobar que la TV está accesible. Para los errores más habituales, consulta la [guía de instalación](INSTALL.md).

## 4. Revisar y autorizar la instalación

Cuando hayas revisado el diagnóstico, confirma en el propio Codex que quieres seguir. Por ejemplo:

```text
Autorizo ahora la instalación de la app incluida en este repositorio en la TV 192.168.1.42 con mi perfil existente MiPerfilTV. Ejecuta exactamente:
pwsh -File ./scripts/install-tv.ps1 -TvIp 192.168.1.42 -SecurityProfile MiPerfilTV -Install -Launch
Antes de ejecutarlo, confirma que este comando instala la app pública AcTVPublic.AceTV. No desinstales apps, no borres datos ni favoritos y no modifiques firmware o ajustes de la TV. Si pide una contraseña, certificado o confirmación de confianza, detente y deja que yo lo gestione localmente.
```

`-Install` firma la app incluida con el perfil indicado y la instala en la TV; `-Launch` la abre al terminar. El script no desinstala aplicaciones ni borra preferencias. No es una instalación completamente automática: el SDK, el perfil, el permiso del televisor y posibles diálogos requieren tu intervención.

## 5. Después

La app empieza sin canales. Añade únicamente enlaces de contenido que tengas autorización para usar. Consulta [Instalación y primer uso](INSTALL.md) y [Uso responsable](RESPONSIBLE_USE.md).

La instalación física de la versión pública no se ha verificado en una TV real. Si hay errores de conexión o firma, revisa [INSTALL.md](INSTALL.md) y la [guía oficial de conexión de Samsung](https://developer.samsung.com/smarttv/develop/getting-started/using-sdk/tv-device.html).
