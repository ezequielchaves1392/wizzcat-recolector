// ==========================================================================
// Tiers de companeros y recolectores.
//
// Curva de poder POR TIER (no por nivel). Antes cada tier daba +5 fijos mientras
// el coste se duplicaba: el coste por punto de poder pasaba de 667 (T1) a 21.333
// (T10), 32x peor, asi que el jugador optimo solo compraba T1 y los tiers altos
// eran trampas. Ahora el poder crece ~1.62x por tier, ligeramente por encima
// del 1.5x del coste, para que subir de tier siga mereciendo la pena.
//
// Vive en data/ porque lo usan el crafteo, el mercado y la valoracion, ademas
// del game loop.
// ==========================================================================

export const TIER_POWER = [
  { tier: 1, base: 6 },
  { tier: 2, base: 10 },
  { tier: 3, base: 16 },
  { tier: 4, base: 26 },
  { tier: 5, base: 42 },
  { tier: 6, base: 68 },
  { tier: 7, base: 110 },
  { tier: 8, base: 178 },
  { tier: 9, base: 288 },
  { tier: 10, base: 466 }
];

export const TIER_SYSTEM = {
  // Rango de poder por tier: [min, max]
  ranges: {
    1: [5, 7],
    2: [8, 12],
    3: [13, 19],
    4: [21, 31],
    5: [34, 50],
    6: [55, 81],
    7: [88, 132],
    8: [142, 214],
    9: [230, 346],
    10: [373, 559]
  } as Record<number, [number, number]>,
  // Rareza por tier
  //
  // **NO HAY TABLAS DE NOMBRES AQUÍ, Y ANTES SÍ HABÍA DOS.** Cada tier tenía tres
  // nombres escritos a mano (`companionNames` y `collectorNames`), y el item
  // sorteaba entre ellos. Era media partida del bug de B10: la base oculta —que
  // es lo que de verdad decide el daño— se sorteaba **aparte**, así que veinte
  // T1 con diez bases distintas se llamaban todos con tres nombres, y dos T1 con
  // el mismo nombre podían pegar 6 y 8.
  //
  // El nombre sale ahora de la base, en `nombres.ts`, y el lore de cada una vive
  // junto a ella, en `bases.ts`. Diez bases por tier y por lado, todas con
  // nombre, todas con lore y todas con su propio multiplicador.
  //
  rarityByTier: {
    1: 'Común',
    2: 'Común',
    3: 'Raro',
    4: 'Raro',
    5: 'Épico',
    6: 'Épico',
    7: 'Legendario',
    8: 'Legendario',
    9: 'Mítico',
    10: 'Divino'
  }
};

/**
 * Rango de poder de un tier, con fórmula más allá del 10 (forja infinita).
 *
 * 1-10: la tabla literal, que es el balance medido y no se toca. 11+: ×1,62
 * por tier desde el T10, la misma razón a la que crece el poder del 1 al 10.
 * Sin esta fórmula, un T11 forjado no tendría rango y caería en el `[1, 5]`
 * de reserva: un T11 con daño de T1.
 */
export function rangoDePoder(tier: number): [number, number] {
  const t = Math.max(1, Math.floor(tier) || 1);
  const literal = (TIER_SYSTEM.ranges as Record<number, [number, number]>)[t];
  if (literal) return literal;
  const RAZON = 1.62;
  const [min10, max10] = TIER_SYSTEM.ranges[10];
  const k = Math.pow(RAZON, t - 10);
  return [Math.max(1, Math.round(min10 * k)), Math.max(2, Math.round(max10 * k))];
}

/**
 * Rareza de un tier: la tabla hasta el 10, Divino de ahí en adelante.
 *
 * Antes se recortaba con `Math.min(tier, 10)` en cada sitio que la leía, y
 * cada recorte era una copia de la misma regla. La rareza máxima sigue siendo
 * la máxima: un T15 es Divino, no una rareza nueva que nadie enseña.
 */
export function rarezaDeTier(tier: number): string {
  const t = Math.max(1, Math.floor(tier) || 1);
  return (TIER_SYSTEM.rarityByTier as Record<number, string>)[t] ?? 'Divino';
}

