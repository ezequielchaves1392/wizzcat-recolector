// ==========================================================================
//  La Wiki enseña las reglas que el juego aplica, no una copia
// ==========================================================================
//  POR QUÉ ESTE BANCO EXISTE.
//
//  La Wiki (`src/ui/wikiPage.ts`) es solo lectura y `verify/` no cubre el
//  pintado, así que lo que se comprueba aquí no es el HTML: es el CONTRATO
//  entre la Wiki y las tablas. Cada número que la Wiki promete enseñar sale
//  de la misma función que el motor, y eso se puede afirmar sin navegador:
//
//    · La ruta existe, va en la cabecera y NO en la barra inferior (tope de 5).
//    · Hay diez cajas y las diez se abren; el reparto de cada una suma el 100 %.
//    · El salto vive en la banda de siempre y la T10 no lo tiene.
//    · Los seis exclusivos salen todos, cada uno en su caja y una sola vez.
//    · Son doscientas bases (diez por tier y por lado), con stat ±10 % y
//      sorteo lineal de 10 a 1.
//    · Los logros son 27 y los difíciles no dan números.
//    · El árbol no tiene requisitos imposibles ni costes que no salgan de
//      `nodeCost()`.
//    · El buscador (F95) indexa lo que el juego tiene —si un dato nuevo no
//      está en el índice sale en rojo—, busca con "y" entre términos y sin
//      tildes, y cada ancla del índice es una que la página escribe.
//
//  Si alguna de estas se mueve, la Wiki miente y este banco lo canta el mismo
//  día, en vez de tres meses después mirando la pantalla.
//
//  LO QUE NO CUBRE, A PROPÓSITO: que la pestaña se abra, que el texto quepa
//  en un móvil y que el número pintado sea el calculado. Eso es
//  `preview.html?vista=wiki` con viewport real.
// ==========================================================================

import { check, resumen } from './kit';
import { ROUTES, BOTTOM_BAR_ROUTES } from '../src/ui/router';
import { appHeaderHTML } from '../src/ui/appHeader';
import { ICONS } from '../src/ui/icons';
import { NOTAS } from '../src/data/patchNotes';
import {
  CRATE_TIERS, CRATE_TYPES, costeDeCaja, costeDeTier, MAX_CRATE_TIER,
  EXPANSOR_TIERS, expansorDeCaja, STORE_ITEMS,
  // POR QUÉ EL ALIAS. Este banco importa `store` directamente Y a través de
  // `wikiIndex`, y con ese doble camino el bundle (solo y completo) dejaba el
  // `CONSUMABLES` de este fichero sin declarar —`ReferenceError` en la primera
  // línea que lo tocaba— mientras el resto de nombres del mismo módulo llegaba
  // bien. Con el alias el banco vuelve a compilar y las pruebas cantan igual.
  CONSUMABLES as CONSUMIBLES
} from '../src/data/store';
import {
  CRATE_LOOT, CRATE_META, CRATE_ONLY_COMPANIONS, tablaDePesos,
  probabilidadDeSalto, EXCLUSIVOS_POR_CAJA
} from '../src/components/crateLoot';
import { crateCosmetics } from '../src/data/cosmetics';
import { rangoDePoder, rarezaDeTier } from '../src/data/tiers';
import {
  BASES_RECOLECTOR, BASES_COMPANERO, TODAS_LAS_BASES
} from '../src/data/bases';
import {
  AFFIXES, POTENTIAL_WEIGHTS, baseSuccessChance, techoDeNivel,
  AFIX_MIN_POR_RARIDAD, AFIX_MAX, danioDeRango, poderDeCompanero,
  multiplicadorDeNivel, multiplicadorDeCalidadDeCompanero
} from '../src/data/crafting';
import { ACHIEVEMENTS } from '../src/achievements';
import {
  LOGROS_DIFICILES, ACHIEVEMENT_REWARDS, SECRET_ACHIEVEMENTS
} from '../src/data/achievements';
import { TREE_NODES, nodeCost, coresGastadosEnArbol } from '../src/data/tree';
import { pendingCores, nanitesForCores, aggregateBonuses } from '../src/data/prestige';
import {
  ANCLA, anclaAfijo, anclaBase, anclaCaja, anclaConsumible, anclaExclusivo,
  anclaExpansor, anclaGrupoBases, anclaLogro, anclaNodo, anclaTier,
  anclaVersion, buscarEnWiki, construirIndiceWiki, normalizaWiki
} from '../src/data/wikiIndex';
import {
  compraSimulada, quitaNivelSimulada, resumenDeBuild,
  produccionParaBuild, cabeEnRun, fichaSimulada
} from '../src/ui/wikiTools';

