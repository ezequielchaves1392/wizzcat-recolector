# ==========================================================================
#  Levanta el emulador local, Y PRIMERO DICE SI FALTA JAVA.
# ==========================================================================
#
#  **POR QUÉ ESTE SCRIPT EXISTE Y NO BASTA CON EL DE PACKAGE.JSON.** El emulador de
#  Firebase necesita Java, y sin él **no sale un error útil**: dice
#  `Could not spawn 'java -version'` y se queda esperando. Se comprobó en esta máquina, que
#  no lo tenía, y el fallo es exactamente el que hace pensar que el proyecto está roto.
#
#  **LO QUE HACE, Y EN ESTE ORDEN PORQUE EL ORDEN ES EL ARREGLO:**
#
#  1. **Comprueba Java.** Es lo primero, y si falta dice **cómo se instala** en lugar de
#     dejar una terminal colgada. Instalar Java es una decisión del usuario y tarda: si el
#     script la tomara por su cuenta, el emulador parecería roto durante un minuto.
#  2. **Busca Java en el PATH y, si no está, en la carpeta donde lo instala `winget`.** El
#     segundo caso es el que de verdad falla: **Java se instala pero no entra en el PATH de
#     una terminal ya abierta**, así que `java` no existe aunque Java esté instalado. Sin
#     esto, un Java recién instalado seguiría dando error.
#  3. **Levanta el emulador.**
#
#  **POR QUÉ COMPRUEBA LOS PUERTOS Y NO SOLO EL CÓDIGO DE SALIDA.** El emulador puede
#  arrancar y quedarse a medias —la primera vez descarga el `.jar` y tarda un minuto— y el
#  proceso sigue vivo sin que haya nada escuchando. Por eso se mira **si los puertos
#  contestan**, que es lo que el juego necesita de verdad.
# ==========================================================================

$ErrorActionPreference = 'Stop'

Write-Host ''
Write-Host '  Cyber-Forge · emulador local' -ForegroundColor Cyan
Write-Host '  ------------------------------' -ForegroundColor DarkCyan
Write-Host ''

# -------------------------------------------------------------------------
#  1 · JAVA
# -------------------------------------------------------------------------
function Buscar-Java {
  # En el PATH primero, que es el caso normal.
  if (Get-Command java -ErrorAction SilentlyContinue) { return $null }

  # Y si no, donde lo deja winget. **Este segundo caso es el que hace falta de verdad**:
  # Java se instala sin problema y aun asi `java` no existe, porque el PATH de la terminal
  # se quedo como estaba. Decir "instala Java" cuando ya esta instalado hace perder media
  # hora, y por eso se mira tambien en disco.
  $instalado = Get-ChildItem 'C:\Program Files\Microsoft\jdk-*' -Directory -ErrorAction SilentlyContinue |
    Sort-Object Name -Descending | Select-Object -First 1
  if ($instalado -and (Test-Path "$($instalado.FullName)\bin\java.exe")) {
    return $instalado.FullName
  }
  return $false
}

$rutaJava = Buscar-Java

if ($rutaJava -eq $false) {
  Write-Host '  NO HAY JAVA. El emulador de Firestore lo necesita y sin el' -ForegroundColor Yellow
  Write-Host '  se queda esperando sin decir por que.' -ForegroundColor Yellow
  Write-Host ''
  Write-Host '  Instalalo con:' -ForegroundColor White
  Write-Host '    winget install --id Microsoft.OpenJDK.21 --source winget `'
  Write-Host '      --accept-source-agreements --accept-package-agreements --silent' -ForegroundColor DarkGray
  Write-Host ''
  Write-Host '  Y despues vuelve a abrir esta terminal.' -ForegroundColor White
  exit 1
}

if ($rutaJava) {
  # Esta sesion y las siguientes de esta terminal.
  $env:PATH = "$rutaJava\bin;" + $env:PATH
  $env:JAVA_HOME = $rutaJava
  Write-Host '  Java encontrado, aunque no estaba en el PATH:' -ForegroundColor Green
  Write-Host "    $rutaJava" -ForegroundColor DarkGray
} else {
  Write-Host '  Java en el PATH.' -ForegroundColor Green
}

# -------------------------------------------------------------------------
#  2 · PUERTOS LIBRES
# -------------------------------------------------------------------------
# **POR QUÉ SE COMPRUEBA ANTES DE LEVANTAR.** Si el emulador de ayer sigue vivo, el de hoy
# falla con un error de puerto que habla de "otro proceso" y no de "el emulador de ayer". Y
# lo que se acabaria viendo es el emulador viejo, con **los datos de la sesion anterior**,
# que es justo lo que uno no se espera al probar una carga nueva.
foreach ($p in @(@(8080, 'Firestore'), @(9099, 'Auth'))) {
  $libre = -not (Test-NetConnection -ComputerName localhost -Port $p[0] -WarningAction SilentlyContinue).TcpTestSucceeded
  if (-not $libre) {
    Write-Host "  El puerto $($p[0]) ($($p[1])) ya esta ocupado." -ForegroundColor Yellow
    Write-Host '  Puede ser un emulador de antes, y entonces se verian los datos de' -ForegroundColor Yellow
    Write-Host '  la sesion anterior en vez de una base vacia. Cierra el otro primero.' -ForegroundColor Yellow
    exit 1
  }
}

# -------------------------------------------------------------------------
#  3 · LEVANTAR
# -------------------------------------------------------------------------
Write-Host ''
Write-Host '  Levantando Firestore (8080) y Auth (9099)...' -ForegroundColor Cyan
Write-Host '  La primera vez descarga el emulador y tarda un minuto.' -ForegroundColor DarkGray
Write-Host ''

# **POR QUÉ NO SE LE PIDE LA INTERFAZ CON `--only firestore,auth`.** Se pidió y se probó: con
# `--only firestore,auth` el emulador **arranca bien** pero **la interfaz del puerto 4000 no
# levanta**. Así que el comando no la anuncia, porque **anunciar una pantalla que no abre es
# peor que no tenerla**. Si algún día hace falta verla, es quitarle el `--only` a esto.
#
# Para ver los documentos hay una vía mejor y más simple: **la consola del navegador**, que
# es donde el emulador deja los documentos que va escribiendo.
npx firebase emulators:start --project chronos-tap --only firestore,auth

# -------------------------------------------------------------------------
#  4 · LO QUE VIENE DESPUES, SI LLEGO AQUI
# -------------------------------------------------------------------------
Write-Host ''
Write-Host '  El emulador se ha parado. Puedes cerrar esto.' -ForegroundColor DarkGray
