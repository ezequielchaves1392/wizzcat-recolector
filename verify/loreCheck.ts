// ==========================================================================
//  El lore cubre todos los nombres, y ningún lore sobra
// ==========================================================================
//  POR QUÉ ESTE BANCO EXISTE.
//
//  Es la regla de D4 aplicada al contenido: cuando se declara una cosa con
//  nombre, tiene que haber un banco que pregunte de dónde sale. Aquí es al
//  revés —el nombre ya existe y lo que se declara es su lore—, pero el fallo
//  es el mismo: un nombre sin lore es una ficha a medias, y un lore sin
//  nombre es contenido inalcanzable que nadie verá nunca. Los dos son gratis
//  de evitar si se preguntan juntos.
//
//  LO QUE NO SE COMPRUEBA, A PROPÓSITO: que el modal y la ficha lo pinten.
//  Eso necesita DOM de verdad y es `preview.html` con viewport real.
// ==========================================================================

import { LORE, lorePara, lineaTipoCompanion } from '../src/data/tiers';
import { TODAS_LAS_BASES } from '../src/data/bases';
import {
  CONSUMABLES_SIN_EXPANSOR, EXPANSOR_TIERS, COMPANION_SLOT_BUY, CRATE_TYPES, CRATE_TIERS, type CrateType
} from '../src/data/store';
import { CRISTAL_NOMBRE } from '../src/data/items';
import { CRATE_ONLY_COMPANIONS } from '../src/components/crateLoot';
import { check, resumen } from './kit';

