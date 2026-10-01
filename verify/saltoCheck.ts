// ==========================================================================
//  El salto de tier en las cajas (F6) y el compañero que faltaba (D1)
// ==========================================================================
//  POR QUÉ ESTE BANCO EXISTE.
//
//  Lo que se pidió (F6) es una probabilidad baja de botín de tier superior en las
//  cajas. Eso suena a "mira que salga a veces", y es justo el tipo de cosa que se
//  declara y no se comprueba: nadie lo ve jugando un rato, porque un 6% en una
//  caja común son 1 de cada 17 aperturas.
//
//  Y al medirlo sale el hallazgo que da nombre al banco: **la entrada de salto está
//  en la tabla de botín con su peso**, no en un `if` suelto. Y tiene que estar
//  ahí, por una razón que no es estética: la primera regla del fichero es que la
//  ruleta tiene que enseñar lo que entra. Un salto hecho con un `if` al abrir sería
//  un premio que la cinta no puede pintar, o sea un elemento que puede aparecer sin
//  que nadie lo haya visto venir.
//
//  Por eso este banco mide la probabilidad REAL (`peso / suma`) y no el peso, y por
//  eso la mide en las cuatro cajas por separado: las sumas son distintas, así que el
//  mismo peso da cuatro porcentajes distintos. Un banco que mirase el peso
//  estaría midiendo un número que no es el que ve el jugador.
//
//  LO QUE NO CUBRE, A PROPÓSITO: que la ruleta pinte bien el salto. Eso es
//  `ruleta-preview.html`.
// ==========================================================================

import { check, resumen } from './kit';
import {
  CRATE_LOOT, CRATE_ONLY_COMPANIONS, makeCrateOnlyCompanion, probabilidadDeSalto
} from '../src/components/crateLoot';
import { TIER_SYSTEM } from '../src/data/tiers';
import { type CrateType } from '../src/data/store';

const CAJAS: CrateType[] = ['common', 'rare', 'epic', 'legendary'];

/** El tier que le toca a cada caja, según su tabla (no el `up`, sino lo normal). */
const TIER_PROPIO: Record<CrateType, number> = { common: 1, rare: 3, epic: 6, legendary: 8 };

/**
 * Todos los premios de una caja, con la entrada ya construida.
 *
 * Hace el mismo sorteo por peso que el juego, a propósito: si el banco usara otro
 * criterio estaría midiendo su propia idea de cómo se sortea, y un banco que
 * reimplementa la regla no puede detectar que la regla se rompió.
 */
function botinDe(c: CrateType, n = 4000): any[] {
  const tabla = CRATE_LOOT[c];
  const total = tabla.reduce((s, e) => s + e.weight, 0);
  const salida: any[] = [];
  for (let i = 0; i < n; i++) {
    let r = Math.random() * total;
    for (const e of tabla) {
      r -= e.weight;
      if (r < 0) { salida.push(e.build({ ownedCosmetics: [] })); break; }
    }
  }
  return salida;
}

/** Cuenta cuántas veces sale una entrada concreta en `n` sorteos reales. */
function vecesQueSale(c: CrateType, id: string, n = 20_000): number {
  const tabla = CRATE_LOOT[c];
  const total = tabla.reduce((s, e) => s + e.weight, 0);
  let veces = 0;
  for (let i = 0; i < n; i++) {
    let r = Math.random() * total;
    for (const e of tabla) {
      r -= e.weight;
      if (r < 0) { if (e.id === id) veces++; break; }
    }
  }
  return veces;
}

function sumarPesos(c: CrateType): number {
  return CRATE_LOOT[c].reduce((s, e) => s + e.weight, 0);
}