// ==========================================================================
// Lore · una línea por nombre
//
// F13. Cada nombre de compañero y de recolector tiene su descripción, con la
// misma clave exacta que las tablas de arriba. Los exclusivos de caja y el
// Artillero Táctico (que solo sale de la caja rara) también tienen la suya:
// si un nombre puede llegar al almacén, tiene que tener lore (D4).
//
// El TIPO del compañero no va en el texto: lo pone la ficha al lado, con la
// cifra que cobra (`lineaTipoCompanion`). Un texto sobre "la tierra se
// quiebra" no dice si produce sin mirar o solo al clickear, y eso es lo que
// el jugador necesita para decidir si lo equipa.
// ==========================================================================

// ==========================================================================
//  F74 · EL LORE DE LOS COMPAÑEROS Y LOS RECOLECTORES, Y POR QUÉ NO ESTÁ AQUÍ
//
//  Antes ocupaba casi cien líneas de este bloque: tres nombres por tier y por
//  lado, cada uno con su frase. Ese contenido es el de `bases.ts` ahora, junto a
//  la base a la que pertenece —**diez bases por tier y por lado, no tres nombres**—
//  y cada una con su lore al lado, que es donde se revisa.
//
//  `lorePara()` de aquí abajo **cae a la base** cuando el nombre no está en esta
//  tabla, así que la ficha enseña el lore de la base sin que el almacén, la forja
//  ni la wiki tengan que saber nada nuevo. Y como el nombre de un item **es** el
//  de su base, el nombre y la frase salen de la misma línea de código: es la
//  única forma de que no puedan separarse.
//
//  `bases.ts` no importa nada de este fichero, así que esta flecha no es un
//  ciclo. Si algún día `bases.ts` necesitara un rango de aquí, esta importación
//  pasa a ser un `import type` o la función se mueve: el ciclo lo delata el
//  type-check, no el navegador.
// ==========================================================================

import { TODAS_LAS_BASES } from './bases';

