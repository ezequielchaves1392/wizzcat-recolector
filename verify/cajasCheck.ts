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
import { CRATE_LOOT, pickLoot, resolveLootAmount, CRATE_META } from '../src/components/crateLoot';
import { ICONS } from '../src/ui/icons';

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
  //  1b. LO QUE SALE TIENE BASE Y NOMBRE, EN LAS VEINTE CAJAS.
  // -----------------------------------------------------------------------
  //
  //  Abrir una caja es que aparezca algo. Con el contenido hasta el T10, abrir la
  //  caja T5 y que salga un item T5 sin base ni nombre propio era posible, porque el
  //  botín se construía a mano y no pasaba por el generador. **Con veinte cajas eso
  //  deja de ser un detalle del contenido nuevo**: es la misma línea ejecutada
  //  veinte veces, y si un tier no sabe tirar base, sale un item llamado
  //  "Prototipo de Recolector" —que es exactamente lo que pasa cuando una tabla de
  //  bases no cubre ese tier.
  //
  //  Por eso no se mira el almacén sino **la caja**: el botín se sortea antes de
  //  colocarse, y ese es el punto en que el item existe por primera vez. Si el
  //  generador no trae base, el almacén tampoco la puede enseñar.
  {
    let salidas = 0;
    for (const c of CAJAS) {
      const g = await boot(baseSave([crate('c1', c)], { nanites: 0 }));
      const r: any = g.openCrateBox('c1');
      const p = r?.reward as any;
      if (p?.kind !== 'collector' && p?.kind !== 'companion') continue;
      salidas++;
      const sinBase = !p.item?.baseId || !p.item?.name;
      check(`abrir: lo que sale de la T${c} trae base y nombre, no un prototipo`,
        !sinBase, `${p.kind}: ${p.item?.name} (base ${p.item?.baseId})`);
    }

    // **LA COBERTURA SE MIDE ABRIENDO VARIAS VECES, NO UNA.** Una caja reparte por
    // pesos y el objeto no siempre sale: en una apertura sale un objeto en nueve de
    // las veinte cajas, y eso es la ruleta funcionando, no un fallo. La pregunta que
    // importa es otra —"de las veinte cajas, ¿cuál es la que no sabe tirar base?"—,
    // y para contestarla hay que abrir hasta que cada caja haya dado un objeto al
    // menos una vez.
    //
    // **DIEZ APERTURAS POR CAJA** sale de la rarerza del objeto dentro de la caja: el
    // compañero pesa 58 contra 62 del recolector pero las dos son entradas del mismo
    // sorteo, y con diez aperturas la probabilidad de no ver ninguna vez un objeto es
    // bajísima. No es un número mágico: es "lo suficiente para que el fallo sea real".
    const sinVerificar: number[] = [];
    for (const c of CAJAS) {
      let conObjeto = 0;
      let conFallo = 0;
      // **HASTA QUE SALGA UN OBJETO, PERO SIN UN TECHO DE UN SOLO INTENTO.** Con diez
      // aperturas y objeto en la mayoría de las veces, es normal que alguna caja
      // sortease nanitas las diez veces seguidas por azar —sobre todo con la misma
      // semilla del banco—. Treinta intentos es suficiente para que la probabilidad de
      // fallar sea despreciable sin que el banco tarde una eternidad.
      for (let intento = 0; intento < 30 && conObjeto === 0; intento++) {
        const g = await boot(baseSave([crate('c1', c)], { nanites: 0 }));
        const r: any = g.openCrateBox('c1');
        const p = r?.reward as any;
        if (p?.kind === 'collector' || p?.kind === 'companion') {
          conObjeto++;
          if (!p.item?.baseId || !p.item?.name) conFallo++;
        }
      }
      if (conObjeto === 0 || conFallo > 0) sinVerificar.push(c);
    }
    check('abrir: todas las cajas dan un objeto con base y nombre, en alguna apertura',
      sinVerificar.length === 0,
      sinVerificar.length ? `cajas problematicas: ${sinVerificar.join(',')}` : 'las 20 verificadas');
  }
  // -----------------------------------------------------------------------
  //  2. LA ECONOMÍA NO SE HA MOVIDO. Y ESTO SE COMPRUEBA DIEZ VECES.
  // -----------------------------------------------------------------------
  //
  // El jugador pagaba la caja más su llave. Ahora paga la caja. Si el precio de
  // la caja no es exactamente la suma de los dos, **se le ha roto algo**: o le
  // se le ha regalado una tercera parte de cada caja, o le hemos encarecido todo.
  //
  // **Y SOLO PARA LOS DIEZ NIVELES QUE EXISTÍAN.** `PRECIOS` es una foto
  // congelada de los diez niveles anteriores al cambio, y es la foto lo que hace
  // valuable la comparación: si saliera de la misma cuenta que el juego, el banco
  // estaría comparando una función consigo misma. Pero una foto no tiene filas para
  // los niveles que aún no existían, así que `precioDeLaCajaAntes(11)` salía del
  // último número de la foto y la comprobación pedía que la caja T11 costara lo
  // mismo que la T10.
  //
  // Los niveles nuevos no tienen un "antes" que comparar, y no lo necesitan: que la
  // caja T20 no cueste lo mismo que la T10 lo vigila `balanceCheck`, que mide la
  // curva sobre el precio real. Aquí lo que se protege es que **los diez primeros no
  // se hayan movido**, y para eso sí hay foto.
  {
    for (const c of PRECIOS.map((_, i) => i + 1)) {
      const parViejo = precioDeLaCajaAntes(c) + precioDeLaLlaveAntes(c);
      check(`precio: la ${c} cuesta lo mismo que antes la caja mas la llave`,
        costeDeCaja(c) === parViejo,
        `ahora=${costeDeCaja(c)} antes=${parViejo} (caja ${precioDeLaCajaAntes(c)} + llave ${precioDeLaLlaveAntes(c)})`);
    }

    // Y el precio de una caja alta es más que el de una baja. Sin esto, el
    // "cuesta lo mismo" podría cumplirse con todas al mismo precio.
    //
    // **RECORRE `CRATE_TIERS`, NO `costeDeCaja.length`.** Ese `.length` era la
    // aridad de la función —uno— porque `costeDeCaja` dejó de ser una lista cuando
    // pasó a ser una función. El bucle no entraba y la comprobación pasaba siempre,
    // sin comprobar nada: un banco que da verde porque su bucle no se ejecuta es
    // peor que un banco que no existe, porque ocupa su sitio.
    let sube = true;
    const niveles = CRATE_TIERS.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
    for (let i = 1; i < niveles.length; i++) {
      if (costeDeCaja(niveles[i]) <= costeDeCaja(niveles[i - 1])) sube = false;
    }
    check('precio: y el precio sigue subiendo con el nivel',
      sube, niveles.map(t => costeDeCaja(t)).join(' -> '));
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

  // -----------------------------------------------------------------------
  //  F72 · CADA CAJA TIENE SU CARA: ICONO Y ACENTO POR TIER.
  //
  //  Antes salían de la rareza y la T1 y la T2 eran la misma cara: abrir la
  //  siguiente no se sentía distinto. Ahora cada tier trae su pareja, y lo que
  //  se ata es que no haya dos iguales y que cada icono exista en el set (un
  //  nombre que no existe pinta la palabra "undefined" en el HTML).
  // -----------------------------------------------------------------------
  {
    const caras = CRATE_TIERS.map(t => `${CRATE_META[t as CrateType].icon}+${CRATE_META[t as CrateType].accent}`);
    check('caras: las diez cajas tienen caras distintas',
      new Set(caras).size === CRATE_TIERS.length, caras.join(' | '));
    const sinIcono = CRATE_TIERS.filter(t => !(CRATE_META[t as CrateType].icon in ICONS));
    check('caras: y cada icono existe en el set',
      sinIcono.length === 0, sinIcono.map(t => `T${t}=${CRATE_META[t as CrateType].icon}`).join(',') || 'los diez existen');
  }

  resumen('cajas: se abren solas, cuestan lo mismo y las llaves viejas se redimen');
}

export default main();
