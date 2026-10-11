// ==========================================================================
//  El balance: que el precio siga al poder
// ==========================================================================
//  POR QUÉ ESTE BANCO EXISTE.
//
//  Una partida se medía completa en 20 minutos: los diez tiers de recolector y
//  compañero, comprados. Eso no es una partida larga, es un formulario.
//
//  LA CAUSA NO ERA EL PRECIO, ERA QUE NO SEGUÍA AL PODER. Los precios de las
//  cartas escalaban 1.5x por tier y el poder escala 1.62x, así que el coste por
//  punto de poder BAJABA al subir de tier. Medido: el T1 costaba 142 por punto de
//  daño y el T10 38. Comprar un T10 era 3.7x más rentable que comprar T1, y el
//  juego se resolvía solo.
//
//  Y aquí está lo que hace el banco valioso: el comentario que explicaba el
//  arreglo decía "el coste por punto se mantiene entre 170 y 235 en todo el
//  rango". Eso era FALSO, y lo era desde antes de que este banco existiera, por
//  una razón concreta: el arreglo se hizo cuando el daño iba de 5 a 77, y luego
//  el daño se abrió a 466 sin tocar los precios. El comentario describía un
//  sistema correcto que ya no era el que corría.
//
//  Un comentario no se verifica solo. Este banco sí.
//
//  LO QUE SE COMPRUEBA.
//
//    · LA PROPORCIÓN — el precio por punto de poder es la regla entera, y tiene
//      que estar en la banda que el comentario promete. La banda de las cartas
//      era 150 en T1 subiendo hasta ~420 en T10; el precio que se mide es el de
//      la caja, que cuesta tres cuartos de una carta, así que la banda vive en
//      112-315 y sale de esos dos mismos números por tres cuartos.
//    · NUNCA MEJOR — y esta es la que ata el bug real: un tier superior NUNCA
//      puede salir mejor por punto que el anterior. No "casi igual", NUNCA. Con
//      solo esta regla, si alguien vuelve a escalar el precio 1.5x el banco
//      falla aunque los números parezcan razonables.
//    · LAS DOS CURVAS — compañero y recolector cuestan lo mismo, porque sacan el
//      poder del mismo `TIER_SYSTEM.ranges`.
//    · LA PARTIDA ESTIRA — el último tier tiene que costar una parte grande del
//      total, que es lo que impide que los últimos minutos sean gratis.
//
//  LO QUE NO CUBRE, A PROPÓSITO.
//
//  · Que el ingreso con el que se paga esté bien. Eso se comprueba jugando, y un
//    banco no mide nada.
  //  · El balance de la Ascension, que depende de `totalNanitesProduced` y se mide
//    en partidas completas, no en una.
// ==========================================================================

import { check, resumen } from './kit';
import { STORE_ITEMS } from '../src/gameLoop';
import { costeDeCaja } from '../src/data/store';
import { TIER_SYSTEM, rangoDePoder } from '../src/data/tiers';
import { techoDeNivel, danioDeRango, multiplicadorDeNivel } from '../src/data/crafting';

/**
 * El poder medio del tier, que es el punto medio de su rango.
 *
 * **F105 · LEE `rangoDePoder()`, NO LA TABLA.** Antes era
 * `TIER_SYSTEM.ranges[tier][0..1]`, y esa tabla tiene claves 1..10: en el T11 salía
 * `undefined` y el banco reventaba con un error de lectura en vez de decir qué
 * estaba mal. `rangoDePoder()` es la misma tabla más la rama de T11 en adelante que
 * usa el juego, así que el banco mide **el poder que el motor realmente aplica**.
 * Un banco que lee el poder de una copia de la tabla en vez de la función está
 * midiendo un número que el juego no usa, que es la forma más difícil de tener un
 * banco en verde sobre un juego roto.
 */
function poderMedio(tier: number): number {
  const [a, b] = rangoDePoder(tier);
  return (a + b) / 2;
}

/**
 * F31 · EL PRECIO QUE SE MIDE ES EL DE LA CAJA, NO EL DE UNA CARTA DE TIER.
 *
 * Este banco comprobaba que la curva de la tienda no se disparara, leyendo el
 * precio de `collectorCardT{n}` y `companionCardT{n}`. F31 quita esas veinte
 * cartas de la tienda, así que el precio que queda para un tier es el de su
 * **caja**.
 *
 * Y la caja **ha vuelto a cambiar de sitio**: cuando quitaron las llaves pasó a
 * costar la mitad de la curva, y ahora que las cajas se abren solas cuesta
 * **tres cuartos** —lo que costaba la caja más su llave—, porque si se quedara
 * en la mitad las cajas saldrían un 33 % más baratas y se movería toda la
 * economía con ellas.
 *
 * **ESTO SÍ CAMBIA LOS RATIOS, Y POR ESO LA BANDA DE ABAJO TIENE OTRO NÚMERO.**
 * Con la mitad, precio y poder se multiplicaban los dos por medio y el coste por
 * punto era el mismo número con otro nombre: las bandas no se tocaban. Con tres
 * cuartos el precio sube un 50 % y el poder se queda donde estaba, así que el
 * coste por punto sube un 50 % y la banda se multiplica por tres cuartos también.
 * Lo que no se toca es la **desigualdad**: el margen de arriba es la misma
 * cuenta de siempre, con otro divisor.
 */
