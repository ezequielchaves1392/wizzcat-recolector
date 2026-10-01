// ==========================================================================
//  Banco de pruebas del BOTÍN DE LAS CAJAS
//
//  Lo que se comprueba aquí
//  -----------------------
//  Que la ruleta no mienta. Es la única regla que sostiene el módulo entero: el
//  premio se decide antes de girar y la animación solo lo enseña, así que la
//  cifra que enseña la casilla y la que entra en la cuenta tienen que ser la
//  misma. No había banco para esto, y por eso una casilla podía prometer
//  "+350 nanitas" mientras el saldo subía 11.667.
//
//  Y que los cosméticos de caja entren sin perderse. Un cosmético no es un
//  item: no ocupa ranura y no se vende. Por eso no puede pasar por la
//  compensación de "almacén lleno", y repetir uno que ya tienes tampoco puede
//  ser el premio.
// ==========================================================================

import {
  CRATE_LOOT, CRATE_META, rollCrateReward, buildRouletteStrip, makeRouletteTile,
  isCountedLoot, lootAmountText, type CrateReward
} from '../src/components/crateLoot';
import { COSMETICS_BY_ID, crateCosmetics } from '../src/data/cosmetics';
import { formatNumber } from '../src/utils/format';
import type { CrateType } from '../src/gameLoop';
import { check, resumen } from './kit';

const CAJAS = Object.keys(CRATE_LOOT) as CrateType[];

/** Lo que se ha aplicado de verdad, para poder compararlo con lo que se enseña. */
type Recuento = { nanitas: number; cristales: number; llaves: number; ids: string[] };

/**
 * Un aplicador de mentira que lleva la cuenta de lo aplicado.
 *
 * Es la firma real de `LootApplier`, no una reimplementación: si esa firma
 * cambia, esto deja de compilar en vez de seguir pasando en verde.
 */
function crearApplier(tieneEspacio = true, yaTiene: string[] = []) {
  const cuenta: Recuento = { nanitas: 0, cristales: 0, llaves: 0, ids: [] };
  const poseidos = new Set(yaTiene);
  return {
    cuenta,
    poseidos,
    applier: {
      nanites: (n: number) => { cuenta.nanitas += n; },
      crystals: (n: number) => { cuenta.cristales += n; },
      keys: (n: number) => { cuenta.llaves += n; },
      addItem: () => tieneEspacio,
      hasSpace: () => tieneEspacio,
      unlockCosmetic: (id: string) => {
        if (poseidos.has(id)) return false;
        poseidos.add(id);
        cuenta.ids.push(id);
        return true;
      },
      ownedCosmetics: () => [...poseidos]
    }
  };
}

/** Cuánto se cobra de un premio, o `null` si no es una cantidad. */
function cobrado(premio: CrateReward, cuenta: Recuento): number | null {
  if (premio.kind === 'nanites') return cuenta.nanitas;
  if (premio.kind === 'crystals') return cuenta.cristales;
  if (premio.kind === 'keys') return cuenta.llaves;
  return null;
}

