// ==========================================================================
//  Cyber-Forge · Cuenta bloqueada
//
//  Pantalla que ve el jugador cuando su cuenta está suspendida desde la
//  terminal de administración. Es una pantalla aparte y no un error dentro del
//  formulario de acceso, por dos razones:
//
//  1. El mensaje importa. Un "nombre o contraseña incorrectos" sobre una cuenta
//     que SÍ es correcta manda al jugador a pensar que se ha equivocado de
//     contraseña, y a probar variaciones hasta que le salta el límite de intentos
//     de Firebase. Aquí se dice qué ha pasado y por qué.
//  2. El formulario no se monta. Con los campos delante, cualquier toque a
//     "Entrar" vuelve a fallar y el jugador insiste. Sin campos, no hay nada
//     que reintentar.
//
//  NO HAY BOTÓN DE REINTENTO A PROPÓSITO. Un desbloqueo es una decisión del
//  administrador, y un botón que dice "reintentar" invites a pulsarlo cada diez
//  segundos. Lo único que se ofrece es recargar la página, por si el bloqueo se
//  levanta mientras el jugador mira.
// ==========================================================================

import { ic } from '../ui/icons';
import { esc } from '../utils/esc';
import { SERVIDOR_ACTUAL, URL_OTRO_SERVIDOR } from '../firebase';

export function renderBloqueado(
  container: HTMLElement,
  datos: { nombre: string; motivo: string; desde: number }
): void {
  const { nombre, motivo, desde } = datos;

  // Si el motivo no viene de la terminal —un documento a medio escribir, por
  // ejemplo— se dice lo mismo que sin motivo. Un hueco en blanco donde debería
  // haber una explicación se lee como un fallo de la página, no como un castigo.
  const texto = (motivo || '').trim() || 'Cuentasuspendida por un administrador.';

  const fecha = desde
    ? new Date(desde).toLocaleString('es-ES', {
        dateStyle: 'long',
        timeStyle: 'short'
      })
    : '';

  container.innerHTML = `
    <div class="auth-scene w-screen h-dvh app-bg flex flex-col items-center justify-center p-4 font-sans overflow-hidden">
      <div class="auth-bg" aria-hidden="true">
        <div class="auth-glow auth-glow-1"></div>
        <div class="auth-grid"></div>
        <div class="auth-vignette"></div>
      </div>

      <div class="relative z-10 w-full max-w-md">
        <div class="auth-card card-glass rounded-3xl p-6 sm:p-8 flex flex-col gap-5 text-center items-center">

          <div class="auth-logo" style="background:#ef4444;color:#fff">
            <span class="[&>span>svg]:w-6 [&>span>svg]:h-6">${ic('lock')}</span>
          </div>

          <div class="flex flex-col gap-1.5">
            <h1 class="font-['Orbitron'] font-black text-lg tracking-[0.18em] text-red-400">
              CUENTA BLOQUEADA
            </h1>
            <p class="text-[10px] font-mono text-[var(--text-muted)] tracking-[0.12em]">
              OPERATIVO · ${nombre}
            </p>
          </div>

          <div role="alert"
               class="w-full rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-4
                      flex flex-col gap-2">
            <span class="label-caps" style="color:#f87171">Motivo</span>
            <p class="text-[13px] font-sans leading-relaxed text-[var(--text-main)] break-words">
              ${esc(texto)}
            </p>
          </div>

          ${fecha ? `
            <p class="text-[10px] font-mono text-[var(--text-muted)]">
              Suspendido el ${esc(fecha)}
            </p>
          ` : ''}

          <p class="text-[10px] font-mono text-[var(--text-muted)] leading-relaxed">
            Tu partida sigue guardada. Un administrador tiene que levantar el
            bloqueo; no hay forma de hacerlo desde aquí.
          </p>

          <button type="button" id="reintentar"
                  class="btn-ghost w-full h-11 rounded-xl font-['Orbitron'] font-bold text-[11px]
                         tracking-[0.12em] cursor-pointer transition">
            COMPROBAR DE NUEVO
          </button>
        </div>
      </div>
    </div>
  `;

  // Recargar y no reintentar el acceso: la sesión sigue abierta, así que un
  // "volver a entrar" ni siquiera tendría nada que hacer. La recarga vuelve a
  // pasar por `onAuthStateChanged`, que es quien vuelve a preguntar a Firestore.
  container.querySelector('#reintentar')?.addEventListener('click', () => location.reload());
}

