# /dev — Levantar un entorno de pruebas que NO gasta cuota

Levanta el juego contra el **emulador local de Firestore y Auth**, para que probar
cualquier cosa **no escriba en el proyecto de producción**.

Esto no es comodidad. La cuota de Firestore del plan Spark es de **20.000 escrituras al
día para el proyecto entero**, y `npm run dev` a secas escribe **en producción**: cada
recarga son **5 escrituras**, más unas **165 por hora** con la pestaña abierta. Con tres
personas jugando, eso no es un extra: es lo que agotó el presupuesto y dejó el juego sin
poder guardar. Ver B31 en `docs/PENDIENTES.md`.

---

## Qué hace este comando

1. **Comprueba que Java está.** Sin ella el emulador no arranca y el error
   (`Could not spawn java -version`) no dice qué hacer. Se comprueba **antes** de nada
   para no dejar una terminal colgada.
2. **Levanta los emuladores** de Firestore (8080) y Auth (9099).
3. **Arranca el juego** con `VITE_EMULADOR=1`, que es lo que hace que `src/firebase.ts`
   apunte al emulador.
4. **Dice en qué terminal estás y qué hacer después**, que es el paso que más se olvida.

---

## Requisitos

**Java 21.** Se instaló con:

```
winget install --id Microsoft.OpenJDK.21 --source winget --accept-source-agreements --accept-package-agreements --silent
```

**Ojo con el PATH:** Java se instala en `C:\Program Files\Microsoft\jdk-21.0.12.101-hotspot\bin`
y **no siempre entra en el PATH de una terminal ya abierta**. Si el emulador se queja de
Java, o cierra el emulador y vuelve a abrirlo, o añade esa carpeta al PATH:

```powershell
$env:PATH = "C:\Program Files\Microsoft\jdk-21.0.12.101-hotspot\bin;" + $env:PATH
```

---

## Los dos terminals

El emulador **ocupa la terminal**, así que hacen falta dos. El comando deja claro cuál es
cuál.

**Terminal 1 — el emulador:**

```
npm run dev:emulador
```

Debe salir `All emulators ready!` y quedarse writing. **Ese terminal no se toca.**

**Terminal 2 — el juego:**

```
$env:VITE_EMULADOR="1"; npm run dev
```

Y se abre `http://localhost:5173`. La consola del navegador dirá:

```
[firebase] Emulador de Firestore conectado en 127.0.0.1:8080. Los datos NO se guardan.
```

**Si ese mensaje no sale, no estás contra el emulador.** Significa que estás escribiendo en
producción **y gastando cuota sin saberlo**. Para volver a producción, abre una terminal
**sin** la variable.

---

## Lo que cambia dentro del juego

- **Las cuentas son del emulador, no reales.** Se puede entrar con
  cualquier correo inventado: `prueba@local.test` / `123456`. Se crea al instante y solo
  existe en tu máquina.
- **La base de datos empieza vacía.** No hay partida anterior. Se empieza de cero, que para
  probar el arranque es lo que se quiere; para probar algo con partida, hay que crearla en
  el emulador.
- **No hay interfaz web del emulador.** Se probó y **con `--only firestore,auth` el puerto
  4000 no levanta**, así que el comando no la anuncia. Para ver los documentos, la consola
  del navegador.

---

## Por qué el emulador está detrás de una variable y no siempre

`src/firebase.ts` solo conecta el emulador si se cumple **lo dos**:

1. `import.meta.env.DEV` — **solo en desarrollo**. Un build de producción **jamás** habla con
   el emulador, ni aunque la variable esté puesta. Eso está comprobado: el bundle de
   producción no contiene ni el aviso ni los puertos.
2. `VITE_EMULADOR === '1'` — hay que **pedirlo a mano**. Sin esto, cualquier `npm run dev`
   apuntaría al cubo y no se podría probar contra el proyecto real.

**Y Auth va conectado también, no solo Firestore.** El juego entra con correo y contraseña,
así que si solo se conectara Firestore se entraría con la cuenta de verdad y se guardaría en
el cubo: **dos bases de datos mezcladas**, que es peor que no tener emulador.

---

## Cuando el emulador no hace falta

Para tocar la interfaz, el layout, los textos o una vista, **`npm run dev` a secas es
suficiente y más rápido**. El emulador solo hace falta cuando lo que se prueba **guarda**:
el arranque, la carga de la partida, el guardado, las compras. Sin emulador, todo eso
funciona igual **pero escribe en producción**.
