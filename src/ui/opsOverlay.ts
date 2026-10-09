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
  raiz.title = 'Ops Firestore del último minuto (F96). Toca para el detalle.';
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