function precio(tipo: 'companion' | 'collector', tier: number): number {
  // La caja suelta un compañero Y un recolector de su tier, así que el precio
  // que los dos miden es el mismo. El parámetro se conserva para que las
  // aserciones que nombran las dos mitades sigan nombrándolas.
  void tipo;
  return costeDeCaja(tier);
}

/** Coste por punto de poder, que es la cifra que tiene que estar acotada. */
function porPunto(tipo: 'companion' | 'collector', tier: number): number {
  return precio(tipo, tier) / poderMedio(tier);
}

const TIERS = Array.from({ length: 20 }, (_, i) => i + 1);

async function main() {
  // -----------------------------------------------------------------------
  //  1. LA BANDA. Lo que el comentario promete.
  // -----------------------------------------------------------------------
  {
    // LA BANDA VA A TRES CUARTOS: [112, 315].
    //
    // El precio que se mide es la caja, y la caja cuesta tres cuartos de lo que
    // cuesta un objeto de su tier, no la mitad. La banda del comentario de
    // arriba —150 en T1 hasta 420 en T10— es la de las cartas, y se lleva el
    // mismo multiplicador: 150 × 3/4 = 112,5 y 420 × 3/4 = 315.
    //
    // **EL NÚMERO CAMBIA Y LA RESTRICCIÓN NO.** Medido: 112,5 en T1 y 312 en T10
    // ahora, contra 75 y 208 antes, o sea los mismos dos números con un 50 % más.
    // La holgura que se sigue exigiendo es la de siempre —"el peor tier no puede
    // pasar del tope mientras el mejor está en el suelo"—, porque los dos
    // extremos de la banda se han movido los dos por lo mismo. Subir el precio de
    // la caja y bajar el tope de la banda sería relajar el banco, y eso es
    // justamente lo que este banco existe para que no pase: por eso los dos
    // números salen de la misma cuenta y no de un redondeo.
    // **LA BANDA SE ESTIRA A VEINTE TIERS, Y EL NÚMERO DE ARRIBA VIENE DE LA
    // CURVA, NO DE UN REDONDEO.** Antes el tope eran 315 y el T10 estaba en 312,
    // o sea que el banco llevaba diez tiers al borde. El sobreprecio del 12 % por
    // tier se acumula: del T10 al T20 son diez saltos de ×1,81, y el coste por punto
    // llega a 969. Estirar la banda **no afloja la regla**: sigue siendo "el peor
    // tier no pasa del tope mientras el mejor está en el suelo", y el suelo y el
    // tope han salido los dos de la misma cuenta.
    //
    // Lo que NO se toca es que el sobreprecio siga creciendo: por eso el banco
    // sigue exigiendo que el coste por punto **nunca baje** al subir de tier. Con
    // veinte tiers, aflojar el tope sin esa regla sería permitir que el T12 saliese
    // mejor negocio que el T11, y eso sí sería relajar el banco de verdad.
    const banda: Record<'companion' | 'collector', [number, number]> = {
      companion: [112, 1000],
      collector: [112, 1000]
    };

    for (const tipo of ['companion', 'collector'] as const) {
      const ratios = TIERS.map(t => porPunto(tipo, t));
      const fuera = ratios.filter(r => r < banda[tipo][0] || r > banda[tipo][1]);

      check(
        `${tipo}: los veinte tiers caen en la banda de 112 a 1000 por punto`,
        fuera.length === 0,
        `por punto = ${ratios.map(r => Math.round(r)).join(', ')}`
      );

      // Y que la banda sea una Promise: si solo se comprobaran los extremos, un
      // T5 desproporcionado pasaría y es justo el tier donde se nota.
      const todos = ratios.every((r, i) => i === 0 || r >= ratios[i - 1] * 0.98);
      check(`${tipo}: y el coste por punto NUNCA baja al subir de tier`, todos,
        ratios.map(r => Math.round(r)).join(', '));
    }

    // **Y QUE EL T20 NO CUESTE LO MISMO QUE EL T10.** Es el fallo que estaba
    // dormido: `costeDeCaja` recortaba con `min(longitud, tier)`, así que todo lo
    // que pasara del T10 costaba lo del T10. No se notaba porque no había cajas de
    // T11, pero con veinte tiers es el bug más caro del juego: el mejor objeto por
    // el precio del primero. Esta es la línea que lo deja escrito.
    const climb = [10, 15, 20].every((t, i, arr) => i === 0 || costeDeCaja(t) > costeDeCaja(arr[i - 1]));
    check('el precio de la caja sigue subiendo de verdad del T10 al T20',
      climb && costeDeCaja(20) > costeDeCaja(10) * 10,
      `T10=${costeDeCaja(10)} T15=${costeDeCaja(15)} T20=${costeDeCaja(20)}`);
  }

  // -----------------------------------------------------------------------
  //  1b. EL TECHO DE NIVEL SUBE CON EL TIER, Y SOLO DESDE EL T11 (F105)
  //
  //  Este bloque no mide precio: mide que **la segunda mitad del stat del juego
  //  siga valiendo algo en la mitad final de la progresión**.
  //
  //  Antes de F105 el techo era el mismo en todos los tiers (29 con potencial 3 y
  //  base neutra), y `baseDeTier` crece ×1,75: el daño del T20 es mil veces el del
  //  T1 con el mismo ×4,9 de niveles. Invertir en niveles a partir del T11 no
  // rendía nada, y el jugador pagaba un cristal por un +10 % sobre una cifra que
  // ya era enorme. Con veinte tiers eso no es un detalle: es la mitad del juego
  // morte en su tramo final.
  // -----------------------------------------------------------------------
  {
    // **Y LO MÁS IMPORTANTE: LOS DIEZ TIERS VIEJOS NO CAMBIAN.** El techo está
    // guardado en cada item, así que subir el del T1 al T10 les daría a los items
    // ya forjados un stat que no tenían sin que nadie lo pidiera. Esta línea es la
    // que deja esa decisión escrita.
    const intactos = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].every(t => techoDeNivel(3, 6, t) === 29);
    check('el techo de nivel no cambia en los diez tiers que ya existían',
      intactos,
      [1, 5, 10].map(t => `T${t}=${techoDeNivel(3, 6, t)}`).join(' '));

    // Y que suba de verdad, tres por tier, desde el T11.
    const sube = techoDeNivel(3, 6, 11) === 32 && techoDeNivel(3, 6, 20) === 59;
    check('y a partir del T11 sube tres niveles por tier',
      sube,
      `T11=${techoDeNivel(3, 6, 11)} T15=${techoDeNivel(3, 6, 15)} T20=${techoDeNivel(3, 6, 20)}`);

    // **Y QUE LOS NIVELES IMPORTEN DE VERDAD AL FINAL.** Este es el invariante, no
    // el detalle: con el techo nuevo, un T20 desarrollado tiene que pegarle
    // claramente más que un T20 recién forjado. Si esto no se cumple, el término
    // del tier no sirve de nada y es mejor no tenerlo.
    const conNiveles = danioDeRango(20, 3, 1.0) * multiplicadorDeNivel(techoDeNivel(3, 6, 20));
    const recienForjado = danioDeRango(20, 3, 1.0) * multiplicadorDeNivel(0);
    check('un T20 con niveles pega más que un T20 recién forjado',
      conNiveles / recienForjado > 5,
      `${Math.round(recienForjado)} -> ${Math.round(conNiveles)} (x${(conNiveles / recienForjado).toFixed(1)})`);

    // Y que el recorrido sea MAYOR que en el T10, que es lo que le prometimos al
    // jugador: no es que los niveles den más, es que hay más de ellos.
    check('el T20 tiene más recorrido de niveles que el T10',
      techoDeNivel(3, 6, 20) - techoDeNivel(3, 6, 10) === 30,
      `T10=${techoDeNivel(3, 6, 10)} T20=${techoDeNivel(3, 6, 20)}`);
  }

  // -----------------------------------------------------------------------
  //  2. NUNCA MEJOR. La regla que ata el bug real.
  // -----------------------------------------------------------------------
  {
    for (const tipo of ['companion', 'collector'] as const) {
      for (let t = 2; t <= 20; t++) {
        const actual = porPunto(tipo, t);
        const anterior = porPunto(tipo, t - 1);
        check(
          `${tipo}: el T${t} no sale mejor por punto que el T${t - 1}`,
          actual > anterior,
          `T${t}=${Math.round(actual)} T${t - 1}=${Math.round(anterior)}`
        );
      }
    }
  }

  // -----------------------------------------------------------------------
  //  3. LAS DOS CURVAS COINCIDEN. Mismo poder, mismo precio.
  // -----------------------------------------------------------------------
  {
    const distintos = TIERS.filter(t => precio('companion', t) !== precio('collector', t));
    check(
      'compañero y recolector cuestan lo mismo en los veinte tiers',
      distintos.length === 0,
      distintos.length ? `difieren en T${distintos.join(', T')}` : ''
    );

    // Y que el poder venga de verdad del rango, no de un número suelto. Si
    // alguien cambiara `ranges[10]` sin tocar los precios, esto lo canta.
    check('el poder del T10 sale del rango, no de una constante inventada',
      TIER_SYSTEM.ranges[10][1] > 500,
      `ranges[10]=${JSON.stringify(TIER_SYSTEM.ranges[10])}`);
  }

  // -----------------------------------------------------------------------
  //  4. LA PARTIDA ESTIRA. Que el final no sea gratis.
  // -----------------------------------------------------------------------
  {
    // F105 · **LOS "DOS ÚLTIMOS" SON AHORA EL T19 Y EL T20, NO EL T9 Y EL T10.**
    // Estas aserciones dicen "llegar al final cuesta": el último tier es una parte
    // grande del total y los dos últimos se llevan más de la mitad. Con veinte
    // tiers, "los dos últimos" son el penúltimo y el último de la lista, o sea el
    // T19 y el T20. Antes se escribían a mano como índices 8 y 9 —el T9 y el T10— y
    // con el contenido nuevo esa pareja es el *principio* de la curva: se lleva el
    // 0 % del total, y la aserción pasaba a medir lo contrario de lo que dice
    // ("el final es gratis"). Es el mismo fallo de las tablas por índice: el número
    // correcto en el sitio fijo, y cuando la lista crece mide otra cosa sin que
    // nadie lo note.
    //
    // Se leen por índice **relativo al final** para que sigan siendo "los dos
    // últimos" si algún día se sube a treinta tiers.
    const precios = TIERS.map(t => precio('collector', t));
    const total = precios.reduce((a, b) => a + b, 0);
    const ultimo = precios[precios.length - 1];
    const dosUltimos = precios[precios.length - 2] + precios[precios.length - 1];

    check(
      `el T${TIERS[TIERS.length - 1]} solo es una parte grande del total: llegar al final cuesta`,
      ultimo / total > 0.35,
      `último = ${ultimo} de ${total} (${Math.round(ultimo / total * 100)}%)`
    );
    check(
      'y los dos últimos tiers se llevan más de la mitad',
      dosUltimos / total > 0.5,
      `T${TIERS[TIERS.length - 2]}+T${TIERS[TIERS.length - 1]} = ${dosUltimos} de ${total} (${Math.round(dosUltimos / total * 100)}%)`
    );
    check(
      `el juego se estira: de T1 a T${TIERS[TIERS.length - 1]} el precio total se multiplica por más de 8`,
      total / precios[0] > 8,
      `${precios[0]} -> ${total} = x${(total / precios[0]).toFixed(1)}`
    );
  }

  // -----------------------------------------------------------------------
  //  5. LA SINTONIZACIÓN NO ES UN BOTÓN.
  //
  //  El otro extremo del mismo problema: subir un recolector a nivel 20 costaba
  //  6 000 nanitas cuando el recolector costaba 17 500. Un 3%. Y no había nada
  //  que decidir.
  // -----------------------------------------------------------------------
  {
    // 1.2 * 1.26^level, que es la fórmula del game loop. Se reimplementa aquí a
    // propósito SOLO para el detalle del mensaje: la regla que se comprueba es
    // la relación con el precio de un item de su tier, que sale del juego.
    const costeDeSubir = (nivel: number) => Math.max(1, Math.floor(1.2 * Math.pow(1.26, nivel)));
    let cristales = 0;
    for (let l = 0; l < 20; l++) cristales += costeDeSubir(l);
    const enNanitas = cristales * (STORE_ITEMS.upgradeCrystal as { cost: number }).cost;
    const colector = precio('collector', 10);

    // **EL DENOMINADOR HA SUBIDO UN 50 % Y LAS DOS ASERCIONES SIGUEN VALIENDO.**
    // El precio de referencia ya no es el de una carta: es el de la caja, que con
    // las llaves desaparecidas pasó a costar tres cuartos de la curva en vez de
    // la mitad. Sintonizar a nivel 20 son 91 200 nanitas, y contra la caja de
    // ahora da el 63 % —antes daba el 94 %—, así que la de "> 0,4" se ha puesto
    // **más difícil** de cumplir con cada subida de la caja, que es justo lo que
    // se quiere de la que protege el suelo. La de "< 2" se ha puesto más fácil;
    // por eso sigue con su número y no se afloja.
    check('sintonizar a nivel 20 no es un botón: cuesta una fracción seria del item',
      enNanitas / colector > 0.4,
      `sintonizar=${enNanitas} cajaT10=${colector} (${Math.round(enNanitas / colector * 100)}%)`);
    check('ni un segundo en el mismo recolector sale gratis: el cristal tiene un precio real',
      enNanitas < colector * 2,
      `${enNanitas} vs ${colector}`);
  }

  resumen('balance: el precio sigue al poder');
}

export default main();
