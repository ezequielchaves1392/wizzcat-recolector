// ==========================================================================
// Fusión, autoría y potencial · recolectores y compañeros
//
// Reglas de diseño que sostienen el sistema:
//
//  1. FUSIÓN: **2** recolectores del mismo tier T -> 1 recolector de tier T+1.
//     El número vive en `MATERIALES_POR_FUSION`, y la página de la forja lo lee de
//     ahí en vez de escribirlo.
//
//     **AQUÍ ESTABA EN 3, Y EL MOTOR NUNCA LLEGÓ A TENERLO.** La receta se pasó a
//     dos y solo se actualizó la comprobación del motor; en la página quedaron
//     cinco restos, con lo que **la forja no se podía usar**: los dos huecos del
//     yunque se llenaban y el botón se quedaba inactivo para siempre. El número de
//     materiales de una receta no se escribe en dos sitios. Está escrito aquí el
//     motivo por el que se quedó en 2, porque sigue siendo la decisión viva:
//
//     La razón original de pedir tres era que con dos el jugador solo tiene una
//     decisión binaria, y con tres elige **cuáles** tres. **Esa razón ya no se
//     sostiene**: desde que los afijos los deciden los padres **en cantidad además
//     de en cuáles** (`rangoDeAfijosForjados()`), elegir dos materiales buenos es
//     una decisión con peso, no una moneda. Y tres materiales además de tres
//     confirmaciones y un yunque de tres huecos es más fricción de la que vale.
//
//  2. AUTORÍA: todo recolector crafteado registra quién la forjó. Es lo que hace que
//     dos recolectores del mismo tier no sean el mismo objeto. Un recolector de otro
//     jugador vale más en el mercado, pero no rinde más: son dos ejes separados.
//
//  3. POTENCIAL: 1..5 estrellas, determinado por la rareza de los materiales,
//     su nivel y el uso de Piedras de Calibración. El potencial sube el techo
//     de nivel (20 normal, hasta 35 con 5 estrellas) y multiplica el valor:
//     es lo que hace que un recolector crafteado sea claramente superior a una de
//     tienda del mismo tier.
//
//  4. HERENCIA: la nueva recolector conserva 1..3 afijos de los materiales. Con
//     más estrellas, más afijos. Los afijos se eligen al azar del pool, pero
//     con pesos: los raros pesan menos.
//
//  5. IDENTIDAD: cada recolector conserva quién la forjó, para que el objeto sea
//     único y el mercado tenga historia. Un recolector hecha por alguien conocido
//     vale más en la tienda, pero rinde lo mismo en tu daño: son dos ejes
//     separados a propósito, para que la fama no se compre con dinero.
//
//  6. COMPENSACIÓN POR FALLO: al fallar se pierden los dos materiales, pero
//     se ganan esquirlas proporcionales al tier. Sin esto, una racha mala
//     vacía el almacén y el jugador deja de intentarlo; con esto, cada fallo
//     acerca un poco la garantía del siguiente intento.
// ==========================================================================

import type { Affix, Rarity, CollectorItem } from '../types/domain';
import { rangoDePoder, rarezaDeTier, TIER_SYSTEM } from './tiers';
import { nombreDe } from './nombres';

// --------------------------------------------------------------------------
// Atributos
// --------------------------------------------------------------------------

// ==========================================================================
//  Atributos
//
//  **NINGÚN afijo da daño plano, y no es una preferencia de redacción.** Cuatro de
//  ellos lo hagan (`flatDamage` / `flatPassive`: +60, +40, +8 y +18) y rompen
//  items de tier bajo sin avisar: un "+60 de daño plano" en un T1, cuya base es 5,
//  más que triplica el item. Y no se ve en el banco, porque el banco comprueba
//  que el afijo exista, no que el item al que se lo pone siga siendo razonable.
//
//  Por eso TODOS son porcentajes, o porcentajes por nivel. Un +35% da 1,75 en un
//  T1 y 238 en un T10: escala con el item, no lo rompe. Los que dependen del
//  nivel (`clickMultPorNivel`, `passiveMultPorNiveles`) también son porcentajes,
//  así que subir de nivel sigue valiendo pero nunca se sale del item.
// ==========================================================================

export const AFFIXES: Affix[] = [
  { id: 'aff_sharp', name: 'Afilado', description: '+18% al daño de click.', rarity: 'Raro',
    effect: { clickMult: 0.18 } },
  { id: 'aff_rapid', name: 'Cadencia', description: '+12% al daño de click.', rarity: 'Raro',
    effect: { clickMult: 0.12 } },
  { id: 'aff_yield', name: 'Rendimiento', description: '+20% al ingreso pasivo.', rarity: 'Raro',
    effect: { passiveMult: 0.20 } },
  { id: 'aff_flow', name: 'Flujo', description: '+14% al ingreso pasivo.', rarity: 'Raro',
    effect: { passiveMult: 0.14 } },
  { id: 'aff_bulwark', name: 'Baluarte', description: '+35% al daño de click.', rarity: 'Épico',
    effect: { clickMult: 0.35 } },
  { id: 'aff_core', name: 'Núcleo', description: '+25% al ingreso pasivo.', rarity: 'Épico',
    effect: { passiveMult: 0.25 } },
  { id: 'aff_crit', name: 'Crítico', description: '+8% de probabilidad de crítico (×2 daño).', rarity: 'Épico',
    effect: { critChance: 0.08 } },
  { id: 'aff_focus', name: 'Foco', description: '+14% de probabilidad de crítico.', rarity: 'Legendario',
    effect: { critChance: 0.14 } },
  { id: 'aff_luck', name: 'Suerte de Forja', description: '+10% a la probabilidad de crafteo del recolector.', rarity: 'Legendario',
    effect: { craftLuck: 0.10 } },
  { id: 'aff_ephemeral', name: 'Efenéreo', description: '+35% a ambos multiplicadores.', rarity: 'Legendario',
    effect: { clickMult: 0.35, passiveMult: 0.35 } },
  { id: 'aff_eternal', name: 'Eterno', description: '+2% de daño por cada nivel del recolector.', rarity: 'Mítico',
    effect: { clickMultPorNivel: 0.02 } },
  { id: 'aff_absorb', name: 'Absorción', description: '+5% de ingreso por cada 5 niveles.', rarity: 'Mítico',
    effect: { passiveMultPorNiveles: 0.05 } },
  { id: 'aff_prime', name: 'Primo', description: '+55% a todos los multiplicadores del recolector.', rarity: 'Mítico',
    effect: { clickMult: 0.55, passiveMult: 0.55 } },
  { id: 'aff_void', name: 'Vacío Devorador', description: '+25% al daño, +25% al pasivo, +10% crítico.', rarity: 'Divino',
    effect: { clickMult: 0.25, passiveMult: 0.25, critChance: 0.10 } }
];

export const AFFIX_BY_ID: Record<string, Affix> = Object.fromEntries(AFFIXES.map(a => [a.id, a]));

/** Techo de nivel de un recolector que no lo trae: los de la tienda. */
export const BASE_COLLECTOR_MAX_LEVEL = 20;

/** Cuántos niveles extra da cada estrella de potencial. */
const MAX_LEVEL_PER_POTENTIAL = 3;

