// ==========================================================================
// Router multipágina
//
// El juego no cambia de URL: cambia de "vista" dentro del mismo árbol de
// nodos. Es una decisión deliberada. El estado vive en un único objeto que
// se guarda en Firestore, y una recarga tiene que devolver exactamente lo
// mismo; si cada página fuera una ruta, el guardado por ruta duplicaría la
// lógica de "qué está en pantalla" y el botón de atrás del navegador
// empezaría a competir con la navegación inferior por el foco.
//
// Lo que sí hace este router:
//   - un único punto de entrada (`goTo`) para cambiar de vista
//   - un historial interno para que el botón "volver" de cada página funcione
//     sin que cada página conozca a dónde vino la anterior
//   - conservar el estado de la partida mientras se navega (no se reinicia el
//     game loop al cambiar de vista; el tick sigue corriendo en segundo plano)
//
// La barra inferior es el índice del menú principal y solo se pinta en la
// base. Desde un sector se vuelve con `back()` (el `‹` de la esquina superior
// izquierda), que además tiene el historial como red de seguridad: si no queda
// nada atrás, quien llama cae a la base.
// ==========================================================================

export type Route = 'base' | 'almacen' | 'forja' | 'tienda' | 'perfil' | 'ranking' | 'prestigio';

export interface RouteDef {
  id: Route;
  label: string;
  /** Icono del set. */
  icon: string;
  /** Aparece en la barra inferior de móvil. Máximo 5: más de 5 deja de ser pulsable. */
  inBottomBar: boolean;
  /** Aparece en la fila de botones de escritorio. */
  inHeader: boolean;
  /** Título de la cabecera de escritorio cuando esta vista está activa. */
  title: string;
}

export const ROUTES: RouteDef[] = [
  { id: 'base', label: 'Base', icon: 'chip', inBottomBar: true, inHeader: true, title: 'Panel Principal' },
  // F25 · El mercado va segundo, antes que el almacén. El jugador lo confundía
  // con la venta del almacén y lo busca "al principio"; Base se queda primero
  // porque es la vista de partida, pero el mercado —que es donde se gastan las
  // nanitas— sube a la segunda posición. Un lugar más que otro, no un sitio
  // nuevo: la ruta es la misma, solo cambia su orden en la barra y en la cabecera.
  { id: 'tienda', label: 'Mercado', icon: 'store', inBottomBar: true, inHeader: true, title: 'Mercado' },
  { id: 'almacen', label: 'Almacén', icon: 'warehouse', inBottomBar: true, inHeader: true, title: 'Almacén' },
  { id: 'forja', label: 'Forja', icon: 'anvil', inBottomBar: true, inHeader: true, title: 'Forja de Recolectores' },
  { id: 'perfil', label: 'Perfil', icon: 'user', inBottomBar: true, inHeader: true, title: 'Perfil y Logros' },
  { id: 'ranking', label: 'Ranking', icon: 'trophy', inBottomBar: false, inHeader: true, title: 'Ranking Global' },
  { id: 'prestigio', label: 'Prestigio', icon: 'recycle', inBottomBar: false, inHeader: false, title: 'Ascensión' }
];

export const BOTTOM_BAR_ROUTES = ROUTES.filter(r => r.inBottomBar);
export const HEADER_ROUTES = ROUTES.filter(r => r.inHeader);

export function routeTitle(route: Route): string {
  return ROUTES.find(r => r.id === route)?.title ?? 'Cyber Base';
}

/**
 * Pila de navegación.
 *
 * El botón "volver" hace pop(); si la pila se queda vacía, `back()` devuelve
 * `false` y quien llama cae a la base, que es el único sitio donde siempre se
 * puede estar. Así no puede haber un "atrás" que no lleve a ninguna parte.
 *
 * LÍMITE DE LA PILA.
 *
 * Navegar siempre hace push, y eso hace que una sesión larga acumule: base →
 * almacén → forja → tienda → base → almacén deja cinco entradas, y el jugador
 * tiene que pulsarlo cinco veces para llegar al principio. Se siente como un
 * botón de atrás roto.
 *
 * Con el tope, tras varias navegaciones se empieza a olvidar el principio, que
 * es justo lo que se quiere: `back()` vuelve "a donde estabas hace un rato",
 * y el botón de inicio lleva a la base sin ninguna ambigüedad. Diez es un
 * número alto a propósito: da para una exploración larga sin castigar al que
 * solo mira dos pantallas.
 */
const MAX_STACK = 10;

export class Router {
  private stack: Route[] = ['base'];
  private listeners = new Set<(route: Route, previous: Route) => void>();

  get current(): Route {
    return this.stack[this.stack.length - 1];
  }

  /** Cambia de vista. Si es la misma, no hace nada. */
  goTo(route: Route): void {
    if (route === this.current) return;
    const previous = this.current;
    // Navegar a la base limpia la pila: si no, volver tres veces para llegar
    // al panel principal sería absurdo.
    if (route === 'base') this.stack = ['base'];
    else {
      this.stack.push(route);
      // Se descarta el principio, nunca la entrada actual: `back()` siempre
      // tiene adónde ir después de una navegación.
      if (this.stack.length > MAX_STACK) this.stack.shift();
    }
    this.emit(previous);
  }

  /** Vuelve a la vista anterior. Devuelve false si ya estaba en la base. */
  back(): boolean {
    if (this.stack.length <= 1) return false;
    const previous = this.current;
    this.stack.pop();
    this.emit(previous);
    return true;
  }

  /** Pila actual, para depurar. */
  get history(): readonly Route[] {
    return this.stack;
  }

  canGoBack(): boolean {
    return this.stack.length > 1;
  }

  onChange(fn: (route: Route, previous: Route) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(previous: Route) {
    for (const fn of this.listeners) fn(this.current, previous);
  }
}
