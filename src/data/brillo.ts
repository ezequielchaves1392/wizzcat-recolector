// ==========================================================================
//  EL BRILLO DE UN ITEM: CÓMO SE CALCULA Y POR QUÉ ES UN NÚMERO
// ==========================================================================
//
//  Lo que se pidió fue un efecto visual en el icono según lo bueno que es el
//  item: más potencial, más nivel, y algo especial en el máximo. La parte difícil
//  no es el brillo, es **que las tres pantallas enseñen lo mismo**.
//
//  Por eso vive aquí y no en `warehouse.ts` ni en la tarjeta. El almacén pinta un
//  brillo, la descripción de la base pinta otro y el jugador compara los dos y ve
//  que no cuadran: es exactamente la clase de bug que ya ha salido dos veces en
//  este proyecto, y la razón de que la regla esté en datos puros es que las tres
//  pantallas la llaman y no pueden discrepar.
//
//  **ESTO ES UN DATO, NO UN EFECTO.** Aquí no hay ni una clase de Tailwind ni un
//  nombre de animación: sale un entero del 0 al 4 y quien pinta decide cómo se ve
//  cada número. Si el cálculo y el CSS vivieran juntos, cambiar el aspecto
//  obligaría a tocar la regla y cambiar la regla obligaría a tocar el aspecto, y
//  con el tiempo una de las dos cosas deja de preguntárselo.
// ==========================================================================

import { potencialNormalizado, collectorMaxLevel, nivelMaximoDeCompanio } from './crafting';

export type TipoDeItem = 'collector' | 'companion' | 'otro';

/** El brillo más alto que existe. Es el que lleva el efecto propio. */
export const BRILLO_MAXIMO = 4;

/**
 * Cuánto brillo puede dar como mucho un item de cada rareza.
 *
 * **LA RAREZA PONE EL TECHO Y EL POTENCIAL Y EL NIVEL LO LLENAN.** Al revés no
 * funciona: un Mítico recién sacado brillaría más que un Divino al máximo, y el
 * techo del juego estaría en la tienda.
 *
 * Los topes no están repartidos a ojo entre las seis rarezas, salen de una idea: un
 * Común apenas puede distinguirse —si no, los veinte comunes del almacén empiezan a
 *—llamar la atención— y un Divino es el único que llega al máximo.
 */
export const TOPO_POR_RAREZA: Record<string, number> = {
  'Común': 1,
  'Raro': 2,
  'Épico': 3,
  'Legendario': 3,
  'Mítico': 4,
  'Divino': 4,
};

/**
 * El techo de una rareza, o el de un Común si no la reconocemos.
 *
 * **EL MISMO SALTAR Y EL MISMO VALOR.** Una rareza mal escrita no puede dejar el
 * brillo sin tope —`undefined` en una comparación da `false` y el `min` se come el
 * número entero—, así que lo desconocido cae en el suelo. Un item con la rareza
 * corrupta brilla poco, que es el fallo que no se nota.
 */
export function topeDeBrillo(rarity: string | undefined | null): number {
  const clave = String(rarity ?? '').trim();
  const directo = TOPO_POR_RAREZA[clave];
  if (typeof directo === 'number') return directo;
  // Se compara como en `crateLoot.ts`: sin acentos y en minúsculas. "Epico" y
  // "Épico" tienen que dar el mismo brillo, no uno de ellos sin brillo.
  const plano = clave.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  for (const [nombre, tope] of Object.entries(TOPO_POR_RAREZA)) {
    const nombrePlano = nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (nombrePlano === plano) return tope;
  }
  return TOPO_POR_RAREZA['Común'];
}

/**
 * El techo de nivel que le toca a este item, sea del tipo que sea.
 *
 * **Y CERO PARA LO QUE NO TIENE NIVEL, QUE ES LA MITAD DE LA LISTA.** Un material de
 * forja, una caja, una llave: nada de eso sube de nivel. Antes esta función devolvía el
 * techo del recolector para todo lo que no fuera compañero, y un material con un
 * `level` basura (99, que es lo que deja un guardado viejo) quedaba por encima de ese
 * techo y se llevaba los dos puntos, con lo cual un material podía tener el efecto
 * propio.
 * Lo que no tiene nivel no puede estar al tope de él.
 */
