// ==========================================================================
//  Equilibrio del árbol (F102) · topes, columnas y la devolución de techos
//
//  El hallazgo: trece nodos daban solo `craftLuck` y sumaban 264 %, así que el
//  árbol solo llegaba al tope del 95 % sin piedras ni nanopartícula; el crítico
//  sumaba 115 % sin ningún tope en el motor; y cinco ramas de click y de pasivo
//  con el mismo bonus hacían que comprarlos todos fuera siempre correcto.
//
//  Lo que se comprueba aquí son las tres mitades del rebalanceo: que el árbol
//  COMPLETO al máximo no pase de sus presupuestos, que el motor topee lo que
//  el árbol no puede topear solo, y que los techos que bajaron devuelvan sus
//  núcleos al cargar (migración con versión, como la de F97).
//
//  Los totales salen del agregador con los niveles al máximo leídos del
//  catálogo, no de números escritos aquí: si un rebalanceo futuro mueve un
//  bonus, el presupuesto se mueve solo y el banco sigue midiendo lo mismo.
// ==========================================================================

import { boot, check, resumen, s, baseSave, collector, ficha, conSec, recargar } from './kit';
import { TREE_NODES, TREE_BY_ID, nodeCost, coresGastadosEnArbol, COLUMNA_META } from '../src/data/tree';
import {
  aggregateBonuses,
  TOPE_CRITICO, TOPE_DESCUENTO, TOPE_COMP_DESCUENTO
} from '../src/data/prestige';
import {
  successChance, baseSuccessChance, attemptForge, costeDeNivelDeCompanio
} from '../src/data/crafting';
import { basePorPosicion } from '../src/data/bases';

/** Niveles al máximo de todo el catálogo: el árbol entero comprado. */
const todoAlMaximo = (): Record<string, number> =>
  Object.fromEntries(TREE_NODES.map(n => [n.id, n.maxLevel]));

