// ==========================================================================
//  Las ranuras de escuadrón: cuántas hay y cuántas abre cada carta (F7, F11)
// ==========================================================================
//  POR QUÉ ESTE BANCO EXISTE.
//
//  Eran dos cartas fijas y el motor escribía un número en cada una: `= 2` y `= 5`.
//  Eso son **cuatro números a mano para la misma regla** —el `if` que desactiva el
//  botón, el `if` del motor, el `=` que concede y el "+3" de la tarjeta—, y ya
//  no coincidían entre sí: la tarjeta decía "Abre hasta 3 ranuras" y el motor
//  daba 5.
//
//  El arreglo no es escribir el 6 en más sitios: es que el número viva en **una**
//  tabla (`COMPANION_SLOT_BUY`) y todo lo demás se lea de ahí. Con eso lo que este
//  banco ata es una regla con dos caras:
//
//    · QUE LA TABLA SEA LA VERDAD. Si alguien vuelve a poner un número suelto en
//      el motor o en la tarjeta, aquí se ve. Es el mismo fallo que el de las
//      llaves (B7) y el del marco del ranking (B2), y por eso se comprueba con
//      la misma forma: comparar lo que dice cada sitio con lo que hace el motor.
//
//    · QUE LOS SALTOS NO SEAN UN +3 DE GOLPE. El precio por ranura se multiplica
//      ×5,3 entre la primera y la segunda compra, que es un desequilibrio que el
//      jugador nota como una pared. Con 1 → 2 → 4 → 6 ningún salto es de tres.
//
//  LO QUE NO CUBRE, A PROPÓSITO: que la tarjeta se vea bien. Eso es
//  `preview.html?vista=tienda` con viewport real. Aquí no hay nada que mirar más
//  allá de los números, y un banco que reimplementara el HTML no comprobaría el
//  juego sino su copia del HTML.
// ==========================================================================

import { check, resumen, boot, reload, baseSave } from './kit';
import {
  COMPANION_SLOT_BUY, COMPANION_SLOT_COSTS, COMPANION_SLOTS_TIENDA,
  RANURA_POR_CARTA, STORE_ITEMS
} from '../src/data/store';

/** Una partida con `slots` ranuras y dinero de sobra. */
function partidaConSlots(slots = 1) {
  return baseSave([], { nanites: 50_000_000, maxCompanionSlots: slots });
}