/**
 * El techo de niveles de un recolector.
 *
 * Recibe el `maxLevel` del item y no el item entero. Una razón es que la regla es
 * sobre un número y no necesita conocer la forma del item. La otra es la que
 * cuesta: `{ maxLevel?: number }` es un *weak type* —todos sus campos opcionales—
 * y TypeScript rechaza con TS2559 cualquier objeto que no comparta ninguna
 * propiedad con él, así que un `WarehouseItem` no se le puede pasar ni con el
 * tipo bien puesto.
 *
 * POR QUÉ ESTA FUNCIÓN Y NO UN `?? 20` EN CADA SITIO. El techo se escribía a mano
 * en cinco sitios y los cinco no coincidían: la ficha del almacén, el panel del
 * jugador, la valoración y el desglose usaban `item.maxLevel ?? 20`, el game loop
 * comparaba contra una constante de 20 y el selector de cristales contra un 35 a
 * pelo. De ahí dos bugs que no se parecían: un recolector forjado con techo 28
 * llegaba al 20 y el juego respondía "ya no puedes" mientras la barra de la ficha
 * seguía llegando a 28; y un recolector de la tienda en su nivel 20 abría el
 * selector, gastaba el cristal y le rechazaban la sintonización.
 *
 * El techo pertenece a la MISMA regla que lo crea —`maxLevel: 20 + potencial * 3`
 * más abajo en este mismo fichero—, así que vive aquí y lo leen el motor y las
 * vistas por igual. Una regla compartida escrita cinco veces no está compartida:
 * está copiada, y las copias divergen.
 *
 * Si el item no trae `maxLevel` es que viene de la tienda, y esos topan en 20. Un
 * `maxLevel` de 0 o negativo también cae al de base: es dato corrupto, y tratarlo
 * como "techo cero" dejaría al recolector sin poder subir nunca.
 */
export function collectorMaxLevel(maxLevel?: number | null): number {
  if (typeof maxLevel === 'number' && maxLevel > 0) return maxLevel;
  return BASE_COLLECTOR_MAX_LEVEL;
}

/**
 * Cristales que cuesta subir del nivel dado al siguiente.
 *
 * Vive AQUÍ y no en `gameLoop.ts` por una razón concreta: es la mitad de la
 * sintonización, y la otra mitad —la probabilidad de éxito,
 * `crystalSuccessChance()` en `data/items.ts`— ya vivía en `data/`. Una regla
 * partida en dos sitios es una regla que se puede tocar por un lado y olvidar por
 * el otro.
 *
 * 1,1,2,2,3,3,5,6,8,9,11,14,17,21,26,32,40,50,63,79 -> 456 cristales en total,
 * 91 200 nanitas con el cristal a 200.
 *
 * POR QUÉ SUBIÓ DE 1.14 A 1.26. Antes subir a nivel 20 costaba 100 cristales, que
 * a 60 cada uno salían 6 000 nanitas: menos del 4% de un T10. No había nada que
 * decidir, era un botón. Ahora subir al máximo cuesta la mitad del recolector,
 * que es la relación que hace que "¿llevo esto a 15 o a 16?" sea una pregunta de
 * verdad.
 *
 * Y por qué NO depende del tier del recolector, que es lo tentador: porque el
 * coste es POR INTENTO, no por item. Sube un T1 y sale carísimo; sube un T10 y
 * sale la mitad de su precio. La consecuencia buscada es que no se desperdicie
 * cristal en un recolector malo, que es justo lo que se quiere: el jugador
 * invierte en lo que le va a durar la partida.
 */
export function collectorUpgradeCost(level: number): number {
  return Math.max(1, Math.floor(1.2 * Math.pow(1.26, level)));
}

// --------------------------------------------------------------------------
// Probabilidad de éxito
// --------------------------------------------------------------------------

/**
 * La BASE de recolección de un tier: el daño de un item antes de que el
 * potencial le sume nada.
 *
 * Es el mínimo del rango que ya tenía cada tier, y no un número nuevo: así el
 * precio de la carta, que se calibró contra ese rango, y el daño del item salen
 * del mismo sitio (R2). `rangoDePoder` pasa a ser la referencia de precio y la
 * tabla que el jugador ve, y el daño sale de aquí.
 *
 * Y hay que subirla un poco, y el motivo es la única cosa rota que traen los
 * multiplicadores: **con la base en el mínimo del rango, los tiers se solapan**.
 * El T1 va de 6 (★1) a 10 (★5) y el T2 de 10 (★1) a 16 (★5), así que un T1
 * perfecto iguala a un T2 normal, y "más tier es más daño" deja de ser cierto.
 * Compra por probabilidad, no por tier.
 *
 * Por eso se sube un 20% la base de cada tier por encima del mínimo del rango:
 * el T1 pasa a 7-14 y el T2 a 11-22, y ahora **el peor T2 supera al mejor T1**.
 * Que la progresión sea legible vale más que encajar el daño con una tabla que
 * estaba calibrada cuando el daño no tenía azar.
 */
export function baseDeTier(tier: number): number {
  const t = Math.max(1, tier);
  const minT1 = rangoDePoder(1)[0];
  // Razón por tier. El rango crece ×1,62, que es MENOS de 1,67, y como el
  // potencial llega a ×2,0 dos tiers atrás empatan con este de aquí. Con 1,75
  // hay separación real, y la progresión se lee: subir de tier siempre mejora,
  // potential o no.
  const RAZON = 1.75;
  const ideal = minT1 * Math.pow(RAZON, t - 1);
  if (t === 1) return Math.round(ideal);
  // El `+1` es para el redondeo. En los tiers bajos —donde los números son de
  // una o dos cifras— 18 redondeados se empatan con 18 redondeados, y eso es un
  // empate real, no un detalle de la tabla: sin él un T3 con ★1 igualaría a un
  // T2 con ★5 y volvería a comprarse por potencial en vez de por tier.
  const minimo = baseDeTier(t - 1) * 2 + 1;
  return Math.max(Math.round(ideal), minimo);
}

/**
 * El daño BASE de un item: su base de tier por el potencial.
 *
 * Cada estrella es un 20%, y **el potencial 1 ya es +20%** — o sea que ★5 es
 * exactamente el doble de la base, que es la perfección del 100%. El ejemplo que
 * lo fija: base 5 con ★5 da 10.
 *
 *   ★1 = ×1,2 · ★2 = ×1,4 · ★3 = ×1,6 · ★4 = ×1,8 · ★5 = ×2,0
 *
 * **Esto es el daño del item, no el del click.** Sobre él siguen actuando el
 * nivel (los cristales), la rareza y los afijos. Aquí no hay ninguno de esos, y
 * deliberadamente: el potencial es la ÚNICA escala que multiplica la base, y por
 * eso no lleva además un segundo multiplicador encima — ese error sí estaba, y
 * por eso el potencial nunca llegaba a ×2.
 *
 * **Consecuencia de balance:** como esto es un multiplicador y el rango viejo no
 * lo era, el techo de daño de cada tier **se multiplica por 2**. El T5 pasa de un
 * rango de 34-50 a una base de 34 que con ★5 da 68. Las proporciones entre tiers
 * se conservan porque todos se mueven igual, pero el precio por punto baja en
 * todos a la vez, y `balanceCheck` mide esa banda.
 */
export function danioDeRango(tier: number, potential: number): number {
  return Math.round(baseDeTier(tier) * (1 + 0.2 * potencialNormalizado(potential)));
}

