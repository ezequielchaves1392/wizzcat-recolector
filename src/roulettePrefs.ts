// ==========================================================================
//  Preferencia de ruleta: saltarse el trompo e ir al cartel
//
//  Vive en `localStorage` y no en el guardado de Firestore, como el tema
//  (`theme.ts`): es una preferencia de VISTA por dispositivo, no progreso.
//  Que sea por dispositivo es incluso lo correcto, porque el trompo no va
//  igual en todos (F28): en el móvil va bien y en el navegador corre.
//
//  Y no puede cambiar la economía por diseño: el premio ya está decidido y
//  aplicado ANTES de que se monte la ruleta (F10). Saltar solo quita la
//  anticipación, nunca el veredicto: el cartel se enseña igual.
//
//  La lectura coacciona (R11): cualquier valor que no sea '1' es "no saltar",
//  y si `localStorage` no está disponible se sigue jugando con el trompo.
// ==========================================================================

const SKIP_KEY = 'cyberforge_skip_roulette';

/** Si el jugador pidió ir directo al cartel del premio. */
export function getSkipRoulette(): boolean {
  try {
    return localStorage.getItem(SKIP_KEY) === '1';
  } catch {
    return false;
  }
}

/** Guarda la preferencia del check. No lanza nunca. */
export function setSkipRoulette(skip: boolean): void {
  try {
    localStorage.setItem(SKIP_KEY, skip ? '1' : '0');
  } catch {
    // Sin almacenamiento no hay preferencia que guardar, y el juego sigue.
  }
}
