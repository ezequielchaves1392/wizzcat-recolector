// ==========================================================================
//  Banco de pruebas del BOTÍN DE LAS CAJAS
//
//  Lo que se comprueba aquí
//  -----------------------
//  Que el cartel no mienta. Es la única regla que sostiene el módulo entero:
//  el premio se decide antes de enseñarse, así que la cifra que enseña el
//  cartel y la que entra en la cuenta tienen que ser la misma. No había banco
//  para esto, y por eso un cartel podía prometer "+350 nanitas" mientras el
//  saldo subía 11.667.
//
//  Y que los cosméticos de caja entren sin perderse. Un cosmético no es un
//  item: no ocupa ranura y no se vende. Por eso no puede pasar por la
//  compensación de "almacén lleno", y repetir uno que ya tienes tampoco puede
//  ser el premio.
// ==========================================================================

import {
  CRATE_LOOT, CRATE_META, rollCrateReward,
  isCountedLoot, lootAmountText, type CrateReward, type LootApplier
} from '../src/components/crateLoot';
import { COSMETICS_BY_ID, crateCosmetics } from '../src/data/cosmetics';
import { formatNumber } from '../src/utils/format';
import type { CrateType } from '../src/gameLoop';
import { check, resumen } from './kit';

// F31 · LAS CAJAS SON LOS NIVELES, no las claves de un objeto. Object.keys de un
// Record con claves numéricas devuelve strings, y una string no abre una caja.
const CAJAS = Object.keys(CRATE_LOOT).map(Number) as CrateType[];

/**
 * Lo que se ha aplicado de verdad, para poder compararlo con lo que se enseña.
 *
 * Sin llaves: las cajas se abren solas, así que ya no hay una cuarta cifra que
 * comprobar y `LootApplier` no tiene ni un `keys` que mandar.
 */
type Recuento = { nanitas: number; cristales: number; ids: string[] };

/**
 * Un aplicador de mentira que lleva la cuenta de lo aplicado.
 *
 * Es la firma real de `LootApplier`, no una reimplementación, y está **anotada**
 * para que siga siéndolo: si esa firma cambia, esto deja de compilar en vez de
 * seguir pasando en verde. Sin la anotación el chequeo de propiedades sobrantes
 * no llegaba —el objeto se devolvía dentro de otro objeto y se pasaba como
 * variable—, que es como una llave se quedó en este banco después de que el
 * juego dejara de tenerlas: compilando, y sin mirar nada.
 */
function crearApplier(tieneEspacio = true, yaTiene: string[] = []) {
  const cuenta: Recuento = { nanitas: 0, cristales: 0, ids: [] };
  const poseidos = new Set(yaTiene);
  const applier: LootApplier = {
    nanites: (n: number) => { cuenta.nanitas += n; },
    crystals: (n: number) => { cuenta.cristales += n; },
    // **DEVUELVE UN OBJETO, NO UN BOOLEANO, Y ESTA LÍNEA SE ROMPIÓ AL CAMBIAR EL
    // CONTRATO.** `addItem` pasó de `boolean` a `{ ok, nanitas? }` para poder distinguir
    // "lo he guardado" de "lo he vendido": con un `true` a secas, `colocado.ok` era
    // `undefined` y **todo item caía en la compensación de almacén lleno**. El banco
    // follow dio cero recolectores en 4.000 tiradas por caja, que es como se noto.
    addItem: () => (tieneEspacio ? { ok: true } : { ok: false }),
    hasSpace: () => tieneEspacio,
    unlockCosmetic: (id: string) => {
      if (poseidos.has(id)) return false;
      poseidos.add(id);
      cuenta.ids.push(id);
      return true;
    },
    ownedCosmetics: () => [...poseidos]
  };
  return { cuenta, poseidos, applier };
}

/**
 * Cuánto se cobra de un premio, o `null` si no es una cantidad.
 *
 * Aquí no hay rama de llaves porque ya no existe ese premio: la quitó el que
 * abrió las cajas sola. Dejarla habría sido código muerto que además no
 * compila, porque `'keys'` ya no es un `LootKind`.
 */
