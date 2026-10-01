// ==========================================================================
//  Las llaves: una por caja, obtenibles, y diciendo la verdad
// ==========================================================================
//  POR QUÉ ESTE BANCO EXISTE.
//
//  El jugador preguntó si el sistema de llaves funcionaba. Funcionaba el código
//  y fallaba el sistema, que es peor: las cuatro llaves eran reales, las cuatro
//  cajas existían, y aun así la caja legendaria **no se podía abrir nunca**.
//
//  Las tres cosas que había que mirar, y las tres estaban rotas:
//
//    1. LA CADENA (B6). La del Vacío no salía de ninguna parte. La Rúnica solo
//       salía de la legendaria. Y la caja épica no soltaba ninguna llave. Tres
//       peldaños y faltaban los tres.
//    2. EL TEXTO (B6). Los cuatro `details` estaban escritos a mano y los cuatro
//       mentían. Ahora se generan con la misma función que decide si la llave
//       abre, así que esto ya no puede pasar.
//    3. LA TIENDA (B7). Una carta llamada "Llave de Cifrado" que entregaba la
//       Reforzada, con el precio en un tercer sitio.
//
//  LO QUE ESTE BANCO PROTEGE, EN ORDEN DE IMPORTANCIA:
//    · que toda caja tenga una llave alcanzable (si esto falla, hay contenido
//      muerto, y es el fallo que no se ve jugando un rato);
//    · que el texto de la llave no prometa una caja que no abre;
//    · que la carta de la tienda entregue la llave que dice entregar.
//
//  LO QUE NO CUBRE, A PROPÓSITO: que la ruleta.animation vaya bien. Eso es
//  `ruleta-preview.html`, y lo que importa aquí es el número que sale, que es
//  cosa de este fichero.
// ==========================================================================

import { check, resumen, boot, baseSave, key, crate } from './kit';
import {
  KEY_DEFS, KEY_TIER_ORDER, CRATE_KEY_TIER, STORE_KEY_TIER, keyOpens, cratesOpenedBy
} from '../src/data/items';
import { STORE_ITEMS, KEY_COSTS, CRATE_TYPES, type CrateType } from '../src/data/store';
import { CRATE_LOOT, pickLoot } from '../src/components/crateLoot';

const CAJAS = Object.keys(CRATE_KEY_TIER) as CrateType[];

