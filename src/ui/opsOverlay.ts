// ==========================================================================
//  F96 · EL NUMERITO DE LA CUOTA, ESTILO FPS
// ==========================================================================
//
//  **QUÉ ES.** `W4·R0` fijo en la esquina: escrituras y lecturas del último
//  minuto, con el semáforo de `colorDeRitmo()`. Al tocarlo se expande con los
//  motivos dominantes y el último pico. Es la superficie de lectura del
//  contador (`services/contadorOps.ts`); no toca la red ni el estado del
//  juego, solo lee memoria una vez por segundo.
//
//  **DÓNDE VIVE.** Pegado a `body`, fuera de `#app`, porque `mountInto()`
//  sustituye el contenido de la página en cada redraw: dentro del árbol lo
//  borraría cada navegación. El intervalo y el estado son de módulo (R6) y se
//  crean una sola vez: montarlo dos veces serían dos intervalos pintando lo
//  mismo.
//
//  **CUÁNDO SALE.** Solo con `?ops=1` en la URL. En producción sin el flag no
//  se pinta nada: un número de cuota a la vista del jugador es ruido. El flag
//  vale en cualquier build porque los picos se cazan jugando de verdad.
//
//  **EN LOS BANCOS NO SE MONTA NUNCA.** `verify/entorno.mjs` instala un
//  `window` sin `location`, así que el guard de abajo lo deja fuera. Un
//  `setInterval` vivo en un banco es un proceso que no termina.

import {
  ritmoUltimoMinuto,
  colorDeRitmo,
  evaluarPico,
  etiquetaMotivo,
  resumenOps,
  topMotivos,
  ultimosPicos,
  totales,
  type ColorOps,
} from '../services/contadorOps';

const COLOR_BORDE: Record<ColorOps, string> = {
  verde: '#22c55e',
  naranja: '#f59e0b',
  rojo: '#ef4444',
};

/** Segundos seguidos con el mismo color antes de cambiarlo, anti-parpadeo. */
const HISTERESIS_S = 3;

const ui: {
  raiz: HTMLElement | null;
  detalle: HTMLElement | null;
  color: ColorOps;
  pendiente: ColorOps | null;
  racha: number;
  expandido: boolean;
} = { raiz: null, detalle: null, color: 'verde', pendiente: null, racha: 0, expandido: false };

