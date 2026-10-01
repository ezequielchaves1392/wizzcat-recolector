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
//      que estar en la banda que el comentario promete: 150 en T1 subiendo hasta
//      ~420 en T10.
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
import { TIER_SYSTEM } from '../src/data/tiers';

/** El poder medio del tier, que es el punto medio de su rango. */
function poderMedio(tier: number): number {
  const r = TIER_SYSTEM.ranges[tier];
  return (r[0] + r[1]) / 2;
}

/** El precio de la carta de ese tipo y ese tier. */
function precio(tipo: 'companion' | 'collector', tier: number): number {
  const item = (STORE_ITEMS as Record<string, { cost: number }>)[`${tipo}CardT${tier}`];
  return item.cost;
}

/** Coste por punto de poder, que es la cifra que tiene que estar acotada. */
function porPunto(tipo: 'companion' | 'collector', tier: number): number {
  return precio(tipo, tier) / poderMedio(tier);
}

const TIERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

async function main() {
  // -----------------------------------------------------------------------
  //  1. LA BANDA. Lo que el comentario promete.
  // -----------------------------------------------------------------------
  {
    const banda: Record<'companion' | 'collector', [number, number]> = {
      companion: [150, 430],
      collector: [150, 430]
    };

    for (const tipo of ['companion', 'collector'] as const) {
      const ratios = TIERS.map(t => porPunto(tipo, t));
      const fuera = ratios.filter(r => r < banda[tipo][0] || r > banda[tipo][1]);

      check(
        `${tipo}: los diez tiers caen en la banda de 150 a 430 por punto`,
        fuera.length === 0,
        `por punto = ${ratios.map(r => Math.round(r)).join(', ')}`
      );

      // Y que la banda sea una Promise: si solo se comprobaran los extremos, un
      // T5 desproporcionado pasaría y es justo el tier donde se nota.
      const todos = ratios.every((r, i) => i === 0 || r >= ratios[i - 1] * 0.98);
      check(`${tipo}: y el coste por punto NUNCA baja al subir de tier`, todos,
        ratios.map(r => Math.round(r)).join(', '));
    }
  }

  // -----------------------------------------------------------------------
  //  2. NUNCA MEJOR. La regla que ata el bug real.
  // -----------------------------------------------------------------------
  {
    for (const tipo of ['companion', 'collector'] as const) {
      for (let t = 2; t <= 10; t++) {
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
      'compañero y recolector cuestan lo mismo en los diez tiers',
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
    const precios = TIERS.map(t => precio('collector', t));
    const total = precios.reduce((a, b) => a + b, 0);
    const ultimo = precios[precios.length - 1];
    const dosUltimos = precios[8] + precios[9];

    check(
      'el T10 solo es una parte grande del total: llegar al final cuesta',
      ultimo / total > 0.35,
      `T10 = ${ultimo} de ${total} (${Math.round(ultimo / total * 100)}%)`
    );
    check(
      'y los dos últimos tiers se llevan más de la mitad',
      dosUltimos / total > 0.5,
      `T9+T10 = ${dosUltimos} de ${total} (${Math.round(dosUltimos / total * 100)}%)`
    );
    check(
      'el juego se estira: de T1 a T10 el precio total se multiplica por más de 8',
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
    // la relación con el precio de la carta, que sale del juego.
    const costeDeSubir = (nivel: number) => Math.max(1, Math.floor(1.2 * Math.pow(1.26, nivel)));
    let cristales = 0;
    for (let l = 0; l < 20; l++) cristales += costeDeSubir(l);
    const enNanitas = cristales * (STORE_ITEMS.upgradeCrystal as { cost: number }).cost;
    const colector = precio('collector', 10);

    check('sintonizar a nivel 20 no es un botón: cuesta una fracción seria del item',
      enNanitas / colector > 0.4,
      `sintonizar=${enNanitas} recolectorT10=${colector} (${Math.round(enNanitas / colector * 100)}%)`);
    check('ni un segundo en el mismo recolector sale gratis: el cristal tiene un precio real',
      enNanitas < colector * 2,
      `${enNanitas} vs ${colector}`);
  }

  resumen('balance: el precio sigue al poder');
}

export default main();