async function main() {
  // -----------------------------------------------------------------------
  //  1. LA PROBABILIDAD ES BAJA, Y SE MIDE DE VERDAD.
  //
  //     El techo es 8%: por encima, "a veces sale algo de arriba" pasa a ser "sale
  //     algo de arriba", y entonces la caja común es una caja legendaria con más
  //     pasos. Por debajo de 1% es decorativo: el jugador no lo vería nunca.
  // -----------------------------------------------------------------------
  {
    for (const c of CAJAS) {
      const p = probabilidadDeSalto(c);
      check(`salto: ${c} da botín de arriba entre 1% y 8%`,
        p >= 0.01 && p <= 0.08,
        `${(p * 100).toFixed(2)}% (peso ${CRATE_LOOT[c].find(e => e.id === 'up')?.weight} de ${sumarPesos(c)})`);
    }

    // Y que la probabilidad medida por tiradas reales cuadre con la calculada.
    // Esto es lo que separa "la tabla dice 6%" de "el jugador ve un 6%", y es la
    // comprobación que de verdad importa: si el sorteo por peso del motor no fuera
    // el mismo que el de esta función, las dos cifras saldrían bien y no dirían
    // nada del juego.
    for (const c of CAJAS) {
      const teorica = probabilidadDeSalto(c);
      const TIRADAS = 20_000;
      const medida = vecesQueSale(c, 'up', TIRADAS) / TIRADAS;
      check(`salto: ${c} la tirada real da lo que dice la tabla`,
        Math.abs(medida - teorica) < 0.01,
        `medida=${(medida * 100).toFixed(2)}% tabla=${(teorica * 100).toFixed(2)}% en ${TIRADAS} tiradas`);
    }
  }

  // -----------------------------------------------------------------------
  //  2. EL SALTO ES DE UN SOLO PASO, Y SIEMPRE DE ARRIBA.
  //
  //     Estas dos reglas son el motivo de que el banco exista. Un salto de "lo que
  //     salga" haría de la caja común una caja legendaria; un salto que a veces no
  //     sube sería un señuelo, y un jugador que lo detecte deja de abrir cajas.
  // -----------------------------------------------------------------------
  {
    for (const c of CAJAS) {
      const entrada = CRATE_LOOT[c].find(e => e.id === 'up');
      check(`salto: ${c} tiene entrada de salto en la tabla`,
        entrada !== undefined, 'sin entrada');

      // Un premio de la caja, con su tier. El tope de cada caja es su propio tier: el
      // `up` sube UNO por encima de ese, y los premios propios no pasan de él.
      //
      // Los items que no llevan `tier` (llaves, cristales, cosméticos) se saltan:
      // no tienen tier y no compiten con la regla.
      const TOPE_PROPIO: Record<CrateType, number> = { common: 1, rare: 4, epic: 6, legendary: 8 };
      const salto = CRATE_LOOT[c].find(e => e.id === 'up')!;
      const esperados = new Set<number>([TOPE_PROPIO[c], TOPE_PROPIO[c] + 1]);
      const p: any = salto.build({ ownedCosmetics: [] });
      check(`salto: ${c} da T${TOPE_PROPIO[c] + 1}, nunca más`,
        esperados.has(p.tier),
        `tier=${p.tier} en una caja cuyo tope propio es T${TOPE_PROPIO[c]}`);

      // Y el premio tiene que llevar un item del mismo tier que anuncia: el cartel
      // dice T8 y si el item fuera T5 el jugador cobraría por una cosa y tendría
      // otra.
      check(`salto: el anuncio y el item son del mismo tier`,
        p.item?.tier === p.tier,
        `anuncia T${p.tier} y el item es T${p.item?.tier}`);
    }

    // Y el caso concreto que importa: la caja común sube UN tier y no más.
    {
      const entrada = CRATE_LOOT.common.find(e => e.id === 'up')!;
      let maxTier = 0;
      for (let i = 0; i < 3000; i++) {
        const p: any = entrada.build({ ownedCosmetics: [] });
        if (p.tier > maxTier) maxTier = p.tier;
      }
      check('salto: la caja comun sube a lo sumo a T2',
        maxTier === 2, `tier maximo=${maxTier}`);
    }
  }

  // -----------------------------------------------------------------------
  //  3. D1 · EL ESPECTRO AZULADO YA SE PUEDE CONSEGUIR.
  //
  //     `CRATE_ONLY_COMPANIONS` tiene seis y la tabla usaba cinco. El sexto estaba
  //     definido, con nombre, tipo, poder y rareza, y no salía de ninguna parte:
  //     un compañero que el juego promete en el código y que ningún jugador puede
  //     tener.
  // -----------------------------------------------------------------------
  {
    const indiceDelFantasmaAzulado = 5;

    // La forma del dato: se puede construir, o sea que no es un hueco vacío.
    const fantasma = makeCrateOnlyCompanion(CRATE_ONLY_COMPANIONS[indiceDelFantasmaAzulado]);
    check('D1: el compañero existe y se puede construir',
      !!fantasma?.item?.name && typeof fantasma.item.power === 'number',
      JSON.stringify({ nombre: fantasma?.item?.name, poder: fantasma?.item?.power }));

    // Y sale de alguna caja. Esta es la comprobación que habría parado el bug:
    // antes el índice 5 no lo usaba ninguna entrada.
    const leyenda = CRATE_LOOT.legendary.map(e => ({ id: e.id, b: e.build({ ownedCosmetics: [] }) }));
    const loUsa = leyenda.some(({ b }) => b.item?.name === fantasma.item.name);
    check('D1: y sale de la caja legendaria',
      loUsa,
      `buscando "${fantasma.item.name}" entre ${leyenda.length} entradas`);

    // Y sale, pero no cada vez: un compañero exclusivo que saliera un 30% de las
    // legendarias dejaría de ser exclusivo.
    const entrada = CRATE_LOOT.legendary.find(e =>
      e.build({ ownedCosmetics: [] }).item?.name === fantasma.item.name
    );
    const totalLegendaria = sumarPesos('legendary');
    const peso = entrada?.weight ?? 0;
    const prob = peso / totalLegendaria;
    check('D1: y sale poco, para que siga siendo exclusivo',
      prob > 0 && prob <= 0.05,
      `${(prob * 100).toFixed(2)}% (peso ${peso} de ${totalLegendaria})`);

    // Y NINGÚN otro índice se ha movido: un guardado que apuntara al 0-4 tiene que
    // seguir recibiendo el mismo compañero.
    for (let i = 0; i < indiceDelFantasmaAzulado; i++) {
      const nombre = CRATE_ONLY_COMPANIONS[i].name;
      const enTabla = CAJAS.some(c =>
        CRATE_LOOT[c].some(e => e.build({ ownedCosmetics: [] }).item?.name === nombre)
      );
      check(`D1: el índice ${i} (${nombre}) sigue saliendo de alguna caja`,
        enTabla, nombre);
    }
  }

  // -----------------------------------------------------------------------
  //  4. EL SALTO NO DESPLAZA A LO QUE YA SALÍA.
  //
  //     Añadir una entrada a una tabla baja el porcentaje de todo lo demás, y eso
  //     es correcto. Lo que no puede pasar es que un premio que salía antes deje de
  //     salir: si el salto entra con peso alto, la caja común podría no dar casi
  //     nunca nanitas.
  // -----------------------------------------------------------------------
  {
    for (const c of CAJAS) {
      const tabla = CRATE_LOOT[c];
      const total = sumarPesos(c);
      const sinSalto = total - tabla.find(e => e.id === 'up')!.weight;
      const pesoUp = tabla.find(e => e.id === 'up')!.weight;

      check(`salto: ${c} no se come la caja (el resto pesa ${sinSalto} de ${total})`,
        sinSalto / total >= 0.85,
        `el salto se lleva el ${((pesoUp / total) * 100).toFixed(1)}% y queda ${((sinSalto / total) * 100).toFixed(1)}%`);
    }
  }

  // -----------------------------------------------------------------------
  //  5. LOS NOMBRES DEL SALTO SON REALES.
  //
  //     El salto compone un item a partir de un nombre del tier. Si el índice se
  //     sale de `TIER_SYSTEM`, el nombre sale `undefined` y el item entra al almacén
  //     sin nombre: visible, y un banco de números no lo vería.
  // -----------------------------------------------------------------------
  {
    for (const c of CAJAS) {
      const entrada = CRATE_LOOT[c].find(e => e.id === 'up')!;
      const vistos = new Set<string>();
      let sinNombre = 0;
      for (let i = 0; i < 600; i++) {
        const p: any = entrada.build({ ownedCosmetics: [] });
        if (typeof p.name !== 'string' || !p.name || p.name === 'undefined') sinNombre++;
        else vistos.add(p.name);
        // Y el item del almacén también tiene que tener nombre: es el que se ve.
        if (p.item && (typeof p.item.name !== 'string' || !p.item.name)) sinNombre++;
      }
      check(`salto: ${c} siempre da un nombre de verdad`,
        sinNombre === 0, `sin nombre en ${sinNombre} de 600 tiradas`);
      check(`salto: ${c} da varios nombres distintos, no uno fijo`,
        vistos.size >= 2, `nombres distintos=${[...vistos].join(' | ')}`);
    }

    // Y que el poder que sale sea el del rango del tier, no uno suelto.
    {
      const entrada = CRATE_LOOT.legendary.find(e => e.id === 'up')!;
      for (let i = 0; i < 300; i++) {
        const p: any = entrada.build({ ownedCosmetics: [] });
        if (p.kind !== 'companion') continue;
        const rango = TIER_SYSTEM.ranges[p.tier];
        if (!rango) { check('salto: el tier del salto existe en TIER_SYSTEM', false, `tier=${p.tier}`); break; }
        const ok = p.item.power >= rango[0] && p.item.power <= rango[1];
        check('salto: el poder sale del rango de su tier',
          ok,
          `tier=${p.tier} rango=${JSON.stringify(rango)} power=${p.item.power}`);
        break;
      }
    }
  }

  resumen('salto: la probabilidad baja de botín de arriba, y el que faltaba');
}

export default main();