/**
 * Los tiers de caja, y si cubren la escalera entera sin huecos.
 *
 * **ESTÁN FUERA DE `main()` PORQUE LOS USAN DOS BLOQUES.** El de las cajas y el del
 * salto. Declarados dentro del primero, el segundo falla con un `no está definido`
 * en una línea que no tiene nada que ver con la decisión que falta —el mismo modo
 * de fallo que ya corrigió el `min()` de los precios— y el banco entero se cae sin
 * decir qué comprobación estaba mirando.
 */
const TIERS_CAJA = CRATE_TIERS.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
const SIN_HUECO = TIERS_CAJA.every((t, i) => i === 0 || t === TIERS_CAJA[i - 1] + 1);

/** Los tiers que tienen base, que son los que la wiki agrupa por lado. */
const TIERS_BASES = Object.keys(BASES_RECOLECTOR).map(Number).filter(Number.isFinite).sort((a, b) => a - b);

async function main() {
  // ------------------------------------------------------------------
  // 1 · Pestaña aparte: sin ruta en el juego, botón en la cabecera
  // ------------------------------------------------------------------
  {
    const ids = ROUTES.map(r => r.id);
    check('wiki: el juego no suma una ruta (la Wiki va en pestaña aparte)',
      !(ids as string[]).includes('wiki'), ids.join(','));
    check('wiki: la barra inferior sigue en 5', BOTTOM_BAR_ROUTES.length === 5,
      `${BOTTOM_BAR_ROUTES.length} en la barra`);
    // El botón lo pinta la cabecera, que sale en todas las pantallas: si está
    // aquí, está en las siete. Se comprueba el marcado, no el clic.
    const cabecera = appHeaderHTML({ route: 'base', resources: false });
    check('wiki: la cabecera trae el botón que la abre aparte',
      cabecera.includes('data-wiki-externo'), 'sin botón');
  }

  // ------------------------------------------------------------------
  // 2 · Las cajas, con su precio y su reparto entero
  // ------------------------------------------------------------------
  {
    check('wiki: hay una caja por tier, sin huecos',
      SIN_HUECO && TIERS_CAJA[0] === 1, `${TIERS_CAJA.length} cajas: ${TIERS_CAJA.join(',')}`);    // **EL NÚMERO DE CAJAS NO SE ESCRIBE.** Decía `=== 10`, y con veinte cajas
    // falló por la razón obvia: el banco que tenía que comprobar que la wiki
    // enseñaba las cajas que existen se quejaba porque había más de las que él
    // conocía. Lo que se comprueba ahora es lo que importa: **una caja por tier,
    // sin huecos**, que es lo que hace que la wiki no se salte un nivel.
    for (const t of TIERS_CAJA) {
      const tabla = (CRATE_LOOT as Record<number, Array<{ id: string }>>)[t] ?? [];
      const pesos = tablaDePesos(t as any);
      const suma = pesos.reduce((a, b) => a + b, 0);
      check(`wiki: la caja T${t} reparte el 100 %`, Math.abs(suma - 1) < 1e-9,
        `suma=${suma}`);
      check(`wiki: la caja T${t} trae compañero y recolector de su tier`,
        tabla.some(e => e.id === 'companion') && tabla.some(e => e.id === 'collector'),
        tabla.map(e => e.id).join(','));
      // **EL PRECIO SE COMPARA CON `costeDeCaja()`, NO CON LA TABLA.** Antes
      // comparaba con `COSTE_POR_TIER[t - 1] * 3/4`, y esa tabla tiene diez
      // entradas: en el T11 daba `undefined`, la cuenta daba `NaN` y la
      // comprobación fallaba con un número de precio que sí era el correcto. El
      // banco quitaba una línea buena por estar escrita con la tabla vieja en vez
      // de con la función.
      check(`wiki: la caja T${t} cuesta lo que dice la curva`,
        CRATE_META[t as any].cost === costeDeCaja(t)
          && costeDeCaja(t) === Math.round(costeDeTier(t) * 3 / 4),
        `${CRATE_META[t as any].cost}`);
      const tipo = (CRATE_TYPES as Record<number, { rarity: string }>)[t];
      check(`wiki: la caja T${t} anuncia su rareza (${tipo.rarity})`,
        CRATE_META[t as any].name === `Caja T${t}` && typeof tipo.rarity === 'string',
        CRATE_META[t as any].name);
    }
  }

  // ------------------------------------------------------------------
  // 3 · El salto: en banda, y la última caja sin él
  // ------------------------------------------------------------------
  {
    for (const t of TIERS_CAJA) {
      const p = probabilidadDeSalto(t as any);
      const tabla = (CRATE_LOOT as Record<number, Array<{ id: string }>>)[t] ?? [];
      // **LA ÚLTIMA, QUE CON 10 Cajas ERA EL 10.** El número estaba escrito, así que
      // al llegar al T20 exigía que la caja T10 —que ya no era la última— no
      // saltase, y fallaba con una probabilidad de 1,9 % que era exactamente la
      // que debía tener. La regla es "la caja más alta no salta", y el banco la
      // estaba aplicando al número.
      if (t === MAX_CRATE_TIER) {
        check(`wiki: la T${t} no salta (no hay tier por encima)`,
          p === 0 && !tabla.some(e => e.id === 'up'), `p=${p}`);
      } else {
        check(`wiki: el salto de la T${t} está en banda (1-8 %)`,
          p >= 0.01 && p <= 0.08, `${Math.round(p * 1000) / 10} %`);
      }
    }
    const conCosmetico = CRATE_TIERS.filter(t => crateCosmetics(t as any).length > 0);
    check('wiki: los cosméticos salen de T1, T3, T6 y T10',
      JSON.stringify(conCosmetico) === JSON.stringify([1, 3, 6, 10]),
      conCosmetico.join(','));
  }

  // ------------------------------------------------------------------
  // 4 · Los exclusivos, cada uno en su caja y una sola vez
  // ------------------------------------------------------------------
  {
    // **EL NÚMERO Y LA LISTA SALEN DE LA TABLA, NO ESTÁN ESCRITOS.** Decía "seis" con
    // un `=== [0,1,2,3,4,5]`: al añadir los diez del T11 en adelante falló diciendo
    // que había 16 donde él esperaba 6. Lo que se sigue exigiendo es la REGLA —cada
    // exclusivo sale de una caja y no de dos, y cada caja trae los suyos—, que es lo
    // que un banco tiene que poder afirmar y no depende de cuántos haya.
    check(`wiki: hay ${CRATE_ONLY_COMPANIONS.length} exclusivos de caja`,
      CRATE_ONLY_COMPANIONS.length > 0, `${CRATE_ONLY_COMPANIONS.length}`);

    const vistos: number[] = Object.values(EXCLUSIVOS_POR_CAJA).flat() as number[];
    const ordenados = [...vistos].sort((a, b) => a - b);
    const esperados = CRATE_ONLY_COMPANIONS.map((_, i) => i);
    check('wiki: los exclusivos salen, cada uno una vez',
      JSON.stringify(ordenados) === JSON.stringify(esperados)
        && ordenados.length === CRATE_ONLY_COMPANIONS.length,
      `${ordenados.length} repartidos de ${CRATE_ONLY_COMPANIONS.length}`);

    // **Y QUE LA CAJA MÁS CARA TENGA EL EXCLUSIVO MÁS POTENTE.** Es la regla que
    // hace que abrir la T20 tenga razón: el premio más grande del juego tiene que
    // estar en el cofre más caro. La alternativa —repartir el exclusivity viejo
    // entre las cajas nuevas— dejaba la caja más cara sin nada propio.
    const porCaja = new Map<number, number>();
    for (const [t, idxs] of Object.entries(EXCLUSIVOS_POR_CAJA)) {
      const mejor = Math.max(...(idxs as number[]).map(i => CRATE_ONLY_COMPANIONS[i].power));
      porCaja.set(Number(t), mejor);
    }
    const cajaMasCara = Math.max(...porCaja.keys());
    const poderMaximo = Math.max(...CRATE_ONLY_COMPANIONS.map(c => c.power));
    check(`wiki: la caja más cara (T${cajaMasCara}) trae el exclusivo más potente`,
      porCaja.get(cajaMasCara) === poderMaximo,
      `poder en T${cajaMasCara}=${porCaja.get(cajaMasCara)} máximo=${poderMaximo}`);

    for (const t of Object.keys(EXCLUSIVOS_POR_CAJA).map(Number)) {
      const tabla = (CRATE_LOOT as Record<number, Array<{ id: string }>>)[t] ?? [];
      const n = (EXCLUSIVOS_POR_CAJA[t] ?? []).length;
      check(`wiki: la caja T${t} trae sus ${n} exclusivo(s) en la tabla`,
        tabla.filter(e => e.id.startsWith('exclusivo_')).length === n,
        `${n}`);
    }
  }

  // ------------------------------------------------------------------
  // 5 · Las bases: contenido, stat y sorteo
  // ------------------------------------------------------------------
  {
    // **EL RECUENTO LO PONE LA TABLA, NO EL NÚMERO.** Decía "doscientas" con un
    // `=== 200`: al añadir el T11 el banco falló diciendo que había 220 bases, que
    // era la respuesta correcta a la pregunta que se le había hecho. Un banco que
    // falla porque el contenido creció es un banco que empuja a no añadir contenido.
    // Lo que se comprueba ahora es que haya **diez por tier y por lado** y que las dos
    // tablas tengan los mismos tiers, que es la regla; el total sale solo.
    const tiersRec = Object.keys(BASES_RECOLECTOR).map(Number).filter(Number.isFinite).sort((a, b) => a - b);
    const tiersCom = Object.keys(BASES_COMPANERO).map(Number).filter(Number.isFinite).sort((a, b) => a - b);
    const completos = [...tiersRec, ...tiersCom].every(t =>
      BASES_RECOLECTOR[t]?.length === 10 && BASES_COMPANERO[t]?.length === 10);
    const mismosTiers = tiersRec.join(',') === tiersCom.join(',');
    check(`wiki: hay diez bases por tier y por lado, en los mismos tiers (${TODAS_LAS_BASES.length} en total)`,
      completos && mismosTiers,
      `rec=${tiersRec.length} com=${tiersCom.length} total=${TODAS_LAS_BASES.length}`);
    for (const [lado, tabla] of [['recolector', BASES_RECOLECTOR], ['companero', BASES_COMPANERO]] as const) {
      for (let tier = 1; tier <= 10; tier++) {
        const bases = (tabla as Record<number, any[]>)[tier] ?? [];
        check(`wiki: ${lado} T${tier} tiene sus diez bases`, bases.length === 10,
          `${bases.length}`);
        for (const b of bases) {
          if (!(b.pesoStat >= 0.92 && b.pesoStat <= 1.10 && b.pesoDrop === 11 - b.posicion)) {
            check(`wiki: base ${b.id} con stat y sorteo en regla`, false,
              `stat=${b.pesoStat} drop=${b.pesoDrop} pos=${b.posicion}`);
          }
        }
      }
    }
    check('wiki: el stat se mueve ±10 % y el sorteo es lineal 10→1', true, '200 revisadas');
    const ids = new Set(TODAS_LAS_BASES.map(b => b.id));
    check(`wiki: ningún id de base se repite (${TODAS_LAS_BASES.length})`,
      ids.size === TODAS_LAS_BASES.length,
      `${ids.size} únicos`);
  }

  // ------------------------------------------------------------------
  // 6 · Los logros, y los difíciles sin números
  // ------------------------------------------------------------------
  {
    // **EL NÚMERO NO SE ESCRIBE, PERO EL MÍNIMO TAMPOCO.** Decía `=== 32` y con los
    // dos de "llegar lejos" felló diciendo que había 34. Lo que un banco puede afirmar
    // sobre el número de logros es que **no baje** —una lista que se encoge es un
    // bug— y que todos los difíciles y secretos siguen sin bonificación numérica,
    // que es la regla de balance de verdad. El número exacto lo dice la tabla.
    check(`wiki: hay al menos 30 logros (${ACHIEVEMENTS.length})`,
      ACHIEVEMENTS.length >= 30, `${ACHIEVEMENTS.length}`);
    const dificiles = new Set(LOGROS_DIFICILES.map(d => d.id));
    const sinBonus = ACHIEVEMENTS.filter(a =>
      dificiles.has(a.id) || (SECRET_ACHIEVEMENTS as string[]).includes(a.id));
    check('wiki: difíciles y secretos no dan bonus numérico',
      sinBonus.every(a => a.reward.clickBonus === 0 && a.reward.passiveBonus === 0),
      `${sinBonus.length} sin bonus`);
    check('wiki: todo logro tiene su recompensa declarada',
      ACHIEVEMENTS.every(a => (ACHIEVEMENT_REWARDS as Record<string, unknown>)[a.id] !== undefined),
      'todas en el Record');
    check('wiki: los doce difíciles explican su porqué',
      LOGROS_DIFICILES.length === 12 && LOGROS_DIFICILES.every(d => d.porQue.length > 10),
      `${LOGROS_DIFICILES.length}`);
  }

  // ------------------------------------------------------------------
  // 7 · El árbol: requisitos que existen y costes que salen de la regla
  // ------------------------------------------------------------------
  {
    const ids = new Set(TREE_NODES.map(n => n.id));
    const rotos = TREE_NODES.filter(n => n.requires.some(r => !ids.has(r)));
    check('wiki: ningún nodo pide un requisito que no existe', rotos.length === 0,
      rotos.map(n => n.id).join(',') || `${TREE_NODES.length} nodos`);
    const costes = TREE_NODES.filter(n => nodeCost(n as any, 0) !== n.baseCost);
    check('wiki: el coste base sale de nodeCost()', costes.length === 0,
      costes.map(n => n.id).join(',') || 'todos cuadran');
    check('wiki: el árbol tiene siete columnas (0-6)', new Set(TREE_NODES.map(n => n.tier)).size === 7,
      [...new Set(TREE_NODES.map(n => n.tier))].join(','));
  }

  // ------------------------------------------------------------------
  // 7b · Las herramientas (F98): el simulador cobra con las reglas
  // ------------------------------------------------------------------
  {
    const raiz = TREE_NODES.find(n => (n.requires ?? []).length === 0);
    const conReq = TREE_NODES.find(n => (n.requires ?? []).length > 0);
    check('herr: hay nodos con y sin requisitos para simular', !!raiz && !!conReq,
      raiz && conReq ? 'los dos casos' : 'falta un caso');
    if (raiz && conReq) {
      const r1 = compraSimulada({}, raiz.id, null);
      check('herr: el simulador suma un nivel en un nodo raíz',
        r1.ok && r1.niveles[raiz.id] === 1 && r1.coste === nodeCost(raiz as any, 0),
        `coste=${r1.coste}`);
      const r2 = compraSimulada({}, conReq.id, null);
      check('herr: sin requisitos no se suma ni sin presupuesto',
        !r2.ok && (r2.motivo ?? '').startsWith('Requiere') && r2.niveles[conReq.id] === undefined,
        r2.motivo ?? 'sin motivo');
      const r3 = compraSimulada({}, raiz.id, 0);
      check('herr: con presupuesto cero no se suma ni el primer nivel',
        !r3.ok && r3.niveles[raiz.id] === undefined, r3.motivo ?? 'sin motivo');
      const q = quitaNivelSimulada({}, raiz.id);
      check('herr: quitar de cero no inventa niveles', q[raiz.id] === undefined, 'ok');
      const res = resumenDeBuild(r1.niveles);
      check('herr: el resumen cobra lo gastado con la regla',
        res.gastados === coresGastadosEnArbol(r1.niveles) &&
        res.gastados === nodeCost(raiz as any, 0),
        `${res.gastados}`);
      check('herr: el resumen otorga lo agregado por el árbol',
        JSON.stringify(res.bonos) === JSON.stringify(aggregateBonuses(r1.niveles)),
        'bonos');
      const C = 100;
      const P = produccionParaBuild(C, 0);
      check('herr: lo pedido para la build la justifica y es lo mínimo',
        pendingCores(P, 0) >= C && (P <= 1_000_000 || pendingCores(P - 1, 0) < C),
        `${P}`);
      const cabe = cabeEnRun(P, C, 0);
      check('herr: con esa producción la build cabe',
        cabe.cabe && cabe.darian >= C, `${cabe.darian}`);
      const noCabe = cabeEnRun(1_000_000, C + 1000, 0);
      check('herr: con poco no cabe y lo dice', !noCabe.cabe, `${noCabe.darian}`);
    }

    const baseRec = { lado: 'rec' as const, tier: 1, baseId: null as string | null, potencial: 3, nivel: 0, tipo: 'click' as const, afijos: [] as string[] };
    const fRec = fichaSimulada(baseRec);
    check('herr: la base neutra da el daño de la regla',
      fRec.total === danioDeRango(1, 3, null), `${fRec.total}`);
    const fNiv = fichaSimulada({ ...baseRec, nivel: 99 });
    check('herr: el nivel simulado topa en el techo real',
      fNiv.nivel === techoDeNivel(3, 6), `${fNiv.nivel}`);
    const fAf = fichaSimulada({
      ...baseRec,
      afijos: ['aff_inventado', 'aff_sharp', 'aff_rapid', 'aff_yield', 'aff_flow', 'aff_bulwark', 'aff_core', 'aff_crit']
    });
    check('herr: los afijos topan en seis y el inventado no cuenta',
      fAf.afijos.length === AFIX_MAX && !fAf.afijos.includes('aff_inventado'),
      fAf.afijos.join(','));
    const baseCom = { lado: 'com' as const, tier: 5, baseId: null as string | null, potencial: 3, nivel: 0, tipo: 'click' as const, afijos: [] as string[] };
    const fCom = fichaSimulada(baseCom);
    check('herr: el compañero simulado rinde el poder de la regla',
      fCom.total === Math.round(poderDeCompanero(5, 3, null)
        * multiplicadorDeNivel(0)
        * multiplicadorDeCalidadDeCompanero('Épico', 3)),
      `${fCom.total}`);
    const fMulSin = fichaSimulada({ ...baseCom, tipo: 'multiplier', afijos: [] });
    const fMulCon = fichaSimulada({ ...baseCom, tipo: 'multiplier', afijos: ['aff_sharp', 'aff_yield'] });
    check('herr: en multiplier los afijos no mueven el aura',
      fMulSin.total === fMulCon.total, `${fMulSin.total}/${fMulCon.total}`);
    const ajena = (BASES_RECOLECTOR as Record<number, Array<{ id: string }>>)[1]?.[5]?.id ?? null;
    const fAjena = fichaSimulada({ ...baseCom, lado: 'rec', tier: 5, baseId: ajena });
    const fNeutra = fichaSimulada({ ...baseCom, lado: 'rec', tier: 5, baseId: null });
    check('herr: una base de otro tier cuenta como neutra',
      fAjena.total === fNeutra.total, `${fAjena.total}/${fNeutra.total}`);
  }

  // ------------------------------------------------------------------
  // 8 · Las reglas que la Wiki enseña con número
  // ------------------------------------------------------------------
  {
    const sumaPot = Object.values(POTENTIAL_WEIGHTS).reduce((a, b) => a + b, 0);
    check('wiki: el potencial sale 50/25/15/7/3', Math.abs(sumaPot - 1) < 1e-9 &&
      POTENTIAL_WEIGHTS[1] === 0.50 && POTENTIAL_WEIGHTS[5] === 0.03,
      `suma=${sumaPot}`);
    check('wiki: los afijos tienen forma completa y tope de seis',
      AFFIXES.length > 0 && AFIX_MAX === 6 &&
      AFFIXES.every(a => a.id && a.name && a.description && a.rarity && a.effect),
      `${AFFIXES.length} afijos`);
    check('wiki: el suelo de afijos sube con la rareza',
      (AFIX_MIN_POR_RARIDAD['Común'] ?? -1) === 0 && (AFIX_MIN_POR_RARIDAD['Divino'] ?? -1) === 6,
      JSON.stringify(AFIX_MIN_POR_RARIDAD));
    check('wiki: la forja base va de 78 % a 33 %',
      Math.abs(baseSuccessChance(1) - 0.78) < 1e-9 && Math.abs(baseSuccessChance(10) - 0.33) < 1e-9,
      `T1=${baseSuccessChance(1)} T10=${baseSuccessChance(10)}`);
    check('wiki: un millón produce ocho núcleos', pendingCores(1_000_000) === 8,
      `${pendingCores(1_000_000)}`);
    check('wiki: el techo de nivel mira potencial y base',
      techoDeNivel(5, 10) > techoDeNivel(5, 1) && techoDeNivel(5, 6) > 20,
      `${techoDeNivel(5, 1)}/${techoDeNivel(5, 10)}`);
    for (let tier = 1; tier <= 10; tier++) {
      const [min, max] = rangoDePoder(tier);
      if (!(min < max && typeof rarezaDeTier(tier) === 'string')) {
        check(`wiki: el tier ${tier} tiene rango y rareza`, false, `${min}-${max}`);
      }
    }
    check('wiki: los diez tiers tienen rango y rareza', true, 'revisados');
    check('wiki: cuatro expansores con techo creciente',
      EXPANSOR_TIERS.length === 4 &&
      EXPANSOR_TIERS.every((e, i, l) => i === 0 || e.maxCap > l[i - 1].maxCap),
      EXPANSOR_TIERS.map(e => e.maxCap).join(','));
    check('wiki: cada caja trae el expansor de su tramo',
      [1, 2, 3, 7, 10].every(t => expansorDeCaja(t).maxCap >= 60),
      [1, 2, 3, 7, 10].map(t => `T${t}→${expansorDeCaja(t).name}`).join(' '));
    check('wiki: el pack de cristal y la caja T1 se venden',
      (STORE_ITEMS as any).upgradeCrystal?.cost === 200 && (STORE_ITEMS as any).crateT1 !== undefined,
      'tienda');
  }

  // ------------------------------------------------------------------
  // 9 · Lo que la Wiki pinta con iconos del juego, y las versiones
  // ------------------------------------------------------------------
  {
    // La Wiki pinta con `icSafe()`, que nunca rompe: un icono que no existe
    // sale como otro. Eso evita el roto pero esconde el fallo, así que el
    // banco lo dice en voz alta: todo icono que enseña tiene que existir.
    const enSet = (nombre: unknown) =>
      typeof nombre === 'string' && (nombre as string) in ICONS;
    check('wiki: los logros pintan iconos del set',
      ACHIEVEMENTS.every(a => enSet(a.icon)),
      ACHIEVEMENTS.filter(a => !enSet(a.icon)).map(a => a.id).join(',') || 'todos existen');
    check('wiki: los nodos pintan iconos del set',
      TREE_NODES.every(n => enSet((n as any).icon)),
      'revisados');
    check('wiki: las cajas pintan su cara del set',
      (CRATE_TIERS as readonly number[]).every(t =>
        enSet((CRATE_META as any)[t]?.icon)),
      'las diez existen');
    check('wiki: los exclusivos pintan su icono del set',
      (CRATE_ONLY_COMPANIONS as readonly any[]).every(c => enSet(c.icon)),
      'los seis existen');
    // La sección de Versiones lee NOTAS sin segunda lista: la historia
    // empieza en la 1.1.0 y va de más nueva a más vieja.
    check('wiki: las versiones empiezan en el inicio (1.1.0)',
      NOTAS.length > 0 && NOTAS[NOTAS.length - 1].version === '1.1.0',
      NOTAS[NOTAS.length - 1]?.version ?? 'vacía');
  }

  // ------------------------------------------------------------------
  // 10 · El buscador (F95): índice completo, búsqueda y anclas íntegras
  // ------------------------------------------------------------------
  {
    const indice = construirIndiceWiki();
    const porSeccion = (s: string) => indice.filter(e => e.seccion === s);
    check('wiki: el índice cubre las ocho secciones',
      ['mecanicas', 'cajas', 'bases', 'items', 'logros', 'pasivas', 'herramientas', 'versiones']
        .every(s => porSeccion(s).length > 0),
      [...new Set(indice.map(e => e.seccion))].join(','));
    check('wiki: cinco bloques de mecánicas', porSeccion('mecanicas').length === 5,
      `${porSeccion('mecanicas').length}`);
    // **LAS ENTRADAS DE CAJA SALEN DEL NÚMERO DE CAJAS.** Decía "once (intro +
    // diez)": con veinte cajas hay veintiuna y el banco fallaba diciendo que había
    // de más. Lo que importa es que haya **una entrada por caja más la intro**, y
    // que su número siga al contenido; escrito fijo, el banco obliga a tocarlo cada
    // vez que se añade una caja, que es el momento en que alguien sube el número sin
    // mirar la regla de al lado.
    check(`wiki: una entrada por caja más la intro (${TIERS_CAJA.length + 1})`,
      porSeccion('cajas').length === TIERS_CAJA.length + 1,
      `${porSeccion('cajas').length}`);
    const deBases = porSeccion('bases');
    check(`wiki: las ${TODAS_LAS_BASES.length} bases están en el índice`,
      deBases.filter(e => e.ancla.startsWith('base-')).length === TODAS_LAS_BASES.length,
      `${deBases.filter(e => e.ancla.startsWith('base-')).length} bases`);
    // **Y LOS GRUPOS: DOS POR TIER, UNO POR LADO.** El 20 estaba escrito y es
    // "tiers × 2", no un número que signifique algo por sí solo.
    const gruposBases = deBases.filter(e =>
      e.ancla.startsWith('bases-rec-') || e.ancla.startsWith('bases-com-')).length;
    check(`wiki: dos grupos de bases por tier (${TIERS_BASES.length * 2})`,
      gruposBases === TIERS_BASES.length * 2,
      `${gruposBases} en bases`);
    check('wiki: un logro por entrada (más la intro)', porSeccion('logros').length === ACHIEVEMENTS.length + 1,
      `${porSeccion('logros').length} frente a ${ACHIEVEMENTS.length}`);
    check('wiki: un nodo por entrada (más la intro)', porSeccion('pasivas').length === TREE_NODES.length + 1,
      `${porSeccion('pasivas').length} frente a ${TREE_NODES.length}`);
    check('wiki: dos herramientas (simuladores de árbol y de base)',
      porSeccion('herramientas').length === 2,
      porSeccion('herramientas').map(e => e.ancla).join(','));
    const deItems = porSeccion('items');
    check('wiki: un afijo por entrada', deItems.filter(e => e.ancla.startsWith('afijo-')).length === AFFIXES.length,
      `${AFFIXES.length} afijos`);
    // **UN ENTRADA POR TIER QUE HAY, Y LOS MISMOS QUE TIENEN BASE.** El índice
    // genera las entradas de tier desde las bases, así que el número de una cosa y el
    // de la otra son el mismo hecho. Con `=== 10` escrito, al llegar al T11 el banco
    // fallaba por los dos lados: porque había 11 entradas y porque una de ellas
    // apuntaba a un ancla que la página no escribía. Los dos fallos salían juntos
    // y parecían uno.
    const entradasTier = deItems.filter(e => e.ancla.startsWith('tier-'));
    check(`wiki: un tier en items por cada tier con base (${TIERS_BASES.length})`,
      entradasTier.length === TIERS_BASES.length,
      `${entradasTier.length}`);
    check(`wiki: los ${CRATE_ONLY_COMPANIONS.length} exclusivos en items`,
      deItems.filter(e => e.ancla.startsWith('exclusivo-')).length === CRATE_ONLY_COMPANIONS.length,
      'revisados');
    check('wiki: los cuatro expansores en items', deItems.filter(e => e.ancla.startsWith('expansor-')).length === 4,
      'revisados');
    const nConsumibles = Object.values(CONSUMIBLES as Record<string, any>)
      .filter(c => !(EXPANSOR_TIERS as any[]).some(e => e.buffId === c.buffId)).length;
    check('wiki: un consumible por entrada', deItems.filter(e => e.ancla.startsWith('consumible-')).length === nConsumibles,
      `${nConsumibles} consumibles`);
    check('wiki: una entrada por parche (más la intro)', porSeccion('versiones').length === NOTAS.length + 1,
      `${NOTAS.length} parches`);

    // Integridad de los saltos: sin repetidos, sin raros, y cada ancla del
    // índice es una que la página escribe (bloques fijos o ayudantes sobre
    // datos). Una escrita a mano que no exista caería en silencio al
    // principio de la sección.
    const anclas = indice.map(e => e.ancla);
    check('wiki: ningún ancla se repite', new Set(anclas).size === anclas.length,
      `${anclas.length} anclas`);
    check('wiki: anclas sin espacios ni raros', anclas.every(a => /^[A-Za-z0-9_.-]+$/.test(a)),
      anclas.filter(a => !/^[A-Za-z0-9_.-]+$/.test(a)).join(',') || 'todas valen');
    const deAyudantes = new Set<string>([
      ...Object.values(ANCLA),      ...(CRATE_TIERS as readonly number[]).map(anclaCaja),
      ...TIERS_BASES.flatMap(t => [anclaGrupoBases('rec', t), anclaGrupoBases('com', t)]),
      ...TODAS_LAS_BASES.map(b => anclaBase((b as any).id)),
      // **LOS TIERS SALEN DE LA TABLA DE BASES.** Estaba `[1..10]` escrito, y con
      // el T11 la entrada `tier-11` del índice se declaraba huérfana: el banco decía
      // que la página no escribía un ancla que sí escribía, porque la lista de
      // anclas que él daba por buenas se quedó en diez. El banco no miraba la
      // página: miraba su propia lista, y la lista estaba vieja.
      ...TIERS_BASES.map(anclaTier),
      ...(CRATE_ONLY_COMPANIONS as readonly unknown[]).map((_, i) => anclaExclusivo(i)),
      ...Object.values(CONSUMIBLES as Record<string, any>)
        .filter(c => !(EXPANSOR_TIERS as any[]).some(e => e.buffId === c.buffId))
        .map(c => anclaConsumible(c.buffId)),
      ...(EXPANSOR_TIERS as any[]).map((_, i) => anclaExpansor(i)),
      ...AFFIXES.map(a => anclaAfijo(a.id)),
      ...ACHIEVEMENTS.map(a => anclaLogro(a.id)),
      ...TREE_NODES.map(n => anclaNodo(n.id)),
      ...NOTAS.map(n => anclaVersion(n.version))
    ]);
    const huerfanas = anclas.filter(a => !deAyudantes.has(a));
    check('wiki: cada ancla del índice la escribe la página', huerfanas.length === 0,
      huerfanas.join(',') || `${anclas.length} atadas`);

    // Comportamiento: "y" entre términos, sin tildes, vacío que no lo devuelve todo.
    check('wiki: "forja" lleva al bloque de la forja',
      buscarEnWiki('forja').some(e => e.ancla === ANCLA.mecanicaForja),
      `${buscarEnWiki('forja').length} resultados`);
    check('wiki: "simulador" lleva a las dos herramientas',
      buscarEnWiki('simulador').some(e => e.ancla === ANCLA.herramientasArbol) &&
      buscarEnWiki('simulador').some(e => e.ancla === ANCLA.herramientasBase),
      buscarEnWiki('simulador').map(e => e.ancla).join(','));
    check('wiki: sin tildes ("calibracion" encuentra la Piedra)',
      buscarEnWiki('calibracion').some(e => e.titulo.includes('Calibración')),
      buscarEnWiki('calibracion').map(e => e.titulo).join(' | ') || 'nada');
    check('wiki: varias palabras son "y" ("caja t10" abre la T10)',
      buscarEnWiki('caja t10')[0]?.ancla === anclaCaja(10),
      buscarEnWiki('caja t10')[0]?.ancla ?? 'nada');
    check('wiki: vacío no devuelve el índice entero', buscarEnWiki('   ').length === 0, 'vacío');
    check('wiki: lo inexistente no devuelve nada', buscarEnWiki('zzzsinconcepto').length === 0, 'nada');
    check('wiki: normaliza tildes y mayúsculas',
      normalizaWiki('Calibración FORJA') === 'calibracion forja',
      normalizaWiki('Calibración FORJA'));
    check('wiki: el set trae el icono del buscador', 'search' in ICONS, 'search');
    check('wiki: el set trae el icono de Herramientas', 'wrench' in ICONS, 'wrench');
  }

  resumen('wiki: la base de conocimiento enseña las reglas que el juego aplica');
}

export default main();