async function main() {
  // -----------------------------------------------------------------------
  //  1. LA CADENA. TODA CAJA TIENE UNA LLAVE ALCANZABLE.
  //
  //     Esta es la prueba que habría parado lo que pasó. No mira textos ni
  //     precios: mira si la llave que una caja necesita se puede conseguir
  //     jugando, y por eso mira las DOS vías, no solo el botín.
  // -----------------------------------------------------------------------
  {
    // 1a. Por botín: cada caja suelta la llave que la abre. Con el botín viejo
    // esto fallaba en las tres de arriba.
    for (const c of CAJAS) {
      const necesaria = CRATE_KEY_TIER[c];
      // Se mira qué llaves suelta la caja, forzando todas las tiradas
      // suficientes para no tener suerte ni mala.
      const sueltas = new Set<number>();
      for (let i = 0; i < 400; i++) {
        // `pickLoot` devuelve la ENTRADA de la tabla (id, peso, build), no el
        // premio: hay que construirla. Esta es la diferencia entre una prueba
        // que mira el botín y una que mira la definición del botín.
        const entrada: any = pickLoot(c);
        const premio: any = entrada.build({ ownedCosmetics: [] });
        if (premio.keyTier !== undefined) sueltas.add(premio.keyTier);
      }
      check(`botin: ${c} suelta alguna vez su propia llave`,
        Array.from(sueltas).includes(necesaria),
        `necesita T${necesaria} y suelta ${JSON.stringify(Array.from(sueltas))}`);
    }

    // 1b. Por tienda: las cuatro llaves son comprables, para que la tienda sea
    // la red de seguridad de un jugador al que le faltan. Sin esto, llegar a la
    // legendaria sin la del Vacío es un callejón sin salida.
    for (const c of CAJAS) {
      const t = CRATE_KEY_TIER[c];
      check(`tienda: la llave de ${c} se puede comprar`,
        KEY_DEFS[t].buyable === true && KEY_DEFS[t].cost !== null,
        `T${t} buyable=${KEY_DEFS[t].buyable} cost=${KEY_DEFS[t].cost}`);
    }
  }

  // -----------------------------------------------------------------------
  //  2. EL TEXTO. NO PUEDE PROMETER UNA CAJA QUE NO ABRE.
  //
  //     La forma de que esto no vuelva a pasar es que el texto no se escriba:
  //     sale de `cratesOpenedBy()`, que llama a `keyOpens()`. Aquí se comprueba
  //     que la promesa y la regla dicen lo mismo, caja por caja y llave por
  //     llave.
  // -----------------------------------------------------------------------
  {
    for (const t of KEY_TIER_ORDER) {
      const def = KEY_DEFS[t];
      const prometidas = cratesOpenedBy(t);
      for (const c of CAJAS) {
        const realmenteAbre = keyOpens(t, CRATE_KEY_TIER[c]);
        if (realmenteAbre) {
          check(`texto: ${def.name} dice que abre ${CRATE_TYPES[c].name}, y lo abre`,
            def.details.includes(CRATE_TYPES[c].name),
            `details="${def.details}"`);
        }
      }
      // Y la dirección inversa: si el texto nombra una caja, la abre de verdad.
      for (const c of CAJAS) {
        if (def.details.includes(CRATE_TYPES[c].name)) {
          check(`texto: ${def.name} nombra ${CRATE_TYPES[c].name} y de verdad la abre`,
            keyOpens(t, CRATE_KEY_TIER[c]),
            `T${t} contra ${c} (necesita T${CRATE_KEY_TIER[c]})`);
        }
      }
    }
  }

  // -----------------------------------------------------------------------
  //  3. LA TIENDA. LA CARTA ENTREGA LA LLAVE QUE DICE.
  //
  //     Era B7: la carta se llamaba "Llave de Cifrado", la compra usaba una
  //     constante única y entraba la Reforzada. Lo que se comprueba aquí es el
  //     número que sale de verdad del almacén.
  // -----------------------------------------------------------------------
  {
    for (const t of KEY_TIER_ORDER) {
      const carta = `keyT${t}`;
      const def = KEY_DEFS[t];

      check(`tienda: ${carta} existe en STORE_ITEMS`,
        (STORE_ITEMS as any)[carta] !== undefined, carta);
      check(`tienda: ${carta} se llama ${def.name}`,
        (STORE_ITEMS as any)[carta]?.label === def.name,
        `carta="${(STORE_ITEMS as any)[carta]?.label}" llave="${def.name}"`);
      check(`tienda: ${carta} cuesta lo que dice KEY_DEFS`,
        (STORE_ITEMS as any)[carta]?.cost === def.cost,
        `carta=${(STORE_ITEMS as any)[carta]?.cost} def=${def.cost}`);
      check(`tienda: ${carta} apunta al nivel ${t}`,
        STORE_KEY_TIER[carta] === t,
        `STORE_KEY_TIER=${STORE_KEY_TIER[carta]}`);
    }

    // Y la compra de verdad, que es donde el bug vivía: se paga y se mira qué
    // entra al almacén. Un `STORE_MATERIAL_TIER` forgotten sale aquí, y no en
    // ninguna prueba de tabla.
    for (const t of KEY_TIER_ORDER) {
      const g = await boot(baseSave([], { nanites: 10_000_000 }));
      const res = g.buyStoreItem?.(`keyT${t}`);
      const llaves = (g.getState().warehouse ?? []).filter((w: any) => w.type === 'key');
      check(`compra: keyT${t} deja en el almacen la llave T${t}`,
        llaves.length === 1 && llaves[0]?.tier === t,
        `entrado=${JSON.stringify(llaves.map((w: any) => ({ n: w.name, t: w.tier })))} res=${JSON.stringify(res)}`);
      check(`compra: y se llama ${KEY_DEFS[t].name}`,
        llaves[0]?.name === KEY_DEFS[t].name,
        `entrado="${llaves[0]?.name}"`);
    }
  }

  // -----------------------------------------------------------------------
  //  4. LOS PRECIOS SUBEN. Y POR QUÉ LO IMPORTANTE ES OTRO NÚMERO.
  //
  //     F5 pide "precio creciente", y se comprueba. Pero el número que de
  //     verdad importa es el otro: **que la llave de una caja no cueste más que
  //     la caja**. Si la llave costara más, la caja sería la mitad barata del
  //     par y comprarla sin llave sería tirar el dinero, que es una forma muy
  //     clara de confuso. Y como cada caja suelta llaves, comprar llave y caja
  //     sale siempre más caro que abrir cajas: la tienda nunca es el camino
  //     bueno, y por eso abrir sigue siendo una decisión de riesgo.
  // -----------------------------------------------------------------------
  {
    for (let i = 1; i < KEY_COSTS.length; i++) {
      check(`precios: la llave T${i} cuesta mas que la T${i - 1}`,
        (KEY_COSTS as any)[i] > (KEY_COSTS as any)[i - 1],
        `${KEY_COSTS[i - 1]} -> ${KEY_COSTS[i]}`);
    }

    for (const c of CAJAS) {
      const t = CRATE_KEY_TIER[c];
      const precioCaja = (STORE_ITEMS as any)[`${c}Crate`]?.cost ?? 0;
      check(`precio: la llave de ${c} (T${t}) no es mas cara que ${c}`,
        (KEY_DEFS[t].cost as number) < precioCaja,
        `llave=${KEY_DEFS[t].cost} caja=${precioCaja}`);
    }
  }

  // -----------------------------------------------------------------------
  //  5. LA CAJA SIGUE SIENDO LO QUE SE ABRE CON SU LLAVE.
  //
  //     Esto ya estaba, pero lo que hace la regla nueva es que ahora importa más:
  //     si la llave es lo único que separa un cofre de otro, un error aquí
  //     hace que el jugador abra una caja y le dé el botín de otra.
  // -----------------------------------------------------------------------
  {
    for (const c of CAJAS) {
      const g = await boot(baseSave([
        crate('c1', c),
        key('k1', CRATE_KEY_TIER[c], 1)
      ], { nanites: 0 }));
      const r = g.openCrateBox('c1', 'k1');
      check(`abrir: ${c} se abre con su llave`,
        r.ok, r.msg ?? '');
      check(`abrir: y es la de ${c} de verdad`,
        r.crateType === c, `crateType=${r.crateType}`);
    }
    // Y la llave de arriba no abre la de abajo al revés... salvo por la regla
    // documentada, que sí lo permite. Se comprueba explícitamente para que la
    //exception esté escrita y no sea un accidente.
    const g = await boot(baseSave([
      crate('c1', 'common'),
      key('k3', 3, 1, { name: KEY_DEFS[3].name })
    ], { nanites: 0 }));
    const r = g.openCrateBox('c1', 'k3');
    check('abrir: la llave del Vacio si abre una caja comun (regla "igual o superior")',
      r.ok, r.msg ?? '');
  }

  // -----------------------------------------------------------------------
  //  6. NADA EN EL BOTIN DICE UNA LLAVE QUE NO ES.
  //
  //     El cartel de la ruleta enseña nombre y texto. Si el botín anuncia
  //     "Llave Rúnica" y entrega otra, el jugador gasta la llave que le han
  //     escrito. Con el texto derivado esto no puede pasar, y aquí se mira.
  // -----------------------------------------------------------------------
  {
    for (const c of CAJAS) {
      const entrada = CRATE_LOOT[c].find((e: any) => e.id === 'keys');
      check(`botin: ${c} tiene entrada de llaves`,
        entrada !== undefined, 'sin entrada de llaves');
      if (!entrada) continue;
      const premio: any = entrada.build({ ownedCosmetics: [] });
      const def = KEY_DEFS[premio.keyTier as 0 | 1 | 2 | 3];
      check(`botin: ${c} anuncia el nombre de la llave que suelta`,
        premio.name === def.name,
        `anuncia="${premio.name}" suelta="${def.name}"`);
      check(`botin: ${c} y su texto es el de esa llave`,
        premio.details === def.details,
        `anuncia="${premio.details}" real="${def.details}"`);
      check(`botin: ${c} y su rareza es la de esa llave`,
        premio.rarity === def.rarity,
        `anuncia="${premio.rarity}" real="${def.rarity}"`);
      // La etiqueta tiene que llevar el nombre BIEN escrito, no solo contener la
      // palabra "Llaves". Se comprueba el plural entero porque una versión
      // anterior de este banco miraba `includes('Llaves')` y daba por buena una
      // etiqueta que decía "+2 Llaves Rúnica": el plural en español no acaba en
      // la primera palabra, y un banco flojo no lo pilla.
      //
      // Y la cantidad se fuerza con `Math.random` para los dos valores posibles,
      // que es lo que hace `rand(1, 2)`: floor(r * 2) + 1.
      for (const [rnd, n] of [[0, 1], [0.99, 2]] as [number, number][]) {
        const original = Math.random;
        Math.random = () => rnd;
        const p: any = entrada.build({ ownedCosmetics: [] });
        Math.random = original;
        const esperado = n > 1 ? def.namePlural : def.name;
        check(`botin: ${c} con ${n} escribe "+${n} ${esperado}"`,
          p.label === `+${n} ${esperado}` && p.amount === n,
          `label="${p.label}" amount=${p.amount}`);
      }
    }
  }

  resumen('llaves: una por caja, obtenibles, y diciendo la verdad');
}

export default main();