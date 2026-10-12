// ==========================================================================
//  F74 · LAS BASES OCULTAS: CONTENIDO, SORTEO, FORJA Y MIGRACIÓN
// ==========================================================================
//
//  Diez bases por tier y por lado (200 en total), ocultas, con más cuanto más
//  raras. Cada base es un peso de stat (±10 %) y un peso de drop (11-posición).
//  Este banco fija cinco cosas:
//
//  1. **EL CONTENIDO ESTÁ ENTERO.** Dos lados, tiers 1..10, diez posiciones,
//     la escalera de stat exacta, drop 11-pos, ids únicos con patrón y cada
//     base con nombre y lore no vacíos y únicos.
//  2. **EL SORTEO RESPETA LOS PESOS.** Con dado fijado por tramos, cada
//     posición sale en su tramo: la mejor no sale donde sale la peor.
//  3. **LA FORJA PROMEDIA BASES.** Dos posiciones dan su media redondeada, en
//     el tier nuevo y del lado que toca. Sin base, neutro (6, ×1,00).
//  4. **LA MIGRACIÓN SORTEA Y RECALCULA.** Lo viejo sin base recibe una de su
//     tabla y su daño/poder pasa por ella; lo que ya trae base válida no se
//     toca (idempotente). Exclusivos y multiplicadores, intactos.
//  5. **EL BALANCE DE LA ENTRADA.** Medio contra medio gana el tier de arriba,
//     maxeado contra flojo gana el de abajo, god fresco contra flojo decide
//     como mucho un vecino, la mejor sale menos que la peor, y base y potencial
//     son ejes independientes.
// ==========================================================================

import { check, resumen, conSec } from './kit';
import {
  danioDeRango, poderDeCompanero, techoDeNivel, attemptForge, attemptForgeCompanion,
  migraPotenciales, migraPotencialesDeCompaneros, multiplicadorDeNivel
} from '../src/data/crafting';
import {
  TODAS_LAS_BASES, tablaDe, basePorId,
  basePorPosicion, baseAleatoria, baseAleatoriaSegura, posicionFusionada,
  posicionDeBase, ladoDeBase
} from '../src/data/bases';
import { generateCollectorByTier } from '../src/data/generators';
import { crearCompanioDeTier } from '../src/data/crafting';

const LADDER = [0.92, 0.93, 0.94, 0.96, 0.98, 1.00, 1.02, 1.04, 1.07, 1.10];

/**
 * Los tiers que existen, salen de la tabla, y el último.
 *
 * **POR QUÉ ESTÁN FUERA DE `main()`.** Los usan tres bloques distintos —el del
 * contenido y los dos del nombre— y dentro del primero no se veían desde el
 * último. Con veinte tiers van a aparecer en más sitios, y repetir el
 * `Object.keys(...)` en cada uno es la forma de que dos bloques miren contenido
 * distinto el día que una tabla y la otra no coincidan.
 */
const TIERS = Object.keys(tablaDe('recolector')).map(Number).filter(Number.isFinite).sort((a, b) => a - b);
const TMAX = TIERS[TIERS.length - 1];