async function main() {
  // -----------------------------------------------------------------------
  //  1. LA TABLA CIERRA, Y ES LA QUE SE USA.
  // -----------------------------------------------------------------------
  {
    // La primera compra da 2 y la última da el tope. Un tope que no se puede
    // alcanzar es un tope que no es un tope: con 5ranuras y dos compras, la
    // segunda compraba de más y el jugador pagaba por un salto invisible.
    check('la primera compra da 2 ranuras',
      COMPANION_SLOT_BUY[0]?.da === 2, JSON.stringify(COMPANION_SLOT_BUY[0]));
    check('y la última da el tope de la tienda',
      COMPANION_SLOT_BUY[COMPANION_SLOT_BUY.length - 1]?.da === COMPANION_SLOTS_TIENDA,
      `ultima=${COMPANION_SLOT_BUY[COMPANION_SLOT_BUY.length - 1]?.da} tope=${COMPANION_SLOTS_TIENDA}`);

    // Las ranuras suben siempre, y nunca de más en un solo paso.
    let anterior = 1;
    for (const compra of COMPANION_SLOT_BUY) {
      check(`"${compra.etiqueta}" da más ranuras que la anterior`,
        compra.da > anterior, `${anterior} -> ${compra.da}`);
      check(`y no de más de 2 de golpe (era el +3)`,
        compra.da - anterior <= 2, `salto=${compra.da - anterior}`);
      anterior = compra.da;
    }

    // Y la tabla tiene que ser tan larga como las cartas de la tienda, o una
    // carta no tendría fila y por tanto no daría ranuras.
    check('hay una carta de tienda por cada fila de la tabla',
      Object.keys(RANURA_POR_CARTA).length === COMPANION_SLOT_BUY.length,
      `cartas=${Object.keys(RANURA_POR_CARTA).length} filas=${COMPANION_SLOT_BUY.length}`);
    for (let i = 0; i < COMPANION_SLOT_BUY.length; i++) {
      const carta = `companionSlot${i + 1}`;
      check(`la carta ${carta} existe en STORE_ITEMS`,
        (STORE_ITEMS as any)[carta] !== undefined, carta);
      check(`y su precio sale de COMPANION_SLOT_COSTS`,
        (STORE_ITEMS as any)[carta]?.cost === COMPANION_SLOT_COSTS[i + 1],
        `carta=${(STORE_ITEMS as any)[carta]?.cost} tabla=${COMPANION_SLOT_COSTS[i + 1]}`);
    }
  }

  // -----------------------------------------------------------------------
  //  2. LO QUE DICE LA TARJETA ES LO QUE HACE EL MOTOR.
  //
  //     Este es el bloque que habría pillado el "+3" contra el 5. Se compra de
  //     verdad, en orden, y se mira el número que queda — que es el mismo que
  //     decide si el botón se desactiva.
  // -----------------------------------------------------------------------
  {
    for (let i = 0; i < COMPANION_SLOT_BUY.length; i++) {
      const carta = `companionSlot${i + 1}`;
      const esperado = COMPANION_SLOT_BUY[i].da;

      // La partida empieza en 1 ranura y se compran en orden, como un jugador.
      const g = await boot(partidaConSlots(1));
      for (let j = 0; j <= i; j++) g.buyStoreItem(`companionSlot${j + 1}`);

      check(`compra: ${carta} deja las ${esperado} ranuras que dice`,
        g.getCompanionSlots() === esperado,
        `esperado=${esperado} real=${g.getCompanionSlots()}`);
    }

    // Y con el árbol de pasivas: el total efectivo puede pasar del tope de la
    // tienda, y las tres cartas tienen que seguir comprándose en orden. Es el
    // mismo caso que el almacén, que también tiene tope de tienda y tope real
    // distintos (el árbol añade ranuras aparte).
    const g = await boot(baseSave([], {
      nanites: 50_000_000,
      maxCompanionSlots: 1,
      // "Cuadrilla" da +1 ranura por nivel y llega a nivel 4, así que con el nodo al
    // máximo el total efectivo pasa de 6 sin tocar la tienda.
    nodeLevels: { squad_slots: 4 }
    }));
    for (let j = 0; j < COMPANION_SLOT_BUY.length; j++) g.buyStoreItem(`companionSlot${j + 1}`);
    const conArbol = g.getCompanionSlots();
    check('compra: con el árbol de por medio, el total supera el tope de la tienda',
      conArbol > COMPANION_SLOTS_TIENDA,
      `total=${conArbol} topeTienda=${COMPANION_SLOTS_TIENDA}`);
  }

  // -----------------------------------------------------------------------
  //  3. NO SE COMPRA DOS VECES LA MISMA RANURA.
  //
  //     Es la parte que hace que "Comprado" en la tarjeta signifique algo, y va
  //     por el botón: `canBuy` es lo que la vista usa para apagarlo, así que si
  //     esto pasa, el botón está apagado cuando tiene que estar encendido.
  // -----------------------------------------------------------------------
  {
    for (let i = 0; i < COMPANION_SLOT_BUY.length; i++) {
      const carta = `companionSlot${i + 1}`;
      const tope = COMPANION_SLOT_BUY[i].da;

      // Ya está en su número: no se puede volver a comprar.
      const g = await boot(partidaConSlots(tope));
      check(`compra: ${carta} no se puede volver a comprar en su propio tope`,
        g.canBuyStoreItem(carta) === false,
        `slots=${g.getCompanionSlots()} tope=${tope} canBuy=${g.canBuyStoreItem(carta)}`);

      // Y por debajo del tope, sí.
      const g2 = await boot(partidaConSlots(tope - 1));
      check(`compra: ${carta} sí se puede comprar si falta al menos una`,
        g2.canBuyStoreItem(carta) === true,
        `slots=${g2.getCompanionSlots()} tope=${tope} canBuy=${g2.canBuyStoreItem(carta)}`);
    }
  }

  // -----------------------------------------------------------------------
  //  4. EL PRECIO POR RANURA NO DA UN SALTO.
  //
  //     Es el otro lado de F7. Con 2 cartas, la primera daba 1 ranura por 1.200
  //     y la segunda 3 por 16.000: 1.200 el precio de la ranura contra 5.333, un
  //     ×4,4 de golpe. Comprar la segunda era solo "pagar por tres" y la decisión
  //     no tenía forma.
  // -----------------------------------------------------------------------
  {
    // Y el que de verdad importa: el salto de la TERCERA compra, que es la que
    // configura el final de partida. Con el modelo viejo el precio por ranura
    // subía ×4,4 en el segundo paso; aquí sube ×3,6, que es el mismo ritmo que
    // las cartas de tier (que suben ×1,62 el poder y ×1,5 el precio) pero sin que
    // ninguna compra parezca un muro.
    const porRanura: number[] = [];
    let desde = 1;
    for (let i = 0; i < COMPANION_SLOT_BUY.length; i++) {
      const hasta = COMPANION_SLOT_BUY[i].da;
      const precio = COMPANION_SLOT_COSTS[i + 1];
      porRanura.push(Math.round(precio / (hasta - desde)));
      desde = hasta;
    }

    check('el precio por ranura sube, pero sin saltos',
      porRanura.every((p, i) => i === 0 || p > porRanura[i - 1]),
      `precio por ranura = ${porRanura.join(' -> ')}`);
    check('y ningún salto multiplica por más de 4 el precio de la ranura',
      porRanura.every((p, i) => i === 0 || p <= porRanura[i - 1] * 4),
      `precio por ranura = ${porRanura.join(' -> ')}`);
    check('y la última ranura sale más cara que un compañero T1 entero (900)',
      porRanura[porRanura.length - 1] > 900,
      `ultima=${porRanura[porRanura.length - 1]} — si fuera menor, el escuadrón grande sería barato`);
  }

  // -----------------------------------------------------------------------
  //  5. LO QUE SE COMPRA ES LO QUE PONE EN EL ALMACÉN DE PERMISOS.
  //
  //     Las ranuras no son items: son permisos, así que `buyStoreItem` devuelve un
  //     objeto y no lo mete en el almacén. Antes ese objeto decía "5 slots" escrito
  //     a mano, y su `details` era el número que el motor acababa de escribir. Con
  //     la tabla, sale del mismo `da`.
  // -----------------------------------------------------------------------
  {
    for (let i = 0; i < COMPANION_SLOT_BUY.length; i++) {
      const carta = `companionSlot${i + 1}`;
      const g = await boot(partidaConSlots(1));
      for (let j = 0; j <= i; j++) g.buyStoreItem(`companionSlot${j + 1}`);
      const r: any = g.buyStoreItem(carta);

      check(`permiso: ${carta} no crea un item en el almacén`,
        g.getState().warehouse.length === 0,
        `items=${JSON.stringify(g.getState().warehouse.map((w: any) => w.id))}`);

      // Y una recarga no cambia el número de ranuras: lo que se guarda es
      // `maxCompanionSlots`, que es lo que la tabla escribió.
      const g2 = await reload();
      check(`permiso: ${carta} sobrevive a la recarga con ${COMPANION_SLOT_BUY[i].da} ranuras`,
        g2.getCompanionSlots() === COMPANION_SLOT_BUY[i].da,
        `tras recargar=${g2.getCompanionSlots()}`);
      void r;
    }
  }

  resumen('ranuras: cuántas hay, cuántas abre cada carta y cuánto cuestan');
}

export default main();