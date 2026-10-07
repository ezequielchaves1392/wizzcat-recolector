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
//  LO QUE NO CUBRE, A PROPÓSITO: que el cartel pinte bien el salto. Eso es
//  `preview.html`, con viewport real.
// ==========================================================================

import { check, resumen } from './kit';
import {
  CRATE_LOOT, CRATE_ONLY_COMPANIONS, makeCrateOnlyCompanion, probabilidadDeSalto, tablaDePesos,
  pickLoot, RARITY_RANK, rarezaDeTabla
} from '../src/components/crateLoot';
import { TIER_SYSTEM } from '../src/data/tiers';
import { CRATE_TYPES, type CrateType } from '../src/data/store';

/**
 * F31 · LAS CAJAS SON NIVELES, Y LA T10 NO TIENE SALTO.
 *
 * `TIER_PROPIO` —que decía "a esta caja le toca el tier 1 / 3 / 6 / 8"— ha
 * desaparecido: con una caja por tier, el tope de la caja es su propio número.
 * Y la lista de cajas va del 1 al 9 porque **la T10 no tiene peldaño por encima
 * del final**, así que su tabla no incluye la entrada `up`. Eso es una regla
 * nueva, y por eso el banco no la da por buena: si alguien la añadiera igual, el
 * salto de la T10 daría un T10 y sería un premio garantizado disfrazado.
 */
const CAJAS: CrateType[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];

/** La caja donde están los compañeros exclusivos. */
const CAJA_EXCLUSIVA: CrateType = 9;

/**
 * Todos los premios de una caja, con la entrada ya construida.
 *
 * Hace el mismo sorteo por peso que el juego, a propósito: si el banco usara otro
 * criterio estaría midiendo su propia idea de cómo se sortea, y un banco que
 * reimplementa la regla no puede detectar que la regla se rompió.
 */
function botinDe(c: CrateType, n = 4000): any[] {
  const tabla = CRATE_LOOT[c];
  const pesos = tablaDePesos(c);
  const total = pesos.reduce((s, w) => s + w, 0);
  const salida: any[] = [];
  for (let i = 0; i < n; i++) {
    let r = Math.random() * total;
    for (let j = 0; j < tabla.length; j++) {
      r -= pesos[j];
      if (r < 0) { salida.push(tabla[j].build({ ownedCosmetics: [] })); break; }
    }
  }
  return salida;
}

/**
 * Cuenta cuántas veces sale una entrada concreta en `n` sorteos reales.
 *
 * **SORTEA CON `tablaDePesos()`, NO CON `e.weight`.** Antes sumaba los pesos de
 * autor, y con cuatro cajas eso coincidía con lo bastante para que la
 * comparación pasara: el salto pesaba casi lo mismo en los dos repartos. Con el
 * reparto actual la diferencia es de más de un punto porcentual, y el banco
 * fallaba por 1,1 puntos midiendo la tabla equivocada.
 *
 * Y es exactamente lo que advierte el comentario de este fichero: un banco que
 * reimplementa el sorteo mide su propia idea de cómo se sortea. Esta función
 * reimplementaba el sorteo con los números de autor mientras el juego usaba los
 * definitivos, así que las dos cifras salían bien y no decían nada del juego.
 */
function vecesQueSale(c: CrateType, id: string, n = 20_000): number {
  const tabla = CRATE_LOOT[c];
  const pesos = tablaDePesos(c);
  const total = pesos.reduce((s, w) => s + w, 0);
  let veces = 0;
  for (let i = 0; i < n; i++) {
    let r = Math.random() * total;
    for (let j = 0; j < tabla.length; j++) {
      r -= pesos[j];
      if (r < 0) { if (tabla[j].id === id) veces++; break; }
    }
  }
  return veces;
}

/**
 * La suma de los pesos con la rareza ya aplicada.
 *
 * Antes sumaba `e.weight` a pelo. Con la rareza mandando en el peso real, sumar
 * los pesos de autor daría una probabilidad distinta de la que el motor usa, y el
 * banco mediría un número que el jugador nunca ve — que es justo lo que este
 * banco existe para no pasar por alto.
 */
