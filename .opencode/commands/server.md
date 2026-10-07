---
description: Levanta el servidor de pruebas (vite) en segundo plano y abre la pantalla pedida
---

Levanta el servidor de pruebas.

Pantalla o ruta pedida: **$ARGUMENTS**
(si viene vacía, `index.html`)

Procedimiento:

1. **Mira si ya está levantado** antes de arrancar nada:

   ```powershell
   Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue
   ```

   Si hay algo escuchando, **no arranques un segundo servidor**: usa el que ya
   está y ve al paso 4.

2. **Arranca en segundo plano**, nunca en primer plano (bloquea la sesión):

   ```
   npm run dev
   ```

   con `background: true`. Espera a que imprima el puerto.

3. **Confirma que responde** antes de decir nada:

   ```powershell
   (Invoke-WebRequest -Uri "http://localhost:5173/" -UseBasicParsing).StatusCode
   ```

   Un `200` es lo único que cuenta. Si falla, lee el error del servidor y
   repórtalo tal cual: no digas "listo" con el servidor caído.

4. **Abre la pantalla pedida** en el navegador, según lo que haya pedido el
   jugador:

   | Lo que pide | URL |
   |---|---|
   | El juego | `http://localhost:5173/` |
   | Una vista con datos de ejemplo | `http://localhost:5173/preview.html?vista=<vista>&w=390&h=844` |
   | La pantalla de acceso | `http://localhost:5173/auth-preview.html` |
   | El recorrido de navegación | `http://localhost:5173/nav-test.html` |
   | El arrastre | `http://localhost:5173/drag-test.html?caso=<n>` |
   | La ruleta suelta | `http://localhost:5173/ruleta-preview.html` |
   | El panel de admin | `http://localhost:5173/admin.html` |

   Usa `browser.tabs.open` y **apúntalo al tab** que devuelva.

5. **No lances tests.** Esto es solo levantar y mirar. Si además quiere la línea
   base, se pide aparte (`npm run build` + `npm run verify`).

Notas:

- El servidor se queda vivo entre mensajes. Para pararlo, `Get-Process node |
  Where-Object { $_.Id -ne $PID }` y matar el proceso, o reiniciar la sesión.
- Si el puerto 5173 está ocupado por otra cosa (no es vite), dilo y usa
  `npm run dev -- --port 5174`.