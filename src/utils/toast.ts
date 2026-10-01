// ==========================================================================
// Avisos flotantes (`showToast`).
//
// POR QUÉ UNA PILA Y NO UN NODO POR AVISO.
//
// Cada aviso se pintaba como un elemento suelto en `fixed top-4 right-4`. Dos
// avisos seguidos caían en el mismo píxel: el segundo tapaba al primero y solo
// se leía el último. Y `top-4 right-4` es exactamente donde vive la esquina
// superior derecha de la cabecera, así que además de taparse entre sí se
// metían debajo de los controles de arriba. Con una acción repetitiva —abrir
// cinco cajas seguidas, vender cinco pilas, pulsar cinco veces un botón que no
// te deja— no era que faltara espacio: era que el último aviso se comía todos
// los anteriores.
//
// LAS TRES REGLAS QUE ARREGLAN ESO, y las tres en el mismo sitio:
//
//   1. UN CONTENEDOR. Los avisos se apilan de verdad, en columna, y por eso no
//      pueden pisarse. El contenedor vive en `body`, no en `#app`: así no lo
//      borra un cambio de vista (`renderRoute` vacía `#app` entero).
//   2. DEBAJO DE LA CABECERA, MEDIDA. La posición vertical no es una constante
//      escrita a ojo: se lee el borde inferior del `<header>` de verdad. Una
//      constante habría que reajustarla cada vez que la cabecera cambia —y la
//      cabecera cambia: en móvil crece una fila entera cuando hay buffs, y en
//      escritorio lleva `md:mt-2`— y un día se habría vuelto a solapar.
//   3. LO REPETIDO SE CUENTA, NO SE REPITE. Vender cinco veces no muestra cinco
//      avisos de "Vendido": muestra uno con un `×5`. Es la diferencia entre
//      "cinco veces más lento" y "cinco veces más corto", y además evita el
//      caso peor de todos, que es el aviso de error que se repite y que el
//      jugador llega a no leer.
//
// Y un tope de cuatro vivos: al superarlo se retira el más viejo sin esperar a
// que expire. Es lo mismo que ya hacen los números flotantes del recolector, que
// también llegan a rachas.
// ==========================================================================

type ToastType = 'success' | 'error' | 'info';

/**
 * Un aviso vivo: el nodo, su contador de repeticiones y su temporizador en la
 * misma estructura. Antes eran tres cosas sueltas y no había forma de encontrar
 * "el aviso vivo que dice esto" sin recorrer el DOM preguntando a cada nodo.
 */
interface ToastVivo {
  el: HTMLElement;
  /** El `×N`. Vive oculto mientras no haya nada que contar. */
  contador: HTMLElement;
  mensaje: string;
  tipo: ToastType;
  /** Cuántas veces se ha pedido este mismo aviso. 1 = todavía sin repetir. */
  veces: number;
  /** Vacío hasta que `armar()` lo pone: `clearTimeout(undefined)` no hace nada. */
  temporizador?: ReturnType<typeof setTimeout>;
}

/** Cuánto vive un aviso antes de retirarse solo. */
const VIDA_MS = 3000;

/** Cuántos avisos conviven como máximo. Al superarlo, se va el más viejo. */
const MAX_VIVOS = 4;

/** Separación entre la cabecera y el primer aviso. */
const HUECO_CABECERA = 12;

/**
 * Avisos vivos ahora mismo.
 *
 * Vive a nivel de módulo y no dentro de `showToast` a propósito: la función se
 * llama una vez por acción, y un array creado dentro se perdería en la llamada
 * siguiente. Es el mismo patrón que la pila de números flotantes de `main.ts`.
 */
const vivos: ToastVivo[] = [];

/** El contenedor. Se crea la primera vez y se reutiliza siempre el mismo. */
let pila: HTMLElement | null = null;

const COLORES: Record<ToastType, string> = {
  success: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300',
  error: 'bg-red-500/20 border-red-500/40 text-red-300',
  info: 'bg-blue-500/20 border-blue-500/40 text-blue-300'
};

/** El contenedor, creándolo la primera vez. */
function asegurarPila(): HTMLElement | null {
  if (pila) return pila;

  const el = document.createElement('div');
  el.id = 'toast-stack';
  el.className =
    'fixed right-3 md:right-4 z-[60] flex flex-col items-end gap-2 ' +
    'w-[min(92vw,20rem)] pointer-events-none';
  // `pointer-events-none` en el contenedor y `pointer-events-auto` en cada aviso:
  // el hueco transparente entre ellos no puede tragarse un toque que iba a otra
  // cosa, y los avisos sí se pueden cerrar al tocarlos.
  //
  // `right-3` y `right-4` son los mismos 12 y 16 px que llevan los bordes de la
  // cabecera y del cuerpo: así la columna queda alineada con el contenido en vez
  // de salirse un poco por fuera.
  document.body.appendChild(el);

  pila = el;
  return pila;
}

/**
 * Coloca la pila justo debajo de la cabecera.
 *
 * Se mide el `<header>` real en vez de escribir una altura a ojo, porque su alto
 * no es fijo: en móvil le crece una fila entera con los buffs activos, y en
 * escritorio lleva margen superior. Lo que hay en la posición superior derecha
 * de las siete pantallas es ese header, así que esta es la única forma de que
 * los avisos no caigan encima.
 *
 * `renderRoute` la llama al montar cada página; `showToast` también, porque al
 * cambiar de vista el borde inferior puede haber cambiado sin que nadie avise.
 *
 * Sin cabecera (la terminal de administración antes de pintarla, o los bancos de
 * pruebas, donde no hay DOM) se deja el margen por defecto en vez de fallar:
 * un aviso en la esquina es mejor que ningún aviso.
 */