function hora(t: number): string {
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function pintar(): void {
  if (!ui.raiz) return;
  const { escrituras, lecturas } = ritmoUltimoMinuto();
  const color = colorDeRitmo(escrituras, lecturas);
  evaluarPico();

  // La histéresis: un save puntual no puede hacer flicker el semáforo.
  if (color === ui.color) {
    ui.pendiente = null;
    ui.racha = 0;
  } else if (color === ui.pendiente) {
    ui.racha++;
    if (ui.racha >= HISTERESIS_S) {
      ui.color = color;
      ui.pendiente = null;
      ui.racha = 0;
    }
  } else {
    ui.pendiente = color;
    ui.racha = 1;
  }

  ui.raiz.textContent = ui.color === 'verde' ? `W${escrituras}·R${lecturas}` : `▲ W${escrituras}·R${lecturas}`;
  ui.raiz.style.borderColor = COLOR_BORDE[ui.color];
  ui.raiz.style.color = COLOR_BORDE[ui.color];
  ui.raiz.dataset.opsEstado = ui.color;

  if (ui.expandido && ui.detalle) {
    const top = topMotivos(5).slice(0, 3).map((t) => `${t.motivo} ${t.n}`).join('\n') || 'sin ops aún';
    const pico = ultimosPicos().at(-1);
    const lineaPico = pico
      ? `pico ${hora(pico.inicio)} maxW${pico.maxW}${pico.fin ? '' : ' (abierto)'}`
      : 'sin picos';
    const tot = totales();
    ui.detalle.textContent = `${top}\n${lineaPico}\ntotal W${tot.escrituras} R${tot.lecturas}`;
  } else if (ui.detalle) {
    ui.detalle.textContent = '';
  }
}

/**
 * Monta el numerito. Sin `?ops=1` no hace nada, y fuera del navegador
 * tampoco: llamarla dos veces monta una sola vez.
 */
export function montarOpsOverlay(): void {
  if (ui.raiz) return;
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  const search = (window as any).location?.search;
  if (typeof search !== 'string' || !search.includes('ops=1')) return;

  const raiz = document.createElement('div');
  raiz.dataset.ops = 'pildora';
  raiz.title = 'Uso de red del último minuto. Toca para el detalle.';
  raiz.style.cssText = [
    'position:fixed', 'right:8px', 'bottom:8px', 'z-index:9999',
    'font:11px/1.4 monospace', 'padding:3px 8px', 'border:1px solid #22c55e',
    'border-radius:8px', 'background:rgba(0,0,0,.78)', 'color:#22c55e',
    'cursor:pointer', 'user-select:none', 'white-space:pre',
  ].join(';');
  const detalle = document.createElement('div');
  detalle.dataset.ops = 'detalle';
  raiz.appendChild(detalle);
  // El listener va sobre el propio nodo, que no lo recrea nadie: una sola
  // vez por pestaña, sin acumularse (R5).
  raiz.addEventListener('click', () => {
    ui.expandido = !ui.expandido;
    pintar();
  });
  document.body.appendChild(raiz);
  ui.raiz = raiz;
  ui.detalle = detalle;
  pintar();
  window.setInterval(pintar, 1000);
}

// ==========================================================================
//  LA SECCIÓN "USO DE RED" DE AJUSTES, VISIBLE PARA EL JUGADOR EN LA BETA
// ==========================================================================
//
//  **QUÉ ES.** Lo mismo que la píldora, pero en cristiano y con detalle: ritmo
//  del último minuto, totales de la sesión, qué lo movió y el último pico. La
//  píldora sigue detrás de `?ops=1`; esta sección sale siempre, porque en beta
//  el jugador es quien mejor caza los picos.
//
//  **SOLO LEE.** `resumenOps()` es memoria local: pintar no toca la red ni el
//  estado (R1). El refresco es un único intervalo de módulo que solo escribe
//  cuando la hoja está abierta; cerrada, no escribe nada (R7). La hoja se
//  reconstruye en cada vista, así que los nodos se buscan en cada pintado y no
//  se guardan.

/** La palabra del semáforo delante del jugador: colores no se explican solos. */
function palabraDeColor(color: ColorOps): string {
  return color === 'verde' ? 'Bien' : color === 'naranja' ? 'Alto' : 'Muy alto';
}

/**
 * El marcado de la sección, con ganchos `data-ops-*` que rellena el pintor.
 * Los valores iniciales son "…" a propósito: si el intervalo no corriera, se
 * vería que falta el número en vez de un cero que miente.
 */
export function seccionUsoRedHTML(): string {
  return `
        <div data-ops-seccion>
          <div class="label-caps mb-2">Uso de red <span data-ops-estado class="font-mono"></span></div>
          <div class="rounded-lg btn-ghost px-3 py-2.5 flex flex-col gap-1.5">
            <div class="flex items-center justify-between gap-2 text-[11px] font-mono">
              <span class="text-[var(--text-muted)]">Último minuto</span>
              <span data-ops-minuto class="text-[var(--text-main)]">…</span>
            </div>
            <div class="flex items-center justify-between gap-2 text-[11px] font-mono">
              <span class="text-[var(--text-muted)]">Desde que abriste</span>
              <span data-ops-total class="text-[var(--text-main)]">…</span>
            </div>
            <div class="text-[11px] font-mono">
              <div class="text-[var(--text-muted)] mb-1">Qué lo movió</div>
              <div data-ops-top class="flex flex-col gap-1 text-[var(--text-main)]">…</div>
            </div>
            <div class="flex items-center justify-between gap-2 text-[11px] font-mono">
              <span class="text-[var(--text-muted)]">Último pico</span>
              <span data-ops-pico class="text-[var(--text-main)] text-right">…</span>
            </div>
            <p class="text-[10px] font-mono text-[var(--text-muted)] leading-relaxed">
              Beta: nos ayuda a cazar picos. Abrir el ranking trae hasta 40
              lecturas de golpe: ese salto es normal. Se borra al recargar y no
              sale de tu pestaña.
            </p>
          </div>
        </div>`;
}

/** Pinta todas las secciones visibles con el resumen actual. No lanza nunca. */
export function pintarUsoRed(): void {
  try {
    const secciones = document.querySelectorAll('[data-ops-seccion]');
    if (secciones.length === 0) return;
    const r = resumenOps();
    const color = r.minuto.color;
    const colorCss = color === 'verde' ? '#22c55e' : color === 'naranja' ? '#f59e0b' : '#ef4444';
    for (const sec of Array.from(secciones)) {
      const hoja = sec.closest('[data-ajustes]');
      // Cerrada no se pinta: escribir en un nodo oculto es trabajo gratis.
      if (hoja && hoja.classList.contains('hidden')) continue;
      const estado = sec.querySelector('[data-ops-estado]');
      if (estado) {
        estado.textContent = `· ${palabraDeColor(color)}`;
        (estado as HTMLElement).style.color = colorCss;
      }
      const minuto = sec.querySelector('[data-ops-minuto]');
      if (minuto) minuto.textContent = `${r.minuto.escrituras} escrituras · ${r.minuto.lecturas} lecturas`;
      const total = sec.querySelector('[data-ops-total]');
      if (total) total.textContent = `${r.total.escrituras} escrituras · ${r.total.lecturas} lecturas`;
      const top = sec.querySelector('[data-ops-top]');
      if (top) {
        top.textContent = '';
        if (r.top.length === 0) {
          top.textContent = 'Nada todavía.';
        } else {
          for (const t of r.top.slice(0, 5)) {
            const fila = document.createElement('div');
            fila.className = 'flex items-center justify-between gap-2';
            const nombre = document.createElement('span');
            nombre.textContent = etiquetaMotivo(t.motivo);
            const veces = document.createElement('span');
            veces.className = 'text-[var(--text-muted)]';
            veces.textContent = `×${t.n}`;
            fila.appendChild(nombre);
            fila.appendChild(veces);
            top.appendChild(fila);
          }
        }
      }
      const pico = sec.querySelector('[data-ops-pico]');
      if (pico) {
        const ultimo = r.picos.at(-1);
        pico.textContent = !ultimo
          ? 'Sin picos.'
          : `${hora(ultimo.inicio)} · ${ultimo.maxW} escrituras${ultimo.fin ? '' : ' (abierto)'}`;
      }
    }
  } catch {
    // Pintar no puede tumbar la hoja de ajustes: se traga y sigue.
  }
}

let refrescoUsoRed: number | null = null;

/**
 * Arranca el refresco de la sección, una sola vez por pestaña. El intervalo
 * vive aunque la hoja esté cerrada, pero entonces `pintarUsoRed()` vuelve sin
 * escribir: el coste es una búsqueda en el DOM cada dos segundos.
 */
export function montarRefrescoUsoRed(): void {
  if (refrescoUsoRed !== null) return;
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  pintarUsoRed();
  refrescoUsoRed = window.setInterval(pintarUsoRed, 2000);
}
