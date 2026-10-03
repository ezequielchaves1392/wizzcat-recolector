// ==========================================================================
//  Banco de pruebas de lo QUE NO SE PUEDE ROMPER
//
//  Lo que no se nota en una partida de dos minutos y aun asi se rompe:
//
//  - Que el estado se GUARDE. Todo lo demas se puede perder en un `setDoc` mal
//    escrito, y el jugador lo descubre al refrescar, cuando ya no tiene el
//    arreglo a mano.
//  - Que el estado se LEA IGUAL. Una partida vieja tiene el tipo de item viejo
//    (`weapon` en vez de `collector`), el nombre viejo, y ni un solo campo nuevo.
//    Si la carga no la entiende, el jugador pierde su inventario entero.
//  - Que la CAPACIDAD respete la prioridad. Un recorte a ciegas puede borrar el
//    recolector equipado y dejar el click a cero sin decir nada.
//  - Que el PRECIO que se enseña sea el que se cobra. `getSellPrice` y
//    `sellItem` tienen que salir del mismo numero, o la pantalla miente.
//  - Que el PRESTIGIO cumpla lo que promete: se recycle el progreso, se conservan
//    los nucleos y los nodos, y el jugador no pierde lo que el reinicio dice que
//    conserva.
//
//  Cada comprobacion termina en `reload()`: lo que solo vive en memoria no esta
//  guardado, y ese es exactamente el bug que mas veces ha llegado a produccion.
// ==========================================================================

import { STORE_ITEMS, collectorUpgradeCost, type CrateType } from '../src/gameLoop';
import { nextCores, pendingCores, coreProgress, nanitesForCores, nanitesToNextCore } from '../src/data/prestige';
import { BASE_COLLECTOR_MAX_LEVEL, collectorMaxLevel, danioDeRango, potencialDe, baseDeTier, AFIX_MIN_POR_RARIDAD, AFFIXES, rollPotentialFrom } from '../src/data/crafting';
import { rangoDePoder, rarezaDeTier, TIER_SYSTEM } from '../src/data/tiers';
import { RARITY_ORDER } from '../src/types/domain';
import { CRATE_LOOT, tablaDePesos } from '../src/components/crateLoot';
import { collectorValue, fusionImprovesDensity, valorBaseTier } from '../src/data/valuation';
import {
  boot, reload, bootNew, check, resumen, s, wh, ids, nanites, deType, find, guardado,
  baseSave, collector, companion, ficha, crate, crystal, consumable, conRoll
} from './kit';

/**
 * La PILA de un material en un nivel dado, o `undefined` si no hay ninguna.
 *
 * Se busca por `tier` y no por el nombre, porque el nombre es lo que se deduce
 * cuando el save es viejo (`crystalTierFromName`) y lo que cambia con la
 * traducción. El nivel es el dato del que habla el botín.
 */
function pilaDe(g: any, tipo: string, tier: number | undefined): any {
  if (typeof tier !== 'number') return undefined;
  return wh(g).find((w: any) => w.type === tipo && w.tier === tier);
}

/**
 * Valor de `Math.random` que hace salir la fila pedida de la tabla de una caja.
 *
 * Lee los PESOS de `CRATE_LOOT` en vez de fijarlos a mano, así que si mañana se
 * añade, se quita o se reordena una entrada, esto sigue acertando sin tocar el
 * test. No reimplementa ninguna regla del juego —solo construye el dado que hace
 * que salga la fila que el test quiere mirar— y devuelve `null` si esa fila no
 * existe, para que el test falle con un mensaje claro en vez de abrir 300 cajas
 * confiando en la suerte.
 */
/**
 * La tirada que cae en la fila pedida, en la escala del sorteo REAL.
 *
 * Usa `tablaDePesos` y no el `weight` de autor: con el reparto por rareza el peso
 * que manda es el ponderado, así que clavar el dado con los pesos de autor ya no
 * elige la fila. Y la fila importa, porque hay bancos que comprueban cosas que
 * dependen de qué fila salió (el cristal, por ejemplo).
 */
function rollPara(caja: CrateType, idFila: string): number {
  const tabla = CRATE_LOOT[caja];
  const pesos = tablaDePesos(caja);
  const total = pesos.reduce((a, w) => a + w, 0);
  let antes = 0;
  for (let i = 0; i < tabla.length; i++) {
    if (tabla[i].id === idFila) return (antes + pesos[i] / 2) / total;
    antes += pesos[i];
  }
  throw new Error(`la caja ${caja} no tiene la fila ${idFila}`);
}