export function syncToastOffset(): void {
  if (!pila) return;

  const cabecera = document.querySelector('header') as HTMLElement | null;
  let borde = 0;
  if (cabecera && typeof cabecera.getBoundingClientRect === 'function') {
    const rect = cabecera.getBoundingClientRect();
    // Una cabecera de alto cero significa que todavía no se ha medido, o que la
    // pestaña está en segundo plano. Confiar en ese 0 pegaría los avisos al
    // borde superior justo cuando se vuelve a la pantalla.
    if (rect && rect.height > 0) borde = rect.bottom;
  }
  pila.style.top = `${Math.round(borde + HUECO_CABECERA)}px`;
}

/** Pone `×N` o lo esconde, según si el aviso se ha repetido. */
function pintarContador(t: ToastVivo): void {
  t.contador.classList.toggle('hidden', t.veces < 2);
  if (t.veces >= 2) t.contador.textContent = `×${t.veces}`;
}

/** (Re)arma el temporizador de un aviso: vive `VIDA_MS` desde ahora. */
function armar(t: ToastVivo): void {
  if (t.temporizador) clearTimeout(t.temporizador);
  t.temporizador = setTimeout(() => retirar(t), VIDA_MS);
}

/**
 * Se va un aviso: primero se desvanece y luego se borra el nodo.
 *
 * El borrado va con su propio temporizador y no en el mismo golpe que el
 * desvanecido porque el nodo tiene que quedarse en el DOM durante la
 * transición; si se quitara antes, el aviso desaparecería de golpe.
 */
function retirar(t: ToastVivo): void {
  if (t.temporizador) clearTimeout(t.temporizador);
  const i = vivos.indexOf(t);
  if (i === -1) return;
  vivos.splice(i, 1);

  t.el.classList.add('translate-x-full', 'opacity-0');
  setTimeout(() => t.el.remove(), 300);
}

export function showToast(message: string, type: ToastType = 'info'): void {
  const texto = message.trim();
  if (!texto) return;

  // El contenedor primero, la posición después: al crearlo tiene `top` en
  // `auto`, que para un `fixed` lo deja en su posición de flujo — pegado al
  // borde superior, justo lo que se quería evitar. Hay que colocarlo siempre.
  const contenedor = asegurarPila();
  if (!contenedor) return;
  syncToastOffset();

  // LO REPETIDO SE CUENTA.
  //
  // Es el caso que más molestaba: la misma acción fallida repetida N veces
  // pintaba N avisos idénticos encima los unos de los otros, y el jugador solo
  // veía el último. Aquí el aviso que ya está en pantalla sube su contador y
  // reinicia su reloj, en el sitio donde ya estaba: no salta de posición, que
  // sería peor que dejarlo quieto.
  const repetido = vivos.find(t => t.mensaje === texto && t.tipo === type);
  if (repetido) {
    repetido.veces++;
    pintarContador(repetido);
    armar(repetido);
    return;
  }

  const textoEl = document.createElement('span');
  textoEl.className = 'flex-1 min-w-0 break-words leading-relaxed';
  textoEl.textContent = texto;

  const contador = document.createElement('span');
  contador.className = 'shrink-0 font-bold opacity-80';

  const el = document.createElement('div');
  el.className =
    'flex items-center gap-2.5 w-full min-h-[44px] px-4 py-3 rounded-xl border ' +
    'text-xs font-mono shadow-2xl cursor-pointer pointer-events-auto ' +
    'transition-all duration-300 translate-x-full opacity-0 ' +
    COLORES[type];
  // Los errores se anuncian (`role="alert"`); el resto, con normalidad. Es lo
  // que distingue un aviso de "no te deja" de un "comprado".
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');
  el.appendChild(textoEl);
  el.appendChild(contador);

  const t: ToastVivo = { el, contador, mensaje: texto, tipo: type, veces: 1 };
  pintarContador(t);

  // TOCARLO LO RETIRA. Es una comodidad, no un control: por eso no lleva
  // `tabindex` ni rol de botón, y no hay que llegar a él con el teclado. Lo que
  // necesita el teclado es el aviso, que se anuncia y se va solo a los 3 s; esto
  // solo le da una salida rápida a quien tiene la pila de avisos encima.
  el.addEventListener('click', () => retirar(t));

  contenedor.appendChild(el);
  vivos.push(t);
  armar(t);

  // TOPE DE CUATRO. Se retira el más viejo ya, sin esperar su turno: cuando
  // avisos distintos llegan más rápido de lo que se leen, esperar es la forma
  // de tenerlos a todos encima.
  while (vivos.length > MAX_VIVOS) retirar(vivos[0]);

  // Entrada. El retardo mínimo es el que hace que la transición se vea: si la
  // clase se quita en el mismo fotograma en que se pinta el nodo, el navegador
  // no tiene nada que interpolar.
  setTimeout(() => t.el.classList.remove('translate-x-full', 'opacity-0'), 10);
}