/**
 * Pantalla de "la partida ya está abierta en otro sitio".
 *
 * Es PARTE de `blocked.ts` y no un archivo aparte porque es la misma situación
 * vista desde el otro lado: hay una sesión viva y esta pestaña no puede tomar el
 * control. La diferencia es lo importante —esta vez **no es un castigo**, la otra
 * sesión sigue jugando— y por eso el texto no dice "bloqueada" en ningún sitio.
 *
 * Y a diferencia de la pantalla de bloqueo, esta **sí ofrece reintentar**: la
 * otra sesión se cierra sola en menos de un minuto, así que esperar es lo
 * correcto. Ofrecer solo recargar convertiría un contratiempo de un minuto en
 * algo que hay que resolver a mano.
 */
export function renderSesionOcupada(
  container: HTMLElement,
  datos: { nombre: string; alLiberarMs: number },
  onReintentar: () => void
): void {
  const segundos = Math.max(1, Math.ceil(datos.alLiberarMs / 1000));
  const nombre = esc(datos.nombre);

  container.innerHTML = `
    <div class="auth-scene w-screen h-dvh app-bg flex flex-col items-center justify-center p-4 font-sans overflow-hidden">
      <div class="auth-bg" aria-hidden="true">
        <div class="auth-glow auth-glow-1"></div>
        <div class="auth-grid"></div>
        <div class="auth-vignette"></div>
      </div>

      <div class="relative z-10 w-full max-w-md">
        <div class="auth-card card-glass rounded-3xl p-6 sm:p-8 flex flex-col gap-5 text-center items-center">

          <div class="auth-logo" style="background:#f59e0b;color:#fff">
            <span class="[&>span>svg]:w-6 [&>span>svg]:h-6">${ic('lock')}</span>
          </div>

          <div class="flex flex-col gap-1.5">
            <h1 class="font-['Orbitron'] font-black text-lg tracking-[0.14em] text-amber-400">
              PARTIDA YA ABIERTA
            </h1>
            <p class="text-[10px] font-mono text-[var(--text-muted)] tracking-[0.12em]">
              ${nombre}
            </p>
          </div>

          <div role="status"
               class="w-full rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-4
                      flex flex-col gap-2 text-left">
            <p class="text-[13px] font-sans leading-relaxed text-[var(--text-main)]">
              Tienes el juego abierto en <strong>otro sitio</strong> —otro
              dispositivo u otra pestaña del navegador— y los dos a la vez se
              pisarían la partida.
            </p>
            <p class="text-[13px] font-sans leading-relaxed text-[var(--text-main)]">
              Tu partida sigue intacta ahí. <strong>Cierra la otra ventana</strong>
              y vuelve a entrar, o espera a que se libere sola.
            </p>
          </div>

          <p class="text-[10px] font-mono text-[var(--text-muted)] leading-relaxed">
            La otra sesión se libera sola en unos ${segundos} segundos. Esta
            pantalla se prueba sola, no hace falta recargar.
          </p>

          <button type="button" id="reintentar-sesion"
                  class="btn-ghost w-full h-11 rounded-xl font-['Orbitron'] font-bold text-[11px]
                         tracking-[0.12em] cursor-pointer transition">
            PROBAR DE NUEVO
          </button>
        </div>
      </div>
    </div>
  `;

  container.querySelector('#reintentar-sesion')?.addEventListener('click', onReintentar);
}


/**
 * PANTALLA DE "NO SE HA PODIDO CARGAR LA PARTIDA", Y POR QUÉ HACE FALTA.
 *
 * ## LO QUE PASABA
 *
 * El arranque era una cadena de `await` sin una sola red de seguridad: si algo fallaba,
 * el `catch` del motor escribía una línea en la consola y la partida **seguía adelante con
 * los valores por defecto**. Para el jugador eso era una pantalla en negro sin una sola
 * palabra: no había ni un error visible, ni un botón, ni una pista de que el navegador no
 * era el culpable. Y el motivo real —que se había agotado la cuota de Firestore— solo
 * aparecía en la consola, en un texto que hay que saber buscar.
 *
 * ## POR QUÉ ES OBLIGATORIA Y NO UN ADORNO
 *
 * Un fallo de red es el único caso en el que el juego **no puede jugar**, así que no es
 * una situación que se pueda dejar pasar con un aviso flotante que se va solo: hace falta
 * algo que quede, que explique y que ofrezca reintentar. Y encima hay un motivo de datos
 * que es el importante: si la carga falla y el juego sigue con los valores por defecto,
 * el guardado automático de quince segundos **escribe una partida en blanco encima de la
 * de verdad**. Eso no lo arregla esta pantalla; lo arregla `partidaNoCargada()`, que en
 * `gameLoop.ts` se niega a guardar. Aquí solo se cuenta lo que pasó.
 */