/** El potencial entero 1..5, para que nadie tenga que repetir el recorte. */
export function potencialNormalizado(potential: number | undefined): number {
  const p = Math.round(Number(potential));
  return Number.isFinite(p) && p >= 1 && p <= 5 ? p : 3;
}

/**
 * EL POTENCIAL DE UN ITEM FUSIONADO: LA MEDIA DE LOS MATERIALES.
 *
 * **LA USA LOS DOS, Y POR QUÉ NO ESTÁ ESCRITA DOS VECES.** El recolector y el
 * compañero heredan su calidad de la media de sus dos materiales, y esa es la
 * regla que hace útil la forja. Escrita en los dos sitios, un día una redondea
 * distinto de la otra y el jugador forja un par de recolectores y se encuentra
 * con un compañero que no se parece en nada.
 *
 * **CADA LLAMANTE RESUELVE SUS PROPIOS MATERIALES ANTES DE LLAMAR.** El
 * recolector infiere el potencial del daño cuando no lo tiene guardado —hay
 * items viejos que no lo traían—, y el compañero lo tiene en la ficha. Aquí solo
 * entra una lista de números.
 *
 * **Y EL EMPATE SUBE, QUE ES LO QUE HACE ESTA FUNCIÓN Y NO OTRA.**
 * `Math.round(4,5)` es 5 en JavaScript, así que **fusionar un 4 con un 5 puede
 * dar un 5**. No es un descuido: es lo que hace `Math.round`, y el día que se
 * puso nadie se paró a mirarlo. Las dos consecuencias:
 *
 * - Un 4 solo es material de fusión de un 5, nunca de un 5 con otro 5 —porque
 *   eso da 5 y habrías perdido el 4 por nada.
 * - Un compañero con potencial 4 no tiene a quién fusionarse sin perderlo.
 *
 * Si algún día esto se cambia a redondear hacia abajo, es **esta línea**, y las
 * pruebas que la fijan están en `forjaCheck`. Con 5, 5 sale 5 y con 3, 3 sale 3:
 * eso no cambia con ninguna de las dos reglas.
 */
export function potencialFusionado(pots: Array<number | undefined>): number {
  if (pots.length === 0) return 3;
  // `undefined` entra y `potencialNormalizado()` lo pone a 3, que es lo que hace
  // con cualquier valor fuera del 1..5: un material sin potencial se funde como
  // uno normal, y no se inventa nada.
  const medio = pots.reduce<number>((a, p) => a + potencialNormalizado(p), 0) / pots.length;
  return Math.max(1, Math.min(5, Math.round(medio)));
}

/**
 * LAS ESTRELLAS DE UN ITEM, SIEMPRE 1 A 5.
 *
 * **POR QUÉ ESTA FUNCIÓN Y NO UN `? '★'.repeat(...)` EN CADA PANTALLA.** Porque el
 * bug era justo ese: siete sitios pintaban `${item.potential ? estrellas : ''}`, y
 * un item **sin** potencial —o con un 0— se pintaba **sin ninguna estrella**. No
 * como cero estrellas: como si no tuviera potencial. Y eso es peor que mentir por
 * una unidad, porque un item sin estrellas parece un item viejo o malgenerado, y
 * el jugador lo descarta sin mirar el daño.
 *
 * La diferencia se ve en el caso real: un recolector con daño 5 y potencial 3 se
 * pintaba sin nada, y otro con daño 8 y potencial 3 se pintaba con tres. El jugador
 * los comparaba y no veía ninguna diferencia, cuando uno pega un 60 % más.
 *
 * `potencialNormalizado` es la que hace el trabajo: un potencial ausente, un 0, un
 * 7 o una cadena son todos el mismo caso, y ese caso es ★3. Que se pinte ★3 es
 * decir la verdad, porque después de `migraPotenciales()` el daño de ese item es
 * el de ★3.
 *
 * **Y NINGÚN BANCO PODRÍA HABERLO VISTO.** La lógica estaba en las plantillas, que
 * no se ejecutan: `verify/` prueba el motor, no el HTML. Por eso esta función
 * existe, y por eso los siete sitios la llaman.
 */
export function estrellasDe(potential: number | undefined): string {
  return '★'.repeat(potencialNormalizado(potential));
}

/** Cuántas estrellas tiene, como número. Para leer el techo y las comparaciones. */
export function estrellasNumeroDe(potential: number | undefined): number {
  return potencialNormalizado(potential);
}

/**
 * El potencial Y el daño de un item viejo, siempre de acuerdo entre sí.
 *
 * Va al revés que `danioDeRango` a propósito: se usa para lo que ya estaba
 * guardado antes de que existiera el campo del potencial.
 *
 * **POR QUÉ DEVUELVE LOS DOS Y NO SOLO EL POTENCIAL.** Porque el potencial sin el
 * daño no sirve de nada: si un item tiene ★3 y su daño no es el de ★3, entonces
 * **la estrella miente**. Y una estrella que miente es peor que no tener
 * estrellas, porque el jugador compara dos items por un número que no es el que
 * pinta. Devolver los dos juntos hace que sea imposible separarlos.
 *
 * **EL POTENCIAL ES EL MÁS CERCANO, Y A EMPATES EL MENOR.** Lo segundo evita el
 * regalo: si dos potenciales dan el mismo error, gana el menor, así que un empate
 * nunca **sube** a nadie. Redondear siempre hacia arriba sería un regalo
 * silencioso a todo el que juega desde antes del campo.
 *
 * **LO PRIMERO NO ES «EL CAMBIO MÁS PEQUEÑO», Y HAY QUE DECIRLO.** Elegir el más
 * cercano limita el movimiento a **medio escalón**, pero no lo deja en cero: la
 * base de cada tier subió un 20 % sobre el mínimo del rango viejo y el potencial
 * la multiplica hasta ×2, así que el suelo nuevo queda **por encima** de casi todo
 * lo que había. Concretamente, un recolector T3 del juego viejo iba de 13 a 19 y
 * el suelo nuevo es 28: **casi todos los items viejos suben**, y en el T3 es de
 * unos 15 a 28.
 *
 * Eso no lo decide esta función, lo decidió F33 al subir la escala, y aquí solo se
 * aplica a lo que se guardó antes. La alternativa —dejar el daño viejo y que las
 * estrellas sean una aproximación— deja **un item con ★3 que pega como un ★1**,
 * que es justo lo que hay que arreglar. Corregir el dato para que cumpla la regla
 * es mejor que dejar la regla rota, pero **es una subida de daño para las partidas
 * viejas y es una decisión de balance, no un detalle de migración**: está escrita
 * en PENDIENTES.md para que sea visible y para que el sitio donde se revierte, si
 * algún día toca, sea esta función.
 */
export function potencialYDanoDe(
  tier: number, damage: number
): { potential: number; damage: number } {
  const d = Number(damage);
  if (!Number.isFinite(d) || d <= 0) {
    return { potential: 3, damage: danioDeRango(tier, 3) };
  }
  let potential = 3;
  let mejorError = Infinity;
  for (let p = 1; p <= 5; p++) {
    const error = Math.abs(danioDeRango(tier, p) - d);
    // `<` y no `<=`: a igualdad de error se queda con el potencial MENOR, y así
    // un empate nunca sube a nadie.
    if (error < mejorError) {
      mejorError = error;
      potential = p;
    }
  }
  return { potential, damage: danioDeRango(tier, potential) };
}

