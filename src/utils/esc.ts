// ==========================================================================
//  Escapar texto para meterlo en HTML. UNA COPIA, Y POR QUÉ ESTÁ AQUÍ
// ==========================================================================
//
//  **Ya había dos copias** —una en `components/blocked.ts` y otra en `admin.ts`— y esta es
//  la tercera que hacía falta. Tres copias de la misma función son tres sitios donde
//  cambiarla, y el día que se cambiara en uno los otros dos seguirían escapando distinto:
//  el síntoma es una etiqueta ejecutándose en el navegador de quien mira el perfil de
//  otro, y eso es un fallo de seguridad disfrazado de detalle de estilo.
//
//  ## POR QUÉ NO USA `textContent`
//
//  Porque el trabajo aquí no es poner un texto en el DOM, es **componer un fragmento de
//  HTML con muchos datos dentro**. Con `textContent` habría que crear un nodo por dato y
//  el maquetado se iría al_heap de nodos. Escapar la cadena es más rápido y hace el
//  HTML legible en las herramientas del navegador, que es donde uno va cuando un nombre
//  de jugador sale mal.
//
//  ## LO QUE ESCAPA
//
//  Los cinco que importan: `&`, `<`, `>`, `"` y `'`. Con los tres últimos es porque los
//  atributos también son datos: un nombre con una comilla doble cerraría un `title="` y
//  lo que viniera detrás se leería como atributo. El `&` va primero en la tabla de
//  reemplazos, que es lo que evita que un `&lt;` ya escapado se vuelva a escapar.

const REEMPLAZOS: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
};

/** Convierte cualquier valor en texto seguro para meter dentro de HTML. */
export function esc(valor: unknown): string {
  return String(valor ?? '').replace(/[&<>"']/g, (c) => REEMPLAZOS[c]);
}