export const LORE: Record<string, string> = {
  // F97 Lote 2d · Los tres buffers de compañero.
  'Buffer Pasivo': 'Un rato de más para los que trabajan solos.',
  'Buffer Click': 'Los golpes se repiten mejor cuando alguien marca el ritmo.',
  'Buffer Global': 'Un empujón que llega a todos, aunque no todos lo agradezcan.',
  'Artillero Táctico': 'Calcula cada salva para no desperdiciar ni un gramo.',
  // ------------------------------------------------- EXCLUSIVOS DE CAJA
  'Fantasma Cuántico': 'Existe y no existe, y en los dos estados se queda.',
  'Oráculo Tribal': 'Los ancianos predijeron tu riqueza.',
  'Avatar del Vacío': 'La nada trabajando, y cobrando por ello.',
  'Fénix de Datos': 'Renace de cada reinicio con más hambre.',
  'Centinela Eterno': 'Juró guardar tu base hasta el fin de los ciclos.',
  'Espectro Azulado': 'Solo sale de la legendaria. Por eso brilla.',
  // ---------------------------------------------------------- EXCLUSIVOS T11-T20
  'Guardián de la Última Veta': 'Vigila la veta más hondo del mapa. No es un turno: no se va nunca.',
  'Motor del Ocaso': 'Un click y se acaba el día. Después vuelve a empezar, y vuelve más fuerte.',
  'Coro de lo Primordial': 'Cantan en la misma nota desde antes de que hubiera quien los escuchara.',
  'Azote del Confín': 'No hace falta saber cómo funciona. Solo que llega desde el borde y llega.',
  'Forjador de Constelaciones': 'Fabrica estrellas con chatarra. Le sale bien porque lleva millones de años practicando.',
  'Yunque Infinito': 'No se desgasta. Todo lo que se pone encima sale mejor de como entró.',
  'Tejedor de Vacíos': 'Cose huecos entre cosas que no deberían tocarse. Lo que cose, queda entero.',
  'Arconte del Silencio': 'No hace ruido. Solo hace que los demás hagan más, sin que se note.',
  'Heraldo del Infinito': 'Anuncia lo que no tiene final. Y lo que anuncia, llega antes que él.',
  'La Última Mano': 'La que tocó la veta por última vez. Desde entonces, todo lo demás es segundo.',
  // =========================================================================
  //  F52 · EL LORE DE LOS OBJETOS QUE NO ERAN RECOLECTORES NI COMPAÑEROS
  //
  //  Arriba hay sesenta nombres de tier y seis exclusivos, y todos tienen su línea.
  //  **Los demás objetos del juego no tenían ninguna**: las cinco consumibles, los
  //  diez expansores, las tres tarjetas de ranura y las diez cajas tienen un
  //  `details` —"Sube 7 puntos la probabilidad"— y nada más.
  //
  //  Y ese `details` es una descripción mecánica, no un lore: dice lo que hace el
  //  objeto y no de dónde sale. La diferencia se ve en la ficha del almacén, que para
  //  un recolector enseña su línea de sabor y para una caja enseña solo la mecánica.
  //  **El jugador tenía veintiocho objetos sin una sola frase de sabor**, y son los
  //  que más se tocan: una caja es lo que se abre quince veces por hora.
  //
  //  **LAS REGLAS QUE CUMPLE ESTE BLOQUE, Y SON LAS DE ARRIBA.** Ni un número: el
  //  stat va al lado, en grande, y un "treinta segundos" en el lore es una segunda
  //  copia de una cifra que ya se lee. Ni una explicación de lo que hace: el
  //  `details` la pone justo encima y repetirla es hacer que la ficha tenga dos
  //  frases que dicen lo mismo y ninguna que diga algo.
  //
  //  **Y LA MISMA TABLA, PORQUE ES LA MISMA REGLA.** El lore se busca por nombre con
  //  `lorePara()`, así que añadir aquí una entrada hace que el objeto la encuentre sin
  //  tocar la ficha ni el almacén ni la forja. No hay un segundo sitio donde mirar el
  //  sabor de un objeto, y no lo hay por casualidad: habría sido el sitio donde los
  //  dos se separan.
  // -------------------------------------------------------------- CONSUMIBLES
  'Tarjeta AFK': 'La máquina sigue trabajando cuando tú cierras los ojos.',
  'Tarjeta Click x2': 'Diez segundos de dedos que no son los tuyos.',
  'Tarjeta Click x3': 'Préstamo del doble: se devuelve solo y cobra intereses.',
  'Piedra de Calibración': 'Alguien tuvo que medirlo antes de que lo fusieras.',
  'Nanopartícula de Estabilidad': 'Tan pequeña que decide cómo se rompe lo grande.',
  'Éter de Refinamiento': 'Le sopla al dado justo antes de que caiga.',
  // --------------------------------------------------------------- EXPANSORES
  // Cuatro tramos (F66). Las frases de los tramos segundo a cuarto vienen de los
  // expansores viejos que cubrían esa zona, para no perder el sabor; las diez
  // claves viejas se van con la tabla, porque un lore sin nombre que lo busque
  // es contenido inalcanzable (D4).
  'Expansor Inicial': 'Un centímetro más de pared, y ya no cabe lo que sobraba.',
  'Expansor Intermedio': 'La obra que siempre se aplazaba por falta de sitio.',
  'Expansor Avanzado': 'Ni una caja más en el suelo, que es como empezó esto.',
  'Expansor Supremo': 'El último metro cuadrado de la Cyber Base.',
  // ------------------------------------------------------- TARJETAS DE RANURA
  'Slot de Compañero 2': 'Uno ya no es compañía: es un puesto.',
  'Ranura de Escuadrón (ranuras 3 y 4)': 'Formación. Ya no son tres cosas sueltas.',
  'Ranura de Escuadrón (ranuras 5 y 6)': 'Y aquí ya no se cuentan: se siguen.',
  // -------------------------------------------------------------------- CAJAS
  // ------------------------------------------------------ CRISTALES
  'Cristal de Mejora': 'No se bebe. Se gasta, y por eso vale lo que vale.',
  'Caja T1': 'La que se podía abrir sin pedir permiso.',
  'Caja T2': 'Lleva tu nombre. La de al lado también lo lleva.',
  'Caja T3': 'Nadie recuerda quién la trajo ni de dónde.',
  'Caja T4': 'Cerrada con llave de la casa, y la casa no era esta.',
  'Caja T5': 'Empieza a saber a algo que no es chatarra.',
  'Caja T6': 'El precinto ya no es lo que se rompe primero.',
  'Caja T7': 'Hay que llevarla en dos manos y no basta.',
  'Caja T8': 'La etiqueta dice que no, en un idioma que ya no se habla.',
  'Caja T9': 'Lo que hay dentro pesa más de lo que debería pesar.',
  'Caja T10': 'La última que se sabe pensar. La de al lado ya no se.',
  'Caja T11': 'Nadie la pidió. Apareció junto a la otra, como si siempre hubiera estado.',
  'Caja T12': 'El precinto no es un cierre: es un aviso, y se saltó igualmente.',
  'Caja T13': 'Dentro hay algo que lleva dentro la marca de otra caja más alta.',
  'Caja T14': 'Pesa lo mismo que la anterior y jura que no.',
  'Caja T15': 'El número ya no es una etiqueta: es una dirección.',
  'Caja T16': 'La abren dos personas y solo cabe una. Se abre igual.',
  'Caja T17': 'Lo que prometía no ser la última, mintiendo en un idioma antiguo.',
  'Caja T18': 'Rinde más que cualquier caja anterior, y lo admite.',
  'Caja T19': 'Pesa poco. Todo lo que tiene dentro, pesa mucho.',
  'Caja T20': 'La última. La que se abre una vez y se recuerda siempre.',
};