/**
 * El daño que explica el que un item YA tiene.
 *
 * Envoltorio delgado sobre `potencialYDanoDe()`, porque la regla tiene que vivir
 * en un sitio. La mitad del daño se tira aquí a propósito: quien solo lee el
 * potencial no debe tener a mano una cifra que no ha recalculado.
 */
export function potencialDeDanio(item: CollectorItem): number {
  return potencialYDanoDe(item.tier, item.damage ?? 0).potential;
}

/**
 * El potencial que trae un item, deducido del daño si no lo trae.
 *
 * Los items viejos no tienen el campo, y ponerles un 3 a pelo cambiaría su
 * daño al punto medio al abrir la partida —eso sí sería tocarle el progreso al
 * jugador. Deducirlo del daño que ya tienen los deja intactos.
 *
 * **ESTO SOLO LEE. Quien vaya a ESCRIBIR tiene que usar `migraPotenciales()`**,
 * que además deja el daño de acuerdo con el potencial. Un item con el potencial
 * deducido y el daño viejo es un item que miente por la pantalla.
 */
export function potencialDe(item: CollectorItem): number {
  const p = item.potential;
  return typeof p === 'number' && p >= 1 && p <= 5 ? p : potencialDeDanio(item);
}

/**
 * Todo recolector con daño tiene potencial, y su daño es el de su potencial.
 *
 * **ES LA MIGRACIÓN, Y ES POR QUÉ EL CAMPO NO ES OPCIONAL.** El potencial apareció
 * después que los items, así que hay partidas guardadas con recolectores sin el
 * campo. `potencialDe()` ya los leía como ★3 sin más, y eso era una mentira
 * silenciosa: un item con daño 5 se pintaba ★3, y ★3 valen 8. El jugador comparaba
 * dos items por un número que no era el de las estrellas.
 *
 * Aquí se escribe el campo **y se recalcula el daño para que cuadre**, que es lo
 * único que hace que las estrellas sean verdad. Cada item se mueve como mucho medio
 * escalón, porque `potencialYDanoDe()` elige el potencial más cercano.
 *
 * **PERO «COMO MUCHO MEDIO ESCALÓN» NO ES «CASI NADA».** La escala nueva está por
 * encima de la vieja en casi todos los tiers —un T3 del juego viejo iba de 13 a
 * 19 y el suelo nuevo es 28—, así que **esta migración sube el daño de los items
 * viejos**. Es aplicar la regla a datos que se guardaron antes de que existiera, y
 * no un retoque: está anotado en PENDIENTES.md porque es decisión de balance y
 * porque el sitio donde se revierte, si algún día toca, es esta función.
 *
 * **COMPRUEBA TAMBIÉN LOS QUE YA LO TIENEN.** Una partida guardada a medio camino
 * de una versión intermedia puede traer un ★5 con el daño de un ★1, y eso no lo
 * arregla esperar a la próxima carga. Cuesta una comparación.
 *
 * **Y DEVUELVE EL MISMO ARRAY CUANDO NO HAY NADA QUE HACER**, para que el
 * llamante pueda usarlo como prueba de "esto no se ha tocado".
 */
export function migraPotenciales(items: any[]): { items: any[]; changed: boolean } {
  let changed = false;
  const salida = items.map((w) => {
    if (w?.type !== 'collector') return w;
    const tiene = typeof w.damage === 'number' && Number.isFinite(w.damage) && w.damage > 0;
    const { potential, damage } = tiene
      ? potencialYDanoDe(w.tier ?? 1, w.damage)
      : { potential: potencialNormalizado(w.potential), damage: 0 };

    const potencialYaVa = typeof w.potential === 'number' && w.potential >= 1 && w.potential <= 5;
    if (potencialYaVa && w.potential === potential && w.damage === damage) return w;

    changed = true;
    // El `details` se rehace porque es lo que se pinta, y un item cuyo texto dice
    // "+5" mientras su daño es 6 es exactamente el bug que se está arreglando.
    return {
      ...w,
      potential,
      damage,
      details: damage > 0 ? `Recolección por click: +${damage}` : w.details
    };
  });
  if (!changed) return { items, changed: false };
  return { items: salida, changed: true };
}

/**
 * Lo mismo para los compañeros, cruzando `state.companions` con su ficha.
 *
 * **SON DOS LISTAS Y POR QUÉ.** El poder del compañero vive en `power`, que solo
 * está en `state.companions`; la ficha del almacén no lo tiene, solo el texto de
 * `details`. Un solo recorrido con un `if` por tipo acabaría sirviendo para uno y
 * estropeando al otro.
 *
 * **A UN COMPAÑERO VIEJO SE LE PONE ★3 Y NO SE LE TOCA EL PODER.** El poder del
 * compañero **es** la posición en el rango del tier (`poderDeCompanero`), no una
 * escala aparte, así que de un poder suelto no se puede deducir un potencial
 * exacto: el mismo 6 es ★3 en el T1 y ★1 en otro sitio. ★3 es el punto medio y es
 * lo que ya se leía antes de este cambio. Recalcular el poder sí sería tocarle el
 * ingreso al jugador, y eso no lo hace una migración.
 *
 * **LA FICHA SE CORRIGE DESDE AQUÍ, POR ID, Y NO LEYENDO `details`.** Parsear una
 * cadena para sacar un número es la forma más corta de que un cambio de redacción
 * rompa la migración en silencio. El número de verdad está en el compañero real, y
 * las dos cosas comparten el id justo para poder cruzarlas.
 */
export function migraPotencialesDeCompaneros(
  companeros: any[], fichas: any[]
): { companeros: any[]; fichas: any[]; changed: boolean } {
  let changed = false;
  const reparados = new Map<string, number>();

  const nuevosComp = (companeros ?? []).map((c) => {
    if (c?.type !== 'companion') return c;
    const tiene = typeof c.potential === 'number' && c.potential >= 1 && c.potential <= 5;
    if (tiene) return c;
    changed = true;
    reparados.set(c.id, 3);
    return { ...c, potential: 3 };
  });

  const nuevasFichas = (fichas ?? []).map((f) => {
    if (f?.type !== 'companion') return f;
    const tiene = typeof f.potential === 'number' && f.potential >= 1 && f.potential <= 5;
    const reparado = reparados.get(f.id);
    if (tiene || reparado === undefined) return f;
    changed = true;
    return { ...f, potential: reparado };
  });

  if (!changed) return { companeros, fichas, changed: false };
  return { companeros: nuevosComp, fichas: nuevasFichas, changed: true };
}

/**
 * La probabilidad de cada potencial, y es **decreciente a propósito**: sacar un
 * ★1 tiene que ser mucho más fácil que sacar un ★5, porque el ★5 es ×2 y el ★1
 * es ×1,2. Con un reparto plano, uno de cada cinco items sería perfecto y buscar
 * uno dejaría de ser una búsqueda.
 *
 * `★5` sale un 3%: con la forja promediando, dos ★5 son el camino al item
 * perfecto, y por eso tiene que ser raro y no regalado.
 */
export const POTENTIAL_WEIGHTS: Record<number, number> = {
  1: 0.50, 2: 0.25, 3: 0.15, 4: 0.07, 5: 0.03
};

