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
// Las dos barras de navegación son el índice del juego, y se pintan en TODAS
// las pantallas: la de abajo en móvil y la fila de la cabecera en escritorio.
// El enrutador ya no lleva pila, porque no hay botón de atrás: se navega con las
// barras o con cualquier `data-nav` que haya en una página.
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
export class Router {
  /** La ruta de ahora. Y solo eso: **aquí ya no hay pila.** */
  private stack: Route[] = ['base'];
  private listeners = new Set<(route: Route, previous: Route) => void>();

  get current(): Route {
    return this.stack[this.stack.length - 1];
  }

  /**
   * Cambia de vista. Si es la misma, no hace nada.
   *
   * **ANTES HACIA PUSH Y TRATABA LA BASE COMO CASO ESPECIAL**, con un tope de
   * diez entradas. Las dos cosas existían por el botón de atrás: el tope era
   * "cuántas veces hay que pulsar para llegar al principio" y el reinicio era "no
   * quiero que ir a la base y volver cueste cuatro toques".
   *
   * Sin botón no hay ni tope ni reinicio. Y quitarlo no es solo limpieza: es que
   * `goTo()` deja de decidir cosas en nombre de un control que ya no existe.
   */
  goTo(route: Route): void {
    if (route === this.current) return;
    const previous = this.current;
    this.stack.push(route);
    this.emit(previous);
  }

  onChange(fn: (route: Route, previous: Route) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(previous: Route) {
    for (const fn of this.listeners) fn(this.current, previous);
  }
}