async function main() {
  // -------------------------------------------------------------------------
  //  1. EL CONTENIDO ESTÁ ENTERO
  //
  //  **LOS RECUENTOS SALEN DE LAS TABLAS, NO DE NÚMEROS ESCRITOS.** Antes el
  //  banco pedía `200` y el rango `1..10` en cuatro sitios, y añadir el T11 los
  //  dejó mintiendo: el chequeo de ids pedía 200 bases cuando ya había 220, y el
  //  del patrón de id solo aceptaba `t([1-9]|10)`, así que un T11 bien escrito
  //  fallaba. Un banco que tiene el número del contenido escrito dentro es un banco
  //  que hay que tocar cada vez que crece el contenido, y ese es el momento en que
  //  alguien sube el número sin revisar la regla de al lado.
  //
  //  Ahora los dos números salen de las tablas. Si mañana se llega al T20, este
  //  bloque pasa sin editarse.
  // -------------------------------------------------------------------------
  {
    const TOTAL = Object.values(tablaDe('recolector')).flat().length
      + Object.values(tablaDe('companero')).flat().length;
    const patron = new RegExp(`^base_(rec|com)_t([1-9]|[1-9]\\d)_([1-9]|10)$`);

    let fallos: string[] = [];
    for (const lado of ['recolector', 'companero'] as const) {
      const tabla = tablaDe(lado);
      for (const t of TIERS) {
        const lista = tabla[t] ?? [];
        if (lista.length !== 10) { fallos.push(`${lado} T${t}: ${lista.length} bases`); continue; }
        lista.forEach((b, i) => {
          if (b.posicion !== i + 1 || b.tier !== t) fallos.push(`${b.id}: pos/tier rotos`);
          if (b.pesoStat !== LADDER[i]) fallos.push(`${b.id}: stat ${b.pesoStat}`);
          if (b.pesoDrop !== 11 - (i + 1)) fallos.push(`${b.id}: drop ${b.pesoDrop}`);
          if (!b.nombre || !b.lore) fallos.push(`${b.id}: sin nombre o lore`);
        });
      }
    }
    check(`bases: dos lados, ${TMAX} tiers, diez posiciones con su escalera y su drop`,
      fallos.length === 0, fallos.slice(0, 3).join(' | ') || `${TOTAL} bases en regla`);

    const ids = TODAS_LAS_BASES.map(b => b.id);
    const nombres = TODAS_LAS_BASES.map(b => b.nombre);
    check(`bases: ${TOTAL} ids únicos con patrón por lado`,
      TODAS_LAS_BASES.length === TOTAL && new Set(ids).size === TOTAL
        && ids.every(id => patron.test(id)),
      `bases=${TODAS_LAS_BASES.length} ids=${new Set(ids).size}`);
    check(`bases: y ${TOTAL} nombres únicos, ninguno vacío`,
      new Set(nombres).size === TOTAL && nombres.every(n => n.trim().length > 0),
      `nombres=${new Set(nombres).size}`);

    // Los getters resuelven lo que la tabla dice, y lo que no existe no existe.
    let mal = '';
    for (const b of TODAS_LAS_BASES) {
      if (basePorId(b.id) !== b) mal += b.id + ' ';
    }
    check('bases: el lado sale del tipo de item',
      ladoDeBase('collector') === 'recolector' && ladoDeBase('companion') === 'companero',
      'collector/companion');
    check(`bases: basePorId devuelve cada una de las ${TODAS_LAS_BASES.length}`,
      mal === '', mal.slice(0, 60) || 'todas');
    check('bases: basePorPosicion acota y lo desconocido es undefined',
      basePorPosicion(4, 7, 'recolector')?.id === 'base_rec_t4_7'
        && basePorPosicion(4, 0, 'recolector') === undefined
        && basePorPosicion(4, 11, 'companero') === undefined
        && basePorPosicion(99, 5, 'recolector') === undefined
        && basePorId('invento') === undefined,
      'pos 7 T4 rec + bordes');
    // **Y FUERA DE TABLA NO SE SORTEA.** El tier 11 ya tiene contenido, así que la
    // pregunta ya no es "el 11" sino "el siguiente al último que existe": el banco
    // lo calcula desde la tabla en vez de tener el número escrito, porque cuando
    // llegue el T20 esta línea tiene que seguir preguntando lo mismo.
    const tmaxTabla = Math.max(...Object.keys(tablaDe('recolector')).map(Number));
    check('bases: fuera de tabla no se sortea, se devuelve null',
      baseAleatoriaSegura(tmaxTabla + 1, 'recolector') === null
        && baseAleatoriaSegura(0, 'companero') === null,
      `T${tmaxTabla + 1} y T0 dan null`);
    check('bases: el lado sale del tipo de item',
      ladoDeBase('collector') === 'recolector' && ladoDeBase('companion') === 'companero'
        && ladoDeBase('loquesea') === 'companero',
      'collector/companion/otro');
  }

  // -------------------------------------------------------------------------
  //  2. EL SORTEO RESPETA LOS PESOS
  // -------------------------------------------------------------------------
  {
    // Dado fijado por tramos: el total pesa 55 (10+9+...+1) y cada posición
    // ocupa su tramo. Con el dado en medio de cada tramo sale esa posición.
    let mal = '';
    for (let pos = 1; pos <= 10; pos++) {
      const antes = [1, 2, 3, 4, 5, 6, 7, 8, 9].slice(0, pos - 1).reduce((a, p) => a + (11 - p), 0);
      const r = (antes + (11 - pos) / 2) / 55;
      const b = baseAleatoria(5, 'recolector', () => r);
      if (b.posicion !== pos || b.tier !== 5) mal += `pos${pos}->${b.id} `;
    }
    check('bases: cada posición sale en su tramo de peso',
      mal === '', mal || 'las diez en su tramo');
    check('bases: y la mejor pesa diez veces menos que la peor',
      (basePorPosicion(5, 10, 'recolector')?.pesoDrop ?? 0) === 1
        && (basePorPosicion(5, 1, 'recolector')?.pesoDrop ?? 0) === 10,
      'pesos 1 y 10');
  }

  // -------------------------------------------------------------------------
  //  3. LA FORJA PROMEDIA BASES
  // -------------------------------------------------------------------------
  {
    const mat = (id: string, baseId: string) => ({
      id, tier: 3, rarity: 'Común', potential: 3, affixes: [] as string[], baseId
    });
    const opts = () => ({ craftLuck: 0, consolationBonus: 0, stonesUsed: 0, nanoUsed: 0, eterUsed: 0 });
    // 2 y 8 promedian 5, en el tier nuevo y del lado que toca.
    const r = conSec(0, 1, () => attemptForge(
      [mat('a', 'base_rec_t3_2'), mat('b', 'base_rec_t3_8')], 3, 'X', opts()));
    check('forja: la base forjada es la media de las posiciones',
      (r as any).success === true && (r as any).collector?.baseId === 'base_rec_t4_5',
      `base=${(r as any).collector?.baseId}`);
    check('forja: y el daño pasa por esa base',
      (r as any).collector?.damage === danioDeRango(4, 3, basePorId('base_rec_t4_5')),
      `daño=${(r as any).collector?.damage}`);
    check('forja: y el techo mira potencial y base',
      (r as any).collector?.maxLevel === techoDeNivel(3, 5),
      `techo=${(r as any).collector?.maxLevel}`);

    const rc = conSec(0, 1, () => attemptForgeCompanion(
      [{ id: 'a', tier: 3, potential: 3, baseId: 'base_com_t3_2' },
       { id: 'b', tier: 3, potential: 3, baseId: 'base_com_t3_8' }], 3, opts()));
    check('forja: el compañero promedia igual, en su tabla',
      (rc as any).success === true && (rc as any).companion?.baseId === 'base_com_t4_5'
        && (rc as any).companion?.power === poderDeCompanero(4, 3, basePorId('base_com_t4_5')),
      `base=${(rc as any).companion?.baseId} poder=${(rc as any).companion?.power}`);

    // Sin base en los materiales, neutro (6, ×1,00): no se castiga lo viejo.
    const rN = conSec(0, 1, () => attemptForge(
      [mat('a', undefined as any), mat('b', undefined as any)], 3, 'X', opts()));
    check('forja: sin base sale la neutra, que no mueve el daño',
      (rN as any).collector?.baseId === 'base_rec_t4_6'
        && (rN as any).collector?.damage === danioDeRango(4, 3),
      `base=${(rN as any).collector?.baseId} daño=${(rN as any).collector?.damage}`);

    // La media redondea al entero y se acota, sin dado de por medio.
    check('bases: posicionFusionada redondea y acota',
      posicionFusionada(10, 10) === 10 && posicionFusionada(1, 1) === 1
        && posicionFusionada(3, 4) === 4 && posicionFusionada(2, 8) === 5
        && posicionFusionada(undefined, undefined) === 6
        && posicionFusionada(0, 99) === 10 && posicionFusionada(-5, 3) === 1,
      '10/10, 1/1, 3/4, 2/8, vacíos, bordes');
    check('bases: y posicionDeBase da 6 con lo desconocido',
      posicionDeBase(undefined) === 6 && posicionDeBase('invento') === 6
        && posicionDeBase('base_rec_t4_7') === 7,
      'undefined/invento/T4-7');

    // -----------------------------------------------------------------------
    //  F106 · LO QUE LA FORJA PROMETE Y LO QUE EL MOTOR FABRICA, EN TODOS LOS
    //  TIERS Y EN LOS DOS LADOS.
    //
    //  **POR QUÉ ESTO ES UN BANCO Y NO UNA MIRADA.** La pantalla de la forja
    //  enseña un nombre y un daño antes de tirar, y los dos salen de funciones sueltas
    //  en la vista: `posicionFusionada()` + `basePorPosicion()` + `danioDeRango()`.
    //  El motor, por su parte, fabrica el item con las suyas. **Si las dos listas de
    //  funciones se separan un día —porque alguien copia la cuenta en la vista, o
    //  porque la vista se queda atrás al cambiar una firma—, la pantalla promete el
    //  nombre de un item que no le va a salir.** Y eso no es un descuadre: es la
    //  pantalla diciendo una cosa y el juego haciendo otra, que es exactamente lo que
    //  este banco existe para cazar.
    //
    //  **POR QUÉ TODOS LOS TIERS Y NO UNO.** Con un solo tier el banco pasa aunque la
    //  regla se rompa a partir del T15. Y con los 20 hace 40 mezclas, que es el
    //  contenido entero de una partida tardía.
    //
    //  **CÓMO SE COMPRUEBA, Y POR QUÉ NO BASTA CON MIRAR EL NOMBRE.** Se fuerza el
    //  acierto con `conSec()` y se compara lo que se enseñaría con lo que sale. El
    //  nombre es lo que el jugador lee, así que es el que tiene que cuadrar; y el daño
    //  se compara aparte porque es el número que puede meaningfully mentir sin que el
    //  nombre se note.
    for (const tier of TIERS) {
      for (const lado of ['recolector', 'companero'] as const) {
        const tierF = tier - 1; // los materiales son del tier de abajo
        if (tierF < 1) continue;
        // Dos bases del mismo material, a propósito en las esquinas: 1 y 10.
        const bA = basePorPosicion(tierF, 1, lado)!;
        const bB = basePorPosicion(tierF, 10, lado)!;
        // **LO QUE LA PANTALLA ENSEÑA:** misma cuenta, mismas funciones.
        const posEnsenyada = posicionFusionada(bA.posicion, bB.posicion);
        const baseEnsenyada = basePorPosicion(tierF + 1, posEnsenyada, lado)!;
        // **LO QUE EL MOTOR FABRICA:** el item de verdad, con el acierto forzado.
        //
        // **EL SEGUNDO ARGUMENTO ES EL TIER DE LOS MATERIALES, NO EL DEL RESULTADO.**
        // `attemptForge(mats, 3, …)` con materiales de tier 3 fabrica un item de tier
        // **4**, que es la regla del juego —por eso en la pantalla la base del
        // resultado se busca en `matTier + 1`—. Pasarle el tier ya incrementado
        // fabricaba un item dos tiers más arriba y el banco comparaba una cosa con
        // otra sin que ninguna de las dos estuviera mal por su cuenta.
        const mats = [
          { id: 'x', tier: tierF, rarity: 'Común', potential: 3, affixes: [] as string[], baseId: bA.id },
          { id: 'y', tier: tierF, rarity: 'Común', potential: 3, affixes: [] as string[], baseId: bB.id },
        ];
        const r = conSec(0, 1, () => (lado === 'recolector'
          ? attemptForge(mats, tierF, 'X', opts())
          : attemptForgeCompanion(mats as any, tierF, opts()))) as any;
        const item = lado === 'recolector' ? r.collector : r.companion;
        check(`F106: T${tierF} ${lado} — el nombre anunciado es el que sale`,
          item?.baseId === baseEnsenyada.id,
          `enseñado=${baseEnsenyada.id} salido=${item?.baseId}`);
        // El daño, con la misma cuenta. En compañero el poder es la otra magnitud,
        // pero sale de `poderDeCompanero()` con la misma base, que es lo que importa.
        const danoEsperado = lado === 'recolector'
          ? danioDeRango(tierF + 1, 3, baseEnsenyada)
          : poderDeCompanero(tierF + 1, 3, baseEnsenyada);
        const danoSalido = lado === 'recolector' ? item?.damage : item?.power;
        check(`F106: T${tierF} ${lado} — y el daño anunciado es el que sale`,
          danoSalido === danoEsperado,
          `enseñado=${danoEsperado} salido=${danoSalido}`);
      }
    }
  }

  // -------------------------------------------------------------------------
  //  4. LA MIGRACIÓN SORTEA Y RECALCULA
  // -------------------------------------------------------------------------
  {
    // Recolector viejo sin base: recibe una válida de su tier, daño recalculado
    // con ella y techo con ella. Determinista salvo el sorteo, que se acota.
    const viejo = { id: 'v', name: 'V', type: 'collector', tier: 4, level: 0, damage: danioDeRango(4, 3), potential: 3 };
    const m1 = migraPotenciales([viejo]);
    const w1: any = m1.items[0];
    const b1 = basePorId(w1.baseId);
    check('migración: lo viejo sin base recibe una válida de su tier',
      m1.changed === true && !!b1 && b1.tier === 4,
      `base=${w1.baseId}`);
    check('migración: y su daño y su techo pasan por ella',
      w1.damage === danioDeRango(4, 3, b1)
        && w1.maxLevel === techoDeNivel(3, b1?.posicion ?? 6),
      `daño=${w1.damage} techo=${w1.maxLevel}`);
    // Idempotente: la segunda pasada no toca nada.
    const m2 = migraPotenciales(m1.items);
    check('migración: y con base válida no se toca nada',
      m2.changed === false && m2.items[0].damage === w1.damage,
      `changed=${m2.changed}`);

    // Compañero igual, en las dos mitades, con el poder recalculado.
    const mc = migraPotencialesDeCompaneros(
      [{ id: 'c', name: 'C', type: 'passive', power: 10, rarity: 'Común', tier: 4, potential: 3 }],
      [{ id: 'c', name: 'C', type: 'companion', tier: 4, potential: 3 }]
    );
    const ac: any = (mc as any).companeros[0];
    const fc: any = mc.fichas[0];
    const bc = basePorId(ac.baseId);
    check('migración: el compañero recibe base y poder recalculado',
      mc.changed === true && !!bc && bc.tier === 4
        && ac.power === poderDeCompanero(4, 3, bc)
        && ac.maxLevel === techoDeNivel(3, bc?.posicion ?? 6),
      `base=${ac.baseId} poder=${ac.power}`);
    check('migración: y la ficha lleva la misma base que su compañero',
      fc.baseId === ac.baseId && fc.potential === 3,
      `ficha=${fc.baseId} array=${ac.baseId}`);

    // Exclusivos (sin tier) y multiplicadores (poder fijo): intactos.
    const me = migraPotencialesDeCompaneros(
      [{ id: 'e', name: 'E', type: 'passive', power: 50, rarity: 'Raro' },
       { id: 'm', name: 'M', type: 'multiplier', power: 2, rarity: 'Raro', tier: 4, potential: 3 }],
      []
    );
    const ex: any = (me as any).companeros[0];
    const mu: any = (me as any).companeros[1];
    check('migración: sin tier no hay sorteo ni estrellas regaladas',
      ex.power === 50 && ex.baseId === undefined && ex.potential === undefined,
      `power=${ex.power} base=${ex.baseId}`);
    check('migración: y el multiplicador conserva su poder fijo',
      mu.power === 2 && mu.baseId === undefined,
      `power=${mu.power} base=${mu.baseId}`);
  }

  // -------------------------------------------------------------------------
  //  5. EL BALANCE DE LA ENTRADA
  // -------------------------------------------------------------------------
  //
  //  Con la fórmula real y las tablas reales: el abanico por tier con base es
  //  mayor que el salto entre tiers, y por eso el solape es de un tier.
  {
    const dano = (tier: number, pos: number, pot: number, nivel = 0) =>
      Math.floor(danioDeRango(tier, pot, basePorPosicion(tier, pos, 'recolector')) * multiplicadorDeNivel(nivel));
    // Medio contra medio, el tier de arriba gana: la escalera no se deshace.
    let rompeMedios = '';
    for (let t = 1; t < 10; t++) {
      if (!(dano(t + 1, 5, 3) > dano(t, 5, 3))) rompeMedios += `T${t} `;
    }
    check('balance: medio contra medio, el tier de arriba siempre gana',
      rompeMedios === '', rompeMedios || 'los nueve saltos');
    // Maxeado contra flojo, el de abajo gana en TODOS los saltos: invertir
    // siempre vale, con cualquier tier. El multiplicador de nivel (×4,5 al techo)
    // empequeñece cualquier redondeo.
    let rompeMax = '';
    for (let t = 1; t < 10; t++) {
      if (!(dano(t, 10, 5, techoDeNivel(5, 10)) > dano(t + 1, 1, 1, 0))) rompeMax += `T${t} `;
    }
    check('balance: maxeado contra flojo, el de abajo gana en los nueve saltos',
      rompeMax === '', rompeMax || 'los nueve saltos');
    // Fresco contra fresco no salta dos tiers: el god-roll de aquí pierde contra
    // el flojo de dos más arriba. (Y contra el vecino, el redondeo de tiers bajos
    // manda: un T1 god fresco pierde con un T2 flojo por uno. La caza fresca no
    // destrona; la caza con niveles, sí. Ver la entrada.)
    let saltaDos = '';
    for (let t = 1; t <= 8; t++) {
      if (!(dano(t, 10, 5) < dano(t + 2, 1, 1))) saltaDos += `T${t} `;
    }
    check('balance: fresco contra fresco no salta dos tiers',
      saltaDos === '', saltaDos || 'ningún salto doble');
    // La mejor base sale menos que la peor: la invariante de la caza.
    check('balance: la mejor base pesa diez veces menos que la peor',
      (basePorPosicion(7, 10, 'companero')?.pesoDrop ?? 0) * 10
        === (basePorPosicion(7, 1, 'companero')?.pesoDrop ?? 0),
      'pesos 1 y 10 en T7 com');
    // Base y potencial son ejes independientes: misma base con distinto
    // potencial pega distinto, y mismo potencial con distinta base también.
    check('balance: base y potencial son ejes independientes',
      danioDeRango(6, 2, basePorPosicion(6, 4, 'recolector')) !== danioDeRango(6, 4, basePorPosicion(6, 4, 'recolector'))
        && danioDeRango(6, 3, basePorPosicion(6, 3, 'recolector')) !== danioDeRango(6, 3, basePorPosicion(6, 8, 'recolector')),
      'pot mueve y base mueve');
  }

  // -------------------------------------------------------------------------
  //  6. EL NOMBRE ES EL DE LA BASE, Y ESO ES LO QUE ARREGLA B10
  //
  //  Este banco, hasta ahora, daba todo por bueno: las bases existen, se sortean
  //  con sus pesos, entran en el daño y la forja las promedia. Lo que **no**
  //  comprobaba es que el jugador las viera. Y no las veía: el item sortaba su
  //  nombre en `collectorNames`/`companionNames` —tres nombres por tier— con un
  //  sorteo aparte del de la base. De las diez bases de un tier se veían tres, y
  //  dos T1 con el mismo nombre podían pegar 6 y 8.
  //
  //  Lo que se fija aquí es el invariante entero, y en las tres capas donde puede
  //  romperse: generar, migrar y forjar.
  // -------------------------------------------------------------------------
  {
    // --- GENERAR: el nombre es el de la base que se acaba de sortear ---
    // Se genera con `rng` clavadísimo para que la base sea la que se pide, y se
    // comprueba que el item se llame como ella. Si el nombre volviera a salir de
    // una lista aparte, esta es la línea que lo caza.
    let fallaGenera = '';
    for (const lado of ['recolector', 'companero'] as const) {
      for (const t of TIERS) {
        for (let intento = 0; intento < 12; intento++) {
          const base = baseAleatoria(t, lado, () => 0.5);
          const hecho = lado === 'recolector'
            ? generateCollectorByTier(t, () => 0.5)
            : crearCompanioDeTier(t, 3, () => 0.5);
          // El generador sortea su propia base, así que se compara contra la que
          // EL GENERADOR chose, no contra la de arriba: se lee su `baseId`.
          const suya = basePorId((hecho as any).baseId);
          if (!suya || (hecho as any).name !== suya.nombre) {
            fallaGenera += `${lado} T${t}: ${(hecho as any).name} != ${suya?.nombre} `;
          }
          void base;
        }
      }
    }
    check('nombre: el item que nace se llama como la base que se le sortió',
      fallaGenera === '', fallaGenera || `los dos lados, T1..T${TMAX}, 12 tiradas cada uno`);

    // **Y QUE NO SEAN EL MISMO NOMBRE, QUE ES EL BUG ENTERO.** Si dos bases
    // distintas de un tier tuvieran el mismo nombre, el jugador vería veinte T1 y
    // no podría distinguirlos, que es exactamente lo que se quejaba.
    let colision = '';
    for (const lado of ['recolector', 'companero'] as const) {
      for (const t of TIERS) {
        const nombres = (tablaDe(lado)[t] ?? []).map(b => b.nombre);
        if (new Set(nombres).size !== nombres.length) colision += `${lado} T${t} `;
      }
    }
    check('nombre: dos bases distintas del mismo tier no se llaman igual',
      colision === '', colision || `las ${TODAS_LAS_BASES.length} bases tienen nombre propio`);

    // --- MIGRAR: un item viejo se renombra al de SU base, no al de otra ---
    // La partida vieja es la que trae `baseId` bueno y nombre de la lista de tres.
    // Si la migración renombrara con la base que le toque en vez de con la suya,
    // el item mudaría de nombre en cada carga sin que nadie tocase nada.
    const viejo = { id: 'v1', name: 'Blaster Láser', type: 'collector', tier: 4, level: 0, damage: danioDeRango(4, 3), potential: 3, baseId: 'base_rec_t4_7' };
    const m1 = migraPotenciales([viejo]);
    const suBase = basePorId('base_rec_t4_7');
    check('migración: un item viejo se renombra con el de SU base',
      m1.items[0]?.name === suBase?.nombre && m1.items[0]?.baseId === 'base_rec_t4_7',
      `${viejo.name} -> ${m1.items[0]?.name} (base ${suBase?.nombre})`);

    // Y es idempotente: migrar dos veces no cambia el nombre otra vez. Sin esto la
    // partida se marca de sucia en cada carga, que es como se nota una migración
    // que no lo es.
    const m2 = migraPotenciales(m1.items);
    check('migración: y es idempotente, que no se renombra dos veces',
      m2.changed === false && m2.items[0].name === m1.items[0].name,
      `${m1.items[0].name} -> ${m2.items[0].name} (changed=${m2.changed})`);

    // Y la firma de obra sobrevive al renombrado: es lo único del nombre viejo que
    // no se puede recuperar de otro sitio, y el buscador mira el nombre.
    const obra = { id: 'v2', name: 'Forja de Vórtice·Obra Maestra', type: 'collector', tier: 4, level: 0, damage: danioDeRango(4, 3), potential: 3, baseId: 'base_rec_t4_7' };
    const mObra = migraPotenciales([obra]);
    check('migración: la firma de obra sobrevive al renombrado',
      mObra.items[0]?.name === `${suBase?.nombre}·Obra Maestra`, mObra.items[0]?.name);

    // --- FORJAR: el nombre sigue a la base, que es la media de los dos padres ---
    // Dos bases 10 dan una 5: el item forjado tiene que llamarse como la 5, no
    // como la 10. Antes llevaba un nombre generado aparte, que no decía nada del
    // stat, y el jugador tenía un item que **afirmaba** ser mejor de lo que era.
    const mat10 = (id: string) => ({
      id, tier: 5, rarity: 'Común', potential: 3, affixes: [] as string[], baseId: 'base_rec_t5_10'
    });
    const rf = conSec(0, 1, () => attemptForge(
      [mat10('f1'), mat10('f2')], 5, 'X',
      { craftLuck: 0, consolationBonus: 0, stonesUsed: 0, nanoUsed: 0, eterUsed: 0 }));
    const esperada = basePorPosicion(6, 10, 'recolector')?.nombre;
    check('forja: el forjado se llama como la base que le toca, la media de los padres',
      (rf as any).success === true && (rf as any).collector?.tier === 6
        && (rf as any).collector?.name === esperada,
      `success=${(rf as any).success} err=${(rf as any).error} nombre=${(rf as any).collector?.name} esperado=${esperada}`);
  }

  resumen('bases ocultas: contenido, sorteo, forja, migración y el nombre');
}

export default main();