function sumarPesos(c: CrateType): number {
  return tablaDePesos(c).reduce((s, w) => s + w, 0);
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
      check(`salto: T${c} tiene entrada de salto en la tabla`,
        entrada !== undefined, 'sin entrada');

      // Un premio de la caja, con su tier. El tope de cada caja es SU PROPIO
      // número —F31— y el `up` sube UNO por encima. Los items que no llevan
      // `tier` (llaves, cristales, cosméticos) no compiten con la regla.
      const salto = CRATE_LOOT[c].find(e => e.id === 'up')!;
      const esperados = new Set<number>([c, c + 1]);
      const p: any = salto.build({ ownedCosmetics: [] });
      check(`salto: T${c} da T${c + 1}, nunca más`,
        esperados.has(p.tier),
        `tier=${p.tier} en una caja cuyo tope propio es T${c}`);

      // Y el premio tiene que llevar un item del mismo tier que anuncia: el cartel
      // dice T8 y si el item fuera T5 el jugador cobraría por una cosa y tendría
      // otra.
      check(`salto: el anuncio y el item son del mismo tier`,
        p.item?.tier === p.tier,
        `anuncia T${p.tier} y el item es T${p.item?.tier}`);
    }

    // Y el caso concreto que importa: la caja T1 sube UN tier y no más.
    {
      const entrada = CRATE_LOOT[1].find(e => e.id === 'up')!;
      let maxTier = 0;
      for (let i = 0; i < 3000; i++) {
        const p: any = entrada.build({ ownedCosmetics: [] });
        if (p.tier > maxTier) maxTier = p.tier;
      }
      check('salto: la caja T1 sube a lo sumo a T2',
        maxTier === 2, `tier maximo=${maxTier}`);
    }

    // Y LA T10 NO SALTA. Es lo único que no encaja en el patrón, y por eso es
    // una comprobación y no una excepción: una caja final sin peldaño por encima
    // no puede tener una entrada de salto que siempre devuelva lo mismo.
    check('salto: la caja T10 no tiene entrada de salto',
      CRATE_LOOT[10].find(e => e.id === 'up') === undefined,
      `entradas=${CRATE_LOOT[10].map(e => e.id).join(',')}`);
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
    const leyenda = CRATE_LOOT[CAJA_EXCLUSIVA].map(e => ({ id: e.id, b: e.build({ ownedCosmetics: [] }) }));
    const loUsa = leyenda.some(({ b }) => b.item?.name === fantasma.item.name);
    check('D1: y sale de una caja alta',
      loUsa,
      `buscando "${fantasma.item.name}" entre ${leyenda.length} entradas`);

    // Y sale, pero no cada vez: un compañero exclusivo que saliera un 30% de las
    // legendarias dejaría de ser exclusivo.
    const entrada = CRATE_LOOT[CAJA_EXCLUSIVA].find(e =>
      e.build({ ownedCosmetics: [] }).item?.name === fantasma.item.name
    );
    // El peso que cuenta es el PONDERADO por rareza, que es el que usa el
    // sorteo. Con el de autor, la probabilidad medida aquí no era la real.
    const totalLegendaria = sumarPesos(CAJA_EXCLUSIVA);
    const idxEspectro = CRATE_LOOT[CAJA_EXCLUSIVA].indexOf(entrada!);
    const peso = tablaDePesos(CAJA_EXCLUSIVA)[idxEspectro] ?? 0;
    const prob = peso / totalLegendaria;
    // El banco mide la entrada suelta, que es lo que la ruleta enseña. Y mide el
    // PESO REAL (el de `tablaDePesos`, ya rareza y bolsa aplicadas) contra la
    // suma de la caja, no el peso de autor: con el reparto por rareza, el peso de
    // autor no es la probabilidad que el jugador ve.
    check('D1: y sale poco, para que siga siendo exclusivo',
      prob > 0 && prob <= 0.05,
      `${(prob * 100).toFixed(2)}% (peso ${peso} de ${totalLegendaria})`);

    // Y NINGÚN otro índice se ha movido: un guardado que apuntara al 0-4 tiene que
    // seguir recibiendo el mismo compañero.
    for (let i = 0; i < indiceDelFantasmaAzulado; i++) {
      const nombre = CRATE_ONLY_COMPANIONS[i].name;
      const enTabla = [...CAJAS, 10].some(c =>
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
      // Los pesos PONDERADOS, no los de autor. Restar `e.weight` de una suma de
      // pesos normalizados daba negativos y una probabilidad de -500%: la suma
      // ya está repartida en 1, así que la resta tiene que ser sobre el valor
      // real de la entrada.
      const pesos = tablaDePesos(c);
      const total = pesos.reduce((s, w) => s + w, 0);
      const indiceUp = tabla.findIndex(e => e.id === 'up');
      const pesoUp = pesos[indiceUp] ?? 0;
      const sinSalto = total - pesoUp;

      check(`salto: ${c} no se come la caja (el resto pesa ${sinSalto.toFixed(3)} de ${total.toFixed(3)})`,
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
      const entrada = CRATE_LOOT[CAJA_EXCLUSIVA].find(e => e.id === 'up')!;
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

  // -----------------------------------------------------------------------
  //  5. MÁS RAREZA, MENOS PROBABILIDAD
  // -----------------------------------------------------------------------
  {
    // La rareza pesa sobre el peso real de cada entrada. Los pesos de autor son
    // relativos dentro de la caja; lo que manda es el peso ya ponderado, que sale
    // del mismo `tablaDePesos` que usa el sorteo.
    for (const c of CAJAS) {
      const tabla = CRATE_LOOT[c];
      // La rareza que manda es la ACOTADA a la caja. Sin acotar, la caja baja
      // tendría un item del tier de arriba pesando por debajo de su Raro, y
      // saldría más a menudo: la caja dejaría de parecer la que es.
      const rarezas = rarezaDeTabla(c);
      // Lo que se mide NO es la suma de la rareza del PREMIO, sino el **peso por
      // unidad de rareza**: cuánto pesa de media una entrada de esa rareza.
      //
      // La diferencia no es un detalle. La suma de una rareza puede ser la de
      // TRES entradas distintas y la de otra la de una sola, así que comparar
      // los totales brutos mide cuántos premios hay de cada rareza, no su
      // probabilidad, y da un falso positivo que no dice nada del juego.
      //
      // Con eso, lo que se compara es lo que el jugador pide: la rareza pesa
      // menos. Y sale del mismo `tablaDePesos` que usa el sorteo, no de una
      // cuenta paralela.
      const pesos = tablaDePesos(c);
      // El multiplicador de rareza es una escalera sobre el peso de autor. La
      // regla que se comprueba es la de ESE multiplicador, no la suma de las
      // entradas de cada rareza.
      //
      // Y la razón es que la suma no puede ser la regla: una caja tiene cuatro
      // entradas Comunes y una Mítica, así que la Común suma más aunque pese
      // más por entrada. Medir la suma mide cuántas entradas hay de cada rareza, y
      // eso no dice nada de su probabilidad. Con la media por entrada, lo que se
      // compara es exactamente "una entrada más rara pesa menos", que es lo que
      // se pidió.
      // Ni el salto ni los exclusivos aparecen aquí: los dos pesan por su peso de autor
      // contra la caja entera, no compiten en la bolsa de su rareza, y los miden
      // los bloques de arriba (salto 1-8%, D1 exclusividad). La escalera de rareza
      // es solo para las entradas que sí compiten por rareza.
      // **LA MEDIA POR ENTRADA, QUE ES LO QUE EL COMENTARIO DE ARRIBA DICE QUE SE
      // MIDE, Y NO LA SUMA.** El comentario lleva tres párrafos explicando por qué la
      // suma es la medida equivocada —"una rareza puede ser la de TRES entradas
      // distintas y la de otra la de una sola"—, y el código sumaba. No es un detalle
      // de redacción: la suma compara **cuántos premios hay de cada rareza**, y esa
      // jerarquía es la del diseñador, no la del jugador.
      //
      // La prueba pasaba en vacío, y conviene decir por qué. Antes, el botín de cristal
      // de una caja alta era Legendario o Divino, así que en las cajas T5 a T10 **no
      // existía ninguna entrada Rara**, la escalera empezaba en Épico y no había un
      // peldaño anterior con el que comparar. Ahora el cristal conserva su rareza de
      // siempre, que tampoco cambia eso, pero el día que aparezca un peldaño más la
      // escalera tiene que sostenerse por lo que dice el comentario y no porque no
      // tenga con qué compararse.
      const porRareza: Record<string, number[]> = {};
      tabla.forEach((e, i) => {
        if (e.id === 'up' || e.exclusivo) return;
        const rar = rarezas[i] ?? 'Común';
        (porRareza[rar] ??= []).push(pesos[i]);
      });
      const escalera = Object.keys(porRareza)
        .sort((a, b) => (RARITY_RANK[a] ?? 0) - (RARITY_RANK[b] ?? 0))
        .map(k => {
          // Media, no suma: el peso **por entrada** de esa rareza, que es lo que el
          // jugador nota —una entrada Épica es más fácil que una Legendario—. La
          // media pondera por el número de entradas, así que una rareza con cuatro
          // entradas no queda handicapeada por tener cuatro.
          const lista = porRareza[k];
          const media = lista.reduce((a, b) => a + b, 0) / lista.length;
          return { rar: k, prob: media * 100 };
        });
      let rompe = '';
      for (let i = 1; i < escalera.length; i++) {
        if (escalera[i].prob >= escalera[i - 1].prob) {
          rompe = `${escalera[i - 1].rar}=${escalera[i - 1].prob.toFixed(2)}% >= ${escalera[i].rar}=${escalera[i].prob.toFixed(2)}%`;
        }
      }
      check(`rareza: en la caja ${c} más rareza es menos probabilidad`,
        rompe === '',
        rompe || escalera.map(m => `${m.rar} ${m.prob.toFixed(2)}%`).join(' · '));
      if (process.env.SALTO_DEBUG) {
        const filas = tabla.map((e, i) =>
          `${rarezas[i]}|${(RARITY_RANK[rarezas[i]] ?? 0)}|autor ${e.weight}|efectivo ${pesos[i].toFixed(2)}|${e.id}`
        );
        console.log(`\n--- ${c} ---\n` + filas.join('\n'));
      }
    }

    // Que la rareza que DECIDE EL PESO está acotada a la caja. La nominal puede
    // ser altísima -el salto de una caja baja trae un item del tier de arriba-,
    // pero para el peso vale la de la caja: si no, una caja común tendría un
    // Divino compitiendo con su Raro y dejaría de parecer una común.
    // F31 · EL TOPE DE CADA CAJA ES SU RAREZA, LEÍDA DE SU NOMBRE.
    //
    // Antes era un objeto de cuatro: `{ common: 1, rare: 2, epic: 3, legendary: 4 }`.
    // Es decir, **el rango de rareza del botín estaba escrito dos veces** —aquí y
    // en el nombre de la caja— y con diez cajas eran veinte números que nadie
    // comparaba. Ahora sale de `RARITY_RANK[CRATE_TYPES[c].rarity]`, que es el
    // mismo dato que pinta la carta y el mismo que usa `rarezaAcotada`. Si las
    // dos copias se separaban, la caja empezaba a dar un Divino con más peso que
    // su Raro y el banco de abajo lo canta.
    for (const c of [...CAJAS, 10] as CrateType[]) {
      const tope = RARITY_RANK[CRATE_TYPES[c].rarity] ?? 0;
      const rarezas = rarezaDeTabla(c);
      const fuera = rarezas.filter(r => (RARITY_RANK[r] ?? 0) > tope);
      check(`rareza: en la caja T${c} ninguna entrada pesa por encima de su tope`,
        fuera.length === 0,
        fuera.length ? `fuera de tope: ${[...new Set(fuera)].join(',')}` :
          [...new Set(rarezas)].join(','));
    }
  }

  resumen('salto: la probabilidad baja de botín de arriba, y el que faltaba');
}

export default main();