/**
 * Potencial 1..5 al crear un item nuevo.
 *
 * Sale del dado: es la lotería de la tienda y de las cajas. **La forja no lo
 * tira, lo promedia**, y esa es justo la diferencia entre las dos vías.
 */
export function rollPotentialFrom(rng: () => number = Math.random): number {
  const t = rng();
  let acum = 0;
  for (let p = 1; p <= 5; p++) {
    acum += POTENTIAL_WEIGHTS[p];
    if (t < acum) return p;
  }
  return 5;
}

/**
 * Dónde cayó un material dentro del rango de su tier, de 0 a 1.
 *
 * Es la regla de F33: lo que se mezcla al forjar **no es el daño, es la
 * posición**. Un T10 tirado en 373 y otro en 559 no valen lo mismo aunque los dos
 * sean T10, y esa diferencia es la que hace que buscar el item perfecto sea una
 * decisión y no una casualidad.
 *
 * **Se recorta a 0..1 a propósito**, y por dos motivos que no son hipotéticos:
 * el daño de un item sube con el potencial y con los afijos, y el de uno ya
 * sintonizado sube con el nivel. Sin el recorte, un T5 de nivel 20 daría una
 * posición de 4 y el forjado siempre saldría en el tope — o sea, la forja
 * premiaría haber invertido antes en vez de en elegir bien el material.
 */
export function posicionEnRango(item: CollectorItem): number {
  return (potencialDeDanio(item) - 1) / 4;
}

/** Probabilidad base de éxito de una fusión de tier T → T+1. */
export function baseSuccessChance(fromTier: number): number {
  // T1 78% → T10 33%. Del T11 en adelante pisa el suelo del 30%: la curva
  // creciente de F34 (60/68/75) está propuesta pero sin visto bueno, así que
  // no se toca el signo hasta que lo haya. El suelo evita el absurdo de una
  // probabilidad negativa en tiers altos.
  return Math.max(0.30, 0.78 - (fromTier - 1) * 0.05);
}

/** Chance final = base + pasivas + piedras, topado a 95%. */
export function successChance(
  fromTier: number,
  craftLuck: number,
  stonesUsed: number,
  affixLuck: number,
  nanoUsed = 0
): number {
  const base = baseSuccessChance(fromTier);
  // Cada piedra: +12%. Se topan a 5 piedras por fusión.
  const stones = Math.min(5, stonesUsed) * 0.12;
  // La nanopartícula da +8% y además garantiza un afijo extra. Aporta menos
  // puntos que una piedra pero hace dos cosas, que es la razón por la que es
  // un objeto raro y no un consumible más.
  const nano = nanoUsed > 0 ? 0.08 : 0;
  const total = base + craftLuck + stones + affixLuck + nano;
  return Math.min(0.95, total);
}

// --------------------------------------------------------------------------
// Potencial
// --------------------------------------------------------------------------

/**
 * Potencial 1..5. Sube con:
 *  - Materiales de rareza alta (sobrecargados/míticos)
 *  - Recolectores de nivel alto (invertidas en experiencia, no en dinero)
 *  - Piedras de Calibración usadas
 */
export function rollPotential(materials: CollectorItem[], stonesUsed: number): number {
  let score = 1;

  // Cada material aporta según rareza y nivel
  for (const m of materials) {
    const rarityScore = RARITY_WEIGHT[m.rarity] ?? 0;
    const levelScore = (m.level || 0) * 0.06;
    score += rarityScore * 0.4 + levelScore;
  }

  score += stonesUsed * 0.25;

  // Redondea a potencial entero con algo de azar para que no sea determinista
  const jitter = (Math.random() - 0.5) * 0.8;
  return Math.max(1, Math.min(5, Math.round(score + jitter - 0.5)));
}

const RARITY_WEIGHT: Record<Rarity, number> = {
  'Común': 0, 'Raro': 0.5, 'Épico': 1, 'Legendario': 1.6, 'Mítico': 2.4, 'Divino': 3.2
};

// --------------------------------------------------------------------------
// Nombres de recolectores crafteadas
// --------------------------------------------------------------------------

const FORGE_PREFIX = ['Forja de', 'Espuela de', 'Nucleo de', 'Herencia de', 'Sello de', 'Yunque de'];
const FORGE_NOUN = ['Vórtice', 'Éclipsis', 'Confín', 'Ceniza', 'Éter', 'Nébula', 'Duna', 'Ónix', 'Zafiro', 'Cobalto'];

/** Nombre generado: "Forja de Ceniza" + sufijo de linaje. */
export function forgeCollectorName(potential: number, tier: number, rng = Math.random): string {
  const p = FORGE_PREFIX[Math.floor(rng() * FORGE_PREFIX.length)];
  const n = FORGE_NOUN[Math.floor(rng() * FORGE_NOUN.length)];
  const tierSuffix = tier >= 11 ? ' PRIMIGENIA' : tier >= 9 ? ' SINGULAR' : '';
  const potSuffix = potential >= 5 ? '·Absoluta' : potential >= 4 ? '·Prima' : '';
  return `${p} ${n}${tierSuffix}${potSuffix}`;
}

// --------------------------------------------------------------------------
// Fusión
// --------------------------------------------------------------------------

export interface ForgeResult {
  success: boolean;
  collector?: CollectorItem;
  /** Esquirlas ganadas por el fallo. */
  shards?: number;
  chanceUsed?: number;
  error?: string;
}

/**
 * CUÁNTOS MATERIALES ENTRAN EN UNA FUSIÓN.
 *
 * **ESTE NÚMERO ESTABA ESCRITO A MANO EN SEIS SITIOS, Y CINCO DECÍAN 3.**
 *
 * La receta se cambió de 3 materiales a 2 y solo se actualizó la comprobación del
 * motor. En la página de la forja quedaron cuatro restos: el tope de la selección,
 * la condición de "puedo forjar", el contador `x/3` y el texto "selecciona 3".
 * Con eso **la forja no se podía usar**: los dos huecos del yunque se llenaban,
 * `ready` pedía tres y el botón se quedaba inactivo para siempre. Si se llegaba a
 * tres, el motor rechazaba la fusión con "se necesitan 2". Y el propio modal de
 * confirmación decía "Dos recolectores de tier N", así que la página se contradecía
 * a sí misma en la misma frase.
 *
 * **POR QUÉ ES UNA CONSTANTE Y NO UN 2 SUELTO.** Porque el número que decide cuántos
 * huecos hay, cuántos puedes seleccionar, cuándo se activa el botón y qué comprueba
 * el motor no puede estar escrito en dos sitios: es la misma regla, y cuando se
 * cambiaron las dos copias se olvidó una. Aquí vive porque es **la que impone el
 * motor**: si algún día se cambia la receta, el sitio que se cambia es este y el
 * resto lo lee.
 */
export const MATERIALES_POR_FUSION = 2;



