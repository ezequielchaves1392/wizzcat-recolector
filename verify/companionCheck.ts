// ==========================================================================
//  EL MULTIPLICADOR DEL COMPAÑERO: RAREZA Y POTENCIAL
// ==========================================================================
//
//  El compañero ya pagaba por el nivel (`multiplicadorDeNivel`) y el potencial ya
//  movía el poder por su posición dentro del rango del tier. Lo que **no** pagaba
//  era la rareza: era decorativa, como una etiqueta de color. Aquí se le da precio.
//
//  Y este banco fija cuatro cosas:
//
//  1. **LA RAREZA SUBE Y NINGÚN MULTIPLICADOR BAJA DE 1.** Un compañero ya
//     forjado no puede perder ingreso por un cambio de reglas: si el potencial por
//     debajo de la média restara, quien tuviera un ★1 se llevaría una pena sin
//     haber hecho nada malo.
//
//  2. **LA RAREZA SE LEE IGUAL CON TILDE QUE SIN ELLA.** El mismo número que
//     decide el color del halo decide el ingreso, y si uno leyera la rareza de una
//     manera y el otro de otra, el mejor item del juego daría más de lo que parece.
//
//  3. **EL INGRESO Y EL STAT SON EL MISMO NÚMERO.** Se suman aquí y se pintan en
//     otro sitio, y antes eran dos copias del mismo cálculo en dos ficheros. Esta es
//     la prueba que evita que vuelvan a separarse: si un sitio se queda sin rareza,
//     el stat y el cobro dejan de cuadrar.
//
//  4. **LA FORJA NO ROMPE EL RANGO.** El comentario de `poderDeCompanero()` cuenta
//     que un multiplicador dentro del rango llegó a hacer un T10 once veces más
//     fuerte. Este va después de la carta, así que el orden entre tiers sigue siendo
//     estricto y el precio por punto no se desploma.
// ==========================================================================

import { boot, check, resumen, s, baseSave, companion, ficha, RAREZA_NEUTRA } from './kit';
import {
  poderDeCompanero, poderEfectivoDeCompanio,
  multiplicadorDeCalidadDeCompanero, multiplicadorPorPotencialDeCompanero,
  multiplicadorDeRarezaDeCompanero, rarezaDeCompanionForjado, crearCompanioDeTier,
  MULTIPLICADOR_POR_RAREZA
} from '../src/data/crafting';
import { rangoDePoder, rarezaDeTier } from '../src/data/tiers';
import { RARITY_RANK } from '../src/components/crateLoot';

const RAREZAS = ['Común', 'Raro', 'Épico', 'Legendario', 'Mítico', 'Divino'];