function techoDeNivel(w: any): number {
  if (w.type === 'companion') return nivelMaximoDeCompanio(w.potential, w.maxLevel);
  if (w.type === 'collector') return collectorMaxLevel(w.maxLevel);
  return 0;
}

/**
 * El brillo de un item, de 0 a `BRILLO_MAXIMO`.
 *
 *     potencial  1..5  ->  0, 0, 1, 2, 2   puntos
 *     nivel      0..1  ->  0, 1, 2         puntos
 *     brillo = min(puntos, tope de la rareza)
 *
 * **CADA PARTE APORTA COMO MUCHO DOS, Y POR QUÉ NO UNA ESCALA LARGA.** Una escala de
 * 0 a 10 daría al potencial y al nivel un peso cada uno, y con potencial —que no se
 * cambia nunca después de forjar— el brillo pararía de subir a mitad de partida: un
 * item de potencial 5 al nivel 3 se vería exactamente igual que al 20. Con dos
 * escalones cada uno, **subir de nivel siempre se nota**, que es lo que el jugador
 * está mirando cuando sube.
 *
 * **EL EFECTO PROPIO ES EL 4, Y SOLO LLEGA AL TECHO DE NIVEL.** Es lo que se pidió:
 * que en el máximo pase algo distinto. No es un premio por tener potencial alto, que
 * se consigue una vez y ya no se mueve, sino por haber llegado al final, que es lo que
 * cuesta. Por eso hace falta un Divino o un Mítico: **un Legendario al máximo se queda
 * en 3**, y llegar al 4 es raro a propósito.
 *
 * **UN ITEM SIN NADA DE ESO BRILLA 0, Y NO ES UN ERROR.** Un item recién salido de
 * una caja tiene potencial y nivel, pero un material de forja no tiene nivel: brilla
 * 0 y se pinta normal, que es lo que es.
 */
export function brilloDeItem(w: any): number {
  if (!w || typeof w !== 'object') return 0;

  const potencial = potencialNormalizado(w.potential);
  // **PUNTOS POR POTENCIAL: 1 y 2 no dan nada.** El potencial medio no paga. Así un
  // ★2 forjado con esfuerzo se ve como un ★1, y el potencial —que es lo único que
  // distingue dos items del mismo tier y nivel— sigue teniendo razón de ser.
  const delPotencial = potencial >= 4 ? 2 : potencial === 3 ? 1 : 0;

  const techo = techoDeNivel(w);
  const nivel = Number(w.level) || 0;
  const proporcion = techo > 0 ? Math.min(1, Math.max(0, nivel / techo)) : 0;
  // **EL ÚLTIMO ESCALÓN ES EXCLUSIVO DEL TOPE.** Comparar con `>= 1` en vez de
  // comprobar el techo entero es lo mismo aquí porque la proporción ya viene recortada
  // a 1, pero deja escrito que el escalón final es "al máximo" y no "casi al máximo".
  const delNivel = proporcion >= 1 ? 2 : proporcion >= 0.5 ? 1 : 0;

  const puntos = delPotencial + delNivel;
  return Math.max(0, Math.min(topeDeBrillo(w.rarity), puntos, BRILLO_MAXIMO));
}

/**
 * ¿Le toca el efecto propio?
 *
 * Va como pregunta aparte y no como `brillo === BRILLO_MAXIMO` escrito en la vista,
 * porque es la clase de comparación que se acaba desincronizando: el día que
 * `BRILLO_MAXIMO` suba a 5, las tres pantallas que comparaban con el `4` se quedan
 * atrás y solo una de ellas se entera.
 */
export function tieneEfectoPropio(w: any): boolean {
  return brilloDeItem(w) >= BRILLO_MAXIMO;
}

/** La etiqueta corta del brillo, para el `title` y para el banco. Nunca en el botón. */
export function etiquetaDeBrillo(brillo: number): string {
  const b = Math.max(0, Math.min(BRILLO_MAXIMO, Math.floor(Number(brillo) || 0)));
  if (b >= BRILLO_MAXIMO) return 'Brillo máximo';
  if (b === 0) return 'Sin brillo';
  return 'Brillo ' + b + ' de ' + BRILLO_MAXIMO;
}