/**
 * EL POTENCIAL DE UN COMPAÑERO: LA POSICIÓN DENTRO DEL RANGO DE SU TIER.
 *
 * **QUÉ SIGNIFICA, DE LA MISMA MANERA QUE EN EL RECOLECTOR.** El potencial va de
 * 1 a 5 y dice **hasta dónde llega este item dentro de lo que su tier puede
 * dar**: ★1 es el suelo del rango y ★5 es el techo. Dos compañeros del mismo
 * tier se comparan con un número, que es lo que hace que buscar uno sea una
 * decisión.
 *
 * **Y POR QUÉ AQUÍ NO ES UN MULTIPLICADOR, COMO EN EL RECOLECTOR.** Porque el
 * poder del compañero **es el rango**: su carta se paga por él, y el rango del
 * tier es lo que fija el precio. Con `danioDeRango()` —base × (1 + 0,2 × p)— el
 * techo de cada tier se multiplicaría otra vez por el potencial, y medido eso
 * da un compañero T10 hasta **once veces** más fuerte que el de ahora con la
 * misma carta: el precio por punto se desploma y el T10 vuelve a ser la trampa
 * que `balanceCheck` ya cazó una vez. Con la regla de la posición, **la
 * esperanza del dado no cambia** (potencial 3 cae en el punto medio, que es lo
 * que `rand(min, max)` daba de media) y lo que cambia es la **diferencia entre
 * dos compañeros del mismo tier**, que es justo lo que el potencial debe hacer.
 *
 * Y el orden entre tiers sigue siendo estricto: el techo del T9 (346) es menor
 * que el suelo del T10 (373), así que subir de tier siempre mejora, con
 * potencial o sin él.
 */
export function poderDeCompanero(tier: number, potential: number): number {
  const [min, max] = rangoDePoder(tier);
  const p = potencialNormalizado(potential);
  return Math.round(min + ((max - min) * (p - 1)) / 4);
}

/**
 * Un compañero del tier pedido, con el potencial que se le diga.
 *
 * **ESTA ES LA QUE USA LA FORJA, Y POR QUÉ NO TIRA EL POTENCIAL.** Un compañero
 * forjado no lo sortea: lo **hereda de la media de sus dos materiales**, igual
 * que el recolector forjado. Si esta función lo tirara, la forja de compañeros
 * tendría que construir el objeto a mano, y el día que se añadiese un campo al
 * compañero —potencial, afijo, lo que sea— la forja se quedaría sin él sin que
 * nada lo dijera.
 *
 * Y está junto a `poderDeCompanero` y no en `generators.ts` porque la forja vive
 * en `crafting.ts` y lo necesita: importarlo de `generators.ts` cerraría un
 * ciclo, porque `generators.ts` ya importa de aquí.
 */
export function crearCompanioDeTier(
  tier: number,
  potential: number,
  rng: () => number = Math.random
): { id: string; name: string; type: 'click'; power: number; rarity: string; tier: number; potential: number } {
  const p = potencialNormalizado(potential);
  return {
    id: `comp_t${tier}_${Date.now()}_${Math.floor(rng() * 1e9).toString(36).substring(2, 7)}`,
    name: nombreDe('companion', tier, rng),
    type: 'click',
    power: poderDeCompanero(tier, p),
    rarity: TIER_SYSTEM.rarityByTier[tier as keyof typeof TIER_SYSTEM.rarityByTier] || 'Común',
    tier,
    potential: p
  };
}
/**
 * LO QUE LAS DOS FUSIONES TIENEN QUE COMPARECER.
 *
 * La forja fusiona recolectores y también compañeros. Las dos comparten cuatro
 * reglas: cuántos materiales entran, que sean **distintos**, que sean del mismo
 * tier y que la probabilidad y el premio del fallo sean los mismos. **Esas cuatro
 * están aquí, en un sitio**, porque duplicadas son cuatro oportunidades de que una
 * acepte tres materiales y la otra dos, o de que una dé esquirlas y la otra no.
 *
 * Lo que sí es distinto —qué se produce, de dónde sale su calidad— vive en cada
 * función, que es donde tiene que vivir: un recolector tiene afijos y un
 * compañero no.
 */
interface IntentosDeForja {
  craftLuck: number;
  shardBonus: number;
  stonesUsed: number;
  /** 1 si se gasta una Nanopartícula de Estabilidad en esta fusión. */
  nanoUsed?: number;
  maxTier?: number;
  /** El dado. Sin él ninguna de las dos reglas se puede comprobar. */
  rng?: () => number;
}

/**
 * Las validaciones que no dependen de qué se está forjando.
 *
 * Devuelve el texto del error, o `null` si todo está bien. **Va ANTES de gastar
 * nada**, que es lo que protege al jugador: un rechazo después del cobro se
 * llevaría piedras y nanopartículas por una fusión que no ocurrió.
 */
export function validaMateriales(
  materials: Array<{ id: string; tier?: number; type?: string }>,
  tier: number,
  tipo: 'recolectores' | 'compañeros',
  maxTier = Infinity
): string | null {
  if (materials.length !== MATERIALES_POR_FUSION) {
    return `Se necesitan ${MATERIALES_POR_FUSION} ${tipo} del mismo tier.`;
  }
  // F24 · Dos POSICIONES no son dos MATERIALES. Sin esto, mandar el mismo id dos
  // veces cuenta como dos: se "fusiona" un solo item y sale otro, ahorrándose un
  // material. El que cuenta es el motor, no la vista.
  if (new Set(materials.map(m => m.id)).size !== MATERIALES_POR_FUSION) {
    return `Selecciona ${MATERIALES_POR_FUSION} ${tipo} distintos.`;
  }
  if (tier < 1 || tier >= maxTier) {
    return `No se pueden forjar ${tipo} de tier ${tier + 1}.`;
  }
  if (materials.some(m => (m.tier ?? 1) !== tier)) {
    return `Los ${MATERIALES_POR_FUSION} ${tipo} deben ser del mismo tier.`;
  }
  return null;
}

/**
 * La tirada: la probabilidad, y el premio del fallo.
 *
 * Sale de aquí en las dos fusiones, así que **la probabilidad de fundir dos
 * compañeros es exactamente la de fundir dos recolectores** con los mismos
 * consumibles. No es una coincidencia: es que el yunque es el mismo y el
 * escribano es el mismo.
 */
export function tiraDeForja(
  tier: number,
  materials: Array<{ affixes?: string[]; rarity?: string }>,
  options: IntentosDeForja
): { acierto: boolean; chance: number; shards: number } {
  // Los compañeros no tienen afijos, así que aquí aportan cero. No es que se les
  // dé un trato peor: es que no tienen la entrada que suma esto.
  const afixLuck = materials.reduce((acc, m) => acc + (m.affixes?.length || 0) * 0.02, 0);
  const nanoUsed = options.nanoUsed ?? 0;
  const chance = successChance(tier, options.craftLuck, options.stonesUsed, afixLuck, nanoUsed);
  const rng = options.rng ?? Math.random;
  if (rng() <= chance) return { acierto: true, chance, shards: 0 };

  // Fallo: esquirlas proporcionales al tier **y a la rareza de los materiales**.
  const matBonus = materials.reduce((a, m) => a + (RARITY_WEIGHT[m.rarity as Rarity] ?? 0) * 4, 0);
  const baseShards = 8 + tier * 6;
  return { acierto: false, chance, shards: Math.round((baseShards + matBonus) * (1 + options.shardBonus)) };
}
/**
 * Intenta fusionar 2 recolectores del mismo tier.
 * - Si tiene éxito: devuelve el nuevo recolector, los 2 materiales se consumen.
 * - Si falla: se consumen los materiales, se devuelven esquirlas.
 */
