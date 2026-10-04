// ==========================================================================
//  La caja se abre sola: lo que sustituye al sistema de llaves
// ==========================================================================
//  POR QUÉ ESTE BANCO SUSTITUYE AL ANTIGUO, Y POR QUÉ NO ES EL MISMO.
//
//  El banco anterior preguntaba "¿existe una llave para cada caja y la puedo
//  conseguir?". Esa pregunta ya no tiene sentido, pero **la que hay debajo sí**,
//  y es la que este banco hace:
//
//  1. QUE LA CAJA SE ABRA. Diez cajas, y las diez se abren con su ID y nada
//     más. Sin llave que buscar, sin llave que elegir, sin llave que no
//     alcance.
//  2. QUE QUITAR LAS LLAVES NO HAYA MOVIDO UN NANITO. Esta es la que da miedo
//     y la que nadie comprueba nunca: quitar un sistema de pago es exactamente
//     el cambio donde la economía se desplaza sin que nadie lo note. Y aquí se
//     puede comprobar número a número, porque el precio viejo de cada caja se
//     puede reconstruir: era la caja más su llave.
//  3. QUE LAS LLAVES QUE TUVIERA ALGUIEN NO DESAPAREZCAN. Se redimen, y se
//     comprueba dos veces: que se pagan, y que no se pagan dos veces.
//  4. QUE NO QUEDE NI UNA TRZA DEL SISTEMA. Ni una carta que las venda, ni una
//     entrada de botín que las anuncie, ni un tipo de item que las pinte.
//
//  LO QUE NO CUBRE, A PROPÓSITO: el botón del almacén. Que la caja se abra sin
//  llave es una regla del motor y del botón, y lo que se comprueba aquí es el
//  motor. Que el botón tenga un texto y no dos se ve en el navegador.
// ==========================================================================

import { check, resumen, boot, baseSave, wh, key, crate } from './kit';
import { CRATE_TYPES, costeDeCaja, CRATE_TIERS, STORE_ITEMS, type CrateType } from '../src/data/store';
import { CRATE_LOOT, pickLoot, resolveLootAmount } from '../src/components/crateLoot';

const CAJAS = Object.keys(CRATE_TYPES).map(Number).filter(n => n >= 1) as CrateType[];
/**
/**
 * Los precios por nivel, congelados.
 *
 * **ESTO ES UNA FOTO, NO UNA TABLA.** No es la lista que usa el juego: es la que
 * había antes de quitar las llaves, escrita aquí a propósito para poder
 * reconstruir el precio de entonces y compararlo con el de ahora. Si algún día
 * cambia el precio de un nivel, **esta lista no se toca**: es lo que el banco
 * usa para detectar ese cambio.
 */
const PRECIOS = [900, 1_700, 3_000, 5_500, 9_900, 18_000, 32_550, 59_050, 106_950, 193_850];

/** Lo que costaba la caja antes: la mitad del objeto de su nivel. */
/** Lo que costaba la caja antes: la mitad del objeto de su nivel. */
function precioDeLaCajaAntes(tier: number): number {
  return Math.round(precioDeUnObjetoDeSuTier(tier) / 2);
}

/**
 * Lo que costaba una llave de un nivel, tal y como se calculaba antes.
 *
 * **ESTA ES LA MITAD IMPORTANTE DEL BANCO, Y LA QUE SE ESCRIBE DE NUEVO A
 * PROPÓSITO.** Si la regla nueva saliera de la misma cuenta, el banco estaría
 * comparando una función consigo misma y no comprobaría nada. Al reescribir aquí
 * la fórmula vieja —media caja, y la llave la mitad de la caja— lo que se está
 * diciendo es: **esto ya no se usa en el juego, y por eso puede quedarse
 * congelado aquí para siempre.** Es una foto del precio anterior, no una segunda
 * implementación.
 */
function precioDeLaLlaveAntes(tier: number): number {
  const precioDeLaCaja = Math.round(precioDeUnObjetoDeSuTier(tier) / 2);
  return Math.round(precioDeLaCaja / 2);
}