async function main() {
  const nombresTier = TODAS_LAS_BASES.map(b => b.nombre);
  const nombresCaja = CRATE_ONLY_COMPANIONS.map(c => c.name);
  const extra = ['Artillero Táctico'];

  // -----------------------------------------------------------------------
  //  F52 · LOS OBJETOS QUE NO SON RECOLECTORES NI COMPAÑEROS.
  //
  //  Esta lista **no está escrita a mano**: sale de las mismas tablas que producen el
  //  juego, que es lo único que hace que no se pueda quedar vieja. Si mañana se añade
  //  una consumible nueva y nadie le pone nombre, esta lista la recoge y el banco dice
  //  que le falta lore. Si la lista estuviera escrita aquí, el banco mediría 28
  //  nombres que ya nadie usa y pasaría en verde con el juego entero roto.
  //
  //  **Y POR QUÉ SE COMPARAN POR NOMBRE Y NO POR ID.** Porque el lore se busca por
  //  nombre, con la misma función para todo. Un id obligaría a decidir el texto por
  //  objeto, y dos objetos que compartieran id compartirían también su historia.
  // -----------------------------------------------------------------------
  //
  //  **DE `CONSUMABLES_SIN_EXPANSOR`, NO DE `CONSUMABLES`.** Los dos existen y se parecen
  //  mucho: el segundo es el primero **más los cuatro expansores**. Pedir los dos aquí no
  //  da error y da el doble: la lista salía de 38 nombres con diez repetidos, y el banco
  //  que dice "cada nombre tiene su lore" pasaba en verde con el mismo nombre contado
  //  dos veces. Un nombre repetido en la lista es un objeto que se comprueba dos veces y
  //  otro que no se comprueba nunca.
  const nombresDeObjeto = [
    ...Object.values(CONSUMABLES_SIN_EXPANSOR).map(c => c.name),
    ...EXPANSOR_TIERS.map(e => e.name),
    ...COMPANION_SLOT_BUY.map(c => c.etiqueta),
    ...CRATE_TIERS.map(t => CRATE_TYPES[t as CrateType].name),
    // El cristal también entra por su nombre, y el nombre sale de `data/items`: es el
    // único que existe, y el que traía el mock antes ('Cristal de Afino') ya no lo es.
    CRISTAL_NOMBRE
  ];

  const todos = [...nombresTier, ...nombresCaja, ...extra, ...nombresDeObjeto];

  // -----------------------------------------------------------------------
  //  1. TODO NOMBRE TIENE LORE.
  //
  //  **LA LISTA DE NOMBRES DE TIER SON LAS 200 BASES, NO SESENTA NOMBRES.** Antes
  //  medía `companionNames` y `collectorNames`, tres nombres por tier y por lado.
  //  Con el nombre saliendo de la base, esos nombres ya no los lleva ningún item y
  //  el banco habría pasado en verde midiendo contenido inalcanzable: el fallo
  //  exacto que este banco existe para cazar, con la lista antigua puesta.
  // -----------------------------------------------------------------------
  {
    const sinLore = todos.filter(n => lorePara(n) === null);
    check('lore: las 200 bases tienen lore',
      TODAS_LAS_BASES.every(b => lorePara(b.nombre) !== null),
      TODAS_LAS_BASES.filter(b => lorePara(b.nombre) === null).map(b => b.nombre).join(','));
    check('lore: el nombre del item ES el de su base, y ese trae lore',
      // La cadena entera: si el nombre sale de la base, buscarlo tiene que dar
      // una frase. Esta es la prueba que ata el nombre al stat.
      nombresTier.every(n => lorePara(n) !== null && lorePara(n)!.length > 20),
      `nombres=${nombresTier.length}`);
    check('lore: los 6 exclusivos de caja tienen lore',
      nombresCaja.every(n => lorePara(n) !== null),
      nombresCaja.filter(n => lorePara(n) === null).join(','));
    check('lore: el Artillero Táctico (solo sale de la rara) tiene lore',
      lorePara('Artillero Táctico') !== null,
      String(lorePara('Artillero Táctico')));
    check('lore: ningún nombre se queda sin nada',
      sinLore.length === 0, sinLore.join(','));
  }

  // -----------------------------------------------------------------------
  //  2. NINGÚN LORE SOBRA.
  //
  //     Un lore cuya clave no es ningún nombre es la otra mitad de D4: está
  //     definido y nadie lo enseña. La comparación es contra todos los nombres
  //     que pueden llegar al almacén, no solo contra los de tier.
  // -----------------------------------------------------------------------
  {
    const conocidos = new Set(todos);
    const huerfanos = Object.keys(LORE).filter(k => !conocidos.has(k));
    check('lore: ningún lore es de un nombre que no existe',
      huerfanos.length === 0, huerfanos.join(','));
  }

  // -----------------------------------------------------------------------
  //  3. EL LORE AGUANTA LO RARO.
  // -----------------------------------------------------------------------
  {
    // **UN NOMBRE ES SU LORE O NO LO ES.** Esta función no hace `replace()` para
    // quitarle un sufijo al nombre y buscar el lore del de verdad: si lo hiciera,
    // "Colapso Dorado·Obra Maestra" —que es un item real, forjado y firmado— se
    // quedaría **sin** lore, que es la mitad de lo que se comprueba aquí.
    //
    // Lo que se comprueba ahora es lo contrario de lo de antes: un nombre con
    // sufijo **no tiene** lore, y la base de la que viene **sí**. Un item forjado
    // se queda sin historia en vez de heredar la de un objeto que no es.
    check('lore: un nombre con sufijo no se inventa el lore de otro',
      lorePara('Colapso Dorado·Obra Maestra') === null &&
      lorePara('Colapso Dorado') !== null,
      `${String(lorePara('Colapso Dorado·Obra Maestra'))} / base=${String(lorePara('Colapso Dorado'))}`);
    check('lore: un nombre inventado no tiene lore, no un texto roto',
      lorePara('Cosa Que No Existe') === null,
      String(lorePara('Cosa Que No Existe')));
    check('lore: ningún lore es una línea vacía',
      Object.values(LORE).every(t => t.trim().length > 20),
      `entradas=${Object.keys(LORE).length}`);
  }

  // -----------------------------------------------------------------------
  //  4. LA LÍNEA DE TIPO DICE LO QUE SE COBRA.
  // -----------------------------------------------------------------------
  //  Sigue viva para la tienda, que es donde se decide comprar sin abrir la ficha.
  //  En la ficha del almacén **ya no se usa**: el stat va en grande y ponerlo dos
  //  veces era justo lo que se pidió quitar.
  {
    check('tipo: el passive enseña su +N/s',
      lineaTipoCompanion('passive', 65).includes('+65/s'),
      lineaTipoCompanion('passive', 65));
    check('tipo: el click enseña el suyo',
      lineaTipoCompanion('click', 32).includes('+32/s'),
      lineaTipoCompanion('click', 32));
    check('tipo: el multiplier enseña su × y no un +N que nadie cobra',
      lineaTipoCompanion('multiplier', 0.35).includes('×1.35') &&
      !lineaTipoCompanion('multiplier', 0.35).includes('+'),
      lineaTipoCompanion('multiplier', 0.35));
  }

  // -----------------------------------------------------------------------
  //  5. EL LORE NO DICE NÚMEROS NI LO QUE HACE EL OBJETO.
  // -----------------------------------------------------------------------
  //
  //  Las dos reglas nacen de lo mismo: **el stat está al lado, en grande**, y un
  //  número al lado de la cifra grande no es información, es una contradicción con
  //  opción de elegir. Y una frase que explica el efecto es la misma cifra otra
  //  vez, con las reglas del efecto dentro de una frase de sabor.
  //
  //  **NINGUNA DE LAS DOS COSAS ERA CIERTA HOY.** No habia ni un numero en 67
  //  entradas —esa parte ya estaba bien—, pero tres frases decian lo que hace el
  //  objeto: una prometía que un arma nunca falla, otra decía que su compañero multiplica
  //  y una tercera anunciaba ser el mayor ingreso del juego. Las tres escritas, y las
  //  tres se contradicen con la etiqueta que ahora va al lado: un recolector que se
  //  equivoca al tirar no falla nunca.
  {
    const conNumero = Object.entries(LORE).filter(([, t]) => /\d/.test(t));
    check('lore: ninguno dice un numero, porque el stat va al lado en grande',
      conNumero.length === 0,
      conNumero.map(([n]) => n).join(', ') || 'ninguno');

    // Palabras que suenan a "esto es lo que hace". No es una lista perfecta —el
    // sabor puede decir cualquier cosa— pero es la que pilla las tres que había.
    const HACE = /\b(multiplica|mayor ingreso|no falla|nunca falla|aporta \+)\b/i;
    const dice = Object.entries(LORE).filter(([, t]) => HACE.test(t));
    check('lore: ninguno explica lo que hace el objeto, que ya lo dice la etiqueta',
      dice.length === 0,
      dice.map(([n, t]) => n + ' -> ' + t).join(' | ') || 'ninguno');
  }

  // -----------------------------------------------------------------------
  //  F52 · LOS OBJETOS QUE NO SON RECOLECTORES NI COMPAÑEROS.
  //
  //  La comprobación de arriba ya los incluye en la lista de nombres, y eso ya dice que
  //  no falta ninguno. Lo que falta es decir **que la lista es la de verdad**: que no se
  //  cuele un objeto que el juego produce y que el banco no está mirando, porque un
  //  banco que compara el catálogo contra una lista suya no sabe que le falta algo.
  //
  //  Por eso el número se compara contra el que sale de las tablas, no contra un número
  //  escrito aquí. Si mañana se añade un consumible más, este banco dice 29 y el de
  //  arriba exige su lore: el olvido se vuelve imposible.
  // -----------------------------------------------------------------------
  {
    const esperados = Object.keys(CONSUMABLES_SIN_EXPANSOR).length + EXPANSOR_TIERS.length
      + COMPANION_SLOT_BUY.length + CRATE_TIERS.length + 1;
    check('lore: F52 los objetos tienen lore',
      nombresDeObjeto.length === esperados && nombresDeObjeto.every(n => lorePara(n) !== null),
      `objetos=${nombresDeObjeto.length} esperados=${esperados} sin lore=${nombresDeObjeto.filter(n => lorePara(n) === null).join(',')}`);

    // Y que un nombre no aparezca dos veces en la lista, que sería la forma de que un
    // objeto se contara dos veces y otro se quedara sin comprobar.
    const repetidos = nombresDeObjeto.filter((n, k) => nombresDeObjeto.indexOf(n) !== k);
    check('lore: F52 ningún nombre de objeto está repetido en la lista',
      repetidos.length === 0, [...new Set(repetidos)].join(','));
  }

  resumen('lore: cada nombre tiene el suyo y ninguno sobra');
}

export default main();