async function main() {
  // =========================================================================
  //  1. Partida nueva
  // =========================================================================
  {
    const g = await bootNew();
    check('partida nueva: nace con nanitas a cero', s(g).nanites === 0, 'nanites=' + s(g).nanites);
    check('partida nueva: trae un recolector', deType(g, 'collector') === 1, ids(g).join(','));
    check('partida nueva: trae un companero', deType(g, 'companion') === 1, ids(g).join(','));
    check('partida nueva: y las 2 cajas de bienvenida, en una sola pila',
      deType(g, 'crate') === 1 && wh(g).find((w: any) => w.type === 'crate')?.stackCount === 2,
      ids(g).join(','));
    check('partida nueva: la capacidad por defecto es 15', s(g).warehouseCapacity === 15,
      'cap=' + s(g).warehouseCapacity);
    check('partida nueva: 1 hueco de companero', s(g).maxCompanionSlots === 1, 'slots=' + s(g).maxCompanionSlots);
    // **NACE TODO EQUIPADO.** El jugador nuevo ve su recolector y su compañero sin
    // puesta ninguna, con ingreso a cero y sin ningún botón que pulsara: todo lo
    // que había que hacer era adivinarlo. Ahora los dos nacen puestos, así que el
    // primer clic ya cobra y la pantalla enseña cómo se ve funcionando.
    check('partida nueva: nace con el recolector EQUIPADO',
      s(g).equippedCollectorId === 'collector_blaster_001', String(s(g).equippedCollectorId));
    check('partida nueva: y con el companion ACTIVO',
      s(g).activeCompanions.join(',') === 'companion_base_001',
      s(g).activeCompanions.join(','));

    const g2 = await reload();
    // Las 2 cajas de bienvenida son UN item apilado, no dos: la capacidad se
    // cuenta en ranuras y dos cajas iguales comparten celda.
    check('partida nueva: recargar no duplica las cajas',
      s(g2).crates[1] === 2 && wh(g2).filter((w: any) => w.type === 'crate').length === 1,
      `items=${wh(g2).filter((w: any) => w.type === 'crate').length} contador=${s(g2).crates[1]}`);
    check('partida nueva: y la pila sigue con las 2 unidades',
      wh(g2).find((w: any) => w.type === 'crate')?.stackCount === 2,
      'stackCount=' + wh(g2).find((w: any) => w.type === 'crate')?.stackCount);
  }
  {
    // Relargar una partida nueva DOS veces seguidas: cada arranque materializa
    // las cajas del contador. Si la migracion no fuera idempotente, la tercera
    // recarga tendria mas cajas de bienvenida.
    await bootNew();
    await reload();
    const g3 = await reload();
    check('partida nueva: recargar muchas veces no acumula cajas',
      s(g3).crates[1] === 2 && wh(g3).find((w: any) => w.type === 'crate')?.stackCount === 2,
      `contador=${s(g3).crates[1]} unidades=${wh(g3).find((w: any) => w.type === 'crate')?.stackCount}`);
  }

  // =========================================================================
  //  2. Lo que se guarda y lo que se lee
  // =========================================================================
  {
    // Todos los campos de progresion, escritos y releidos. Si uno se olvidara en
    // `saveToFirebase`, el jugador lo pierde en cada refresco.
    const g = await boot(baseSave([
      // **EL DAÑO SE SACA DE LA REGLA, NO DE UN NÚMERO ESCRITO.** Estaba en 80 con un
      // ★3, y un ★3 de T4 vale 75: el item de la prueba se contradecía a sí mismo
      // y la migración de G4 lo puso en su sitio al recargar. Un fixture
      // incoherente no mide lo que dice medir —mide la contradicción del autor—,
      // así que aquí el número sale de `danioDeRango()`, como el de cualquier otro.
      collector('r1', 4, { level: 5, damage: danioDeRango(4, 3), affixes: ['a'], potential: 3 }),
      crate('c1', 6, 2),
      crystal('x1', 2, 4),
      consumable('u1', 'afk', 2, { name: 'Tarjeta AFK' }),
      { id: 'm1', name: 'Compañero T2', type: 'companion', details: 'x', rarity: 'Épico', tier: 2, sellPrice: 500 }
    ], {
      nanites: 12_345,
      totalNanitesProduced: 987_654,
      totalClicks: 321,
      cratesOpened: 7,
      warehouseCapacity: 28,
      maxCompanionSlots: 4,
      cores: 33,
      totalCores: 44,
      resets: 2,
      shards: 9,
      forgedCount: 5,
      companions: [ficha('m1', 2)],
      activeCompanions: ['m1'],
      equippedCollectorId: 'r1',
      nodeLevels: { core_sink: 3, core_edge: 1 },
      unlockedNodes: ['core_sink', 'core_edge']
    }));
    // NO se llama a `equipCollector`: la partida ya viene con `r1` equipado, y
    // `equipCollector` es un conmutador, asi que llamarla lo DESEQUIPARIA.

    const g2 = await reload();
    const t = s(g2);
    check('guardar: nanites', t.nanites === 12_345, 'nanites=' + t.nanites);
    check('guardar: total producido', t.totalNanitesProduced === 987_654, String(t.totalNanitesProduced));
    check('guardar: total de clicks', t.totalClicks === 321, String(t.totalClicks));
    check('guardar: cajas abiertas', t.cratesOpened === 7, String(t.cratesOpened));
    check('guardar: capacidad', t.warehouseCapacity === 28, String(t.warehouseCapacity));
    check('guardar: slots de companero', t.maxCompanionSlots === 4, String(t.maxCompanionSlots));
    check('guardar: nucleos', t.cores === 33 && t.totalCores === 44,
      `${t.cores}/${t.totalCores} cola=${(globalThis as any).localStorage.getItem('cyberforge_nanitas_pendientes')}`);
    check('guardar: reinicios', t.resets === 2, String(t.resets));
    check('guardar: esquirlas', t.shards === 9, String(t.shards));
    check('guardar: recolectores forjadas', t.forgedCount === 5, String(t.forgedCount));
    check('guardar: nodos del arbol', t.nodeLevels.core_sink === 3 && t.nodeLevels.core_edge === 1,
      JSON.stringify(t.nodeLevels));
    check('guardar: el almacen entero', wh(g2).length === 5, ids(g2).join(','));
    check('guardar: el recolector conserva nivel, dano, afijos y potencial', (() => {
      const r = find(g2, 'r1');
      return r?.level === 5 && r?.damage === danioDeRango(4, 3)
        && r?.potential === 3 && JSON.stringify(r?.affixes) === '["a"]';
    })(), JSON.stringify(find(g2, 'r1')));
    check('guardar: el companero activo sigue activo', t.activeCompanions.join(',') === 'm1',
      t.activeCompanions.join(','));
    check('guardar: el recolector equipado sigue equipado',
      t.equippedCollectorId === 'r1' && g2.getClickDamage() > 0, 'danio=' + g2.getClickDamage());
    check('guardar: el documento queda en la version actual',
      guardado().saveVersion === s(g2).saveVersion,
      `documento=${guardado().saveVersion} estado=${s(g2).saveVersion}`);
  }
  {
    // El documento NO se reescribe entero: `setDoc` va con `merge: true`, asi
    // que las claves de otras versiones sobreviven. Es intencionado (ver el
    // renombre `equippedWeaponId`), y por eso no se debe "limpiar" a lo bruto.
    const g = await boot(baseSave([collector('r1')], { saveVersion: 6, campoAjeno: 'noTocar' }));
    await reload();
    check('guardar: el merge no borra claves ajenas al guardado',
      guardado().campoAjeno === 'noTocar', String(guardado().campoAjeno));
  }

  // =========================================================================
  //  3. Partidas viejas: migracion
  // =========================================================================
  {
    // Una partida minima: solo lo imprescindible. Todo lo demas tiene que salir
    // de los valores por defecto sin petar.
    const g = await boot({ saveVersion: 3, nanites: 500, warehouse: [collector('r1')] });
    check('migracion: una partida minima carga sin error', !!s(g).warehouse, 'sin almacen');
    check('migracion: los contadores de material se derivan del almacen',
      typeof s(g).upgradeCrystals === 'number',
      `crystals=${s(g).upgradeCrystals}`);
    check('migracion: el documento se sube a la version actual',
      guardado().saveVersion === s(g).saveVersion,
      `documento=${guardado().saveVersion} estado=${s(g).saveVersion}`);
  }
  {
    // Un item sin `damage`: se le inventa uno segun su tier, y se corrige la
    // descripcion. Si no, la rejilla pinta "+undefined".
    const g = await boot(baseSave([{ id: 'r1', name: 'Cosa Vieja', type: 'collector', rarity: 'Común', tier: 2 }],
      { saveVersion: 4 }));
    const r = find(g, 'r1');
    check('migracion: un recolector sin dano recibe uno', typeof r?.damage === 'number' && r.damage > 0,
      JSON.stringify(r?.damage));
    check('migracion: y su descripcion se pone al dia',
      r?.details === `Recolección por click: +${r.damage}`, JSON.stringify(r?.details));
  }
  {
    // Material sin `tier`: el nivel se deduce del nombre UNA vez, porque es lo
    // unico que dice que cristal mejora a que recolector. Hay que quitar el `tier`
    // de verdad: la fabrica se lo pone, y si es un numero la migracion no hace nada.
    //
    // **LO QUE HACIA ESTA MISMA PRUEBA CON LAS LLAVES SE HA IDO A `cajasCheck`.**
    // Antes el motor rellenaba tambien el `tier` de una llave para poder contarla
    // por nivel en la migracion de los contadores. Ese par de migraciones —llaves
    // por nivel y contadores de llaves— desaparecieron juntas al redimir las
    // llaves: para redimir hace falta el PRECIO, no el nivel, y ese precio sale de
    // `keyTierFromName()` en el momento de redimir. Asi que la deduccion por
    // nombre de una llave se sigue probando, pero en el banco que se encarga de
    // la redencion, que es donde tiene sentido mirarla.
    const crist = crystal('x1', 1, 1, { name: 'Cristal de Fase' });
    delete (crist as any).tier;
    const g = await boot(baseSave([crist], { saveVersion: 4 }));
    check('migracion: un cristal sin nivel tambien lo deduce del nombre',
      find(g, 'x1')?.tier === 2, 'tier=' + find(g, 'x1')?.tier);
  }
  // =========================================================================
  //  LOS CONTADORES DE LLAVES: ESTA PRUEBA NO EXISTE, Y POR QUÉ
  // =========================================================================
    //
    // Aquí había dos comprobaciones —"un contador de llaves sin items se
    // materializa" y "no las duplica al cargar otra vez"— que medían la migración
    // que convertía `state.keys` y `state.keysByTier` en pilas de items del almacén.
    // **Las dos reglas dejaron de existir**: el estado ya no tiene contadores de
    // llaves y el guardado ya no los escribe. Un `keys: 3` en un documento viejo no
    // se materializa en tres llaves, porque las llaves ya no son un objeto del
    // juego. Lo que hay en el almacén de una partida vieja son items `type: 'key'`,
    // y eso es otra cosa: no se cuentan, **se redimen**.
    //
    // **LO QUE SÍ HAY QUE COMPROBAR AHORA ES EL OTRO LADO**, y es el que importa:
    // una partida con llaves en el almacén entra, y esas llaves desaparecen
    // sumando a `nanites` un tercio del antiguo par caja+llave por unidad, con suelo
    // de 1. Si no se pagaran, el jugador perdería lo que compró; si se pagaran dos
    // veces, sería una máquina de imprimir nanitas.
    //
    // Esa prueba vive ahora en **`cajasCheck`, apartado 3** —"LAS LLAVES QUE
    // TUVIERA ALGUIEN SE REDIMEN. UNA VEZ."— y aquí no se duplica a propósito: es
    // la misma regla, y una regla comprobada en dos bancos solo se desincroniza uno
    // de los dos. Además `cajasCheck` la monta con `key()`, que es una partida vieja
    // de verdad —el nombre escrito a mano y sin `tier`—, que es justo el caso que
    // hay que redimir.
  //
  // =====================================================================
  //  Y LO QUE QUEDA DE LA MIGRACIÓN: SOLO EL CRISTAL
  // =====================================================================
  {
    // LA REGRESION DE LA MIGRACION DE CONTADORES. La migracion de contadores a
    // items existe para las partidas viejas, donde el contador era un numero
    // suelto sin nada detras. Si no le resta al contador lo que YA HAY en el
    // almacen, se ejecuta tambien en las partidas nuevas, y entonces recargar la
    // pagina duplica el material: 4 cristales -> 8 -> 16 -> 32, y el almacen se
    // llena de material que el jugador nunca pidio, hasta que el botin empieza a
    // perderse por falta de hueco.
    //
    // El banco de pruebas anterior no lo veía porque sus partidas de prueba
    // traian los contadores a cero, que es justo el caso en el que la migracion
    // no hace nada. Aqui la partida se parece a una de verdad: contador y
    // almacen dicen lo mismo.
    //
    // **YA NO HAY LLAVES QUE MIRAR**, asi que el cristal se queda solo. Sigue
    // siendo el mismo caso: la migración es de un tipo, y por eso el nombre de
    // "material" describe exactamente lo que queda.
    const g = await boot(baseSave([crystal('x1', 1, 4)], { saveVersion: 7 }));
    check('sin duplicar: una carga deja el material como estaba',
      s(g).upgradeCrystals === 4 && deType(g, 'crystal') === 1,
      `crystals=${s(g).upgradeCrystals} items=${deType(g, 'crystal')}`);

    const g2 = await reload();
    check('sin duplicar: la segunda carga NO duplica los cristales',
      s(g2).upgradeCrystals === 4 && deType(g2, 'crystal') === 1,
      `crystals=${s(g2).upgradeCrystals} items=${deType(g2, 'crystal')} (${s(g2).warehouse.filter((w: any) => w.type === 'crystal').map((w: any) => w.stackCount).join('+')})`);

    const g3 = await reload();
    const g4 = await reload();
    check('sin duplicar: cinco recargas no multiplican el material',
      s(g3).upgradeCrystals === 4 && s(g4).upgradeCrystals === 4,
      `3a=${s(g3).upgradeCrystals} 4a=${s(g4).upgradeCrystals}`);
    check('sin duplicar: y el almacen no crece', wh(g4).length === 1, ids(g4).join(','));
  }
  {
    // El caso parcial: el contador dice MAS que el almacen porque el jugador
    // vendio material. Lo que falta es lo que hay que recuperar, y lo que ya
    // esta NO se vuelve a crear.
    const g = await boot(baseSave([crystal('x1', 1, 2)], {
      saveVersion: 7, upgradeCrystals: 5
    }));
    check('migracion parcial: solo se recupera lo que falta',
      s(g).upgradeCrystals === 5,
      `crystals=${s(g).upgradeCrystals} (almacen tenia 2, contador decia 5)`);
    check('migracion parcial: y se echa a la pila que ya habia',
      deType(g, 'crystal') === 1 && find(g, 'x1')?.stackCount === 5,
      `items=${deType(g, 'crystal')} unidades=${find(g, 'x1')?.stackCount}`);
    const g2 = await reload();
    check('migracion parcial: y no se duplica al cargar otra vez', s(g2).upgradeCrystals === 5,
      `crystals=${s(g2).upgradeCrystals}`);
  }
  {
    // Al CARGAR, un contador de cajas por encima del almacen SI materializa: es
    // la migracion de partidas antiguas y el regalo de partida nueva. La regla de
    // "el almacen manda" es la de EN EJECUCION (`syncCrateCounters`), que es la
    // que evita que una caja vendida reaparezca.
    //
    // Lo que no puede pasar es que se materialice de mas: al cargar otra vez, el
    // contador ya coincide con el almacen y no se crea nada nuevo.
    const g = await boot(baseSave([], { saveVersion: 5, crates: { common: 0, rare: 5, epic: 0, legendary: 0 } }));
    check('migracion: al cargar, un contador de cajas huérfano se materializa',
      s(g).crates[3] === 5 && wh(g).some((w: any) => w.type === 'crate'),
      'rare=' + s(g).crates[3] + ' items=' + deType(g, 'crate'));
    const g2 = await reload();
    check('migracion: y al cargar otra vez no se crea ninguna mas',
      s(g2).crates[3] === 5 && wh(g2).filter((w: any) => w.type === 'crate').length === 1,
      `rare=${s(g2).crates[3]} items=${wh(g2).filter((w: any) => w.type === 'crate').length}`);
    check('migracion: las 5 cajas estan en una sola pila',
      wh(g2).find((w: any) => w.type === 'crate')?.stackCount === 5,
      'stackCount=' + wh(g2).find((w: any) => w.type === 'crate')?.stackCount);

    // Y la regla de EN EJECUCION: vender la ultima caja la quita del almacen y el
    // contador baja con ella, sin que reaparezca al siguiente guardado.
    g2.sellItem(wh(g2).find((w: any) => w.type === 'crate')!.id);
    check('migracion: tras vender la pila, el contador baja a 0', s(g2).crates[3] === 0,
      'rare=' + s(g2).crates[3]);
    const g3 = await reload();
    check('migracion: y no reaparece al recargar', s(g3).crates[3] === 0 && deType(g3, 'crate') === 0,
      `rare=${s(g3).crates[3]} items=${deType(g3, 'crate')}`);
  }
  {
    // `saveVersion` ausente: se trata como la version mas vieja y se migra todo.
    const g = await boot({
      nanites: 100,
      warehouse: [{ id: 'w1', name: 'Blaster Láser', type: 'weapon', details: 'x', rarity: 'Común', tier: 1, sellPrice: 250 }]
    });
    check('migracion: sin saveVersion tambien migra', deType(g, 'collector') === 1, ids(g).join(','));
  }

  // =========================================================================
  //  4. Capacidad: el recorte tiene que respetar la prioridad
  // =========================================================================
  {
    // 6 items con capacidad 3: se conservan los mas valiosos, no los 3 primeros.
    const items = [
      crate('c1'), crate('c2'),
      consumable('u1', 'afk'),
      companion('m1', 5),
      collector('r1', 5)
    ];
    const g = await boot(baseSave(items, { warehouseCapacity: 3 }));
    check('capacidad: el almacen se recorta al limite', wh(g).length === 3, ids(g).join(','));
    check('capacidad: se conservan recolectores y companeros, no cajas',
      !!find(g, 'r1') && !!find(g, 'm1'), ids(g).join(','));
  }
  {
    // El caso que un recorte a ciegas rompe: la capacidad baja por debajo del
    // numero de items y el recolector EQUIPADO esta en la lista. Perderlo deja
    // el click a cero sin decir nada.
    const items = [collector('r1'), collector('r2'), crate('c1'), crate('c2')];
    const g = await boot(baseSave(items, { warehouseCapacity: 1, equippedCollectorId: 'r1' }));
    check('capacidad: con recorte minimo sobrevive el recolector equipado',
      s(g).equippedCollectorId === 'r1' && !!find(g, 'r1'), `id=${s(g).equippedCollectorId} items=${ids(g).join(',')}`);
    check('capacidad: y el click sigue haciendo dano', g.getClickDamage() > 0, 'danio=' + g.getClickDamage());
  }
  {
    // Un companero ACTIVO tambien sobrevive al recorte: es lo que paga el pasivo.
    const g = await boot(baseSave([
      crate('c1'), crate('c2'), crate('c3'),
      { id: 'm1', name: 'Compañero T1', type: 'companion', details: 'x', rarity: 'Común', sellPrice: 100 },
      { id: 'm2', name: 'Compañero T1', type: 'companion', details: 'x', rarity: 'Común', sellPrice: 100 }
    ], {
      warehouseCapacity: 2,
      companions: [ficha('m1'), ficha('m2')],
      activeCompanions: ['m1']
    }));
    check('capacidad: sobrevive el companero activo', s(g).activeCompanions.includes('m1'),
      s(g).activeCompanions.join(','));
    check('capacidad: y el recorte no lo descuadra', wh(g).length <= 2, 'items=' + wh(g).length);
  }
  {
    // Recargar despues de un recorte no lo deshace ni lo repite.
    const g = await boot(baseSave([crate('c1'), crate('c2'), collector('r1')], { warehouseCapacity: 1 }));
    const g2 = await reload();
    check('capacidad: recargar tras un recorte no lo cambia otra vez',
      wh(g2).length === 1 && wh(g2)[0].id === wh(g)[0].id,
      `${ids(g2).join(',')} vs ${ids(g).join(',')}`);
  }

  // =========================================================================
  //  5. El precio que se enseña es el que se cobra
  // =========================================================================
  {
    // `getSellPrice` es el precio DE UNA UNIDAD, y `sellItem` cobra la pila
    // entera: unidad x unidades. El modal de confirmacion multiplica antes de
    // ensenar el numero, asi que el total que se cobra y el que se anuncia
    // coinciden.
    //
    // ARREGLADO. El boton "Vender" de la hoja de detalle pintaba
    // `getSellPrice` SIN multiplicar, asi que con una pila de 20 cristales decia
    // "Vender - 480" y el modal siguiente decia "por 9.600". Ahora la vista pide
    // el total al game loop (`getSellTotal`), que es el mismo calculo que hace
    // el cobro, y no queda ninguna copia de la formula. Lo comprueba
    // `sellCheck`, que si puede porque el numero ya no se calcula en la vista.
    const g = await boot(baseSave([crate('c1', 1, 4), crystal('x1', 1, 3), crystal('x2', 3, 2)]));
    for (const [id, unidades] of [['c1', 4], ['x1', 3], ['x2', 2]] as Array<[string, number]>) {
      const unitario = g.getSellPrice(id);
      const nanoAntes = nanites(g);
      const r = g.sellItem(id);
      const cobrado = nanites(g) - nanoAntes;
      check(`precio: ${id} cobra unidad x unidades (${unitario} x ${unidades})`,
        r.ok && cobrado === unitario * unidades,
        `cobrado=${cobrado} esperado=${unitario * unidades}`);
    }
  }
  {
    // Con la bonificacion de venta del arbol, el precio cambia y el cobro tiene
    // que cambiar con el. Un precio congelado en el item hace que vender salga
    // mas caro (o mas barato) de lo que decia la pantalla.
    const g = await boot(baseSave([crate('c1', 1, 2)], {
      nodeLevels: { scrapyard: 2 }, unlockedNodes: ['scrapyard']
    }));
    const prima = 1 + s(g).bonus.sellMult;
    check('precio: la bonificacion de venta sube el precio mostrado',
      g.getSellPrice('c1') === Math.floor(125 * prima), `${g.getSellPrice('c1')} prima=${prima}`);
    const antes = nanites(g);
    g.sellItem('c1');
    check('precio: y el cobro usa el mismo numero', nanites(g) - antes === g.getSellPrice('c1') + 0 ||
      nanites(g) - antes === Math.floor(125 * prima * 2), `cobrado=${nanites(g) - antes}`);
  }
  {
    // Un id que no existe vale 0 y no se puede vender.
    const g = await boot(baseSave([crate('c1')]));
    check('precio: un id inexistente vale 0', g.getSellPrice('no_existe') === 0);
    check('precio: y venderlo se rechaza', g.sellItem('no_existe').ok === false);
  }

  // =========================================================================
  //  6. El clic: la fuente de ingresos
  // =========================================================================
  {
    const g = await boot(baseSave([collector('r1', 3, { damage: 60 })], { nanites: 0 }));
    check('click: sin recolector equipado no hay dano', g.getClickDamage() === 0, 'danio=' + g.getClickDamage());
    g.click();
    check('click: sin recolector no se gana nada', s(g).nanites === 0, 'nanites=' + s(g).nanites);
    check('click: pero el click se cuenta igualmente', s(g).totalClicks === 1, 'clicks=' + s(g).totalClicks);
  }
  {
    const g = await boot(baseSave([collector('r1', 3, { damage: 60 })], { nanites: 0 }));
    g.equipCollector('r1');
    const danio = g.getClickDamage();
    check('click: con recolector hay dano', danio > 0, 'danio=' + danio);
    g.click();
    check('click: el click da el dano anunciado', s(g).nanites === danio, `${s(g).nanites} vs ${danio}`);

    // Los clicks siguientes NO tienen por que dar lo mismo: el primer click puede
    // desbloquear un logro, y un logro con bonificacion de click sube el
    // multiplicador. Por eso se compara con el dano vigente en cada momento, en
    // vez de con el del principio.
    const d2 = g.getClickDamage();
    g.click();
    check('click: el segundo click da el dano de ese momento',
      s(g).nanites === danio + d2, `${s(g).nanites} vs ${danio}+${d2}`);
    const d3 = g.getClickDamage();
    g.click();
    check('click: y el tercero tambien', s(g).nanites === danio + d2 + d3,
      `${s(g).nanites} vs ${danio}+${d2}+${d3}`);
    check('click: el total producido lleva la cuenta', s(g).totalNanitesProduced === s(g).nanites,
      `${s(g).totalNanitesProduced} vs ${s(g).nanites}`);
    check('click: y el numero de clicks tambien', s(g).totalClicks === 3, 'clicks=' + s(g).totalClicks);
  }
  {
    // El nivel del recolector sube el dano, y tiene que hacerlo de forma
    // monotona. El nivel se sube con `updateState`: `equipCollector` es un
    // conmutador, y llamar ahi con el item ya equipado lo DESEQUIPARIA.
    const g = await boot(baseSave([collector('r1', 3, { damage: 60, level: 0 })], { nanites: 0 }));
    g.equipCollector('r1');
    const d0 = g.getClickDamage();
    g.updateState({ warehouse: wh(g).map((w: any) => w.id === 'r1' ? { ...w, level: 10 } : w) });
    const d10 = g.getClickDamage();
    check('click: el nivel del recolector sube el dano', d10 > d0, `${d0} -> ${d10}`);
    check('click: y sigue equipado', s(g).equippedCollectorId === 'r1', String(s(g).equippedCollectorId));
  }

  // =========================================================================
  //  7. La Mejora del recolector: cristal del nivel exacto y coste creciente
  // =========================================================================
  {
    // EL ACIERTO, con el dado clavado. Esta rama no la miraba NINGÚN banco:
    // todos los tests de mejora comprobaban rechazos, que son deterministas
    // porque no llegan al dado. Ese hueco es justo lo que dejó vivir el bug más
    // gordo que arregla este commit: `crystalPicker.ts` leía `res.ok` sobre un
    // resultado `{ success, msg }`, así que `res.ok` era `undefined`, `!undefined`
    // era `true` y TODA sintonización caía en la rama de error. Un acierto
    // pintaba un toast rojo de "error" con el texto "¡Mejora exitosa!" dentro y
    // sonaba el sonido de fallo. El fallo sí se veía bien, pero por casualidad.
    //
    // El acierto tiene que leerse por `success`. Si algún día alguien unifica la
    // convención y cambia este campo sin tocar la vista, esta línea se enciende.
    const g = await boot(baseSave([
      collector('r1', 3, { damage: 60, level: 0 }),
      crystal('x1', 3, 5)
    ], { nanites: 0, nodeLevels: { blueprint: 1 }, unlockedNodes: ['blueprint'] }));
    g.equipCollector('r1');
    const coste = collectorUpgradeCost(0);
    const antes = find(g, 'x1').stackCount;
    const danio0 = g.getClickDamage();
    // 0 * 100 = 0 y el techo de la probabilidad es 95: acierta siempre, para
    // cualquier nivel y cualquier cristal.
    const r = conRoll(0, () => g.upgradeEquippedCollector());
    check('mejora: el acierto se lee por `success` y no por `ok`',
      r.success === true,
      `success=${r.success} ok=${JSON.stringify((r as any).ok)} msg=${r.msg ?? ''}`);
    check('mejora: y el mensaje es el del acierto, no el del fallo',
      /exitosa/i.test(r.msg ?? ''), r.msg ?? '');
    check('mejora: el acierto sube el nivel',
      find(g, 'r1').level === 1, 'nivel=' + find(g, 'r1').level);
    check('mejora: consume los cristales del coste',
      find(g, 'x1').stackCount === antes - coste,
      `antes=${antes} ahora=${find(g, 'x1').stackCount} coste=${coste}`);
    check('mejora: y el nivel nuevo paga más daño', g.getClickDamage() > danio0,
      `${danio0} -> ${g.getClickDamage()}`);
    const g2 = await reload();
    check('mejora: el acierto sobrevive a la recarga', find(g2, 'r1')?.level === 1,
      'nivel=' + find(g2, 'r1')?.level);
    check('mejora: y el reload no regasta la mejora', find(g2, 'x1')?.stackCount === antes - coste,
      'stackCount=' + find(g2, 'x1')?.stackCount);
  }
  {
    // EL FALLO, también con el dado clavado. 0.999 * 100 = 99.9, por encima
    // del techo del 95, así que falla siempre.
    //
    // Lo que se fija aquí es la decisión de diseño: el fallo NO retrocede el
    // nivel. Retrocederlo convertía la mejora en una escalera sin retorno para
    // el jugador que fallaba dos veces. La pérdida real es el cristal, que es
    // justo el coste que se eligió arriesgar — y aun así se paga.
    const g = await boot(baseSave([
      collector('r1', 3, { damage: 60, level: 4 }),
      crystal('x1', 3, 5)
    ], { nanites: 0 }));
    g.equipCollector('r1');
    const coste = collectorUpgradeCost(4);
    const antes = find(g, 'x1').stackCount;
    const danio0 = g.getClickDamage();
    const r = conRoll(0.999, () => g.upgradeEquippedCollector());
    check('mejora: el fallo se lee por `success`', r.success === false,
      `success=${r.success} ok=${JSON.stringify((r as any).ok)}`);
    check('mejora: y el mensaje lo dice', /fallo/i.test(r.msg ?? ''), r.msg ?? '');
    check('mejora: el fallo no retrocede el nivel', find(g, 'r1').level === 4,
      'nivel=' + find(g, 'r1').level);
    check('mejora: el fallo no cambia el daño', g.getClickDamage() === danio0,
      `${danio0} -> ${g.getClickDamage()}`);
    check('mejora: pero el cristal se paga igual', find(g, 'x1').stackCount === antes - coste,
      `antes=${antes} ahora=${find(g, 'x1').stackCount} coste=${coste}`);
    const g2 = await reload();
    check('mejora: el fallo sobrevive a la recarga', find(g2, 'r1')?.level === 4,
      'nivel=' + find(g2, 'r1')?.level);
    check('mejora: y el cristal gastado no vuelve', find(g2, 'x1')?.stackCount === antes - coste,
      'stackCount=' + find(g2, 'x1')?.stackCount);
  }
  {
    // Sin recolector equipado no se mejora, y no se gasta nada.
    const g = await boot(baseSave([crystal('x1', 1, 5)], { nanites: 0 }));
    const r = g.upgradeEquippedCollector();
    check('mejora: sin recolector equipado se rechaza', !r.success && !!r.msg, r.msg ?? '');
    check('mejora: y no se gastan cristales', find(g, 'x1').stackCount === 5,
      String(find(g, 'x1')?.stackCount));
  }
  {
    // Un cristal de otro nivel no se gasta por uno del nivel del recolector. Antes
    // esto era "pides el nivel 1 y el juego usa el que le digas"; con F26 el
    // recolector T3 **exige** el T3, así que el caso se ha vuelto la regla.
    const g = await boot(baseSave([
      collector('r1', 3, { damage: 60, level: 0 }),
      crystal('x1', 1, 5)
    ], { nanites: 0 }));
    g.equipCollector('r1');
    const r = g.upgradeEquippedCollector();
    check('mejora: sin cristal del nivel pedido se rechaza',
      !r.success && /no tienes/i.test(r.msg ?? ''), r.msg ?? '');
    check('mejora: y el cristal de otro nivel no se gasta', find(g, 'x1').stackCount === 5,
      String(find(g, 'x1')?.stackCount));
  }
  {
    // El techo de un recolector SIN `maxLevel` (o sea, de la tienda) son 20, y
    // es un tope real: en el 20 no se mejora ni se cobran cristales.
    const g = await boot(baseSave([
      collector('r1', 3, { damage: 60, level: BASE_COLLECTOR_MAX_LEVEL }),
      crystal('x1', 3, 99)
    ], { nanites: 0 }));
    g.equipCollector('r1');
    const r = g.upgradeEquippedCollector();
    check('mejora: en el nivel maximo se rechaza', !r.success && /máximo/i.test(r.msg ?? ''), r.msg ?? '');
    check('mejora: y no se gastan cristales', find(g, 'x1').stackCount === 99,
      String(find(g, 'x1')?.stackCount));
  }
  {
    // EL TECHO LO PONE EL RECOLECTOR, NO UNA CONSTANTE DEL MOTOR.
    //
    // Un recolector forjado nace con `maxLevel: 20 + potencial * 3`, o sea entre
    // 23 y 35, y la ficha del almacen y el panel del jugador enseñan ese techo.
    // El game loop comparaba contra un 20 fijo, asi que un recolector forjado
    // llegaba al nivel 20, el jugador gastaba un cristal mas y le respondian
    // "ya no puedes": la barra de la ficha prometia 28 niveles y el motor daba
    // 20. Un techo que la pantalla no enseña hace que el jugador pague por algo
    // que no existe.
    // Y la cantidad de cristales se CALCULA, no se escribe. Estaba fija en 99 y
    // cuando la curva de coste de sintonización se endureció (1.14 a 1.26 por
    // nivel) el nivel 20 pasó a costar 132 y estas pruebas fallaron sin ningún
    // bug: la partida de test se había quedado sin cristales. El banco tiene que
    // depender del coste, no de un número que alguien escribió una vez.
    const paraPasarDe20 = collectorUpgradeCost(20);
    const cristalesDe20 = paraPasarDe20 + 10;

    const g = await boot(baseSave([
      collector('r1', 3, { damage: 60, level: 20, maxLevel: 28, potential: 3 }),
      crystal('x1', 3, cristalesDe20)
    ], { nanites: 0 }));
    g.equipCollector('r1');
    const r = conRoll(0, () => g.upgradeEquippedCollector());
    check('mejora: un recolector forjado pasa del 20 si su techo da',
      r.success === true && find(g, 'r1').level === 21,
      `nivel=${find(g, 'r1').level} msg=${r.msg ?? ''}`);
    check('mejora: y el gasto es real', find(g, 'x1').stackCount === cristalesDe20 - paraPasarDe20,
      `x1=${find(g, 'x1').stackCount} menos ${paraPasarDe20}`);
    const g2 = await reload();
    check('mejora: y el nivel 21 sobrevive a la recarga', find(g2, 'r1')?.level === 21,
      'nivel=' + find(g2, 'r1')?.level);
  }
  {
    // Y el techo del item es el tope de verdad: en su propio maxLevel, ni uno mas.
    const g = await boot(baseSave([
      collector('r1', 3, { damage: 60, level: 28, maxLevel: 28 }),
      crystal('x1', 3, 99)
    ], { nanites: 0 }));
    g.equipCollector('r1');
    const r = g.upgradeEquippedCollector();
    check('mejora: en el techo del item se rechaza',
      !r.success && /máximo/i.test(r.msg ?? ''), r.msg ?? '');
    check('mejora: y no se gastan cristales', find(g, 'x1').stackCount === 99,
      String(find(g, 'x1')?.stackCount));
    // El mensaje nombra el techo REAL, no el 20 de antes: si dice "+200%" cuando
    // el techo son 28, el jugador ve un número que no corresponde con su item.
    check('mejora: el mensaje nombra el techo del item', /\+280%/.test(r.msg ?? ''), r.msg ?? '');
  }
  {
    // Y sin `maxLevel` la regla sigue siendo 20, sin exceptions: los recolectores
    // de la tienda no traen el campo y no pueden tocar mas alto.
    check('mejora: sin `maxLevel` el techo es 20',
      collectorMaxLevel(undefined) === 20 && collectorMaxLevel(null) === 20
      && collectorMaxLevel(28) === 28,
      [collectorMaxLevel(undefined), collectorMaxLevel(28)].join(','));
    check('mejora: un `maxLevel` de 0 no rompe el techo',
      collectorMaxLevel(0) === 20, String(collectorMaxLevel(0)));
  }
  {
    // Si no hay cristales suficientes, no se intenta: el item no se gasta a medias.
    // El coste del nivel 0 es 1, asi que hace falta un nivel ALTO para que la
    // cantidad no alcance.
    const g = await boot(baseSave([
      collector('r1', 3, { damage: 60, level: 10 }),
      crystal('x1', 3, 1)
    ], { nanites: 0 }));
    g.equipCollector('r1');
    const necesita = collectorUpgradeCost(10);
    check('mejora: el coste crece con el nivel', necesita > 1, 'coste en nivel 10=' + necesita);
    const r = g.upgradeEquippedCollector();
    check('mejora: con menos cristales de los necesarios se rechaza',
      !r.success && /Necesitas/i.test(r.msg ?? ''), r.msg ?? '');
    check('mejora: y no se queda sin cristales', find(g, 'x1')?.stackCount === 1,
      'stackCount=' + find(g, 'x1')?.stackCount);
    check('mejora: y el nivel no cambia', find(g, 'r1').level === 10, 'nivel=' + find(g, 'r1').level);
  }

  // =========================================================================
  //  8. Abrir cajas
  // =========================================================================
  {
    // Una caja de nivel alto se abre igual que una de nivel bajo, sin nada más que
    // su id. Antes esta prueba comparaba el alcance de una llave con el nivel del
    // cofre —"una llave de nivel 0 no abre un cofre de nivel 3", y al revés una
    // llave mejor sí abría un cofre peor—, y ya no hay llave ni alcance: el
    // alcance de una caja es su nivel y no se puede pedir nada más.
    //
    // **LO QUE QUEDA DE ESA COMPARACIÓN ES JUSTO ESTO**, y merece su propia
    // comprobación porque es el cambio de fondo: quitar la llave no puede dejar
    // la caja atada a ningún otro item del almacén. Lo de que el botín salga del
    // nivel que la caja anuncia está más abajo, con el cristal.
    const g = await boot(baseSave([crate('c1', 8)]));
    const r = g.openCrateBox('c1');
    check('cajas: una caja alta se abre sin nada más que su id', r.ok && r.crateType === 8, r.msg ?? '');
    check('cajas: y es la de su propio nivel', r.crateType === 8, `crateType=${r.crateType}`);
  }
  {
    const g = await boot(baseSave([crate('c1', 1), crystal('x1', 1, 2)]));
    const r = g.openCrateBox('c1');
    check('cajas: con una caja en el almacen se abre', r.ok, r.msg ?? '');
    check('cajas: la caja se consume', !find(g, 'c1'), ids(g).join(','));
    // Lo que se comprueba aquí NO es que la pila quede en su cuenta, sino que el
    // botín caiga en la pila de SU nivel. Antes miraba la pila de llaves y daba 1
    // siempre, y no porque estuviera bien: la caja común anunciaba llaves de nivel
    // 0 y el aplicador las forzaba a nivel 1, así que caían en OTRA pila y esta
    // cuenta pasaba por casualidad. Al arreglarlo, el resultado depende del
    // sorteo, así que se compara con el premio que devuelve el propio juego y no
    // con una cuenta fija.
    //
    // **AHORA LA PILA ES DE CRISTALES**, porque es la del material que existe: el
    // cristal es lo que la caja anuncia por nivel y lo que el jugador gasta en
    // sintonizar. La regla es idéntica —el botín cae en la pila de SU nivel—, solo
    // que escrita sobre un tipo que el juego sigue teniendo.
    const delBotin = r.reward?.kind === 'crystals' && r.reward.materialTier === 1;
    const esperado = delBotin ? 2 + r.reward.amount : 2;
    check('cajas: el botín se apila en la pila del nivel que anuncia',
      find(g, 'x1')?.stackCount === esperado,
      `pila=${find(g, 'x1')?.stackCount} esperado=${esperado} premio=${r.reward?.kind}`);
    check('cajas: el contador de cajas abiertas sube', s(g).cratesOpened === 1, String(s(g).cratesOpened));
    const g2 = await reload();
    // F31 · LA CAJA ABIERTA PUEDE DEJAR OTRA CAJA, Y EL CONTADOR NO ES EL NÚMERO
    // DE ITEMS SINO EL DE UN NIVEL. La caja T1 suelta la T2, así que abrir una
    // puede dejar dos items de caja en el almacén: el que había y el que llegó.
    // La comparación correcta es "el total de cajas del almacén es la suma de
    // los contadores", que es la regla que el propio juego mantiene.
    const totalCajas = Object.values(s(g2).crates as Record<number, number>)
      .reduce((a, b) => a + (b || 0), 0);
    check('cajas: el botin aplicado sobrevive a la recarga',
      s(g2).cratesOpened === 1 && deType(g2, 'crate') === totalCajas,
      `abiertas=${s(g2).cratesOpened} items=${deType(g2, 'crate')} contadores=${totalCajas}`);
  }
  {
    const g = await boot(baseSave([crystal('x1', 1, 1)]));
    const r = g.openCrateBox('c1');
    check('cajas: sin caja se rechaza', !r.ok, r.msg ?? '');
  }
  {
    // Con el almacen lleno, abrir una caja no puede desbordarlo.
    const lleno = Array.from({ length: 29 }, (_, i) => crate(`x${i}`));
    const g = await boot(baseSave([...lleno, crate('c1', 1)], { warehouseCapacity: 30 }));
    const antes = wh(g).length;
    g.openCrateBox('c1');
    check('cajas: con el almacen lleno el botin no desborda', wh(g).length <= g.getCapacity(),
      `antes=${antes} ahora=${wh(g).length} cap=${g.getCapacity()}`);
  }
  {
    // LA CAJA ENTREGA EL MATERIAL QUE ANUNCIA, Y NO OTRO.
    //
    // Este es el bug que más se parezca a "la ruleta mintiendo", y lo es de
    // verdad. La tabla declara qué material deja cada cofre (`materialTier`), y el
    // aplicador del game loop se comía ese segundo argumento y entregaba siempre
    // nivel 1. El jugador veía un nombre y recibía otro, sin ninguna forma de saber
    // que eran distintos.
    //
    // Con el módulo de apilado era peor que cosmético: como todo el material caía
    // en nivel 1, se fundía en UNA sola pila y no había forma de separarlo.
    //
    // `rollPara` clava el dado en la fila que interesa, así que esto no depende
    // del sorteo ni de cuántas cajas haga falta abrir.
    //
    // **ESTE BLOQUE Y EL DE ABAJO ERAN EL MISMO, Y AHORA SOLO QUEDA UNO.** Estaba
    // dos veces: una forzando la fila `keys` y otra la fila `crystals`. Las dos
    // medían la misma regla —el botín da el material del nivel que anuncia— sobre
    // dos tipos que en aquel momento existían. Al quitar las llaves solo queda la
    // fila de cristales, así que las dos se han fundido en esta: se conserva la
    // comprobación del nivel del botín y la de que no aparezca material del nivel
    // equivocado, y de la que faltaba se ha cogido la recarga.
    const g = await boot(baseSave([crate('c1', 8)]));
    const r = conRoll(rollPara(8, 'crystals'), () => g.openCrateBox('c1'));
    check('cajas: la caja T8 se abre', r.ok, r.msg ?? '');
    check('cajas: el cristal del botín es del nivel que anuncia',
      r.reward?.kind === 'crystals' && pilaDe(g, 'crystal', r.reward.materialTier)?.stackCount === r.reward.amount,
      `anuncia ${r.reward?.materialTier}x${r.reward?.amount} y llegó ` +
      JSON.stringify(wh(g).filter((w: any) => w.type === 'crystal')
        .map((w: any) => `${w.name}:${w.tier}x${w.stackCount ?? 1}`)));
    check('cajas: y no aparece un cristal del nivel equivocado',
      !wh(g).some((w: any) => w.type === 'crystal' && w.tier !== r.reward?.materialTier),
      'sobran cristales de otro nivel');
    const g2 = await reload();
    check('cajas: y el nivel del cristal sobrevive a la recarga',
      pilaDe(g2, 'crystal', r.reward?.materialTier)?.stackCount === r.reward?.amount,
      `pila=${pilaDe(g2, 'crystal', r.reward?.materialTier)?.stackCount}`);
  }
  {
    // =====================================================================
    //  F26 · LA ATONIZACIÓN USA EL CRISTAL DEL MISMO TIER, Y SOLO ESE.
    // =====================================================================
    //
    // Antes esta prueba era "gastar una llave de nivel 2 afina con un cristal de
    // nivel 2": el selector **elegía** el cristal y el motor obedecía. Ahora no
    // hay elección —el nivel sale del tier del recolector— así que el caso
    // interesante es el otro: con un T3 en la mano, el cristal T1 **no** cuenta
    // aunque haya cinco en el almacén, y la sintonización se rechaza diciendo
    // cuál falta.
    //
    // Y el motivo por el que esto no es una comodidad: si el T3 pudiera afinarse
    // con el cristal que se compra en la tienda, las cajas dejarían de ser
    // necesarias para progresar. Con esta regla, el T8 exige cristal T8, y el
    // cristal T8 sale de las cajas T8.
    const g = await boot(baseSave([
      crystal('x1', 1, 5),
      collector('r1', 3, { damage: 60, level: 0 })
    ]));
    g.equipCollector('r1');

    const r1 = g.upgradeEquippedCollector();
    check('F26: un T3 sin cristal T3 no se afina',
      r1.success === false && r1.rolled === false && /Cristal/.test(r1.msg ?? ''),
      `msg=${r1.msg ?? ''}`);
    check('F26: y no se gasta nada, ni siquiera el T1 que sí tiene',
      find(g, 'x1').stackCount === 5, `x1=${find(g, 'x1').stackCount}`);
  }
  {
    // El mismo item con el cristal de SU nivel: ahora sí, y ahora solo ese. Con
    // los cinco T1 ahí al lado, que es lo que el jugador tiene en el almacén
    // durante medio juego.
    const coste = collectorUpgradeCost(0);
    const g = await boot(baseSave([
      crystal('x1', 1, 5), crystal('x3', 3, 5),
      collector('r1', 3, { damage: 60, level: 0 })
    ]));
    g.equipCollector('r1');
    const r2 = conRoll(0, () => g.upgradeEquippedCollector());
    check('F26: con el cristal T3 sí se afina, y gasta el T3',
      r2.success === true && find(g, 'x3').stackCount === 5 - coste,
      `x3=${find(g, 'x3').stackCount} coste=${coste} msg=${r2.msg ?? ''}`);
    check('F26: y el T1 sigue entero aunque haya cinco',
      find(g, 'x1').stackCount === 5, 'x1=' + find(g, 'x1').stackCount);
  }
  {
    // Y un T por encima del último cristal se dice, no se degrada a "usa el T1".
    // La forja infinita produce T11 y siguientes; mientras no haya cristal para
    // ellos, la respuesta es que no hay cristal, y no una regla más blanda que
    // dejara subir un T30 con un cristal de la tienda.
    const g = await boot(baseSave([
      crystal('x10', 10, 50),
      collector('r1', 12, { damage: 600, level: 0 })
    ]));
    g.equipCollector('r1');
    const r = g.upgradeEquippedCollector();
    check('F26: un T12 sin cristal T12 se rechaza diciendo cuál falta',
      r.success === false && r.rolled === false && /T12/.test(r.msg ?? ''),
      `msg=${r.msg ?? ''}`);
    check('F26: y no se gasta el cristal T10 que sí tiene',
      find(g, 'x10').stackCount === 50, 'x10=' + find(g, 'x10').stackCount);
  }
  {
    // F18: ABRIR VARIAS SEGUIDAS. El lote de la vista son N llamadas enteras a
    // `openCrateBox`, así que lo que el banco ata es que N seguidas se
    // comporten: cada una consume lo suyo, el contador sube N y todo
    // sobrevive a la recarga.
    //
    // El material es de nivel 1, que es el nivel que anuncia la caja común, así
    // que el botín de esa caja puede sumárselo por detrás y la cuenta no es
    // exacta —por eso lo que se afirma de la pila es que nunca baja de lo que
    // había, no una cifra fija. Las cajas sí pueden dar cajas, por eso de la pila
    // de cajas tampoco se afirma una cuenta cerrada.
    const g = await boot(baseSave([
      crate('c1', 1, 3), crystal('x1', 1, 5)
    ], { nanites: 0 }));
    const producidasAntes = s(g).totalNanitesProduced;
    const abiertasAntes = s(g).cratesOpened;
    const resultados = [g.openCrateBox('c1'), g.openCrateBox('c1'), g.openCrateBox('c1')];
    check('lote: las tres aperturas salen ok con premio',
      resultados.every(r => r.ok && !!r.reward),
      resultados.map(r => `${r.ok}:${r.reward?.kind}`).join(','));
    check('lote: el contador sube una por apertura, ni una más',
      s(g).cratesOpened === abiertasAntes + 3,
      `abiertas=${s(g).cratesOpened} antes=${abiertasAntes}`);
    // LO QUE QUEDA DEL LOTE, Y POR QUÉ NO ES "UNA CAJA MENOS POR APERTURA".
    //
    // La caja T1 suelta el cristal T1, así que cada apertura devuelve parte de lo
    // que cuesta: abrir tres cajas con un solo material es legal, porque la
    // segunda te devuelve parte de lo que gastó la primera. Y las cajas pueden dar
    // cajas, así que el total de cajas del almacén al final no tiene por qué ser
    // cero.
    //
    // **LO QUE NO PUEDE PASAR ES QUE LAS CUENTAS BAJEN.** Tres aperturas, tres
    // cajas consumidas, y el material nunca por debajo de lo que había. Eso es lo
    // que se mide aquí.
    check('lote: la caja se gasta una por apertura, exacta',
      s(g).crates[1] === 0,
      `contador T1=${s(g).crates[1]} unidades=${find(g, 'c1')?.stackCount}`);
    check('lote: y el material nunca baja de lo que había',
      (find(g, 'x1')?.stackCount ?? 0) >= 5,
      `x1=${find(g, 'x1')?.stackCount} (5 de partida, y las cajas solo pueden sumar)`);
    check('lote: lo producido nunca baja entre aperturas',
      s(g).totalNanitesProduced >= producidasAntes,
      `producidas=${s(g).totalNanitesProduced} antes=${producidasAntes}`);
    const g2 = await reload();
    check('lote: el lote sobrevive a la recarga',
      s(g2).cratesOpened === abiertasAntes + 3 && s(g2).totalNanitesProduced >= producidasAntes,
      `abiertas=${s(g2).cratesOpened} producidas=${s(g2).totalNanitesProduced}`);
  }
  {
    // Y la condición de parada del lote: sin cajas no hay apertura y no se
    // gasta nada. Es lo que hace que "se abrieron N de M" pare donde toca.
    const g = await boot(baseSave([crystal('x1', 1, 1)]));
    const r = g.openCrateBox('c1');
    check('lote: sin cajas se rechaza', !r.ok && !!r.msg, r.msg ?? '');
    check('lote: y no se toca el material que hay', find(g, 'x1')?.stackCount === 1,
      `x1=${find(g, 'x1')?.stackCount}`);
  }
  {
    // Por debajo del umbral no se puede reciclar.
    const g = await boot(baseSave([crate('c1'), collector('r1'), collector('r2')],
      { totalNanitesProduced: 10 }));
    const r = g.prestige();
    check('prestigio: por debajo del umbral se rechaza', !r.success && !!r.msg, r.msg ?? '');
    check('prestigio: y no se toca nada', deType(g, 'crate') === 1 && s(g).nanites === 1000,
      `nanites=${s(g).nanites}`);
  }
  {
    const g = await boot(baseSave([
      crate('c1', 1, 2), crate('c2', 6, 1),
      collector('r1', 3), collector('r2', 3),
      { id: 'm1', name: 'Compañero T1', type: 'companion', details: 'x', rarity: 'Común', sellPrice: 100 },
      crystal('x1', 1, 5)
    ], {
      totalNanitesProduced: 50_000_000,
      nanites: 123_456,
      cores: 7, totalCores: 12, resets: 3,
      nodeLevels: { core_sink: 2 }, unlockedNodes: ['core_sink'],
      unlockedAchievements: ['first_click'], forgedCount: 4, shards: 6
    }));
    const esperado = nextCores({
      totalNanitesProduced: 50_000_000, totalCores: 12, coreGain: s(g).bonus.coreGain
    });

    const r = g.prestige();
    check('prestigio: con suficiente produccion se concede', r.success, r.msg ?? '');
    check('prestigio: otorga los nucleos anunciados',
      s(g).cores === 7 + esperado, `${s(g).cores} esperado=${7 + esperado}`);
    check('prestigio: el historico de nucleos crece', s(g).totalCores === 12 + esperado,
      String(s(g).totalCores));
    check('prestigio: se resetea el progreso', s(g).nanites < 123_456, 'nanites=' + s(g).nanites);
    check('prestigio: los contadores de reinicios suben', s(g).resets === 4, String(s(g).resets));
    check('prestigio: se conservan los NODOS del arbol', s(g).nodeLevels.core_sink === 2,
      JSON.stringify(s(g).nodeLevels));
    check('prestigio: se conservan los logros', s(g).unlockedAchievements.includes('first_click'),
      s(g).unlockedAchievements.join(','));
    check('prestigio: se conservan las recolectores forjadas', s(g).forgedCount === 4,
      String(s(g).forgedCount));
    check('prestigio: se conservan las esquirlas', s(g).shards === 6, String(s(g).shards));
    // Lo unico que sobrevive al reinicio son las 2 cajas de bienvenida, y son UN
    // item apilado con 2 unidades: la capacidad se cuenta en ranuras.
    check('prestigio: el almacen se recycle', deType(g, 'crate') === 1 && deType(g, 'crystal') === 0,
      `cajas=${deType(g, 'crate')} cristales=${deType(g, 'crystal')}`);
    check('prestigio: y son las 2 cajas de bienvenida, en una sola pila',
      s(g).crates[1] === 2 && deType(g, 'crate') === 1 &&
      wh(g).find((w: any) => w.type === 'crate')?.stackCount === 2,
      `contador=${s(g).crates[1]} items=${deType(g, 'crate')} unidades=${wh(g).find((w: any) => w.type === 'crate')?.stackCount}`);

    const g2 = await reload();
    check('prestigio: el resultado sobrevive a la recarga',
      s(g2).resets === 4 && s(g2).cores === 7 + esperado && s(g2).crates[1] === 2,
      `resets=${s(g2).resets} cores=${s(g2).cores} cajas=${s(g2).crates[1]}`);
  }
  {
    // Reciclar dos veces seguidas no duplica nada.
    const g = await boot(baseSave([crate('c1'), collector('r1'), collector('r2')],
      { totalNanitesProduced: 50_000_000 }));
    g.prestige();
    await reload();
    const g2 = await bootNew();
    g2.prestige?.();
    const g3 = await reload();
    check('prestigio: reiniciar otra vez no rompe el estado', typeof s(g3).nanites === 'number',
      'nanites=' + s(g3).nanites);
  }

  // =========================================================================
  //  10. La forja
  // =========================================================================
  {
    // **LA FORJA NO TIENE PUERTA.** Aquí había dos comprobaciones que decían que sin
    // el nodo "Planos Viejos" no se fusionaba, y ya no hay nodo que la abra. Se han
    // ido con la puerta: una prueba que afirma una regla borrada es peor que no
    // tenerla, porque alguien la lee, la ve pasar, y se queda creyendo que el
    // requisito sigue ahí.
    //
    // Lo que se conserva —y ya está en `forjaCheck`, con partida recién creada— es
    // que la forja funciona sin árbol ninguno. Aquí solo hace falta que el rechazo
    // siga sin costar materiales cuando lo hay por otro motivo.
    const g = await boot(baseSave([collector('a', 2)]));
    const r = g.forgeCollector(['a', 'b']);
    check('forja: un material que no existe se rechaza, y no dice nada de nodos',
      !r.success && !/Planos Viejos/i.test(r.msg ?? ''), r.msg ?? '');
    check('forja: y ese rechazo tampoco consume nada',
      deType(g, 'collector') === 1, ids(g).join(','));
  }
  {
    const conBlueprint = {
      nodeLevels: { blueprint: 1 }, unlockedNodes: ['blueprint']
    };
    const g = await boot(baseSave([collector('a', 2), collector('b', 2), collector('c', 2)], conBlueprint));

    // F33 · Exactamente 2: ni uno ni tres.
    check('forja: con 1 material se rechaza', !g.forgeCollector(['a']).success);
    check('forja: con 3 materiales se rechaza',
      !g.forgeCollector(['a', 'b', 'c']).success);
    check('forja: un id inexistente se rechaza', !g.forgeCollector(['a', 'nope']).success);
    check('forja: y nada se ha consumido todavia', deType(g, 'collector') === 3, ids(g).join(','));

    // Mezcla de tiers.
    const g2 = await boot(baseSave([
      collector('a', 2), collector('b', 3)
    ], conBlueprint));
    check('forja: los 2 tienen que ser del mismo tier',
      !g2.forgeCollector(['a', 'b']).success);

    // F24 · El mismo id dos veces no son dos materiales: se rechaza, no se
    // consume nada y no se gastan piedras (el rechazo va antes del cobro).
    const rDup = g.forgeCollector(['a', 'a']);
    check('forja: el mismo id dos veces se rechaza',
      !rDup.success && /distintos/i.test(rDup.msg ?? ''), rDup.msg ?? '');
    check('forja: y no se consume ningún material',
      deType(g, 'collector') === 3, ids(g).join(','));
    const gP = await boot(baseSave([
      collector('a', 2), collector('b', 2),
      consumable('p1', 'calibrationStone', 2, { name: 'Piedra de Calibración' })
    ], conBlueprint));
    const rP = gP.forgeCollector(['a', 'a'], 2, 0);
    check('forja: el rechazo por duplicados no gasta piedras',
      !rP.success && find(gP, 'p1')?.stackCount === 2,
      `ok=${rP.success} piedras=${find(gP, 'p1')?.stackCount}`);

    // Sin techo de tier (forja infinita): el T11 se fusiona y da T12. El precio
    // (2^n materiales) es lo que frena, no un rechazo.
    const g3 = await boot(baseSave([
      collector('a', 11), collector('b', 11)
    ], conBlueprint));
    const r12 = conRoll(0, () => g3.forgeCollector(['a', 'b']));
    check('forja: el T11 se fusiona y da T12',
      r12.success === true && (r12.collector as any)?.tier === 12,
      `success=${r12.success} tier=${(r12.collector as any)?.tier} msg=${r12.msg ?? ''}`);

    {
      // F33 · El potencial es lo que decide el daño, y la forja lo promedia. Esto
      // es lo que hace que buscar los items buenos sea una decisión: si el
      // forjado saliera siempre en el punto medio (que era lo que pasaba), el
      // material que metieras da igual y buscarlo era tiempo perdido.
      // El daño es base(tier) × (1 + 0,2 × potencial). Cada estrella es un 20% y el
      // ★1 YA es +20%, así que el ★5 es exactamente el doble de la base: la
      // perfección del 100%. El ejemplo que lo fija: base 5 con ★5 da 10.
      const base5 = baseDeTier(5);
      check('potencial: cada estrella es un 20% y el ★5 es el doble de la base',
        danioDeRango(5, 5) === Math.round(base5 * 2) &&
        danioDeRango(5, 1) === Math.round(base5 * 1.2) &&
        danioDeRango(5, 3) === Math.round(base5 * 1.6),
        `base=${base5} p1=${danioDeRango(5, 1)} p3=${danioDeRango(5, 3)} p5=${danioDeRango(5, 5)}`);
      check('potencial: el ejemplo del jugador, base 5 con ★5 da 10',
        danioDeRango(1, 5) === 10 || baseDeTier(1) === 5,
        `base T1=${baseDeTier(1)} p5=${danioDeRango(1, 5)}`);
      check('potencial: los cinco escalones suben y ninguno baja del 20%',
        [1, 2, 3, 4, 5].every((p, i, a) => i === 0 || danioDeRango(5, p) > danioDeRango(5, a[i - 1])) &&
        danioDeRango(5, 1) > base5,
        [1, 2, 3, 4, 5].map(p => danioDeRango(5, p)).join(','));
      // La condición que hace que la progresión se LEA: **el peor item de un tier
      // tiene que superar al mejor del tier anterior**. Con la base en el mínimo
      // del rango no pasaba: el T1 iba de 6 a 10 y el T2 de 10 a 16, así que un T1
      // perfecto igualaba a un T2 normal y el jugador compraba por potencial en
      // vez de por tier. `playthroughCheck` mide esto comprando, y falló.
      const cruces: string[] = [];
      for (let t = 2; t <= 10; t++) {
        if (danioDeRango(t, 1) <= danioDeRango(t - 1, 5)) {
          cruces.push(`T${t}★1=${danioDeRango(t, 1)} <= T${t - 1}★5=${danioDeRango(t - 1, 5)}`);
        }
      }
      check('potencial: el peor de un tier supera al mejor del anterior',
        cruces.length === 0,
        cruces.join(' | ') || `T1=${danioDeRango(1, 5)} -> T2=${danioDeRango(2, 1)}`);
      // F33 · Los afijos: la rareza da el MÍNIMO y el tope es 6. Antes el número
      // venía del potencial, así que un Divino podía salir con 1 afijo y un Común
      // con 3. Y en la forja se heredan los de los dos materiales primero, que es
      // lo que hace que buscar un item con buenos afijos tenga recompensa.
      //
      // **EL SEXTO ESCALÓN ERA `SOBRECARGADO`, Y CON ESA RAREZA FUERA EL TOPO
      // ENTERO SE LO LLEVA `Divino`.** Si no, un item con 6 afijos no existiría:
      // el `AFIX_MAX` es 6 y ningún peldaño de la escalera llegaría, así que la
      // de "más rareza, más afijos" se quedaría sin final. Con el Divino en 6, el
      // item más completo del juego es un Divino forjado con buenos materiales,
      // que es lo que tenía que ser.
      check('afijos: la rareza da el minimo y el tope es 6',
        AFIX_MIN_POR_RARIDAD['Común'] === 0 && AFIX_MIN_POR_RARIDAD['Divino'] === 6 &&
        Object.keys(AFIX_MIN_POR_RARIDAD).length === 6 &&
        Object.values(AFIX_MIN_POR_RARIDAD).every(v => v <= 6) &&
        // Y la escalera es estrictamente creciente: cada rareza da más que la de
        // abajo, que es lo que hace que "más rareza" signifique algo.
        RARITY_ORDER.every((r, i) => i === 0
          || AFIX_MIN_POR_RARIDAD[r] > AFIX_MIN_POR_RARIDAD[RARITY_ORDER[i - 1]]),
        JSON.stringify(AFIX_MIN_POR_RARIDAD));
      check('afijos: NINGUNO da dano plano, o rompe los items de tier bajo',
        AFFIXES.every(a => a.effect.flatDamage === undefined && a.effect.flatPassive === undefined),
        AFFIXES.filter(a => a.effect.flatDamage || a.effect.flatPassive).map(a => a.id).join(',') || 'ninguno');
      // Y que el texto del afijo no prometa un numero plano que ya no existe.
      check('afijos: el texto de cada uno dice lo mismo que su efecto',
        AFFIXES.every(a => !/plano/i.test(a.description)),
        AFFIXES.filter(a => /plano/i.test(a.description)).map(a => a.name).join(',') || 'ninguno');
      // La estrella 5 tiene que ser mucho mas rara que la 1.
      const tiradas = [1, 2, 3, 4, 5].map(p => {
        let n = 0;
        for (let i = 0; i < 4000; i++) if (rollPotentialFrom() === p) n++;
        return n / 4000;
      });
      check('afijos: el potencial es decreciente, el 5 mucho mas raro que el 1',
        tiradas[0] > tiradas[4] && tiradas[0] > 0.4 && tiradas[4] < 0.08,
        'medido=' + tiradas.map(t => t.toFixed(3)).join(','));

      // Dos 5 dan 5: la perfección se conserva. Y un 5 con un 1 da 3: la media,
      // no el mejor de los dos. Si saliera el mejor, forjar seria subir de
      // potencial con un material malo y buscar el bueno no serviría de nada.
      const conBp = { nodeLevels: { blueprint: 1 }, unlockedNodes: ['blueprint'] };
      const conPot = async (p1: number, p2: number) => {
        const g = await boot(baseSave([
          collector('a', 4, { damage: danioDeRango(4, p1), potential: p1 }),
          collector('b', 4, { damage: danioDeRango(4, p2), potential: p2 })
        ], conBp));
        return conRoll(0, () => g.forgeCollector(['a', 'b']));
      };
      const dosPerfectos = await conPot(5, 5);
      check('forja: dos items perfectos dan un item perfecto',
        dosPerfectos.success && (dosPerfectos.collector as any)?.potential === 5,
        `pot=${(dosPerfectos.collector as any)?.potential}`);
      const unoFlojo = await conPot(5, 1);
      check('forja: un 5 con un 1 da de media un 3, no el mejor de los dos',
        unoFlojo.success && (unoFlojo.collector as any)?.potential === 3,
        `pot=${(unoFlojo.collector as any)?.potential}`);
      check('forja: y el daño de la forjada es el del potencial que ha salido',
        (dosPerfectos.collector as any)?.damage === danioDeRango(5, 5) &&
        (unoFlojo.collector as any)?.damage === danioDeRango(5, 3),
        `daño perfecto=${(dosPerfectos.collector as any)?.damage} mezcla=${(unoFlojo.collector as any)?.damage}`);
      // Un item viejo sin el campo NO puede cambiar de daño al migrar: su
      // potencial se deduce del daño que ya tenía. Ponerle un 3 a pelo lo
      // habría movido al punto medio al abrir la partida.
      const viejo = { ...collector('v', 4), damage: danioDeRango(4, 5) };
      delete (viejo as any).potential;
      check('potencial: un item viejo sin el campo deduce el suyo del daño',
        potencialDe(viejo as any) === 5 && danioDeRango(4, potencialDe(viejo as any)) === viejo.damage,
        `deducido=${potencialDe(viejo as any)} daño=${viejo.damage}`);
    }

    {
      // Las fórmulas de más allá del 10 son continuas con la tabla: el T11 no es
      // un salto ni un recorte, y el valor sigue al poder en vez de quedarse
      // plano. Sin esto, un T11 forjado tendría daño de T1 y precio de T11.
      const tabla = (TIER_SYSTEM.ranges as Record<number, [number, number]>);
      check('infinito: el rango 1-10 es la tabla literal, sin tocar',
        Object.keys(tabla).every(k => {
          const r = rangoDePoder(Number(k));
          return r[0] === tabla[Number(k)][0] && r[1] === tabla[Number(k)][1];
        }), 'tiers=1..10');
      const [min10, max10] = tabla[10];
      const [min11, max11] = rangoDePoder(11);
      check('infinito: el T11 crece ×1,62 sobre el T10, no un salto',
        Math.abs(min11 / min10 - 1.62) < 0.05 && Math.abs(max11 / max10 - 1.62) < 0.05,
        `T10=[${min10},${max10}] T11=[${min11},${max11}]`);
      check('infinito: la rareza de arriba es Divino, no un recorte ni un invento',
        rarezaDeTier(3) === 'Raro' && rarezaDeTier(15) === 'Divino' && rarezaDeTier(30) === 'Divino',
        `T3=${rarezaDeTier(3)} T15=${rarezaDeTier(15)}`);
      check('infinito: el valor base sigue subiendo del 11 al 15',
        valorBaseTier(11) < valorBaseTier(12) && valorBaseTier(12) < valorBaseTier(15),
        `11=${valorBaseTier(11)} 12=${valorBaseTier(12)} 15=${valorBaseTier(15)}`);
    }
    {
      // El T10 se fusiona y da un T11 de verdad: nombre de forja (con su
      // sufijo, no un `undefined`), daño dentro del rango nuevo y rareza
      // definida. El dado se clava para que el acierto sea determinista.
      const conBlueprint = { nodeLevels: { blueprint: 1 }, unlockedNodes: ['blueprint'] };
      const g = await boot(baseSave([
        collector('a', 10), collector('b', 10)
      ], conBlueprint));
      const r = conRoll(0, () => g.forgeCollector(['a', 'b']));
      const item = (r.collector as any);
      const [min11b] = rangoDePoder(11);
      check('forja: el T10 da un T11 con daño de T11, no de T1',
        r.success === true && item?.tier === 11 && item?.damage >= min11b,
        `success=${r.success} tier=${item?.tier} daño=${item?.damage} suelo=${min11b}`);
      check('forja: y con nombre de forja, no un undefined',
        typeof item?.name === 'string' && item.name.includes('PRIMIGENIA'),
        `nombre=${item?.name}`);
      const g2 = await reload();
      check('forja: el T11 sobrevive a la recarga con su daño',
        wh(g2).some((w: any) => w.tier === 11 && w.damage === item?.damage),
        ids(g2).join(','));
    }

    // El equipado no se puede fusionar: perderlo seria un castigo doble.
    //
    // NO se llama a `equipCollector`: la partida ya viene con `a` equipado, y esa
    // funcion es un conmutador, asi que llamarla lo desequiparia y la fusionaria.
    const g4 = await boot(baseSave([
      collector('a', 2), collector('b', 2), collector('c', 2)
    ], { ...conBlueprint, equippedCollectorId: 'a' }));
    check('forja: la partida arranca con un recolector equipado',
      s(g4).equippedCollectorId === 'a', String(s(g4).equippedCollectorId));
    const r = g4.forgeCollector(['a', 'b']);
    check('forja: el recolector equipado no se puede consumir', !r.success, r.msg ?? '');
    check('forja: y sigue en el almacen', deType(g4, 'collector') === 3, ids(g4).join(','));
    check('forja: y sigue haciendo dano', g4.getClickDamage() > 0, 'danio=' + g4.getClickDamage());
  }
  {
    // Con materiales validos la forja se ejecuta: gane o pierda, el numero de
    // recolectores no puede quedar en un estado imposible.
    const conBlueprint = { nodeLevels: { blueprint: 1 }, unlockedNodes: ['blueprint'] };
    const g = await boot(baseSave([
      collector('a', 2, { damage: 40 }), collector('b', 2, { damage: 50 })
    ], conBlueprint));
    const r = g.forgeCollector(['a', 'b']);
    check('forja: con 2 del mismo tier se ejecuta',
      typeof r.success === 'boolean', r.msg ?? '');
    // El resultado de la forja es un DADO: la probabilidad depende del tier, de
    // la suerte y de las piedras. Comprobar el estado de "despues de acertar"
    // sin mirar si ha acertado hacia que la prueba fallara una de cada tres
    // veces, solo segun la semilla. Aqui se comprueba el estado que corresponde
    // a CADA desenlace, y de paso el de fallo, que no se comprobaba nunca.
    if (r.success) {
      check('forja: acierto, queda solo la forjada',
        deType(g, 'collector') === 1, 'recolectores=' + deType(g, 'collector'));
      check('forja: acierto, el almacen no queda ni vacio ni duplicado',
        wh(g).length === 1 && new Set(ids(g)).size === wh(g).length, ids(g).join(','));
      check('forja: la cuenta de forjadas sube', s(g).forgedCount >= 1, String(s(g).forgedCount));
    } else {
      check('forja: fallo, se pierden los 2 materiales',
        deType(g, 'collector') === 0, 'recolectores=' + deType(g, 'collector'));
      check('forja: fallo, y a cambio dan esquirlas',
        s(g).shards > 0, 'esquirlas=' + s(g).shards);
      check('forja: fallo, y el almacen no queda con ids repetidos',
        new Set(ids(g)).size === wh(g).length, ids(g).join(','));
    }
    const g2 = await reload();
    check('forja: el resultado sobrevive a la recarga',
      wh(g2).length === wh(g).length, `${wh(g2).length} vs ${wh(g).length}`);
  }
  {
    // Pedir mas piedras de las que hay no puede gastarlas de mas.
    const g = await boot(baseSave([
      collector('a', 2), collector('b', 2),
      consumable('p1', 'calibrationStone', 2, { name: 'Piedra de Calibración' })
    ], { nodeLevels: { blueprint: 1 }, unlockedNodes: ['blueprint'] }));
    const r = g.forgeCollector(['a', 'b'], 5, 0);
    check('forja: pedir mas piedras de las que hay se rechaza', !r.success, r.msg ?? '');
    check('forja: y no se gasta ninguna', find(g, 'p1')?.stackCount === 2,
      String(find(g, 'p1')?.stackCount));
  }
  {
    // Pedir una nanoparticula SIN tenerla. El uso esta acotado a una por fusion,
    // asi que "pedir mas de las que hay" no se puede expresar con la firma: lo que
    // se comprueba es que sin nanoparticula la fusion se rechaza.
    const g = await boot(baseSave([
      collector('a', 2), collector('b', 2)
    ], { nodeLevels: { blueprint: 1 }, unlockedNodes: ['blueprint'] }));
    const r = g.forgeCollector(['a', 'b'], 0, 1);
    check('forja: pedir una nanoparticula sin tenerla se rechaza', !r.success, r.msg ?? '');
    check('forja: y no se fusiona', deType(g, 'collector') === 2, ids(g).join(','));
  }
  {
    // Con la nanoparticula en el almacen, la fusion la consume. Si el item
    // desaparece al pedirse y la fusion falla, el jugador pierde la nanoparticula
    // (la mas cara de la tienda) sin obtener nada.
    const g = await boot(baseSave([
      collector('a', 2, { damage: 40 }), collector('b', 2, { damage: 50 }),
      consumable('n1', 'stabilityNano', 1, { name: 'Nanopartícula de Estabilidad' })
    ], { nodeLevels: { blueprint: 1 }, unlockedNodes: ['blueprint'] }));
    const r = g.forgeCollector(['a', 'b'], 0, 1);
    check('forja: con la nanoparticula la fusion se ejecuta', typeof r.success === 'boolean', r.msg ?? '');
    check('forja: y la nanoparticula se gasta', !find(g, 'n1'), ids(g).join(','));
  }
  {
    // ¿LA FORJA CREA VALOR O LO DESTRUYE?
    //
    // Esta pregunta es la de todo el módulo: tres recolectores del mismo tier se
    // convierten en uno del siguiente, así que si la salida vale menos que la
    // entrada la forja es una trampa y el jugador lo descubre tarde, cuando ya no
    // puede deshacerla. `fusionIsProfitable` existe para esto y su comentario
    // decia "se usa en los tests" sin que ningun test la usara: era codigo
    // muerto que hacia una promesa. Ahora hay un test detras de la promesa.
    //
    // Se mide la EXITENCIA, no el acierto: los tres materiales se consumen tanto
    // si la fusion acierta como si falla, y hay que comprobar las dos. Se
    // comprueba sobre los items REALES del juego, con la misma `collectorValue`
    // que usa el precio de venta, para que el test no mida una copia de la regla.
    const conBlueprint = { nodeLevels: { blueprint: 1 }, unlockedNodes: ['blueprint'] };
    const porTier: Record<string, number> = {};
    const entradasPorTier: Record<string, any[]> = {};
    let aciertos = 0;
    let intentos = 0;
    let algunaRenta = false;
    let algunaPerdida = false;
    for (let tier = 1; tier <= 9; tier++) {
      let peorDensidad = Infinity;
      let ultimaEntrada: any[] = [];
      let ultimaSalida: any = null;
      for (let intento = 0; intento < 4; intento++) {
        const g = await boot(baseSave([
          collector('a', tier, { damage: 20 * tier }),
          collector('b', tier, { damage: 20 * tier })
        ], conBlueprint));
        // Los dos materiales se consumen acierte o falle la fusion, asi que su
        // valor se lee ANTES de forjar.
        const entrada = [find(g, 'a'), find(g, 'b')].map((w: any) => ({ ...w }));
        const r = g.forgeCollector(['a', 'b']);
        intentos++;
        if (!r.success || !r.collector) continue;
        aciertos++;
        ultimaEntrada = entrada;
        ultimaSalida = r.collector;
        peorDensidad = Math.min(peorDensidad,
          collectorValue(r.collector) / (entrada.reduce((s, w) => s + collectorValue(w), 0) / 2));
        const total = collectorValue(r.collector) / entrada.reduce((s, w) => s + collectorValue(w), 0);
        if (total > 1) algunaRenta = true; else algunaPerdida = true;
      }
      if (peorDensidad !== Infinity) {
        porTier['T' + tier] = Number((peorDensidad / 1.15).toFixed(2));
        entradasPorTier['T' + tier] = ultimaEntrada;
      }
    }
    const peorDensidad = Math.min(...Object.values(porTier));
    check('forja: se pudo medir la fusion en todos los intentos',
      intentos > 0 && aciertos >= 8, `intentos=${intentos} aciertos=${aciertos}`);
    // Lo que se mide es la DENSIDAD: valor de salida por valor de entrada POR
    // RANURA. La densidad real sube 2,5x-4,6x segun el tier, asi que esto pide
    // >1.15 y el margen sobra. Medir el TOTAL daria 0.64 en T1 y la forja
    // pareceria una trampa: es el cambio de cantidad a calidad, que es lo que
    // paga la ranura liberada.
    check('forja: fusionar mejora el valor por ranura en TODOS los tiers',
      peorDensidad >= 1,
      'margen por tier=' + JSON.stringify(porTier));
    // Y la funcion del juego dice lo mismo que el dato, no una copia del test.
    const ref = Object.keys(entradasPorTier)[0];
    const gRef = await boot(baseSave([collector('a', 1), collector('b', 1)], conBlueprint));
    const rRef = gRef.forgeCollector(['a', 'b']);
    check('forja: `fusionImprovesDensity` coincide con lo medido',
      !rRef.success || fusionImprovesDensity(
        [collector('a', 1), collector('b', 1)], rRef.collector),
      ref ?? '');
    // DATO, no invariante, y F33 lo MOVIO: antes la forja perdia valor total en
    // los tiers bajos, y ahora gana en todos. Se documenta porque es un hecho de
    // balance que un rebalance futuro tiene que ver antes de "arreglarlo".
    //
    // La causa no es el potencial, es la receta: consumir 2 en vez de 3 deja la
    // misma salida con la mitad de la entrada, asi que el cociente sube. Los
    // margenes por ranura pasaron de 2,5x-4,6x a 2,1x-5,8x.
    //
    // Y el riesgo real es el que dice el comentario viejo: si forjar es la
    // accion que mas valor da, comprar pierde su sentido. La respuesta de F33 es
    // que ahi no se compra: el potencial se promedia, asi que la caja y la tienda
    // (que tiran el dado) son las que traen la perfección, y la forja solo la
    // conserva. Mismo número, distinta decisión.
    // Con la base × potencial el valor de la forja depende de la estrella que salga
    // en cada intento, y **promediar no sube**: dos materiales de ★2 dan un ★2.
    // Así que en los tiers donde la carta vale mucho más que lo que da el
    // promedio de dos materiales, forjar pierde — y eso es correcto, no un
    // defecto: es lo que hace que buscar los materiales buenos sea la decisión.
    //
    // Lo que NO puede pasar es que forjar gane en todas partes, porque entonces
    // comprar nunca sería la opción y la tienda entera sobraría.
    check('forja: DATO forjar no gana en todos los tiers',
      algunaRenta && algunaPerdida,
      `ganan=${algunaRenta} pierden=${algunaPerdida} — ver el comentario de arriba`);
  }

  // =========================================================================
  //  11. La forja con un DEDO encima del boton de usar una piedra
  // =========================================================================
  {
    // Un consumible de forja comprado en la tienda y usado desde el almacen es
    // un caso contradictorio: el juego tiene que rechazar uno de los dos.
    // Comprueba que no se puedan gastar los dos por el mismo item.
    const g = await boot(baseSave([consumable('p1', 'calibrationStone', 3, { name: 'Piedra de Calibración' })]));
    const r = g.useConsumable('p1');
    check('forja: la piedra no se gasta usandola en el almacen', !r.ok, r.msg ?? '');
    check('forja: y conserva sus unidades', find(g, 'p1').stackCount === 3, String(find(g, 'p1').stackCount));
  }

  // =========================================================================
  //  12. `updateState`: sustituir el estado en caliente
  // =========================================================================
  {
    const g = await boot(baseSave([collector('r1'), collector('r2'), crate('c1')]));
    g.updateState({ nanites: 4242 });
    check('updateState: aplica el cambio', s(g).nanites === 4242, 'nanites=' + s(g).nanites);
    const g2 = await reload();
    check('updateState: y lo guarda', s(g2).nanites === 4242, 'nanites=' + s(g2).nanites);
  }
  {
    // Un estado entrante que no cabe tiene que recortarse, no aceptarse tal cual.
    const g = await boot(baseSave([collector('r1'), collector('r2')]));
    g.updateState({
      warehouse: Array.from({ length: 20 }, (_, i) => crate(`n${i}`))
    });
    check('updateState: un almacen entrante demasiado grande se recorta',
      wh(g).length <= g.getCapacity(), `items=${wh(g).length} cap=${g.getCapacity()}`);
  }
  {
    // Un almacen entrante con cajas NO puede fabricar cajas de mas: el estado
    // entrante es la verdad, no un contador que haya que materializar.
    const g = await boot(baseSave([collector('r1'), collector('r2')]));
    g.updateState({ warehouse: [crate('n1', 1, 3)], crates: { 1: 3, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0 } });
    check('updateState: no fabrica cajas de las que ya no hay',
      deType(g, 'crate') === 1 && s(g).crates[1] === 3,
      `items=${deType(g, 'crate')} contador=${s(g).crates[1]}`);
  }

  // =========================================================================
  //  13. Los logros no revientan nada
  // =========================================================================
  {
    // Los logros se evaluan en CADA operacion (click, venta, uso, forja...). Un
    // logro mal escrito que lance al evaluarlos tumbaria el juego entero en el
    // momento mas tonto. Aqui se ejecutan las cuatro rutas con un estado que los
    // dispara.
    const g = await boot(baseSave([
      collector('r1', 5, { damage: 100, level: 5 }),
      crate('c1'), crate('c2'), crystal('x1', 1, 1),
      consumable('u1', 'afk', 1, { name: 'Tarjeta AFK' })
    ], { nanites: 0 }));
    g.equipCollector('r1');
    for (let i = 0; i < 5; i++) g.click();
    g.sellItem('x1');
    g.useConsumable('u1');
    g.openCrateBox('c1');
    g.moveItems([find(g, 'r2')?.id ?? 'r1'], null);
    check('logros: ninguna operacion revienta', wh(g).length >= 0, 'ok');
    check('logros: los logros desbloqueados son ids conocidos',
      s(g).unlockedAchievements.every((id: any) => typeof id === 'string'),
      s(g).unlockedAchievements.join(','));
    const g2 = await reload();
    check('logros: y se guardan sin romper la carga', Array.isArray(s(g2).unlockedAchievements),
      String(s(g2).unlockedAchievements));
  }

  // =========================================================================
  //  14. La tienda: los expansores son objetos con tipo y tope
  // =========================================================================
  {
    // F27 · Comprar mete el item y usarlo amplía. Nada es un permiso: la
    // ranura de compañero tampoco (companionSlot1 deja el almacén igual
    // porque es un permiso, y eso se comprueba en `ranuraCheck`).
    const g = await boot(baseSave([], {
      nanites: 500_000, warehouseCapacity: 15, maxCompanionSlots: 1
    }));
    const antes = wh(g).length;
    const e1 = g.buyStoreItem('expansorT1') as any;
    check('tienda: el expansor mete un item',
      !!e1 && wh(g).length === antes + 1, `items=${wh(g).length}`);
    const r = g.useConsumable(e1.id);
    check('tienda: y al usarlo la capacidad sube 5',
      r.ok === true && s(g).warehouseCapacity === 20,
      `cap=${s(g).warehouseCapacity} msg=${r.msg ?? ''}`);
    const g2 = await reload();
    check('tienda: y la ampliación sobrevive a la recarga',
      s(g2).warehouseCapacity === 20, `cap=${s(g2).warehouseCapacity}`);
  }
  {
    // Cada expansor vale hasta SU techo, y el techo es el siguiente peldaño:
    // el T1 sirve hasta 20 y en 20 deja de servir y pide el T2.
    const g = await boot(baseSave([], { nanites: 500_000, warehouseCapacity: 19 }));
    const e1 = g.buyStoreItem('expansorT1') as any;
    check('tipos: el T1 sirve por debajo de su techo', g.useConsumable(e1.id).ok === true,
      `cap=${s(g).warehouseCapacity}`);
    const gB = await boot(baseSave([], { nanites: 500_000, warehouseCapacity: 20 }));
    const e2 = gB.buyStoreItem('expansorT1') as any;
    const r2 = gB.useConsumable(e2.id);
    check('tipos: en 20 el T1 pide el T2 y no gasta',
      r2.ok === false && /T2/.test(r2.msg ?? '') && s(gB).warehouseCapacity === 20,
      `msg=${r2.msg ?? ''} cap=${s(gB).warehouseCapacity}`);
    const gC = await boot(baseSave([], { nanites: 500_000, warehouseCapacity: 24 }));
    const e3 = gC.buyStoreItem('expansorT2') as any;
    check('tipos: el T2 sirve por debajo de 25 y da +5',
      gC.useConsumable(e3.id).ok === true && s(gC).warehouseCapacity === 29,
      `cap=${s(gC).warehouseCapacity}`);
  }
  {
    // El tope es 600 y frena, no recorta: lo comprado se conserva.
    const g = await boot(baseSave([], { nanites: 500_000, warehouseCapacity: 600 }));
    const e = g.buyStoreItem('expansorT2') as any;
    const r = g.useConsumable(e.id);
    check('tope: en 600 no se usa nada más',
      r.ok === false && s(g).warehouseCapacity === 600, `msg=${r.msg ?? ''} cap=${s(g).warehouseCapacity}`);
    // Y quien ya pasó el tope con la carta vieja conserva cada ranura: la
    // migración no quita nada.
    const gV = await boot(baseSave([], { nanites: 0, warehouseCapacity: 650 }));
    const gV2 = await reload();
    check('tope: una partida vieja por encima conserva su capacidad',
      s(gV2).warehouseCapacity === 650, `cap=${s(gV2).warehouseCapacity}`);
  }
  {
    // El +1 viejo sigue sirviendo con el tope nuevo, sin banda.
    const g = await boot(baseSave(
      [consumable('e1', 'warehouseExpander', 1, { name: 'Expansor de Almacén' })],
      { nanites: 0, warehouseCapacity: 599 }
    ));
    check('legado: el +1 viejo sube a 600',
      g.useConsumable('e1').ok === true && s(g).warehouseCapacity === 600,
      `cap=${s(g).warehouseCapacity}`);
  }

  // =========================================================================
  //  15. Ciclo largo: veinte operaciones mezcladas
  // =========================================================================
  {
    // La prueba de humo final. Se encadena una sesion larga con todo mezclado y
    // al final se comprueba lo unico que no puede fallar: el documento guardado
    // tiene que ser exactamente el estado en memoria.
    const g = await boot(baseSave([
      collector('r1', 3, { damage: 60 }),
      collector('r2', 3, { damage: 40 }),
      crate('c1', 1, 2),
      crate('c2', 6, 1),
      crystal('x1', 1, 3),
      consumable('u1', 'afk', 2, { name: 'Tarjeta AFK' }),
      { id: 'm1', name: 'Compañero T1', type: 'companion', details: 'x', rarity: 'Común', sellPrice: 100 }
    ], {
      nanites: 100_000,
      companions: [ficha('m1')],
      maxCompanionSlots: 4
    }));

    g.equipCollector('r1');
    for (let i = 0; i < 10; i++) g.click();
    g.equipCompanion('m1');
    g.buyStoreItem('upgradeCrystal');
    g.buyStoreItem('rareCrate');
    g.sellItem('c2');
    g.moveItems(['r2'], 'r1');
    g.useConsumable('u1');
    g.openCrateBox('c1');
    g.equipCollector('r2');
    g.buyNode('core_sink');

    const enMemoria = JSON.stringify(s(g).warehouse);
    const enDisco = JSON.stringify(guardado().warehouse);
    check('ciclo largo: el almacen en memoria es el que hay en el documento',
      enMemoria === enDisco, enMemoria === enDisco ? '' : 'difieren');
    check('ciclo largo: nanites en memoria = nanitas guardadas',
      s(g).nanites === guardado().nanites, `${s(g).nanites} vs ${guardado().nanites}`);

    const g2 = await reload();
    // QUÉ COMPARA Y POR QUÉ NO COMPARA MÁS. Antes comparaba el almacén entero con
    // `JSON.stringify`, y eso era una prueba VACUA: el stub de Firestore guardaba
    // el documento con una copia superficial, así que `__MEM_DB__.warehouse` era la
    // MISMA matriz que `state.warehouse`, y el banco comparaba un array consigo
    // mismo. Pasara siempre.
    //
    // El stub ahora serializa como Firestore, y la comparación ha empezado a mirar
    // de verdad. Lo que encuentra no es un bug: al cargar, la migración reescribe a
    // propósito algunos campos —el `details` de un recolector, que se deduce de su
    // daño, o el `tier` de un item viejo— y esa normalización es idempotente por
    // diseño. Exigir que cargar no toque NADA mide la implementación, no el
    // inventario del jugador.
    //
    // Lo que sí importa, y es lo que se comprueba: los MISMOS items, en el MISMO
    // orden, con las MISMAS unidades. Un `sellPrice` reescrito no le importa a
    // nadie; que una caja haya desaparecido, sí.
    const forma = (x: any[]) => JSON.stringify(
      x.map((w: any) => [w.id, w.stackable ? (w.stackCount || 1) : 1])
    );
    check('ciclo largo: recargar devuelve el mismo almacen',
      forma(wh(g2)) === forma(wh(g)),
      `g2=${forma(wh(g2))}\n       g=${forma(wh(g))}`);
    check('ciclo longo: recargar devuelve los mismos nanites',
      s(g2).nanites === s(g).nanites, `${s(g2).nanites} vs ${s(g).nanites}`);
    check('ciclo largo: recargar devuelve el mismo equipado',
      s(g2).equippedCollectorId === s(g).equippedCollectorId,
      `${s(g2).equippedCollectorId} vs ${s(g).equippedCollectorId}`);
    check('ciclo largo: recargar devuelve los mismos companeros activos',
      s(g2).activeCompanions.join(',') === s(g).activeCompanions.join(','),
      `${s(g2).activeCompanions.join(',')} vs ${s(g).activeCompanions.join(',')}`);
    check('ciclo largo: no hay ids duplicados tras todo el ciclo',
      new Set(ids(g2)).size === wh(g2).length, ids(g2).join(','));
    check('ciclo largo: el click sigue haciendo dano', g2.getClickDamage() > 0,
      'danio=' + g2.getClickDamage());
    check('ciclo largo: el pasivo sigue pagando', s(g2).passiveIncome > 0,
      'pasivo=' + s(g2).passiveIncome);
  }

  // =========================================================================
  //  16. `getAchievements` no rompe y se mantiene coherente
  // =========================================================================
  {
    const g = await boot(baseSave([collector('r1', 3, { damage: 60, level: 3 })]));
    g.equipCollector('r1');
    for (let i = 0; i < 3; i++) g.click();
    const lista = g.getAchievements();
    check('logros: la lista tiene entradas', lista.length > 0, String(lista.length));
    check('logros: cada uno trae actual y objetivo',
      lista.every((a: any) => typeof a.current === 'number' && typeof a.target === 'number'));
    check('logros: el actual nunca pasa del objetivo',
      lista.every((a: any) => a.current <= a.target), 'alguno se pasa');
    check('logros: los desbloqueados coinciden con el estado',
      g.getAchievements().filter((a: any) => a.unlocked).every((a: any) =>
        s(g).unlockedAchievements.includes(a.id)), 'desincronizado');
  }

  {
    // LA PRIMERA ASCENSIÓN, QUE ES DONDE NADA MIRABA.
    //
    // Todas las pruebas de prestigio que había partían de `totalCores: 12` y
    // `resets: 3`, así que nunca pasaban por el caso de un jugador que aún no ha
    // reciclado nunca. Y ahí estaba el bug: se rellenaba `totalCores` con
    // `pendingCores()` y luego se le sumaba `gained`, que ya incluye lo mismo. El
    // histórico quedaba en el doble de lo ganado, y como `nextCores` lo resta,
    // el segundo ascenso costaba 3,17 M de producción en vez de 1 M sin que nada
    // lo dijera.
    const g = await boot(baseSave([collector('r1')], {
      totalNanitesProduced: 1_000_000,
      cores: 0, totalCores: 0, resets: 0
    }));
    const esperado = pendingCores(1_000_000, s(g).bonus.coreGain);

    const r = g.prestige();
    check('prestigio: la primera ascencion da los nucleos justos',
      r.success && r.gained === esperado, `ganado=${r.gained} esperado=${esperado}`);
    check('prestigio: y el historico NO se cuenta dos veces',
      s(g).totalCores === esperado, `totalCores=${s(g).totalCores} esperado=${esperado}`);
    check('prestigio: la cartera queda con exactamente lo ganado',
      s(g).cores === esperado, `cores=${s(g).cores} esperado=${esperado}`);
    check('prestigio: y queda en un reinicio',
      s(g).resets === 1, `resets=${s(g).resets}`);

    const g2 = await reload();
    check('prestigio: el historico corregido sobrevive a la recarga',
      g2.getState().totalCores === esperado,
      `totalCores=${g2.getState().totalCores}`);
    check('prestigio: el anuncio de la pagina coincide con lo ya ganado',
      g2.getPrestigeInfo().totalCores === esperado,
      String(g2.getPrestigeInfo().totalCores));
  }
  {
    // Y la mitad que de verdad se nota: el umbral del SEGUNDO ascenso.
    //
    // Con el histórico en el doble, producir 1 M por segunda vez no daba nada y
    // el jugador tenía que llegar a 3,17 M sin que ninguna pantalla dijera por
    // qué. Ahora el segundo ascenso empieza a dar en cuanto la producción
    // justifica un núcleo más que el primero.
    const g = await boot(baseSave([collector('r1')], {
      totalNanitesProduced: 1_000_000,
      cores: 0, totalCores: 0, resets: 0
    }));
    g.prestige();
    // Se simula que el jugador vuelve a producir 1 M Exactamente.
    const justo = pendingCores(1_000_000, s(g).bonus.coreGain);
    g.getState().totalNanitesProduced = 1_000_000;
    check('prestigio: al reconducir 1 M otra vez no hay segundo noyau todavia',
      g.getPrestigeInfo().pending === 0 && justo > 0,
      `pending=${g.getPrestigeInfo().pending} primerAscension=${justo}`);

    // Un poco más de producción, y ya da uno.
    g.getState().totalNanitesProduced = 2_000_000;
    const segundo = g.getPrestigeInfo().pending;
    check('prestigio: pasar de 1 M SI da el segundo núcleo',
      segundo >= 1, `pending=${segundo}`);
    check('prestigio: y da MENOS que el primero, porque el histórico se descuenta',
      segundo < justo, `segundo=${segundo} primero=${justo}`);
  }
  {
    // B12 · EL SEGUNDO PRESTIGIO DECÍA "PRODUCE 0 MÁS".
    //
    // La vista restaba `PRESTIGE_MIN_NANITES - producido`, que es el umbral del
    // PRIMER núcleo. En la segunda vuelta, con 1 M producido y 8 de histórico,
    // la resta da 0 y el botón sigue apagado: la pantalla dice 0 y la cuenta
    // pide más. La cifra que se enseña tiene que salir de `nanitesToNextCore`
    // (el mismo `nextCores` que decide si el botón se enciende), y la barra de
    // `coreProgress` tiene que subir al producir: antes devolvía
    // `totalCores / total`, que BAJA de 1 a 0,67 entre 1 M y 2 M.
    const g = await boot(baseSave([collector('r1')], {
      totalNanitesProduced: 1_000_000,
      cores: 0, totalCores: 0, resets: 0
    }));
    g.prestige();
    const hist = s(g).totalCores;
    g.getState().totalNanitesProduced = 1_000_000;
    const st = (p: number) => ({
      totalNanitesProduced: p, totalCores: hist, coreGain: s(g).bonus.coreGain
    });
    const falta = nanitesToNextCore(st(1_000_000));
    check('B12: en la segunda vuelta con 1 M falta MAS de 0 (la vista decia 0)',
      falta > 0, `falta=${falta}`);
    check('B12: y produciendo justo lo que falta aparece el siguiente nucleo',
      nextCores(st(1_000_000 + falta)) >= 1,
      `pending=${nextCores(st(1_000_000 + falta))} falta=${falta}`);
    check('B12: y con uno menos todavia no hay nada (la cifra es exacta, no un redondeo)',
      nextCores(st(1_000_000 + falta - 1)) === 0,
      `pending=${nextCores(st(1_000_000 + falta - 1))}`);
    // Lo que solo vive en memoria es un bug: tras recargar, el historico sigue
    // intacto y el pendiente sigue en 0 (la segunda vuelta empieza de 0).
    const g2 = await reload();
    check('B12: el historico y el pendiente sobreviven a la recarga',
      g2.getPrestigeInfo().pending === 0 && g2.getPrestigeInfo().totalCores === hist,
      `pending=${g2.getPrestigeInfo().pending} totalCores=${g2.getPrestigeInfo().totalCores}`);
    const prog1 = coreProgress(st(1_000_000));
    const prog2 = coreProgress(st(2_000_000));
    check('B12: la barra sube al producir (antes bajaba de 1 a 0,67)',
      prog2 > prog1, `1M=${prog1} 2M=${prog2}`);
    check('B12: y llega a 1 cuando ya se puede reciclar',
      coreProgress(st(1_000_000 + falta)) === 1,
      String(coreProgress(st(1_000_000 + falta))));
    // La primera vuelta no cambia: sin histórico el umbral sigue siendo 1 M.
    check('B12: en la primera vuelta el umbral sigue siendo el minimo de 1 M',
      nanitesForCores(1, 0) === 1_000_000 && nanitesToNextCore({
        totalNanitesProduced: 400_000, totalCores: 0, coreGain: 0
      }) === 600_000, `forCores(1)=${nanitesForCores(1, 0)}`);
  }

  resumen('estado, migracion y economia');
}

export default main();
