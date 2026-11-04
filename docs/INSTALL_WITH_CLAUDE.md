# Instalar con Claude Code

Esta guía usa Claude Code ejecutándose en tu ordenador para trabajar sobre el repositorio local. Claude en la nube, por sí solo, no puede acceder a tu red local ni instalar una app en la TV. El ordenador y el televisor deben estar en la misma red.

Necesitas el SDK de Samsung/Tizen, PowerShell 7, el modo desarrollador de la TV y un perfil de firma propio que autorice esa TV. Claude Code puede guiarte; completa personalmente el inicio de sesión de Samsung y la autorización del certificado.

## 1. Preparar la TV y el PC

1. En la TV, activa **Developer Mode** y añade la IP del ordenador. En muchos modelos está en **Apps → Settings**: pulsa `12345` con el mando y activa Developer Mode. La ubicación puede variar.
2. Instala Samsung TV Extension/SDK y PowerShell 7 en el PC. En Certificate Manager, crea tu perfil de firma e incluye el certificado de tu televisor. Completa tú mismo las confirmaciones de navegador y de la TV.
3. Anota la IP de la TV (`TV_IP`) y el nombre exacto del perfil (`MI_PERFIL`). No compartas contraseñas, certificados o claves privadas con Claude Code ni los subas a GitHub.

## 2. Instalar Claude Code y clonar el repositorio

En PowerShell, instala Claude Code con el método oficial de Windows y comprueba que se inicia:

```powershell
winget install Anthropic.ClaudeCode
claude --version
```

Clona el proyecto y entra en su carpeta:

```powershell
git clone https://github.com/DANIRGZ1/ac-tv-samsung.git
cd ac-tv-samsung
claude
```

La primera vez, Claude Code te pedirá iniciar sesión mediante el navegador. Hazlo tú y revisa los permisos que solicite. Consulta la [guía oficial de inicio rápido de Claude Code](https://code.claude.com/docs/en/quickstart).

## 3. Fase de diagnóstico

Sustituye los valores y pega este prompt en Claude Code. En esta fase se permite solo el diagnóstico local; el script no conecta con la TV, no firma ni instala.

```text
Trabaja en este repositorio local de ac-tv-samsung. Quiero instalar la app incluida en mi televisor Samsung Tizen, conectado a la misma red local que este PC.

Valores: TV_IP=192.168.1.42; MI_PERFIL=MiPerfilTV

Primero, inspecciona docs/INSTALL.md y scripts/install-tv.ps1. Confirma los requisitos y dime qué comandos ejecutarías. Puedes ejecutar únicamente el diagnóstico predeterminado:
pwsh -File ./scripts/install-tv.ps1 -TvIp 192.168.1.42 -SecurityProfile MiPerfilTV

No uses -Install ni -Launch en esta fase. No cambies archivos, certificados, configuración de la TV ni otras aplicaciones. Si falta algo o el diagnóstico falla, explica cómo resolverlo y espera.
```

## 4. Autorizar la instalación expresamente

Revisa el resultado. Si todo está listo, envía un segundo mensaje como este para autorizar el cambio de red e instalación:

```text
Autorizo ahora la instalación de la app incluida en este repositorio en la TV 192.168.1.42 con mi perfil existente MiPerfilTV. Ejecuta exactamente:
pwsh -File ./scripts/install-tv.ps1 -TvIp 192.168.1.42 -SecurityProfile MiPerfilTV -Install -Launch
Antes de ejecutarlo, confirma que el comando instala la app pública AcTVPublic.AceTV. No desinstales apps, no borres datos ni favoritos y no modifiques firmware o ajustes de la TV. Si pide una contraseña, certificado o confirmación de confianza, detente y deja que yo lo gestione localmente.
```

El parámetro `-Install` firma e instala la app incluida con tu perfil; `-Launch` la abre al terminar. El instalador no desinstala aplicaciones ni borra preferencias. El proceso no es completamente automático: la preparación de herramientas, el perfil, la autorización de la TV y posibles diálogos dependen de ti.

## 5. Primer uso y ayuda

La app empieza sin canales. Añade solo enlaces de contenido que tengas autorización para usar. Consulta [Instalación y primer uso](INSTALL.md) y [Uso responsable](RESPONSIBLE_USE.md).

La versión pública no se ha verificado instalada en una TV real. Para errores de firma o conexión, revisa [INSTALL.md](INSTALL.md) y la [documentación oficial de Samsung sobre conexión de la TV](https://developer.samsung.com/smarttv/develop/getting-started/using-sdk/tv-device.html).