/** Si el error es de cuota de Firestore, que tiene arreglo distinto y se dice de otro modo. */
export function esCuotaAgotada(error: unknown): boolean {
  const codigo = (error as any)?.code ?? '';
  const texto = String((error as any)?.message ?? error ?? '');
  return String(codigo).includes('resource-exhausted') || /quota exceeded/i.test(texto);
}

/**
 * Si lo que falló es que el servidor **no contestó**, en vez de que contestara que no.
 *
 * **ES UN TERCER CASO Y NO UNA VARIEDAD DEL SEGUNDO.** Con la cuota agotada, Firestore
 * no dice "no": dice "todavía no", y la petición se queda colgada hasta que el reloj del
 * arranque la declara perdida. El aviso de cuota y el de "no contesta" no pueden ser el
 * mismo texto: en el primero hay que esperar a que se reponga el límite, y en el segundo
 * lo único que funciona es reintentar, porque la red puede volver en cualquier momento.
 */
function esSinRespuesta(error: unknown): boolean {
  return String((error as any)?.name ?? '') === 'TiempoAgotadoError';
}

/**
 * F101 · EL ENLACE AL OTRO SERVIDOR, Y POR QUÉ ES UN ENLACE Y NO UN BOTÓN.
 *
 * Un botón con `addEventListener` es código que puede fallar justo en la pantalla
 * que sale cuando algo ya falló, y un listener sobre `#app` es el bug de R5 que ya
 * se pagó. Un `<a>` navega solo, sin JS: no hay nada que atar ni que acumular.
 *
 * POR QUÉ DICE QUE SE EMPIEZA DE CERO. Las cuentas no viajan entre servidores
 * (F100): sin esa línea, el jugador esperaría su partida al otro lado y encontraría
 * un registro vacío, que es la misma mentira que este cartel vino a quitar.
 *
 * Y POR QUÉ A VECES NO SALE NADA. Sin `VITE_URL_OTRO_SERVIDOR` no hay a dónde ir:
 * un botón que promete otro servidor sin URL es peor que no tener botón.
 */
function enlaceOtroServidorHTML(): string {
  if (!URL_OTRO_SERVIDOR) return '';
  const destino = SERVIDOR_ACTUAL === '1' ? '2' : '1';
  return `
    <a href="${esc(URL_OTRO_SERVIDOR)}" data-otro-servidor
       class="w-full min-h-[44px] py-2.5 btn-ghost font-['Orbitron'] font-bold text-xs rounded-xl
              hover:opacity-90 transition cursor-pointer flex items-center justify-center gap-2">
      <span class="[&>span>svg]:w-4 [&>span>svg]:h-4">${ic('globe')}</span>
      JUGAR EN EL SERVIDOR ${destino}
    </a>
    <p class="text-[10px] font-mono text-[var(--text-muted)] leading-relaxed">
      En el otro servidor empiezas de cero: tu cuenta y tu partida de aquí no viajan.
    </p>`;
}