export function attemptForge(
  materials: CollectorItem[],
  tier: number,
  authorName: string,
  options: IntentosDeForja
): ForgeResult {
  const rng = options.rng ?? Math.random;
  const maxTier = options.maxTier ?? Infinity; // Forja infinita: el precio frena solo

  const error = validaMateriales(materials, tier, 'recolectores', maxTier);
  if (error) return { success: false, error };

  const tira = tiraDeForja(tier, materials, options);
  if (!tira.acierto) return { success: false, shards: tira.shards, chanceUsed: tira.chance };

  // Éxito: construir el recolector
  // F33 · El potencial es la MEDIA de los dos materiales, y es el potencial lo
  // que decide el daño. Antes salía de `rollPotential`, que lo tiraba de la
  // rareza, y el daño era el punto medio del rango: un item forjado nunca podía
  // salir en el máximo ni con materiales perfectos.
  //
  // Y ojo con la consecuencia, que es la que hace útil la forja: promediar
  // NUNCA sube el resultado. Un 5 sale de un 5, y un 4 de un 4 y un 5. O sea
  // que la perfección se consigue en la tienda o en las cajas, y la forja es la
  // que **consolida**: te da el potencial que querías sin depender del azar.

  // Éxito: construir el recolector
  // F33 · El potencial es la MEDIA de los dos materiales, y es el potencial lo
  // que decide el daño. Antes salía de `rollPotential`, que lo tiraba de la
  // rareza, y el daño era el punto medio del rango: un item forjado nunca podía
  // salir en el máximo ni con materiales perfectos.
  //
  // Y ojo con la consecuencia, que es la que hace útil la forja: promediar
  // NUNCA sube el resultado. Un 5 sale de un 5, y un 4 de un 4 y un 5. O sea
  // que la perfección se consigue en la tienda o en las cajas, y la forja es la
  // que **consolida**: te da el potencial que querías sin depender del azar.
  const potential = potencialFusionado(materials.map((m) => potencialDe(m)));
  const newTier = tier + 1;
  const name = forgeCollectorName(potential, newTier, rng);

  // El daño sale del potencial y de la base del tier nuevo. Una sola función, y
  // la misma que usa la tienda, así que potencial y daño no pueden separarse.
  const damage = danioDeRango(newTier, potential);

  // La rareza va ANTES que los afijos, porque es lo que decide cuántos lleva: la
  // rareza da el mínimo y el tope es 6 para todos. Antes el número venía del
  // potencial y la rareza no influía en nada, así que un Divino podía salir con
  // un afijo y un Común con tres.
  const rarity = collectorRarity(newTier, potential);
  const affixes = pickAffixes(materials, rarity, (options.nanoUsed ?? 0) > 0, rng);

  const collector: CollectorItem = {
    id: `forged_${Date.now()}_${rng().toString(36).substring(2, 8)}`,
    name,
    type: 'collector',
    details: `Daño base: +${damage}`,
    rarity,
    tier: newTier,
    level: 0,
    // El techo sube con potencial: 20 + 3 por estrella (máx 35). Se calcula con la
    // misma regla que lee todo el mundo, para que el techo que se crea y el que
    // se comprueba no puedan separarse.
    maxLevel: BASE_COLLECTOR_MAX_LEVEL + potential * MAX_LEVEL_PER_POTENTIAL,
    potential,
    damage,
    affixes,
    forgedBy: authorName,
    forgedAt: Date.now(),
    lineage: materials.map(m => m.rarity),
    sellPrice: 0 // se calcula dinámicamente
  };

  return { success: true, collector, chanceUsed: tira.chance };
}

/**
 * Intenta fusionar 2 compañeros del mismo tier.
 *
 * **LO QUE PRODUCE Y DE DÓNDE SALE SU CALIDAD, Y POR QUÉ NO ES IGUAL AL
 * RECOLECTOR.** El recolector forjado hereda **afijos** de la rareza de sus
 * materiales. El compañero no tiene afijos: su eje de calidad es el
 * **potencial**, y sale de la media de los dos, con la misma regla que el del
 * recolector —**promediar nunca sube**: un 5 sale de un 5, y un 4 de un 4 y un 5.
 *
 * **QUÉ HACE LA NANOPARTÍCULA AQUÍ, Y POR QUÉ NO ES LO MISMO QUE EN EL
 * RECOLECTOR.** La nanopartícula "garantiza un afijo extra", y un compañero no
 * tiene afijos, así que copiarla tal cual convertiría un consumible de 90 000
 * nanitas en **el mejor objeto del juego que no hace absolutamente nada**. En vez
 * de dejarlo ahí, su equivalente para un compañero es su propio eje de calidad:
 * **+1 al potencial**, con el tope de siempre.
 *
 * Y es la **única** vía por la que esta fusión puede superar la media. Sin
 * nanopartícula, promediar no sube y punto: la forja de compañeros es igual de
 * ciega que la de recolectores, y el jugador tiene que decidir conscientemente si
 * quiere pagar esa excepción.
 */
export function attemptForgeCompanion(
  materials: Array<{ id: string; tier?: number; rarity?: string; potential?: number }>,
  tier: number,
  options: IntentosDeForja
): { success: boolean; companion?: any; error?: string; shards?: number; chanceUsed?: number } {
  const rng = options.rng ?? Math.random;
  const maxTier = options.maxTier ?? Infinity;

  const error = validaMateriales(materials, tier, 'compañeros', maxTier);
  if (error) return { success: false, error };

  const tira = tiraDeForja(tier, materials, options);
  if (!tira.acierto) return { success: false, shards: tira.shards, chanceUsed: tira.chance };

  const newTier = tier + 1;

  // **LA MEDIA, Y LUEGO LA NANOPARTÍCULA.** En ese orden y no al revés: si el +1
  // entrara antes de promediar, dos 5 y una nanopartícula darían un 6, que es un
  // potencial que ningún otro camino del juego puede dar. Promediar primero
  // mantiene la promesa de que la forja **consolida** y no **crea**.
  // **LA MEDIA PRIMERO Y EL +1 ENCIMA.** Al revés —sumar antes de promediar— el
  // +1 se colaba dentro del `potencialNormalizado()`, y `potencialNormalizado(6)`
  // no es un 6: es un 3, que es lo que devuelve fuera del 1..5. Dos 5 con
  // nanopartícula salían un **3**, peor que no gastarla, sin decir nada.
  const base = potencialFusionado(materials.map((m) => m.potential));
  const conNano = (options.nanoUsed ?? 0) > 0 ? 1 : 0;
  const potential = Math.max(1, Math.min(5, base + conNano));

  return { success: true, companion: crearCompanioDeTier(newTier, potential, rng), chanceUsed: tira.chance };
}

function collectorRarity(tier: number, potential: number): Rarity {
  const base = rarezaDeTier(tier) as Rarity ?? 'Común';
  if (potential >= 5 && tier >= 9) return 'Divino';
  if (potential >= 4 && tier >= 7) return 'Mítico';
  if (potential >= 3 && tier >= 5) return 'Legendario';
  if (potential >= 2 && tier >= 3) return 'Épico';
  return (base as Rarity) || 'Común';
}

