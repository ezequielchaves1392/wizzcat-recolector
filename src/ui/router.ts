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
// Además decide qué se re-renderiza y qué no: la barra inferior y la cabecera
// sobreviven a los cambios de vista, así que el reproductor, los buffs y el
// contador de nanitas no parpadean al abrir la tienda.
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
  { id: 'almacen', label: 'Almacén', icon: 'warehouse', inBottomBar: true, inHeader: true, title: 'Almacén' },
  { id: 'forja', label: 'Forja', icon: 'anvil', inBottomBar: true, inHeader: true, title: 'Forja de Recolectores' },
  { id: 'tienda', label: 'Tienda', icon: 'store', inBottomBar: true, inHeader: true, title: 'Mercado' },
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
 * Pila de navegación. El botón "volver" de una página hace pop(); si la pila
 * se queda vacía vuelve a la base, que es el único sitio donde siempre se
 * puede estar.
 */
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
    else this.stack.push(route);
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