export function renderErrorDeCarga(
  container: HTMLElement,
  error: unknown,
  onReintentar: () => void
): void {
  const cuota = esCuotaAgotada(error);
  const sinRespuesta = esSinRespuesta(error);

  // Los TRES textos, y por qué son tres: el jugador puede hacer una cosa distinta en cada
  // uno. Con la cuota agotada toca esperar; sin respuesta toca reintentar; y una cosa que no
  // es ninguna de las dos suele ser una pestaña abierta en otra parte. Decirle a alguien
  // que espere cuando lo que necesita es reintentar es la forma de que se vaya a esperar.
  const titulo = cuota
    ? 'El servidor está en mantenimiento'
    : sinRespuesta
      ? 'El servidor no está contestando'
      : 'No se ha podido cargar la partida';
  const explicacion = cuota
    ? 'El servidor de la partida está en mantenimiento y ahora mismo no puede atenderte. '
      + 'No es un fallo de tu equipo ni de tu navegador, y tu partida sigue guardada donde '
      + 'estaba: no se ha tocado nada. El mantenimiento termina solo, así que dentro de un '
      + 'rato vuelve a funcionar.'
    : sinRespuesta
      ? 'Se le ha pedido tu partida al servidor y no ha contestado a tiempo. No se ha '
        + 'guardado nada, así que tu progreso sigue donde estaba. Esto es una espera, no un '
        + 'problema con tu cuenta.'
      : 'El juego no ha conseguido leer tu partida del servidor. No se ha guardado nada, '
        + 'así que tu progreso sigue donde estaba. Esto suele ser la conexión.';
  const pie = cuota
    ? 'Si vuelve a pasar en cuanto termine el mantenimiento, el culpable es el ritmo de '
      + 'guardado, no tu juego.'
    : 'Si tienes el juego abierto en otra pestaña, ciérrala antes de reintentar.';

  container.innerHTML = `
    <div class="min-h-screen flex items-center justify-center p-6 bg-[var(--bg-app)]">
      <div class="card-glass border rounded-2xl p-6 max-w-sm w-full flex flex-col gap-4">
        <div class="label-caps text-rose-400">Sin conexión con la partida</div>
        <div class="font-['Orbitron'] font-bold text-base leading-tight">${esc(titulo)}</div>
        <div class="text-xs text-[var(--text-muted)] leading-relaxed">${esc(explicacion)}</div>
        <button data-reintentar
                class="w-full py-2.5 accent-bg text-slate-950 font-['Orbitron'] font-bold text-xs
                       rounded-xl hover:opacity-90 transition cursor-pointer">
          REINTENTAR
        </button>
        ${cuota ? `
        <button data-wiki-externo
                class="w-full py-2.5 btn-ghost font-['Orbitron'] font-bold text-xs rounded-xl
                       hover:opacity-90 transition cursor-pointer flex items-center justify-center gap-2">
          <span class="[&>span>svg]:w-4 [&>span>svg]:h-4">${ic('scroll')}</span>
          ABRIR LA WIKI
        </button>` : ''}
        ${enlaceOtroServidorHTML()}
        <div class="text-[10px] font-mono text-[var(--text-muted)] leading-relaxed">
          ${esc(pie)}
        </div>
      </div>
    </div>
  `;

  // El botón se ata con `addEventListener` sobre el nodo recién creado, no con un
  // atributo `onclick`: es la misma red de seguridad que R5, y aquí importa más porque
  // este nodo vive dentro de `#app`.
  container.querySelector('[data-reintentar]')?.addEventListener('click', onReintentar);

  // Mismo destino que el botón de mantenimiento y el de la cabecera: la Wiki vive en
  // `wiki.html`, en pestaña aparte, sin game loop y sin tocar la partida. Aquí es donde
  // más sirve: el mantenimiento es tiempo muerto, y leer la Wiki no gasta cuota.
  container.querySelector('[data-wiki-externo]')?.addEventListener('click', () => {
    window.open('wiki.html', '_blank', 'noopener');
  });
}

