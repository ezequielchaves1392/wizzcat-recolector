// ==========================================================================
//  F97 Lote 2b · LOS CUATRO KEYSTONES, UNO POR RAMA
//
//  Son la maestría de cada rama, no un número más: Sobrecarga (Asalto),
//  Mente Colmena (Manada), Jackpot (Fortuna) y Obra Maestra (Forja). Cada uno
//  trae UNA mecánica con sus cifras dentro del bonus —la descripción las
//  nombra y `leyendaCheck` las ata—, y todos son de un solo nivel.
//
//  Lo que se comprueba aquí es la mecánica, no el catálogo (eso ya lo atan
//  `arbolLoreCheck` para la estructura y `leyendaCheck` para los textos).
// ==========================================================================

import { boot, recargar, check, resumen, s, baseSave, collector, conRoll } from './kit';
import { attemptForge, attemptForgeCompanion, esObraMaestra, danioDeRango } from '../src/data/crafting';
import { aplicarJackpot } from '../src/components/crateLoot';
import { AFIX_MIN_POR_RARIDAD } from '../src/data/crafting';

const opts = (extra: any = {}) => ({
  craftLuck: 0, consolationBonus: 0, stonesUsed: 0, nanoUsed: 0, eterUsed: 0, ...extra
});

async function main() {
  // -------------------------------------------------------------------------
  //  1. SOBRECARGA: CADA 50 CLICS, EL SIGUIENTE CRITICA x3
  // -------------------------------------------------------------------------
  //  Tuyos y autos comparten contador, y el asegurado manda sobre el dado. Sin
  //  el nodo el contador no se mueve: uno que corriera sin premio daría el
  //  asegurado en la primera compra. La partida se monta rica para que ningún
  //  logro se desbloquee a mitad y mueva las cifras: lo que se compara son
  //  clics adyacentes con el mismo estado.
  {
    const montar = (conNodo = true) => boot(baseSave(
      [collector('w', 3, { damage: 60, rarity: 'Común' })],
      {
        nanites: 5_000_000_000, totalNanitesProduced: 5_000_000_000,
        equippedCollectorId: 'w',
        unlockedAchievements: ['first_click'],
        nodeLevels: conNodo ? { sobrecarga: 1 } : {}
      }
    ));
    const g = await montar();
    const cantidades: number[] = [];
    const marcas: boolean[] = [];
    await conRoll(0.999, async () => {
      for (let i = 0; i < 51; i++) {
        const r: any = g.click();
        cantidades.push(r.cantidad);
        marcas.push(r.critico === true);
      }
    });
    const c = cantidades[48];
    check('sobrecarga: los 49 primeros pegan lo mismo, sin asegurado',
      c > 0 && cantidades.slice(0, 49).every(v => v === c) && marcas.slice(0, 49).every(m => m === false),
      `c=${c} marcas=${marcas.slice(0, 49).filter(Boolean).length}`);
    check('sobrecarga: y el 50 pega el triple y va marcado',
      cantidades[49] === c * 3 && marcas[49] === true,
      `c50=${cantidades[49]} esperado=${c * 3}`);
    check('sobrecarga: el 51 vuelve a lo normal (el contador se resetea)',
      cantidades[50] === c && marcas[50] === false,
      `c51=${cantidades[50]}`);

    // Y el contador sobrevive a la recarga: la piedad que se pierde al
    // recargar no es piedad, es un contador de sesión. `recargar()` vuelca y
    // espera lo que `flush()` solo promete (kit): sin la espera, la lectura
    // llegaría antes que la escritura y la prueba mediría la carrera.
    //
    // **Y LA BASE SALE DEL MISMO JUEGO, NO DE UNO FRESCO.** La migración
    // sortea la base oculta al cargar (±10 % de daño): dos arranques del mismo
    // fixture pegan distinto, así que comparar con otro juego es medir el
    // sorteo. El 49.º clic de antes de recargar es la base del de después.
    const g2 = await montar();
    let previo = 0;
    await conRoll(0.999, async () => {
      for (let i = 0; i < 49; i++) previo = (g2.click() as any).cantidad;
    });
    const g3 = await recargar(g2);
    const tras = await conRoll(0.999, async () => (g3.click() as any).cantidad);
    check('sobrecarga: tras recargar con 49, el siguiente es el asegurado',
      tras === previo * 3, `tras=${tras} previo=${previo}`);

    // Y sin el nodo no hay asegurado en 50 clics: el contador no corre.
    const g0 = await montar(false);
    const sin: number[] = [];
    await conRoll(0.999, async () => {
      for (let i = 0; i < 50; i++) sin.push(((g0 as any).click() as any).cantidad);
    });
    check('sobrecarga: sin el nodo, 50 clics pagan lo mismo',
      new Set(sin).size === 1, `distintos=${new Set(sin).size}`);
  }

  // -------------------------------------------------------------------------
  //  2. MENTE COLMENA: CADA ACTIVO DA +4 % A LOS DEMÁS
  // -------------------------------------------------------------------------
  //  Con N produciendo, el total multiplica por 1 + 0,04×(N−1). Va sobre el
  //  total para no romper el reparto exacto por compañero (los floors no
  //  suman). Con 0 o 1 no hay "demás" y no suma nada. Potencial 3 y rareza
  //  Común dan multiplicador 1 exacto: la cuenta es entera y el banco la clava
  //  sin tolerancias.
  {
    const comp = (id: string) => ({
      id, name: id, type: 'passive', power: 100, level: 0,
      rarity: 'Común', potential: 3
    });
    const base = { nanites: 0, totalNanitesProduced: 0 };
    // F97 · `primera_maestria` (+3 % pasivo) se desbloquea al comprar colmena,
    // que ES un keystone. Sin fijarlo, el lado con nodo mediría colmena+logro
    // y el lado sin nodo solo colmena: el test mediría dos cosas. Con el logro
    // desbloqueado en los tres, el +3 % es constante y lo que se compara es
    // solo la colmena (103 de base: 100 × 1,03).
    const conLogro = { unlockedAchievements: ['primera_maestria'] };
    const g1: any = await boot(baseSave([], {
      ...base, ...conLogro, companions: [comp('a')], activeCompanions: ['a'],
      nodeLevels: { colmena: 1 }
    }));
    check('colmena: con uno solo no hay demas y no suma nada',
      s(g1).passiveIncome === 103, `ingreso=${s(g1).passiveIncome}`);
    const g2: any = await boot(baseSave([], {
      ...base, ...conLogro, companions: [comp('a'), comp('b')], activeCompanions: ['a', 'b'],
      nodeLevels: {}
    }));
    const g3: any = await boot(baseSave([], {
      ...base, ...conLogro, companions: [comp('a'), comp('b')], activeCompanions: ['a', 'b'],
      nodeLevels: { colmena: 1 }
    }));
    check('colmena: sin el nodo, dos de 100 dan 206 con el logro',
      s(g2).passiveIncome === 206, `ingreso=${s(g2).passiveIncome}`);
    check('colmena: y con el nodo, 206 por 1,04',
      s(g3).passiveIncome === 214, `ingreso=${s(g3).passiveIncome}`);
  }

  // -------------------------------------------------------------------------
  //  3. JACKPOT: UN TIER MÁS DESPUÉS DEL SORTEO
  // -------------------------------------------------------------------------
  //  Es una segunda tirada, no una entrada de la tabla: el salto mide lo mismo
  //  con nodo que sin él. No se apila sobre el salto, no toca exclusivos ni
  //  nanitas, y en T10 no hay tier por encima.
  {
    const rec = (tier: number, type = 'collector', extra: any = {}) => ({
      kind: type === 'collector' ? 'collector' : 'companion',
      name: 'X', label: 'X', details: 'x', rarity: 'Raro', icon: type, tier,
      exclusive: false,
      item: { id: 'i', name: 'X', type, tier, ...extra }
    });
    const sin = aplicarJackpot(1 as any, rec(5) as any, 0, () => 0);
    check('jackpot: sin nodo no se toca nada',
      (sin as any).tier === 5 && (sin.item as any).tier === 5 && !(sin as any).jackpot,
      `tier=${(sin.item as any).tier}`);
    const con = aplicarJackpot(1 as any, rec(5) as any, 1, () => 0) as any;
    check('jackpot: con el nodo al máximo, el recolector sube un tier',
      con.tier === 6 && con.item.tier === 6 && con.jackpot === true,
      `tier=${con.tier} jackpot=${con.jackpot}`);
    check('jackpot: y trae los afijos de su rareza nueva, no los del viejo',
      Array.isArray(con.item.affixes)
        && con.item.affixes.length === ((AFIX_MIN_POR_RARIDAD as any)[con.item.rarity] ?? -1),
      `rareza=${con.item.rarity} afijos=${JSON.stringify(con.item.affixes)}`);
    const comp = aplicarJackpot(1 as any, rec(5, 'companion') as any, 1, () => 0) as any;
    check('jackpot: y el compañero también sube',
      comp.tier === 6 && comp.item.tier === 6 && comp.jackpot === true,
      `tier=${comp.tier}`);
    const techo = aplicarJackpot(10 as any, rec(10) as any, 1, () => 0) as any;
    check('jackpot: en T10 no hay tier por encima y no hace nada',
      techo.item.tier === 10 && !techo.jackpot, `tier=${techo.item.tier}`);
    const excl2 = aplicarJackpot(1 as any, { ...rec(5), exclusive: true } as any, 1, () => 0) as any;
    check('jackpot: un exclusivo no se convierte en generico',
      excl2.item.tier === 5 && !excl2.jackpot, `tier=${excl2.item.tier}`);
    const salto = aplicarJackpot(1 as any, { ...rec(5), up: true } as any, 1, () => 0) as any;
    check('jackpot: no se apila sobre el salto',
      salto.item.tier === 5 && !salto.jackpot, `tier=${salto.item.tier}`);
    const nanis = aplicarJackpot(1 as any, { kind: 'nanites', amount: 5 } as any, 1, () => 0) as any;
    check('jackpot: las nanitas no son un item y no se tocan',
      nanis.amount === 5 && !nanis.jackpot, `amount=${nanis.amount}`);

    // Y el cableado: abrir una caja con el nodo no rompe la apertura.
    const g: any = await boot(baseSave(
      [{ id: 'caja', name: 'Caja T5', type: 'crate', details: 'x', rarity: 'Épico', tier: 5, stackable: true, stackCount: 1 } as any],
      { warehouseCapacity: 30, nodeLevels: { jackpot: 1 } }
    ));
    const r: any = await conRoll(0.5, async () => g.openCrateBox('caja'));
    check('jackpot: abrir con el nodo comprado abre igual',
      r.ok === true, r.msg ?? 'sin mensaje');
  }

  // -------------------------------------------------------------------------
  //  4. OBRA MAESTRA: DOS ★5 EN UN ★5, CON EL NODO
  // -------------------------------------------------------------------------
  //  Tres condiciones y no una: el nodo, los dos padres en ★5 y el resultado
  //  en ★5. Un 4 con un 5 que sube por Éter es afortunado, no obra.
  {
    check('obra: las tres condiciones juntas dan obra',
      esObraMaestra([{ potential: 5 }, { potential: 5 }], 5, true) === true, '5+5→5 con nodo');
    check('obra: sin el nodo no hay firma aunque todo lo demás cuadre',
      esObraMaestra([{ potential: 5 }, { potential: 5 }], 5, false) === false, 'sin nodo');
    check('obra: un 4 con un 5 es afortunado, no obra',
      esObraMaestra([{ potential: 4 }, { potential: 5 }], 5, true) === false, '4+5');
    check('obra: y si el resultado no llega a ★5 tampoco',
      esObraMaestra([{ potential: 5 }, { potential: 5 }], 4, true) === false, 'resultado 4');
    check('obra: un item viejo sin potencial cuenta como ★3 y no dispara',
      esObraMaestra([{}, {}], 5, true) === false, 'sin potencial');

    const padre = (id: string) => collector(id, 3, {
      potential: 5, damage: danioDeRango(3, 5), rarity: 'Raro'
    });
    const r = conRoll(0, () => attemptForge([padre('o1'), padre('o2')], 3, 'X', opts({ obraMaestra: 1 })));
    check('obra: dos ★5 con el nodo firman el recolector',
      r.success === true && (r.collector as any)?.obraMaestra === true
        && String((r.collector as any)?.name ?? '').endsWith('·Obra Maestra'),
      `obra=${(r.collector as any)?.obraMaestra} nombre=${(r.collector as any)?.name}`);
    const r2 = conRoll(0, () => attemptForge([padre('o3'), padre('o4')], 3, 'X', opts()));
    check('obra: y sin el nodo sale ★5 normal, con Absoluta y sin firma',
      r2.success === true && (r2.collector as any)?.obraMaestra !== true
        && String((r2.collector as any)?.name ?? '').endsWith('·Absoluta'),
      `obra=${(r2.collector as any)?.obraMaestra} nombre=${(r2.collector as any)?.name}`);

    const pc = (id: string) => ({ id, tier: 3, potential: 5 });
    const rc = conRoll(0, () => attemptForgeCompanion([pc('k1'), pc('k2')], 3, opts({ obraMaestra: 1 })));
    check('obra: y el compañero también firma con 5+5 y nodo',
      rc.success === true && (rc.companion as any)?.obraMaestra === true
        && String((rc.companion as any)?.name ?? '').endsWith('·Obra Maestra'),
      `obra=${(rc.companion as any)?.obraMaestra} nombre=${(rc.companion as any)?.name}`);
  }

  resumen('keystones: uno por rama, cada uno con su mecánica');
}

export default main();