async function main() {
  // -------------------------------------------------------------------------
  //  1. LA ESTRUCTURA: 4 ramas × 15 nodos en 3 columnas
  // -------------------------------------------------------------------------
  {
    const ramas = [...new Set(TREE_NODES.map(n => n.category))];
    check('columnas: son cuatro ramas y sesenta nodos',
      ramas.length === 4 && TREE_NODES.length === 60,
      `ramas=${ramas.join(',')} nodos=${TREE_NODES.length}`);
    const porRama = ramas.map(r => TREE_NODES.filter(n => n.category === r).length);
    check('columnas: quince nodos por rama, ni uno más ni uno menos',
      porRama.every(n => n === 15), porRama.join(','));

    // Cada nodo dice en qué columna va, y cada rama tiene las tres con nodos:
    // un lado vacío no es un camino a elegir, es un título sin nada debajo.
    const cols = ['izq', 'centro', 'der'];
    const sinCol = TREE_NODES.filter(n => !(n as any).columna || !cols.includes((n as any).columna));
    check('columnas: todo nodo va en una columna válida',
      sinCol.length === 0, sinCol.map(n => n.id).join(',') || 'las 60 puestas');
    const ladoVacio = ramas.filter(r =>
      !cols.every(c => TREE_NODES.some(n => n.category === r && (n as any).columna === c)));
    check('columnas: cada rama tiene sus tres lados con nodos',
      ladoVacio.length === 0, ladoVacio.join(',') || 'las tres en las cuatro');
    const sinNombre = ramas.filter(r => {
      const m: any = (COLUMNA_META as any)[r];
      return !m || !m.izq || !m.centro || !m.der;
    });
    check('columnas: y cada lado tiene su nombre para la pestaña',
      sinNombre.length === 0, sinNombre.join(',') || 'nombrados');
  }

  // -------------------------------------------------------------------------
  //  2. LOS PRESUPUESTOS: el árbol entero no pasa de aquí
  // -------------------------------------------------------------------------
  //  Son las cifras del encargo: la forja del árbol no llega sola al 95 % en
  //  los tiers altos, el crítico no se acerca al 100 %, y el descuento no deja
  //  la tienda a mitad de precio. Cada una se lee del agregador, no de una
  //  suma escrita a mano.
  {
    const lleno: any = aggregateBonuses(todoAlMaximo());
    check('presupuesto: la forja del árbol suma 0.40 como mucho',
      lleno.craftLuck <= 0.40 + 1e-9, `craftLuck=${lleno.craftLuck}`);
    check('presupuesto: el crítico del árbol suma 0.30 como mucho',
      lleno.critChance <= 0.30 + 1e-9, `critChance=${lleno.critChance}`);
    check('presupuesto: el descuento de tienda suma 0.40 como mucho',
      lleno.costReduction <= 0.40 + 1e-9, `costReduction=${lleno.costReduction}`);
    // **EL 3.3 Y NO EL 3.1, Y POR QUÉ.** El primer tope escrito aquí era 3.1,
    // calculado sin el nodo cruzado: solo la escalera de Asalto suma 3.02, y
    // `sinergia` (Manada que pega en click, +6% × 4 = 0.24) lo lleva a 3.26.
    // El encargo pide nodos cruzados entre builds, así que recortar el
    // ejemplo para que quepa en el tope viejo sería deshacer la feature para
    // salvar el número. El tope cubre el árbol diseñado, como sus vecinos.
    check('presupuesto: el click plano suma 3.3 como mucho',
      lleno.clickMult <= 3.3 + 1e-9, `clickMult=${lleno.clickMult}`);
    check('presupuesto: el pasivo plano suma 2.9 como mucho',
      lleno.passiveMult <= 2.9 + 1e-9, `passiveMult=${lleno.passiveMult}`);
    check('presupuesto: el potencial suma 0.30 como mucho',
      (lleno.forgePotential ?? 0) <= 0.30 + 1e-9, `forgePotential=${lleno.forgePotential}`);
    check('presupuesto: y los núcleos siguen en lo de F70 (+30 % marginal)',
      (lleno.coreGain ?? 0) <= 0.30 + 1e-9, `coreGain=${lleno.coreGain}`);

    // **LA COLMENA TIENE UN SOLO DUEÑO.** Había dos nodos dando
    // `colmenaPorComp` y el segundo era el primero con otro nombre: comprar
    // los dos era siempre correcto y no una decisión.
    const colmenas = TREE_NODES.filter(n => (n.bonus as any).colmenaPorComp);
    check('presupuesto: un solo nodo da colmena, el keystone',
      colmenas.length === 1 && colmenas[0].id === 'colmena',
      colmenas.map(n => n.id).join(',') || 'ninguno');
  }

  // -------------------------------------------------------------------------
  //  3. LOS TOPES DEL MOTOR: la red por si el árbol crece
  // -------------------------------------------------------------------------
  {
    check('topes: el crítico topa al 50 % en el motor',
      TOPE_CRITICO === 0.5, `TOPE_CRITICO=${TOPE_CRITICO}`);
    check('topes: el descuento de tienda topa al 50 %',
      TOPE_DESCUENTO === 0.5, `TOPE_DESCUENTO=${TOPE_DESCUENTO}`);
    check('topes: y el de mejora de compañeros también',
      TOPE_COMP_DESCUENTO === 0.5, `TOPE_COMP_DESCUENTO=${TOPE_COMP_DESCUENTO}`);

    // La forja ya topaba al 95 % en `successChance`: con suerte absurda sigue
    // dando 95, que es lo que impide el "120 %" del encargo por construcción.
    check('topes: la forja no pasa del 95 % ni con suerte inventada',
      successChance(1, 5, 10, 5) === 0.95, `chance=${successChance(1, 5, 10, 5)}`);

    // Y con el árbol entero, el T10 sigue necesitando piedras: la base (33 %)
    // más la suerte del árbol no llega al tope. En los tiers bajos sí se roza,
    // que es lo correcto: lo trivial no tiene que costar.
    const suerte: number = (aggregateBonuses(todoAlMaximo()) as any).craftLuck;
    check('topes: en T10 el árbol solo no llega al 95 %, hacen falta piedras',
      baseSuccessChance(10) + suerte < 0.95,
      `base=${baseSuccessChance(10)} suerte=${suerte}`);

    // El descuento de compañero SÍ pasa del tope sumando sus tres nodos
    // (30 + 24 + 20 = 74 %), así que aquí el tope muerde de verdad: la mejora
    // sale a mitad de precio y no al 26 %.
    const g = await boot(baseSave([], {
      nanites: 0,
      crystals: 1_000_000,
      companions: [ficha('c1', 3, { potential: 3 })],
      nodeLevels: { comp_descuento: 3, colmena_final: 3, colneta: 4 }
    }));
    const base = costeDeNivelDeCompanio(3, 0);
    const esperado = Math.max(1, Math.floor(base * 0.5));
    const antes = s(g).crystals;
    const r: any = g.upgradeCompanion('c1');
    check('topes: con 74 % de descuento la mejora cobra el 50 %, no el 26 %',
      r.success === true && antes - s(g).crystals === esperado,
      `cobrado=${antes - s(g).crystals} esperado=${esperado} base=${base}`);
    const g2 = await recargar(g);
    check('topes: y sobrevive a la recarga', s(g2).crystals === s(g).crystals,
      `crystals=${s(g2).crystals}`);
  }

  // -------------------------------------------------------------------------
  //  4. LOS NODOS NUEVOS LLEGAN AL MOTOR
  // -------------------------------------------------------------------------
  {
    // `forgePotential` suma a la tirada de subida, al lado del Éter: con el
    // dado a 0.5 la base de ★4 (5 %) falla y con 60 puntos del árbol sube.
    const mats = () => [
      collector('x', 3, { potential: 4, rarity: 'Raro', damage: 60 }),
      collector('y', 3, { potential: 4, rarity: 'Raro', damage: 60 })
    ];
    const sinNodo = conSec(0, 0.5, () => attemptForge(mats() as any, 3, 'X', {
      craftLuck: 0, consolationBonus: 0, stonesUsed: 0
    })).collector;
    const conNodo = conSec(0, 0.5, () => attemptForge(mats() as any, 3, 'X', {
      craftLuck: 0, consolationBonus: 0, stonesUsed: 0, forgePotential: 0.6
    })).collector;
    check('potencial: sin el nodo esa tirada no sube',
      sinNodo?.potential === 4, `pot=${sinNodo?.potential}`);
    check('potencial: y con 60 puntos del árbol la misma tirada sí sube',
      conNodo?.potential === 5, `pot=${conNodo?.potential}`);

    // `clickPorForja` convierte la forja en click: con el Instinto al máximo
    // (10 % de forja) y Manos Calientes al máximo (100 % de conversión), el
    // click sube un 10 % exacto sobre la misma arma.
    //
    // **Y LA MISMA ARMA, QUE ES LO QUE ESTA PRUEBA NO HACÍA.** El arma se
    // montaba sin potencial ni base, y la migración F74 sorteaba la base y
    // recalculaba el daño en cada arranque: las dos partidas no comparaban el
    // nodo, comparaban dos sorteos (una pasada dio 1.1950 y la siguiente
    // 1.0816, con el motor correcto). Con potencial 3 y base neutra fija, el
    // arma es la misma en las dos y el ratio es el del nodo, clavado.
    const neutra = basePorPosicion(5, 6, 'recolector');
    const arma = () => collector('w', 5, {
      damage: 100000, rarity: 'Común', potential: 3, affixes: [], baseId: neutra?.id
    });
    const gSin: any = await boot(baseSave([arma()], {
      equippedCollectorId: 'w', nodeLevels: { forge_luck: 5 }
    }));
    const gCon: any = await boot(baseSave([arma()], {
      equippedCollectorId: 'w', nodeLevels: { forge_luck: 5, golpe_bajo: 4 }
    }));
    const dSin = gSin.getClickDamage();
    const dCon = gCon.getClickDamage();
    const ratio = dCon / dSin;
    check('cruzado: la forja se vuelve click con Manos Calientes',
      ratio > 1.09 && ratio < 1.11, `sin=${dSin} con=${dCon} ratio=${ratio.toFixed(4)}`);
    const gCon2 = await recargar(gCon);
    check('cruzado: y sobrevive a la recarga',
      gCon2.getClickDamage() === dCon, `damage=${gCon2.getClickDamage()}`);
  }

  // -------------------------------------------------------------------------
  //  5. LA DEVOLUCIÓN DE TECHOS RECORTADOS (migración con versión)
  // -------------------------------------------------------------------------
  //  Varios techos bajan (el Caos de 4 a 2, el Temple de 4 a 2...): quien los
  //  tuviera por encima cobra la diferencia a la cartera al cargar, con la
  //  misma función que cobra la tienda. Los costes no cambian, así que la
  //  cuenta es exacta y no una estimación.
  {
    const over = { chaos_forge: 4, temple: 4 };
    const devuelto = nodeCost(TREE_BY_ID.chaos_forge, 2) + nodeCost(TREE_BY_ID.chaos_forge, 3)
      + nodeCost(TREE_BY_ID.temple, 2) + nodeCost(TREE_BY_ID.temple, 3);
    const g = await boot(baseSave([], { saveVersion: 11, cores: 0, nodeLevels: { ...over } }));
    check('devolución: los niveles por encima del techo se recortan al máximo',
      s(g).nodeLevels.chaos_forge === 2 && s(g).nodeLevels.temple === 2,
      `caos=${s(g).nodeLevels.chaos_forge} temple=${s(g).nodeLevels.temple}`);
    check('devolución: y la diferencia vuelve a la cartera, exacta',
      s(g).cores === devuelto, `cores=${s(g).cores} esperado=${devuelto}`);
    const g2 = await recargar(g);
    check('devolución: y no se devuelve dos veces al recargar',
      s(g2).cores === devuelto && s(g2).nodeLevels.chaos_forge === 2,
      `cores=${s(g2).cores} caos=${s(g2).nodeLevels.chaos_forge}`);

    // Una partida ya en 12 no devuelve nada: el nivel de más se queda
    // guardado pero cobra capado, que es el trato de F97 y lo ata su banco.
    const g3 = await boot(baseSave([], { saveVersion: 12, cores: 0, nodeLevels: { ...over } }));
    check('devolución: en versión 12 no hay devolución',
      s(g3).cores === 0 && s(g3).nodeLevels.chaos_forge === 4,
      `cores=${s(g3).cores} caos=${s(g3).nodeLevels.chaos_forge}`);
    await recargar(g3);

    // Y una anterior a F97 pasa por su devolución capada sin que esta sume
    // otra encima: el recorte lee el estado, no el save crudo. Esos ids
    // nacieron en la versión 11, así que en una 10 solo existen manipulando;
    // lo que se afirma es que la de F102 no suma nada más encima.
    const vieja = { chaos_forge: 4 };
    const toda = coresGastadosEnArbol(vieja as any);
    const g4 = await boot(baseSave([], { saveVersion: 10, cores: 0, nodeLevels: { ...vieja } }));
    check('devolución: en versión 10 solo devuelve la de F97, una vez',
      s(g4).cores === toda && Object.keys(s(g4).nodeLevels).length === 0,
      `cores=${s(g4).cores} esperado=${toda} niveles=${JSON.stringify(s(g4).nodeLevels)}`);
    await recargar(g4);
  }

  resumen('equilibrio del árbol: topes, columnas y devolución');
}

export default main();