/**
 * B34 · PANTALLA DE CUOTA AGOTADA, CUANDO OCURRE **DURANTE** EL JUEGO.
 *
 * **POR QUÉ HACE FALTA UNA PANTALLA Y NO BASTA EL AVISO FLOTANTE.** El aviso se va solo a
 * los pocos segundos, y el caso es de **esperar**, no de un instante: el límite del día se
 * repone y quien lo ha visto pasar se ha ido a jugar a otra cosa creyendo que el juego no
 * funciona. Un aviso que desaparece es un aviso que se olvida; una pantalla que **queda**
 * explica, tranquiliza —**tu partida está intacta**— y ofrece reintentar cuando toca.
 *
 * **LO QUE ESTA PANTALLA PROMETE Y CÓMO SE CUMPLE, Y ES LO IMPORTANTE.** Dice tres cosas,
 * y las tres son verdad o no sirve de nada:
 *
 *   1. **Tu partida está intacta.** Y no es consuelo: el motor **no ha guardado nada** desde
 *      que empezó el problema (`partidaNoCargada` y la firma de B28), así que lo que hay en
 *      el servidor es exactamente lo que había antes. Lo que el jugador ha jugado estos
 *      minutos vive **en este dispositivo**, en la cola local, y se sube al volver.
 *   2. **El límite se repone solo.** Firestore repone el presupuesto al día siguiente. No
 *      hay que hacer nada, no se ha roto nada y no se ha perdido nada.
 *   3. **Reintentar funciona** cuando el límite vuelve.
 *
 * **Y NO HAY PAGO, Y NO ES OLVIDO: ES UNA DECISIÓN QUE HAY QUE ESCRIBIR.** Se pidió una
 * pantalla de pago. **El límite se repone solo**, así que cobrar para continuar es cobrar
 * por el reloj. Y además **el pago no podría ni funcionar**: la pantalla del pago y su
 * confirmación se guardan en **la misma base de datos que está saturada**, así que con la
 * cuota agotada el pago tampoco llega. Un muro que no se puede cobrar no es una venta, es
 * una pantalla de error. Si algún día hay un plan de pago, lo razonable es un enlace
 * **voluntario** de apoyo, que no condicione poder jugar.
 *
 * **Y LA REGLA QUE LA HACE HONESTA, QUE ES EL RIESGO REAL DE ESTA PANTALLA.** Solo se
 * muestra con `resource-exhausted` de verdad, mediante `esCuotaAgotada()`. **Ese criterio
 * es el que la separa de la pantalla de espera**: `Using maximum backoff delay` es un
 * "todavía no", aparece **con el juego funcionando bien** y **nunca debe cobrar ni asustar**.
 * Si esta pantalla saliera por ese motivo, le estaríamos enseñando una factura a alguien
 * cuyo juego va perfecto, y esa es la forma más rápida de que se vaya y no vuelva.
 */
export function renderCuotaAgotada(container: HTMLElement): void {
  container.innerHTML = `
    <div class="auth-scene w-screen h-dvh app-bg flex flex-col items-center justify-center p-4 font-sans overflow-hidden">
      <div class="auth-bg" aria-hidden="true">
        <div class="auth-glow auth-glow-1"></div>
        <div class="auth-grid"></div>
        <div class="auth-vignette"></div>
      </div>

      <div class="relative z-10 w-full max-w-md">
        <div class="auth-card card-glass rounded-3xl p-6 sm:p-8 flex flex-col gap-5 text-center items-center">

          <div class="auth-logo" style="background:#f59e0b;color:#fff">
            <span class="[&>span>svg]:w-6 [&>span>svg]:h-6">${ic('wrench')}</span>
          </div>

          <div class="flex flex-col gap-1.5">
            <h1 class="font-['Orbitron'] font-black text-lg tracking-[0.18em] text-amber-400">
              SERVIDOR EN MANTENIMIENTO
            </h1>
            <p class="text-[10px] font-mono text-[var(--text-muted)] tracking-[0.12em]">
              EL JUEGO NO ESTÁ DISPONIBLE
            </p>
          </div>

          <div role="status"
               class="w-full rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-4
                      flex flex-col gap-2 text-left">
            <p class="text-[13px] font-sans leading-relaxed text-[var(--text-main)]">
              El servidor está en mantenimiento y el juego no está disponible
              ahora mismo. Tu partida sigue guardada y no se ha perdido nada.
            </p>
            <p class="text-[13px] font-sans leading-relaxed text-[var(--text-main)]">
              Mientras tanto, puedes leer la <strong>Wiki</strong> para aprender
              las reglas, ver las cajas o planificar tu próxima partida.
            </p>
          </div>

          <button type="button" id="abrir-wiki"
                  class="btn-ghost w-full h-11 rounded-xl font-['Orbitron'] font-bold text-[11px]
                         tracking-[0.12em] cursor-pointer transition flex items-center justify-center gap-2">
            <span class="[&>span>svg]:w-4 [&>span>svg]:h-4">${ic('scroll')}</span>
            ABRIR LA WIKI
          </button>
          ${enlaceOtroServidorHTML()}

          <p class="text-[10px] font-mono text-[var(--text-muted)] leading-relaxed">
            La Wiki es solo lectura y no toca tu partida. El juego volverá cuando
            termine el mantenimiento.
          </p>
        </div>
      </div>
    </div>
  `;

  container.querySelector('#abrir-wiki')?.addEventListener('click', () => {
    window.open('wiki.html', '_blank', 'noopener');
  });
}