/**
 * Cuántos afijos lleva como MÍNIMO un item de cada rareza. El tope son 6.
 *
 * **`Divino` SE LLEVA EL TOPO ENTERO.** Antes el sexto escalón era `Sobrecargado`
 * y el que llevaba los 6 afijos; con esa rareza fuera, un item con 6 afijos
 * tiene que ser `Divino`, o el tope de afijos es inalcanzable y la regla de
 * "más rareza, más afijos" deja de tener final. La rareza la pone el tier —o el
 * potencial, en la forja—, así que un Divino de T9 forjado con buenos materiales
 * es el item más completo del juego, que es lo que tenía que ser.
 */
export const AFIX_MIN_POR_RARIDAD: Record<string, number> = {
  'Común': 0, 'Raro': 1, 'Épico': 2, 'Legendario': 3,
  'Mítico': 4, 'Divino': 6
};

/** El tope de afijos de un item. Nadie lleva más de estos. */
export const AFIX_MAX = 6;

/**
 * Cuántos afijos puede llevar un item forjado: el suelo y el techo.
 *
 * **SON DOS NÚMEROS Y NO UNO, Y POR QUÉ ES LO QUE PEDÍAS.** Con un solo número,
 * el item forjado lleva siempre los mismos afijos que le tocan por rareza, y los
 * dos materiales que pones solo sirven para decidir *cuáles*. Se podían haber
 * gastado en cualquier otra cosa. Con dos, los padres deciden también *cuántos*:
 * dos materiales con muchos afijos dan un item que puede llevar más, y esa es la
 * recompensa de buscar buenos materiales en vez de la primera pareja que se vea.
 *
 * **EL SUELO ES EL DE LA RAREZA, Y NO SE NEGOCIA.** `AFIX_MIN_POR_RARIDAD` es una
 * regla del juego ("más rareza, más afijos") y esta función no la puede desbordar
 * hacia abajo: un Divino no sale con dos afijos porque sus padres fueran pobres.
 *
 * **LA NANOPIRTÍCULA SUMA UNO AL SUELO Y AL TECHO**, porque es su segundo efecto y
 * el que justifica pagar 90.000 por ella: sube lo que se puede llegar, no solo lo
 * que se garantiza.
 *
 * **UN `Divino` TIENE EL TECHO PEGADO AL SUELO** —los 6 afijos—, así que el dado
 * no tira nada y el item sale siempre completo. Es lo que hace que "más rareza, más
 * afijos" tenga final, y no es casualidad: la rareza la pone el potencial en la
 * forja, así que un Divino sale de fundir dos materiales con potencial 5.
 */
export function rangoDeAfijosForjados(
  materials: CollectorItem[], rarity: string, nanoparticula: boolean
): { minimo: number; maximo: number } {
  const suelo = (AFIX_MIN_POR_RARIDAD[rarity] ?? 0) + (nanoparticula ? 1 : 0);
  // Lo que arrastra el linaje: la MEDIA de los dos padres, no el mayor ni la
  // suma. Con la suma, un solo material perfecto bastaría y el otro sería
  // decorativo, que es justo lo que la forja no debe ser: los dos importan.
  const linea = materials.reduce((a, m) => a + (m.affixes?.length ?? 0), 0) / Math.max(1, materials.length);
  const tope = Math.min(AFIX_MAX, suelo + Math.floor(linea));
  return { minimo: Math.max(0, Math.min(suelo, AFIX_MAX)), maximo: Math.max(0, tope) };
}

/**
 * Reparte los afijos del item forjado.
 *
 * **La rareza da el suelo y el linaje da el techo** (`rangoDeAfijosForjados()`),
 * y entre los dos se tira un dado. Con un solo número fijo, un Divino podía salir
 * con un afijo —que era lo que pasaba antes— y los dos materiales solo decidían
 * *cuáles*, no *cuántos*. Ahora el suelo de un Divino son 6, que es el tope
 * entero, y un Común puede llegar a llevar afijos si sus padres los traían.
 *
 * **Y EL DADO VA ANTES DE ELEGIR CUÁLES**, que es el orden que hace que la mezcla
 * tenga sentido: si se eligieran primero, el número sería un efecto secundario de
 * qué afijos entraron y el techo del linaje no se llenaría nunca.
 *
 * **La mezcla es en dos pasos, y ese orden es lo que la hace tener sentido:**
 *
 * 1. Primero se cogen afijos **de los dos materiales**, al azar entre los que
 *    tienen entre los dos. Es la herencia: los afijos buenos se transmiten de
 *    verdad, y por eso buscar un item con buenos afijos tiene recompensa.
 * 2. Si aún faltan para llegar al número que salió del dado, se rellenan **al azar
 *    de todo el catálogo**, con los raros pesando menos.
 *
 * El paso 1 va primero a propósito. Si rellenara de catálogo y luego heredara,
 * muchas veces no quedaría hueco para heredar y el paso 1 casi no se vería.
 *
 * Con dos materiales no se puede pasar de 12 afijos distintos, pero el tope de 6
 * hace esa cuenta irrelevante.
 */
function pickAffixes(
  materials: CollectorItem[], rarity: string, nanoparticula: boolean,
  rng: () => number = Math.random
): string[] {
  const { minimo, maximo } = rangoDeAfijosForjados(materials, rarity, nanoparticula);

  // **EL DADO VA ANTES DE ELEGIR CUÁLES, Y POR QUÉ.** Cuántos afijos lleva lo
  // decide el linaje y lo tira el azar; cuáles lleva lo decide la mezcla. Si se
  // eligieran primero y se rellenara después, el número sería un efecto
  // secundario de qué afijos entraron, y con dos materiales muchas veces no
  // quedarían huecos: el techo del linaje no se llenaría nunca.
  //
  // `minimo + Math.floor(rng() * (maximo - minimo + 1))` con `+1` para que el techo
  // sea alcanzable: sin el `+1` un `Divino` con el techo pegado al suelo daría
  // `0` y se quedaría sin afijos.
  const objetivo = maximo <= minimo
    ? minimo
    : minimo + Math.floor(rng() * (maximo - minimo + 1));
  if (objetivo <= 0) return [];

  const picked: string[] = [];
  const usados = new Set<string>();

  // 1 · Herencia: al azar entre los afijos que tienen los dos materiales juntos.
  const heredables: string[] = [];
  for (const m of materials) {
    for (const id of m.affixes ?? []) {
      if (!usados.has(id) && !heredables.includes(id) && AFFIXES.some(a => a.id === id)) {
        heredables.push(id);
      }
    }
  }
  while (picked.length < objetivo && heredables.length > 0) {
    const i = Math.floor(rng() * heredables.length);
    const id = heredables[i];
    picked.push(id);
    usados.add(id);
    heredables.splice(i, 1);
  }

  // 2 · Relleno del catálogo completo, con los afijos raros pesando menos.
  const restantes = AFFIXES.filter(a => !usados.has(a.id));
  while (picked.length < objetivo && restantes.length > 0) {
    const weights = restantes.map(a => 1 / (0.5 + (RARITY_WEIGHT[a.rarity] ?? 1)));
    const total = weights.reduce((a, b) => a + b, 0);
    let roll = rng() * total;
    let idx = 0;
    for (; idx < restantes.length - 1; idx++) {
      roll -= weights[idx];
      if (roll <= 0) break;
    }
    picked.push(restantes[idx].id);
    restantes.splice(idx, 1);
  }

  return picked;
}