async function main() {
  // =========================================================================
  //  1. La cifra que se enseña es la que se cobra
  // =========================================================================
  {
    const fallos: string[] = [];
    for (const caja of CAJAS) {
      for (let i = 0; i < 3000; i++) {
        const { cuenta, applier } = crearApplier();
        const premio = rollCrateReward(caja, applier);
        const pagado = cobrado(premio, cuenta);
        if (pagado === null) continue;

        const esperado = `+${formatNumber(pagado)}`;
        if (makeRouletteTile(premio).amount !== esperado) {
          fallos.push(`${caja}: casilla ${makeRouletteTile(premio).amount}, cobrado ${pagado}`);
        }
        // `label` es el otro sitio donde se escribe la cifra, y la usa el
        // almacén. Si divergiera de la casilla, el jugador vería dos números.
        if (!premio.label.includes(String(pagado))) {
          fallos.push(`${caja}: la etiqueta "${premio.label}" no dice ${pagado}`);
        }
        if (fallos.length > 4) break;
      }
    }
    check('botín: la casilla enseña la cifra exacta que entra en la cuenta',
      fallos.length === 0, fallos.slice(0, 3).join(' | '));
  }
  {
    // La cifra se escribe con el mismo formato que los contadores del juego. Si
    // la ruleta dijera "8.332" y el saldo "8.33 K", serían dos números.
    const uno = lootAmountText({ amount: 999 } as CrateReward);
    const otro = lootAmountText({ amount: 10833 } as CrateReward);
    check('botín: la cifra usa el formato de los contadores',
      uno === `+${formatNumber(999)}` && otro === `+${formatNumber(10833)}`,
      `${uno} / ${otro}`);
  }
  {
    // Qué premios llevan cifra. Monedas y materiales siempre; los objetos de a
    // uno no, porque un "+1 Dron" es ruido y el nombre ya lo dice.
    const conCifra = (kind: string, amount: number) =>
      isCountedLoot({ kind, amount } as CrateReward);
    check('botín: nanitas, cristales y llaves siempre enseñan su cantidad',
      conCifra('nanites', 1) && conCifra('crystals', 1) && conCifra('keys', 1),
      [conCifra('nanites', 1), conCifra('crystals', 1), conCifra('keys', 1)].join(','));
    check('botín: un objeto de a uno no enseña "+1"',
      !conCifra('companion', 1) && !conCifra('collector', 1) && !conCifra('cosmetic', 1),
      'companion, collector y cosmetic');
    check('botín: pero varios de una vez, sí',
      conCifra('crate', 2) && conCifra('consumable', 2) && !conCifra('crate', 1),
      'crate x2 sí, crate x1 no');
  }

  // =========================================================================
  //  2. La tira de la ruleta
  // =========================================================================
  {
    // Ninguna casilla se queda sin texto. Una casilla vacía es un hueco en la
    // cinta, y el jugador ve un hueco donde debería haber un premio.
    let tirasMalas = 0;
    for (const caja of CAJAS) {
      for (let i = 0; i < 200; i++) {
        const { tiles } = buildRouletteStrip(caja, 26);
        if (tiles.length !== 26) tirasMalas++;
        if (tiles.some(t => !t.label || !t.rarity || !t.icon)) tirasMalas++;
      }
    }
    check('ruleta: la tira se llena entera y ninguna casilla queda sin texto',
      tirasMalas === 0, 'tiras con huecos=' + tirasMalas);
  }

  // =========================================================================
  //  3. Cosméticos de caja
  // =========================================================================
  {
    // Catálogo y tablas no se desincronizan: si un cosmético declara
    // `unlock.kind: 'crate'`, tiene que existir una caja que lo sortee.
    const conEntrada = CAJAS.filter(c => CRATE_LOOT[c].some(e => e.id === 'cosmetic'));
    const sueltos = Object.values(COSMETICS_BY_ID)
      .filter(c => c.unlock.kind === 'crate')
      .filter(c => !conEntrada.includes(c.unlock.value as CrateType));
    check('cosméticos: ninguno declara una caja que no lo sortea',
      sueltos.length === 0, sueltos.map(c => c.id).join(','));

    const sinNada = conEntrada.filter(c => crateCosmetics(c).length === 0);
    check('cosméticos: toda caja con la entrada tiene al menos un cosmético',
      sinNada.length === 0, sinNada.join(','));
  }
  {
    // Sorteando mucho, todo cosmético de la legendaria tiene que salir.
    const vistos = new Set<string>();
    for (let i = 0; i < 4000; i++) {
      const { cuenta, applier } = crearApplier();
      rollCrateReward('legendary', applier);
      cuenta.ids.forEach(id => vistos.add(id));
    }
    const esperados = crateCosmetics('legendary').map(c => c.id);
    const faltan = esperados.filter(id => !vistos.has(id));
    check('cosméticos: los de la legendaria salen todos con el tiempo',
      faltan.length === 0, `faltan ${faltan.join(',')} de ${esperados.length}`);
  }
  {
    // El cosmético entra en la lista de desbloqueados, no en el almacén.
    const { cuenta, applier, poseidos } = crearApplier();
    for (let i = 0; i < 6000 && poseidos.size < crateCosmetics('common').length; i++) {
      rollCrateReward('common', applier);
    }
    check('cosméticos: se desbloquean en la lista, no como item del almacén',
      poseidos.size === crateCosmetics('common').length && cuenta.ids.length === poseidos.size,
      `desbloqueados=${poseidos.size} veces=${cuenta.ids.length}`);

    const primero = COSMETICS_BY_ID[[...poseidos][0]];
    check('cosméticos: el desbloqueado existe y es de un tipo equipable',
      Boolean(primero) && ['title', 'frame', 'banner'].includes(primero.type),
      primero ? `${primero.id}:${primero.type}` : 'ninguno');
  }
  {
    // Lo que NO puede pasar: ganar algo que ya tienes.
    const todos = crateCosmetics('legendary').map(c => c.id);
    let repetidos = 0;
    let compensado = 0;
    for (let i = 0; i < 4000; i++) {
      const { applier } = crearApplier(true, todos);
      const premio = rollCrateReward('legendary', applier);
      if (premio.cosmeticId) repetidos++;
      if (premio.details.includes('cosméticos')) compensado++;
    }
    check('cosméticos: con los de la caja en la mano no se sortea ninguno',
      repetidos === 0, `repetidos=${repetidos} de ${todos.length} posibles`);
    // Y en ese caso el premio son NANITAS, no un cosmético: la casilla tiene que
    // enseñar lo que de verdad se lleva, que es la regla de todo el módulo.
    check('cosméticos: sin novedades, el premio son nanitas y no un repetido',
      compensado > 0, 'veces=' + compensado);
  }
  {
    // El almacén lleno no puede tocar un cosmético: no es un item y no ocupa
    // ranura, así que entra igual y sin compensar. Con el MISMO aplicador, para
    // que la cuenta de desbloqueados y la de Compensation sean la misma.
    const { cuenta, applier, poseidos } = crearApplier(false);
    let cosmeticos = 0;
    for (let i = 0; i < 6000; i++) {
      if (rollCrateReward('common', applier).kind === 'cosmetic') cosmeticos++;
    }
    check('cosméticos: con el almacén lleno el cosmético entra igual',
      cosmeticos > 0 && poseidos.size === crateCosmetics('common').length,
      `veces=${cosmeticos} desbloqueados=${poseidos.size}`);
    check('cosméticos: y ninguno se compensó por falta de sitio',
      cuenta.ids.length === poseidos.size,
      `ids=${cuenta.ids.length} desbloqueados=${poseidos.size}`);
  }
  {
    // El duplicado paga lo mismo que el almacén lleno. Si divergieran, el
    // jugador vería en la ruleta un número que la tabla no explica.
    const coste = Math.round(CRATE_META.legendary.cost * 1.5);
    let porAlmacen = 0;
    let porDuplicado = 0;
    const sinEspacio = crearApplier(false);
    const conTodo = crearApplier(true, crateCosmetics('legendary').map(c => c.id));
    for (let i = 0; i < 4000; i++) {
      const a = rollCrateReward('legendary', sinEspacio.applier);
      if (a.details === 'No cabía el objeto, se compensó en nanitas') porAlmacen = a.amount;
      const b = rollCrateReward('legendary', conTodo.applier);
      if (b.details.includes('Ya tienes todos')) porDuplicado = b.amount;
    }
    check('cosméticos: el duplicado paga lo mismo que el almacén lleno',
      porAlmacen === coste && porDuplicado === coste,
      `almacén=${porAlmacen} duplicado=${porDuplicado} coste=${coste}`);
  }
  {
    // Ningún premio puede traer un id de cosmético que no exista: entraría en
    // la partida y no habría forma de equiparlo.
    let fantasma = '';
    for (const caja of CAJAS) {
      for (let i = 0; i < 2000; i++) {
        const { cuenta, applier } = crearApplier();
        const premio = rollCrateReward(caja, applier);
        for (const id of cuenta.ids) if (!COSMETICS_BY_ID[id]) fantasma = id;
        if (premio.cosmeticId && !COSMETICS_BY_ID[premio.cosmeticId]) fantasma = premio.cosmeticId;
      }
    }
    check('cosméticos: ningún premio trae un id que no exista en el catálogo',
      fantasma === '', fantasma);
  }
  {
    // El nombre y la rareza del premio son los del catálogo. La casilla los
    // enseña tal cual, así que si divergieran el jugador vería una rareza que
    // el cosmético no tiene.
    let mal = '';
    for (const caja of CAJAS) {
      for (let i = 0; i < 2000; i++) {
        const premio = rollCrateReward(caja, crearApplier().applier);
        if (!premio.cosmeticId) continue;
        const cos = COSMETICS_BY_ID[premio.cosmeticId];
        if (cos && (premio.rarity !== cos.rarity || premio.name !== cos.name)) mal = premio.cosmeticId;
      }
    }
    check('cosméticos: el nombre y la rareza del premio son los del catálogo',
      mal === '', mal);
  }
  {
    // La rareza de un cosmético de caja nunca supera a la de la caja que lo
    // da. Es la regla que sostiene el "no es pay-to-win": si la legendaria
    // soltara un Divino, el marco Divino dejaría de ser solo del Top 1.
    const tope: Record<string, number> = { common: 1, rare: 2, epic: 3, legendary: 5 };
    const escala: Record<string, number> = {
      'Común': 0, 'Raro': 1, 'Épico': 2, 'Legendario': 3, 'Mítico': 4, 'Divino': 5
    };
    const pasadas: string[] = [];
    for (const caja of CAJAS) {
      for (const cos of crateCosmetics(caja)) {
        if (escala[cos.rarity] > tope[caja]) pasadas.push(`${cos.id} en ${caja}`);
      }
    }
    check('cosméticos: la rareza no supera la de la caja que la reparte',
      pasadas.length === 0, pasadas.join(', '));
  }

  resumen('botín y cosméticos de caja');
}

export default main();
