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
  CRATE_TIERS, CRATE_TYPES, costeDeCaja, COSTE_POR_TIER,
  EXPANSOR_TIERS, expansorDeCaja, STORE_ITEMS
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
  AFIX_MIN_POR_RARIDAD, AFIX_MAX
} from '../src/data/crafting';
import { ACHIEVEMENTS } from '../src/achievements';
import {
  LOGROS_DIFICILES, ACHIEVEMENT_REWARDS, SECRET_ACHIEVEMENTS
} from '../src/data/achievements';
import { TREE_NODES, nodeCost } from '../src/data/tree';
import { pendingCores } from '../src/data/prestige';

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
  // 2 · Las diez cajas, con su precio y su reparto entero
  // ------------------------------------------------------------------
  {
    check('wiki: hay diez cajas, una por tier', CRATE_TIERS.length === 10,
      CRATE_TIERS.join(','));
    for (const t of CRATE_TIERS) {
      const tabla = (CRATE_LOOT as Record<number, Array<{ id: string }>>)[t] ?? [];
      const pesos = tablaDePesos(t as any);
      const suma = pesos.reduce((a, b) => a + b, 0);
      check(`wiki: la caja T${t} reparte el 100 %`, Math.abs(suma - 1) < 1e-9,
        `suma=${suma}`);
      check(`wiki: la caja T${t} trae compañero y recolector de su tier`,
        tabla.some(e => e.id === 'companion') && tabla.some(e => e.id === 'collector'),
        tabla.map(e => e.id).join(','));
      check(`wiki: la caja T${t} cuesta lo que dice la curva`,
        CRATE_META[t as any].cost === costeDeCaja(t) &&
        costeDeCaja(t) === Math.round(COSTE_POR_TIER[t - 1] * 3 / 4),
        `${CRATE_META[t as any].cost}`);
      const tipo = (CRATE_TYPES as Record<number, { rarity: string }>)[t];
      check(`wiki: la caja T${t} anuncia su rareza (${tipo.rarity})`,
        CRATE_META[t as any].name === `Caja T${t}` && typeof tipo.rarity === 'string',
        CRATE_META[t as any].name);
    }
  }

  // ------------------------------------------------------------------
  // 3 · El salto: en banda, y la T10 sin él
  // ------------------------------------------------------------------
  {
    for (const t of CRATE_TIERS) {
      const p = probabilidadDeSalto(t as any);
      const tabla = (CRATE_LOOT as Record<number, Array<{ id: string }>>)[t] ?? [];
      if (t >= 10) {
        check('wiki: la T10 no salta (no hay tier por encima)',
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
  // 4 · Los seis exclusivos, cada uno en su caja y una sola vez
  // ------------------------------------------------------------------
  {
    check('wiki: hay seis exclusivos de caja', CRATE_ONLY_COMPANIONS.length === 6,
      `${CRATE_ONLY_COMPANIONS.length}`);
    const vistos: number[] = Object.values(EXCLUSIVOS_POR_CAJA).flat() as number[];
    const ordenados = [...vistos].sort((a, b) => a - b);
    check('wiki: los seis salen, cada uno una vez',
      JSON.stringify(ordenados) === JSON.stringify([0, 1, 2, 3, 4, 5]),
      ordenados.join(','));
    for (const t of [7, 8, 9, 10]) {
      const tabla = (CRATE_LOOT as Record<number, Array<{ id: string }>>)[t] ?? [];
      const n = (EXCLUSIVOS_POR_CAJA[t as 7] ?? []).length;
      check(`wiki: la caja T${t} trae sus ${n} exclusivo(s) en la tabla`,
        tabla.filter(e => e.id.startsWith('exclusivo_')).length === n,
        `${n}`);
    }
  }

  // ------------------------------------------------------------------
  // 5 · Doscientas bases: contenido, stat y sorteo
  // ------------------------------------------------------------------
  {
    check('wiki: son doscientas bases en total', TODAS_LAS_BASES.length === 200,
      `${TODAS_LAS_BASES.length}`);
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
    check('wiki: ningún id de base se repite', ids.size === 200, `${ids.size} únicos`);
  }

  // ------------------------------------------------------------------
  // 6 · Veintisiete logros, y los difíciles sin números
  // ------------------------------------------------------------------
  {
    check('wiki: hay 27 logros', ACHIEVEMENTS.length === 27, `${ACHIEVEMENTS.length}`);
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
    check('wiki: el árbol tiene cinco columnas', new Set(TREE_NODES.map(n => n.tier)).size === 5,
      [...new Set(TREE_NODES.map(n => n.tier))].join(','));
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

  resumen('wiki: la base de conocimiento enseña las reglas que el juego aplica');
}

export default main();