/**
/**
 * El lore de un nombre, o `null` si no tiene.
 *
 * **ANTES TENÍA QUE CONOCER EL SUFIJO "SOBRECARGADO".** Un item sobrecargado
 * llevaba el nombre de su base más ese sufijo, así que la función hacía un
 * `replace()` para quitarlo y buscar el lore del nombre de verdad. Como el
 * sobrecargado ya no existe, el `replace()` se va con él: un nombre es su lore o
 * no lo es.
 *
 * Cualquier nombre sin entrada no tiene lore, y eso es lo que el banco
 * `loreCheck` vigila: un nombre sin lore es contenido a medias (D4).
 *
 * **Y SI NO ESTÁ EN LA TABLA, SE MIRA EN LA BASE.** El nombre de un compañero o
 * un recolector **es** el de su base, y su lore vive con ella, en `bases.ts`.
 * Antes eran dos tablas y podía desincronizarse: hoy el nombre y la frase salen
 * de la misma línea de código, que es la única forma de que no puedan separarse.
 *
 * El orden importa: primero esta tabla, y solo si no está, la base. Así un
 * consumible o un exclusivo de caja —que sí viven aquí— no pierde su lore por
 * tener un nombre parecido al de una base.
 *
 * **Y LO QUE NO HACE.** No adivina: un nombre que no es de esta tabla ni el de
 * ninguna base devuelve `null`, no un texto vacío ni el de otro. Un item mal
 * escrito se queda **sin historia a la vista**, que es justo lo que hay que ver,
 * en vez de enseñar la de un objeto que no es.
 */
export function lorePara(nombre: string): string | null {
  if (!nombre) return null;
  const propio = LORE[nombre];
  if (propio) return propio;
  return TODAS_LAS_BASES.find(b => b.nombre === nombre)?.lore ?? null;
}

/**
 * Lo que hace un compañero, en una línea con su cifra.
 *
 * Va AL LADO del lore y no dentro: el lore es sabor y esto es la decisión de
 * equiparlo. Un `multiplier` no tiene cifra propia —multiplica a los demás—,
 * así que enseña su × en vez de un +N que nadie cobra.
 */
export function lineaTipoCompanion(tipo: string, power: number): string {
  if (tipo === 'multiplier') {
    const mult = Math.round((1 + power) * 100) / 100;
    return `Multiplica la recolección ×${mult}`;
  }
  if (tipo === 'passive') return `Recolección por segundo: +${power}/s`;
  return `Recolección por segundo: +${power}/s (tipo click)`;
}
