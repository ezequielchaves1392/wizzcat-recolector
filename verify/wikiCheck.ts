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
  CRATE_TIERS, CRATE_TYPES, costeDeCaja, COSTE_POR_TIER,
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
  AFIX_MIN_POR_RARIDAD, AFIX_MAX
} from '../src/data/crafting';
import { ACHIEVEMENTS } from '../src/achievements';
import {
  LOGROS_DIFICILES, ACHIEVEMENT_REWARDS, SECRET_ACHIEVEMENTS
} from '../src/data/achievements';
import { TREE_NODES, nodeCost } from '../src/data/tree';
import { pendingCores } from '../src/data/prestige';
import {
  ANCLA, anclaAfijo, anclaBase, anclaCaja, anclaConsumible, anclaExclusivo,
  anclaExpansor, anclaGrupoBases, anclaLogro, anclaNodo, anclaTier,
  anclaVersion, buscarEnWiki, construirIndiceWiki, normalizaWiki
} from '../src/data/wikiIndex';

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

  // ------------------------------------------------------------------
  // 10 · El buscador (F95): índice completo, búsqueda y anclas íntegras
  // ------------------------------------------------------------------
  {
    const indice = construirIndiceWiki();
    const porSeccion = (s: string) => indice.filter(e => e.seccion === s);
    check('wiki: el índice cubre las siete secciones',
      ['mecanicas', 'cajas', 'bases', 'items', 'logros', 'pasivas', 'versiones']
        .every(s => porSeccion(s).length > 0),
      [...new Set(indice.map(e => e.seccion))].join(','));
    check('wiki: cinco bloques de mecánicas', porSeccion('mecanicas').length === 5,
      `${porSeccion('mecanicas').length}`);
    check('wiki: once entradas de cajas (intro + diez)', porSeccion('cajas').length === 11,
      `${porSeccion('cajas').length}`);
    const deBases = porSeccion('bases');
    check('wiki: las doscientas bases están en el índice',
      deBases.filter(e => e.ancla.startsWith('base-')).length === TODAS_LAS_BASES.length,
      `${deBases.filter(e => e.ancla.startsWith('base-')).length} bases`);
    check('wiki: veinte grupos de bases (diez por lado)',
      deBases.filter(e => e.ancla.startsWith('bases-rec-') || e.ancla.startsWith('bases-com-')).length === 20,
      `${deBases.length} en bases`);
    check('wiki: un logro por entrada (más la intro)', porSeccion('logros').length === ACHIEVEMENTS.length + 1,
      `${porSeccion('logros').length} frente a ${ACHIEVEMENTS.length}`);
    check('wiki: un nodo por entrada (más la intro)', porSeccion('pasivas').length === TREE_NODES.length + 1,
      `${porSeccion('pasivas').length} frente a ${TREE_NODES.length}`);
    const deItems = porSeccion('items');
    check('wiki: un afijo por entrada', deItems.filter(e => e.ancla.startsWith('afijo-')).length === AFFIXES.length,
      `${AFFIXES.length} afijos`);
    check('wiki: los diez tiers en items', deItems.filter(e => e.ancla.startsWith('tier-')).length === 10,
      'revisados');
    check('wiki: los seis exclusivos en items', deItems.filter(e => e.ancla.startsWith('exclusivo-')).length === 6,
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
      ...Object.values(ANCLA),
      ...(CRATE_TIERS as readonly number[]).map(anclaCaja),
      ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].flatMap(t => [anclaGrupoBases('rec', t), anclaGrupoBases('com', t)]),
      ...TODAS_LAS_BASES.map(b => anclaBase((b as any).id)),
      ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(anclaTier),
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
  }

  resumen('wiki: la base de conocimiento enseña las reglas que el juego aplica');
}

export default main();