function cobrado(premio: CrateReward, cuenta: Recuento): number | null {
  if (premio.kind === 'nanites') return cuenta.nanitas;
  if (premio.kind === 'crystals') return cuenta.cristales;
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
        // **LA CIFRA DEL CARTEL, NO LA DE UNA CASILLA.** Antes se comparaba
        // `makeRouletteTile(premio).amount`, que era la casilla de la cinta; sin
        // cinta, lo que se enseña es `lootAmountText(premio)`, que es lo que pinta
        // el cartel. Para botín contado las dos eran la misma cadena, así que la
        // regla no cambia: cambia el sitio donde se lee.
        if (lootAmountText(premio) !== esperado) {
          fallos.push(`${caja}: cartel ${lootAmountText(premio)}, cobrado ${pagado}`);
        }
        // `label` es el otro sitio donde se escribe la cifra, y la usa el
        // almacén. Si divergiera del cartel, el jugador vería dos números.
        //
        // **SE COMPARA CONTRA LA MISMA CADENA QUE EL CARTEL, NO CONTRA EL
        // NÚMERO CRUDO.** La etiqueta de las nanitas pasó a usar `formatNumber`
        // —"+1.49 K Nanitas"— cuando el premio se reescaló, y la prueba pedía el
        // número entero. Las dos cosas que esta comprobación quiere son "el cartel
        // dice lo que se cobra" y "la etiqueta dice lo mismo que el cartel", y
        // comparar contra `esperado` dice las dos sin depender de qué formato
        // decida cada etiqueta.
        if (!premio.label.includes(esperado)) {
          fallos.push(`${caja}: la etiqueta "${premio.label}" no dice ${esperado}`);
        }
        if (fallos.length > 4) break;
      }
    }
    check('botín: el cartel enseña la cifra exacta que entra en la cuenta',
      fallos.length === 0, fallos.slice(0, 3).join(' | '));
  }
  {
    // La cifra se escribe con el mismo formato que los contadores del juego. Si
    // el cartel dijera "8.332" y el saldo "8.33 K", serían dos números.
    const uno = lootAmountText({ amount: 999 } as CrateReward);
    const otro = lootAmountText({ amount: 10833 } as CrateReward);
    check('botín: la cifra usa el formato de los contadores',
      uno === `+${formatNumber(999)}` && otro === `+${formatNumber(10833)}`,
      `${uno} / ${otro}`);
  }
  {
    // Qué premios llevan cifra. Monedas y materiales siempre; los objetos de a
    // uno no, porque un "+1 Dron" es ruido y el nombre ya lo dice.
    //
    // **LA TERCERA FILA CAMBIÓ AL DESPAREZER LAS LLAVES, Y NO ES UN RELLENO.**
    // Antes eran las llaves, que son una moneda y por lo tanto contaban siempre.
    // Ahora la sustituye la **Piedra de Calibración cuando salen dos**, que es
    // la única fila de la tabla que es un objeto y aun así lleva cifra: sale de
    // `rand(1, 2)`, así que la mitad de las veces son dos y la casilla tiene que
    // decir "+2 Piedras de Calibración". Medir el mismo número de filas deja la
    // prueba con la misma cobertura de `isCountedLoot()`, que es lo que se
    // comprueba aquí.
    const conCifra = (kind: string, amount: number) =>
      isCountedLoot({ kind, amount } as CrateReward);
    check('botín: nanitas, cristales y piedras de calibración por parejas enseñan su cantidad',
      conCifra('nanites', 1) && conCifra('crystals', 1) && conCifra('consumable', 2),
      [conCifra('nanites', 1), conCifra('crystals', 1), conCifra('consumable', 2)].join(','));
    check('botín: un objeto de a uno no enseña "+1"',
      !conCifra('companion', 1) && !conCifra('collector', 1) && !conCifra('cosmetic', 1),
      'companion, collector y cosmetic');
    check('botín: pero varios de una vez, sí',
      conCifra('crate', 2) && conCifra('consumable', 2) && !conCifra('crate', 1),
      'crate x2 sí, crate x1 no');
  }

  // =========================================================================
  //  1b. TODA CAJA PUEDE DAR UN RECOLECTOR, Y DEL TIER DE SU NIVEL
  // =========================================================================
  //  **ESTE BUG LLEVABA MESES VIVO Y NO LO CANTABA NINGÚN BANCO.**
  //
  //  La tabla de botín del recolector estaba detrás de un `if (tier >= 3)`, así que
  //  **una caja T1 y una T2 no podían dar un arma**. No había ninguna prueba que
  //  lo mirara: los bancos comprobaban el botín que sí salía, nunca el que no.
  //
  //  Y para el jugador era indistinguible de que el juego no quisiera darle armas:
  //  abría cajas y no le salían. Peor aún, la tarjeta de la caja T1 en la
  //  tienda **enumeraba el botín y no incluía el recolector**, así que el juego le
  //  decía al jugador que esa caja no le iba a dar armas. Los dos bugs se
  //  sostenían el uno al otro.
  //
  //  La prueba cuenta, con tiradas de verdad, cuántas cajas de cada nivel sacan un
  //  recolector. No mira la tabla: mira lo que sale.
  {
    const TIRADAS = 4000;
    const sinArma: string[] = [];
    const sinCompanero: string[] = [];
    const porCaja: string[] = [];
    for (const caja of CAJAS) {
      let conArma = 0;
      let conCompanero = 0;
      for (let i = 0; i < TIRADAS; i++) {
        const { applier } = crearApplier(true);
        const premio = rollCrateReward(caja, applier);
        if (premio.kind === 'collector') conArma++;
        if (premio.kind === 'companion') conCompanero++;
      }
      const pa = Math.round((conArma / TIRADAS) * 100);
      const pc = Math.round((conCompanero / TIRADAS) * 100);
      porCaja.push(`T${caja}: ${pa}% arma / ${pc}% compañero`);
      if (conArma / TIRADAS < 0.01) sinArma.push(`T${caja} (${conArma}/${TIRADAS})`);
      if (conCompanero / TIRADAS < 0.01) sinCompanero.push(`T${caja} (${conCompanero}/${TIRADAS})`);
    }
    check('botín: TODA caja puede dar un recolector, la T1 incluida',
      sinArma.length === 0, sinArma.join(', ') || porCaja.join(' '));
    check('botín: y un compañero, con la misma garantía',
      sinCompanero.length === 0, sinCompanero.join(', ') || porCaja.join(' '));

    // **Y QUE LOS DOS OBJETOS SALGAN LO SUFICIENTE A MENUDO.** Esta es la
    // comprobación que motivó subir los pesos, y por eso hay un suelo y no
    // solo la garantía de que existen. Es un **mínimo por caja**, no una media: el
    // fallo que se quiere cazar es "la caja T3 no da armas casi nunca", y una
    // hoy sale entre 27 % y 29 %- para que subirlo más no rompa el banco por
    // flor.
    // rosca.
    const MINIMO_OBJETO = 0.22;
    const flojos: string[] = [];
    for (const caja of CAJAS) {
      let conObjeto = 0;
      for (let i = 0; i < TIRADAS; i++) {
        const { applier } = crearApplier(true);
        const p = rollCrateReward(caja, applier);
        if (p.kind === 'collector' || p.kind === 'companion') conObjeto++;
      }
      const p = conObjeto / TIRADAS;
      if (p < MINIMO_OBJETO) flojos.push(`T${caja} ${Math.round(p * 100)}%`);
    }
    check('botín: armas y compañeros salen al menos un 22 % de las veces, en toda caja',
      flojos.length === 0, flojos.join(', ') || porCaja.join(' '));
  }

  // =========================================================================
  //  2. Cosméticos de caja
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

    // F31 · Y LA OTRA DIRECCIÓN, QUE ANTES NO SE COMPROBABA.
    //
    // El catálogo reparte nueve cosméticos entre cuatro cajas (1, 3, 6 y 10), y
    // con diez cajas eso deja seis con la entrada `cosmetic` apuntando a una bolsa
    // vacía: la ruleta las enseña como si tuvieran premio y el sorteo compensa
    // en nanitas. No es un fallo grave, pero es una casilla que miente.
    //
    // Con cuatro cajas las cuatro coinciden por casualidad —o porque la tabla se
    // escribió cuando solo había cuatro— y el banco no lo veía. Ahora la entrada
    // se pone **sola** en las cajas que tienen catálogo, y esto lo ata.
    const sobran = CAJAS.filter(c => !conEntrada.includes(c) && crateCosmetics(c).length > 0);
    check('cosméticos: ninguna caja con catálogo se queda sin entrada',
      sobran.length === 0, sobran.join(','));
  }
  {
    // Sorteando mucho, todo cosmético de la legendaria tiene que salir.
    const vistos = new Set<string>();
    for (let i = 0; i < 4000; i++) {
      const { cuenta, applier } = crearApplier();
      rollCrateReward(10, applier);
      cuenta.ids.forEach(id => vistos.add(id));
    }
    const esperados = crateCosmetics(10).map(c => c.id);
    const faltan = esperados.filter(id => !vistos.has(id));
    check('cosméticos: los de la legendaria salen todos con el tiempo',
      faltan.length === 0, `faltan ${faltan.join(',')} de ${esperados.length}`);
  }
  {
    // El cosmético entra en la lista de desbloqueados, no en el almacén.
    const { cuenta, applier, poseidos } = crearApplier();
    for (let i = 0; i < 6000 && poseidos.size < crateCosmetics(1).length; i++) {
      rollCrateReward(1, applier);
    }
    check('cosméticos: se desbloquean en la lista, no como item del almacén',
      poseidos.size === crateCosmetics(1).length && cuenta.ids.length === poseidos.size,
      `desbloqueados=${poseidos.size} veces=${cuenta.ids.length}`);

    const primero = COSMETICS_BY_ID[[...poseidos][0]];
    check('cosméticos: el desbloqueado existe y es de un tipo equipable',
      Boolean(primero) && ['title', 'frame', 'banner'].includes(primero.type),
      primero ? `${primero.id}:${primero.type}` : 'ninguno');
  }
  {
    // Lo que NO puede pasar: ganar algo que ya tienes.
    const todos = crateCosmetics(10).map(c => c.id);
    let repetidos = 0;
    let compensado = 0;
    for (let i = 0; i < 4000; i++) {
      const { applier } = crearApplier(true, todos);
      const premio = rollCrateReward(10, applier);
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
      if (rollCrateReward(1, applier).kind === 'cosmetic') cosmeticos++;
    }
    check('cosméticos: con el almacén lleno el cosmético entra igual',
      cosmeticos > 0 && poseidos.size === crateCosmetics(1).length,
      `veces=${cosmeticos} desbloqueados=${poseidos.size}`);
    check('cosméticos: y ninguno se compensó por falta de sitio',
      cuenta.ids.length === poseidos.size,
      `ids=${cuenta.ids.length} desbloqueados=${poseidos.size}`);
  }
  {
    // El duplicado paga lo mismo que el almacén lleno. Si divergieran, el
    // jugador vería en la ruleta un número que la tabla no explica.
    const coste = Math.round(CRATE_META[10].cost * 1.5);
    let porAlmacen = 0;
    let porDuplicado = 0;
    const sinEspacio = crearApplier(false);
    const conTodo = crearApplier(true, crateCosmetics(10).map(c => c.id));
    for (let i = 0; i < 4000; i++) {
      const a = rollCrateReward(10, sinEspacio.applier);
      if (a.details === 'No cabía el objeto, se compensó en nanitas') porAlmacen = a.amount;
      const b = rollCrateReward(10, conTodo.applier);
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