async function main() {
  // -------------------------------------------------------------------------
  //  1. LA TABLA: SUBE, NO BAJA, Y CONOCE LAS SEIS RAREZAS
  // -------------------------------------------------------------------------
  {
    check('companero: la tabla tiene una entrada por cada rareza del juego',
      Object.keys(MULTIPLICADOR_POR_RAREZA).length === RAREZAS.length
        && RAREZAS.every(r => MULTIPLICADOR_POR_RAREZA[r] !== undefined),
      'tabla=' + Object.keys(MULTIPLICADOR_POR_RAREZA).length
        + ' rarezas=' + RAREZAS.length);

    // **CADA SALTO ES MÁS ALTO QUE EL ANTERIOR.** Una rareza por debajo de la que
    // tiene antes daría un motivo para no quererla, y el jugador pagaría una caja
    // peor por tener una etiqueta menos.
    const valores = RAREZAS.map(r => MULTIPLICADOR_POR_RAREZA[r]);
    const monótono = valores.every((v, i) => i === 0 || v > valores[i - 1]);
    check('companero: cada rareza paga mas que la anterior',
      monótono,
      RAREZAS.map((r, i) => r + '=' + valores[i]).join(' '));

    check('companero: y ninguna rareza paga menos que 1, que seria una pena',
      valores.every(v => v >= 1),
      'minimo=' + Math.min(...valores));

    check('companero: la rareza mas alta es la que mas paga, y no hay otra por encima',
      MULTIPLICADOR_POR_RAREZA[RAREZAS[5]] === Math.max(...valores)
        && RAREZAS.length === Object.keys(RARITY_RANK).length,
      'divino=' + MULTIPLICADOR_POR_RAREZA['Divino']);

    // **POTENCIAL: DE LA MEDIA PARA ARRIBA PAGA, Y POR DEBAJO NO.**
    const porPotencial = [1, 2, 3, 4, 5].map(p => p + '=' + multiplicadorPorPotencialDeCompanero(p));
    check('companero: el potencial de la media no paga y el de arriba si',
      multiplicadorPorPotencialDeCompanero(3) === 1
        && multiplicadorPorPotencialDeCompanero(4) > 1
        && multiplicadorPorPotencialDeCompanero(5) > multiplicadorPorPotencialDeCompanero(4),
      porPotencial.join(' '));

    check('companero: y ningun potencial paga menos de 1, para no castigar al que ya lo forjo',
      [1, 2, 3, 4, 5].every(p => multiplicadorPorPotencialDeCompanero(p) >= 1)
        && multiplicadorPorPotencialDeCompanero(0) >= 1
        && multiplicadorPorPotencialDeCompanero(99) >= 1,
      porPotencial.join(' '));
  }

  // -------------------------------------------------------------------------
  //  2. RAREZA LEÍDA CON Y SIN TILDE, Y LA QUE NO EXISTE
  // -------------------------------------------------------------------------
  {
    check('companero: la rareza da el mismo multiplicador con tilde que sin ella',
      multiplicadorDeCalidadDeCompanero('Mitica', 3) === multiplicadorDeCalidadDeCompanero('Mítica', 3)
        && multiplicadorDeCalidadDeCompanero('mitica', 3) === multiplicadorDeCalidadDeCompanero('Mítica', 3)
        && multiplicadorDeCalidadDeCompanero('EPICO', 3) === multiplicadorDeCalidadDeCompanero('Épico', 3),
      'mitica=' + multiplicadorDeCalidadDeCompanero('Mitica', 3)
        + ' mitica=' + multiplicadorDeCalidadDeCompanero('mitica', 3)
        + ' EPICO=' + multiplicadorDeCalidadDeCompanero('EPICO', 3));

    // **UNA RAREZA QUE NO EXISTE NO PUEDE ROMPER EL INGRESO.** Un `undefined` que se
    // multiplica da `NaN`, y un compañero con NaN es un compañero que no paga y no
    // dice por qué.
    check('companero: una rareza que no existe no rompe nada, da 1',
      multiplicadorDeCalidadDeCompanero('Rarisima', 3) === 1
        && multiplicadorDeCalidadDeCompanero('', 3) === 1
        && multiplicadorDeCalidadDeCompanero(undefined, 3) === 1
        && multiplicadorDeCalidadDeCompanero(null, 3) === 1,
      'inventada=' + multiplicadorDeCalidadDeCompanero('Rarisima', 3));

    check('companero: y con potencial sigue siendo un numero, nunca NaN',
      [0, 1, 3, 5, 99, undefined, null].every(p =>
        Number.isFinite(multiplicadorDeCalidadDeCompanero('Divino', p))),
      'divino=' + [0, 1, 3, 5, 99, undefined, null]
        .map(p => multiplicadorDeCalidadDeCompanero('Divino', p)).join(' '));
  }

  // -------------------------------------------------------------------------
  //  3. EL INGRESO Y EL STAT SON EL MISMO NÚMERO
  // -------------------------------------------------------------------------
  {
    const g = await boot(baseSave([
      companion('mc', 5, { rarity: 'Divino' }),
      ficha('mc', 5, { power: 100, rarity: 'Divino', potential: 5 })
    ], {
      activeCompanions: ['mc'],
      companions: [{ id: 'mc', name: 'Compañero T5', type: 'passive', power: 100, rarity: 'Divino', tier: 5, potential: 5 }]
    }));

    // **LO QUE COBRA Y LO QUE SE PINTA, DEL MISMO NÚMERO.** El stat se pide al motor
    // por el id del item, que es el camino que usa la rejilla del almacén.
    const ingreso = s(g).passiveIncome;
    const stat: any = g.getStatPrincipal?.('mc');
    check('companero: el ingreso pasivo paga la rareza y el potencial',
      ingreso === poderEfectivoDeCompanio({ power: 100, rarity: 'Divino', potential: 5 }),
      'ingreso=' + ingreso + ' esperado='
        + poderEfectivoDeCompanio({ power: 100, rarity: 'Divino', potential: 5 }));

    check('companero: y el stat dice exactamente lo mismo que el ingreso',
      stat && stat.valor === ingreso,
      'stat=' + (stat ? stat.valor : 'n/a') + ' ingreso=' + ingreso);

    // **Y CON LA RAREZA DE UN COMPAÑERO NORMAL, EL INGRESO ES OTRO.** Si esto no se
    // moviera, el multiplicador estaría en la función pero nadie lo usaría.
    const g2 = await boot(baseSave([
      companion('mc', 5, { rarity: RAREZA_NEUTRA }),
      ficha('mc', 5, { power: 100, rarity: RAREZA_NEUTRA, potential: 3 })
    ], {
      activeCompanions: ['mc'],
      companions: [{ id: 'mc', name: 'Compañero T5', type: 'passive', power: 100, rarity: RAREZA_NEUTRA, tier: 5, potential: 3 }]
    }));
    check('companero: y un companero de la misma carta pero raro rinde menos',
      s(g2).passiveIncome < ingreso,
      'comun=' + s(g2).passiveIncome + ' divino=' + ingreso);
  }

  // -------------------------------------------------------------------------
  //  4. LA FORJA NO ROMPE EL RANGO ENTRE TIERS
  // -------------------------------------------------------------------------
  {
    // **A IGUAL POTENCIAL, EL ORDEN ENTRE TIERS NO CAMBIA.** Es lo único que se puede
    // prometer. Con potencial distinto la promesa no existe ya **antes** de este cambio:
    // un T2 con cinco estrellas y un T3 con una empatan en 21, porque los rangos bajos se
    // pisan y el redondeo los junta. Prometer el orden estricto en todos los saltos sería
    // inventar una garantía que el rango no tiene — y esta prueba la inventó, y falló, y
    // el fallo era de la prueba y no de la regla.
    let rompen = '';
    for (let potencial = 1; potencial <= 5 && !rompen; potencial++) {
      for (let tier = 1; tier < 10; tier++) {
        const bajo = poderEfectivoDeCompanio({
          power: poderDeCompanero(tier, potencial),
          rarity: 'Divino',
          potential: potencial
        });
        const alto = poderEfectivoDeCompanio({
          power: poderDeCompanero(tier + 1, potencial),
          rarity: 'Divino',
          potential: potencial
        });
        if (alto <= bajo) {
          rompen = 'T' + tier + ' (' + bajo + ') >= T' + (tier + 1) + ' (' + alto
            + ') a potencial ' + potencial;
          break;
        }
      }
    }
    check('companero: a igual potencial, un tier mas alto siempre rinde mas',
      rompen === '',
      rompen || 'los cinco potenciales suben en los nueve saltos de tier');

    // **Y LA PROMESA ESCRITA EN EL CÓDIGO SIGUE SIENDO CIERTA.** El comentario de
    // poderDeCompanero() dice que el techo del T9 es menor que el suelo del T10. Con el
    // multiplicador encima tiene que seguir siéndolo: es lo que evita que el tier alto
    // sea la trampa que balanceCheck ya cazó una vez.
    const [min9, max9] = rangoDePoder(9);
    const [min10] = rangoDePoder(10);
    const techo9 = poderEfectivoDeCompanio({ power: max9, rarity: 'Divino', potential: 5 });
    const suelo10 = poderEfectivoDeCompanio({ power: min10, rarity: 'Divino', potential: 1 });
    check('companero: y el techo del T9 sigue por debajo del suelo del T10',
      techo9 < suelo10,
      'T9 techo=' + techo9 + ' (rango ' + min9 + '-' + max9 + ') T10 suelo=' + suelo10
        + ' (rango desde ' + min10 + ')');

    // **EL EXTRA POR POTENCIAL TIENE UN TECHO Y ESTA ES LA PRUEBA QUE LO DICE.**
    //
    // El primer intento puso el extra de ★5 en 1,10 y rompió justo lo de arriba: un T9 al
    // máximo rendía 609 y un T10 recién salido 597. **El fallo lo dio esta cuenta, no el
    // ojo**, y el arreglo fue bajar el extra a 1,06.
    //
    // La condición sale del rango y es independiente de la rareza, porque la rareza
    // multiplica a los dos por igual en esta comparación: el extra de ★5 tiene que quedar
    // por debajo de suelo_del_T10 / techo_del_T9. Si algún día se sube el extra, esta
    // falla antes de que un jugador descubra que le sale más barato un T9.
    const limite = min10 / max9;
    check('companero: el extra por potencial no puede invertir el orden entre tiers',
      multiplicadorPorPotencialDeCompanero(5) < limite,
      'extra★5=' + multiplicadorPorPotencialDeCompanero(5) + ' limite=' + limite.toFixed(4));

    check('companero: y con el extra en su sitio, el T9 al maximo sigue por debajo del T10',
      techo9 < suelo10,
      'T9 techo=' + techo9 + ' < T10 suelo=' + suelo10);

    // **Y LA BANDA ENTRE EL SUELO Y EL TECHO DE CADA TIER SIGUE SIENDO LA MISMA QUE
    // ANTES DEL MULTIPLICADOR.** Lo que cambia es cuánto rinde un Divino, no qué
    // poder tiene un T5: el precio de la caja sigue siendo el del rango.
    const bandaIntacta = [1, 3, 5, 7, 10].every(tier => {
      const [min, max] = rangoDePoder(tier);
      const p1 = poderDeCompanero(tier, 1);
      const p5 = poderDeCompanero(tier, 5);
      return p1 >= min && p5 <= max && p1 < p5;
    });
    check('companero: y el poder de la carta no se sale de su rango, que es su precio',
      bandaIntacta,
      'poderDeCompanero no cambio: sigue siendo posicion en el rango');
  }

  // -------------------------------------------------------------------------
  //  5. NADA CAMBIA PARA QUIEN YA TENÍA UN COMPAÑERO
  // -------------------------------------------------------------------------
  {
    // **UNA PARTIDA VIEJA NO TIENE RAREZA EN LA FICHA, Y NO PUEDE PERDER INGRESO.**
    // El multiplicador por defecto es 1, o sea que un compañero guardado sin rareza
    // cobra exactamente lo que cobraba. Un guardado con una rareza inventada tampoco.
    const viejo = await boot(baseSave([
      companion('mv', 4),
      { id: 'mv', name: 'Viejo', type: 'passive', power: 40, tier: 4 }
    ], {
      activeCompanions: ['mv'],
      companions: [{ id: 'mv', name: 'Viejo', type: 'passive', power: 40, tier: 4 }]
    }));
    check('companero: una ficha sin rareza cobra lo mismo que antes, ni un nano mas ni menos',
      s(viejo).passiveIncome === 40,
      'pasivo=' + s(viejo).passiveIncome);

    const raro = await boot(baseSave([
      companion('mr', 4, { rarity: 'Inventada' }),
      { id: 'mr', name: 'Raro', type: 'passive', power: 40, rarity: 'Inventada', tier: 4 }
    ], {
      activeCompanions: ['mr'],
      companions: [{ id: 'mr', name: 'Raro', type: 'passive', power: 40, rarity: 'Inventada', tier: 4 }]
    }));
    check('companero: y una rareza inventada tampoco lo cambia, porque vale 1',
      s(raro).passiveIncome === 40,
      'pasivo=' + s(raro).passiveIncome);
  }

  // -------------------------------------------------------------------------
  //  6. LA RAREZA SOLA Y LA QUE ESTAMPA LA FORJA (F76/F77)
  // -------------------------------------------------------------------------
  //
  //  La ficha del companero explica su numero con una fila por multiplicador, y
  //  la fila de la rareza pide el multiplicador SIN el extra del potencial. Esa
  //  lectura vive en `multiplicadorDeRarezaDeCompanero()` y `calidad` es su
  //  producto con el extra: esta seccion fija que partirla no cambio nada.
  {
    // **CALIDAD ES RAREZA POR POTENCIAL, EN TODAS LAS COMBINACIONES.** Si la
    // refactorizacion hubiese cambiado un solo producto, el ingreso de alguien
    // se moveria sin que ninguna regla lo pidiera.
    const potes = [1, 2, 3, 4, 5, undefined, null];
    let rotos = '';
    for (const r of [...RAREZAS, 'Rarisima', '', undefined, null]) {
      for (const p of potes) {
        const junto = multiplicadorDeCalidadDeCompanero(r as any, p as any);
        const partido = multiplicadorDeRarezaDeCompanero(r as any)
          * multiplicadorPorPotencialDeCompanero(p as any);
        if (junto !== partido) rotos += `[${r}/${p}: ${junto} vs ${partido}]`;
      }
    }
    check('companero: calidad es rareza por potencial en todas las combinaciones',
      rotos === '',
      rotos || '6 rarezas + 4 desconocidas x 7 potenciales, todas iguales');

    // **LA TABLA DE LA RAREZA SOLA, CON LOS MISMOS SEIS VALORES.** Y con y sin
    // tilde da lo mismo, porque es la misma lectura que ya fijaba la seccion 2.
    const sola = RAREZAS.map(r => r + '=' + multiplicadorDeRarezaDeCompanero(r));
    check('companero: la rareza sola trae la tabla entera',
      RAREZAS.every(r =>
        multiplicadorDeRarezaDeCompanero(r) === MULTIPLICADOR_POR_RAREZA[r]),
      sola.join(' '));
    check('companero: y sin tilde ni mayusculas lee igual',
      multiplicadorDeRarezaDeCompanero('Mitico') === 1.45
        && multiplicadorDeRarezaDeCompanero('Epico') === 1.20
        && multiplicadorDeRarezaDeCompanero('legendario') === 1.32,
      'Mitico=' + multiplicadorDeRarezaDeCompanero('Mitico'));

    // **LA FORJA ESTAMPA LA DEL TIER, Y LA FUNCION DICE LA MISMA.** La pantalla
    // anuncia el resultado antes de tirar: si esta funcion dijera otra cosa que
    // el companero forjado, la linea mentiria (R3).
    let otra = '';
    for (let t = 1; t <= 10; t++) {
      const dicha = rarezaDeCompanionForjado(t);
      const delTier = rarezaDeTier(t);
      const forjado = crearCompanioDeTier(t, 3, () => 0.5).rarity;
      if (dicha !== delTier || forjado !== dicha) otra += `[T${t}: ${dicha}/${delTier}/${forjado}]`;
    }
    check('companero: lo anunciado, lo del tier y lo forjado son la misma rareza',
      otra === '',
      otra || 'T1-T10: las tres dicen lo mismo');
  }

  resumen('multiplicador del compañero');
}

export default main();