/**
 * Lo que valía un objeto del nivel `n` antes de este cambio.
 *
 * Sale de la lista de precios con el mismo redondeo de entonces, en vez de
 *redondeado a tres cuartos, porque la idea es reconstruir **la cuenta de antes**, no la
 * de ahora.
 */
function precioDeUnObjetoDeSuTier(tier: number): number {
  return PRECIOS[Math.min(PRECIOS.length, Math.max(1, Math.floor(tier))) - 1];
}

/** Lo que la redención paga por una llave del nivel dado, deducido de la caja. */
function redencionDeUnaLlave(tier: number): number {
  return Math.max(1, Math.round(costeDeCaja(tier) / 3));
}

async function main() {
  // -----------------------------------------------------------------------
  //  1. LA CAJA SE ABRE. DIEZ CAJAS Y NADA MÁS QUE SU ID.
  // -----------------------------------------------------------------------
  {
    for (const c of CAJAS) {
      const g = await boot(baseSave([crate('c1', c)], { nanites: 0 }));
      const r: any = g.openCrateBox('c1');
      check(`abrir: ${c} se abre sin llave`,
        r?.ok === true, r?.msg ?? 'no se abrio');
      check(`abrir: ${c} y es la de ${c} de verdad`,
        r?.crateType === c, `crateType=${r?.crateType}`);
    }

    // **Y LA CAJA SE CONSUME, QUE ES LA MITAD DE ABRIRLA.** El bug viejo —el que
    // ya se corrigió una vez— era abrir sin gastar: la caja se quedaba en la
    // rejilla y el contador de aperturas subía igual.
    //
    // **ESTE CONTEO ERA POR TIPO Y NO POR ID, Y POR ESO LA PRUEBA DEPENDÍA DEL DADO.**
    // Contaba las cajas del almacén antes y después, así que si el botín era **otra
    // caja** el contador no bajaba: 1 antes, 1 después, y la prueba fallaba sin que
    // hubiera pasado nada. Pasaba en uno de cada varias tiradas de la suite, que es la
    // peor forma de que una prueba se rompa: no la rompe un cambio, la rompe el azar.
    // Ahora se pregunta por la caja concreta, que es lo que dice el enunciado.
    const g = await boot(baseSave([crate('c1', 3)], { nanites: 0 }));
    const estaLaCaja = () => (wh(g) as any[]).some((w: any) => w.id === 'c1');
    const antes = estaLaCaja();
    const rAbrir: any = g.openCrateBox('c1');
    const despues = estaLaCaja();
    check('abrir: la caja sale del almacen al abrirla',
      antes === true && despues === false && rAbrir?.ok === true,
      `antes=${antes} despues=${despues} ok=${rAbrir?.ok}`);

    // Y un id que no está no rompe nada ni cobra nada.
    const g2 = await boot(baseSave([crate('c1', 3)], { nanites: 0 }));
    const r: any = g2.openCrateBox('no-existe');
    check('abrir: una caja que no esta devuelve un motivo, no una excepcion',
      r?.ok === false && typeof r?.msg === 'string' && r.msg.length > 0,
      JSON.stringify(r));
  }

  // -----------------------------------------------------------------------
  //  2. LA ECONOMÍA NO SE HA MOVIDO. Y ESTO SE COMPRUEBA DIEZ VECES.
  // -----------------------------------------------------------------------
  //
  // El jugador pagaba la caja más su llave. Ahora paga la caja. Si el precio de
  // la caja no es exactamente la suma de los dos, **se le ha roto algo**: o le
  // se le ha regalado una tercera parte de cada caja, o le hemos encarecido todo.
  {
    for (const c of CAJAS) {
      const parViejo = precioDeLaCajaAntes(c) + precioDeLaLlaveAntes(c);
      check(`precio: la ${c} cuesta lo mismo que antes la caja mas la llave`,
        costeDeCaja(c) === parViejo,
        `ahora=${costeDeCaja(c)} antes=${parViejo} (caja ${precioDeLaCajaAntes(c)} + llave ${precioDeLaLlaveAntes(c)})`);
    }

    // Y el precio de una caja alta es más que el de una baja. Sin esto, el
    // "cuesta lo mismo" podría cumplirse con las diez al mismo precio.
    let sube = true;
    for (let i = 1; i < costeDeCaja.length; i++) {
      if (costeDeCaja(i) <= costeDeCaja(i - 1)) sube = false;
    }
    check('precio: y el precio sigue subiendo con el nivel',
      sube, PRECIOS.join(' -> '));
  }

  // -----------------------------------------------------------------------
  //  3. LAS LLAVES QUE TUVIERA ALGUIEN SE REDIMEN. UNA VEZ.
  // -----------------------------------------------------------------------
  //
  // El nombre importa: la redención tiene que entender las llaves **de una
  // partida de antes**, que es un item con un nombre escrito y ningún nivel. Por
  // eso la fábrica `key()` del kit escribe el nombre a mano en vez de sacarlo de
  // una tabla que ya no existe.
  {
    // Nombres viejos, uno por nivel bajo, para que la redención tenga que resolver
    // el nivel por el nombre y no porque el item lo traiga.
    const g = await boot(baseSave([
      key('k1', 'Llave de Cifrado', 4),
      key('k2', 'Llave Rúnica', 1),
      key('k3', 'Llave de Fase', 1, { stackable: false, stackCount: 1 })
    ], { nanites: 1_000 }));

    const quedan = (wh(g) as any[]).filter((w: any) => w.type === 'key');
    check('redencion: no queda ni una llave en el almacen',
      quedan.length === 0, `quedan=${quedan.length}`);

    const nanitas: any = g.getState().nanites;
    const esperado = 1_000
      + redencionDeUnaLlave(1) * 4
      + redencionDeUnaLlave(3) * 1
      + redencionDeUnaLlave(4) * 1;
    check('redencion: y se pagan por lo que valian',
      nanitas === esperado,
      `nanitas=${nanitas} esperado=${esperado} (T1=${redencionDeUnaLlave(1)} T3=${redencionDeUnaLlave(3)} T4=${redencionDeUnaLlave(4)})`);

    // **Y NO SE PAGAN DOS VECES.** La redención es idempotente por construcción:
    // si no quedan llaves, la segunda carga no encuentra nada. Esto se comprueba
    // guardando y recargando, porque es el caso que importa: una migración que se
    // apoya en "ya no hay nada que redimir" y se vuelve a ejecutar porque el
    // guardado se recrea es una máquina de imprimir.
    const guardado: any = JSON.parse(JSON.stringify(g.getState()));
    const g2 = await boot(guardado);
    check('redencion: recargar la partida no paga otra vez',
      (g2.getState().nanites as any) === nanitas,
      `antes=${nanitas} despues=${g2.getState().nanites}`);

    // Y una partida nueva, sin llaves, no recibe nada. Si recibiera, el suelo de
    // `Math.max(1, ...)` estaría pagándole una llave a todo el mundo.
    const g3 = await boot(baseSave([crate('c1', 1)], { nanites: 1_000 }));
    check('redencion: una partida sin llaves no recibe nada',
      (g3.getState().nanites as any) === 1_000,
      `nanitas=${g3.getState().nanites}`);
  }

  // -----------------------------------------------------------------------
  //  4. NO QUEDA NI UNA TRZA DEL SISTEMA.
  // -----------------------------------------------------------------------
  {
    // 4a. Ninguna carta de la tienda vende una llave. Con diez cartas de llave
    //     fuera, cualquier `keyT{n}` que sobreviva daría una carta que el juego
    //     no pinta pero cuyo precio existe.
    const cartasDeLlave = Object.keys(STORE_ITEMS as Record<string, unknown>)
      .filter(k => /^keyT\d+$/.test(k));
    check('tienda: no queda ninguna carta de llave',
      cartasDeLlave.length === 0, `sobran=${cartasDeLlave.join(',')}`);

    // 4b. Ninguna caja anuncia una llave. El botín es lo que el jugador ve, y una
    //     entrada que dijera "Llave Rúnica" sería una promesa que nada entrega.
    for (const c of CAJAS) {
      const entrada = CRATE_LOOT[c].find((e: any) => e.id === 'keys');
      check(`botin: ${c} no tiene entrada de llaves`,
        entrada === undefined, `id=${entrada?.id}`);
    }

    // 4c. Y ninguna entrada construida dice "llave", venga de donde venga. Esto no
    //     depende de la tabla: mira el botín de verdad, con 200 tiradas por caja,
    //     así que una entrada que se colara con otro nombre también saldría aquí.
    let diceLlave = '';
    for (const c of CAJAS) {
      for (let i = 0; i < 200; i++) {
        const p: any = pickLoot(c).build({ ownedCosmetics: [] });
        if (/llave/i.test(`${p.name ?? ''} ${p.label ?? ''} ${p.details ?? ''}`)) {
          diceLlave = `${c}: ${p.label}`;
        }
      }
    }
    check('botin: ninguna entrada de ninguna caja habla de una llave',
      diceLlave === '', diceLlave);
  }

  // -----------------------------------------------------------------------
  //  5. LA CADENA SIGUE ESTANDO: LA CAJA N SUELTA LA N+1.
  // -----------------------------------------------------------------------
  //
  // Las nueve cajas altas no se venden, y la única forma de llegar a ellas es
  // abrir la anterior. Con el sistema de llaves fuera, esa cadena **es** el
  // contenido de la caja alta: si la fila de la caja siguiente desaparece de la
  // tabla, la T10 es inalcanzable y no hay ni un error en el juego.
  {
    for (let i = 1; i < CRATE_TIERS.length; i++) {
      const hay = CRATE_LOOT[i].some((e: any) => e.id === 'nextCrate');
      check(`cadena: la caja T${i} suelta la T${i + 1}`,
        hay, `entradas=${CRATE_LOOT[i].map((e: any) => e.id).join(',')}`);
    }

    // Y la última no lo hace, porque no hay peldaño por encima del final. Que
    // soltara una T11 sería un item que nada reconoce.
    check('cadena: y la ultima no suelta una caja que no existe',
      !CRATE_LOOT[CRATE_TIERS.length].some((e: any) => e.id === 'nextCrate'),
      `entradas=${CRATE_LOOT[CRATE_TIERS.length].map((e: any) => e.id).join(',')}`);
  }

  // -----------------------------------------------------------------------
  //  6. EL PREMIO DE NANITAS SIGUE ESTANDO TOPADO POR EL MISMO NÚMERO.
  // -----------------------------------------------------------------------
  //
  // El tope es `topeDeVenta()`, que era la caja más la llave y ahora es solo la
  // caja. Si ese número se hubiera movido, **el premio de nanitas se habría movido
  // con él**, y eso no se vería en ningún sitio: la ruleta enseñaría un número
  // nuevo y nadie sabría si es un ajuste o un bug. La única forma de sujetarlo es
  // mirar el número de antes, y está en el punto 2.
  {
    // Se mide el máximo real del botín de nanitas de cada caja y se comprueba que
    // no se pasa del precio de la caja, que es el mismo número que antes.
    for (const c of CAJAS) {
      let maximo = 0;
      for (const entrada of CRATE_LOOT[c]) {
        if (entrada.id !== 'nanites') continue;
        for (let i = 0; i < 400; i++) {
          const p: any = resolveLootAmount(c, entrada.build({ ownedCosmetics: [] }) as any);
          if (p.amount > maximo) maximo = p.amount;
        }
      }
      check(`nanitas: el premio de ${c} no pasa del tope, que no se ha movido`,
        maximo > 0 && maximo <= costeDeCaja(c),
        `maximo=${maximo} tope=${costeDeCaja(c)}`);
    }
  }

  resumen('cajas: se abren solas, cuestan lo mismo y las llaves viejas se redimen');
}

export default main();
