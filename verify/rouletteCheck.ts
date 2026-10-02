// ==========================================================================
//  Banco de pruebas del GIRO DE LA RULETA
//
//  Lo que se comprueba aqui
//  -----------------------
//  Que la curva del frenado frena de verdad, que el chasquido cae en la casilla
//  que cruza el marcador, y que la casilla ganadora para en el marcador.
//
//  Esto no es cosmetico. La ruleta promete una cosa sola: que la casilla que
//  queda bajo la aguja es el premio. Esa promesa se sostiene sobre la
//  aritmetica del desplazamiento, y la aritmetica no la cubria ningun banco:
//  `lootCheck` comprueba que la cifra de la casilla ganadora es la que entra en
//  la cuenta, pero no que esa casilla sea la que se para debajo de la aguja. Un
//  desplazamiento mal calculado deja el cartel anunciando un premio mientras el
//  marcador señala otro, y eso es una ruleta mintiendo justo como la entendia
//  el resto del modulo.
//
//  Y hay una segunda cosa que no es un detalle de sonido: los chasquidos tienen
//  que caer en las fronteras de casilla. Antes iban a un intervalo constante
//  calculado por separado de la curva del movimiento, con lo que el primer
//  segundo, que es donde la cinta vuela, no tenia ni un chasquido y el ultimo
//  tramo, donde casi esta quieta, sonaba igual de fuerte. El sintoma es que el
//  trompo "no itera bien", y aqui es donde se comprueba que ya si.
//
//  El modulo bajo prueba no importa nada: ni DOM, ni Web Audio, ni Firebase.
//  Por eso vive en `rouletteSpin.ts` y no dentro de `crateRoulette.ts`.
// ==========================================================================

import { FRENADO, VUELTAS, avance, instante, geometria, crucesDeCasilla } from '../src/components/rouletteSpin';
import { tuningRoll } from '../src/components/tuningRoulette';
import { getSkipRoulette, setSkipRoulette } from '../src/roulettePrefs';
import { collectorUpgradeCost } from '../src/gameLoop';
import { check, resumen, boot, reload, conRoll, baseSave, collector, crystal, find } from './kit';

/** Ventanas reales: el movil de 390 px y el escritorio de 1440 px. */
const MOVIL = 358;      // 390 menos los 16 px de margen a cada lado
const ESCRITORIO = 672; // el `max-w-2xl` del carril
const CASILLA_MOVIL = 78;
const CASILLA_ESCRITORIO = 96;
const GAP = 8;

/** Las dos geometrias del juego, tal y como las monta `rouletteStrip`. */
function geometrias() {
  return [
    { nombre: 'movil', ventana: MOVIL, casilla: CASILLA_MOVIL, paso: CASILLA_MOVIL + GAP },
    { nombre: 'escritorio', ventana: ESCRITORIO, casilla: CASILLA_ESCRITORIO, paso: CASILLA_ESCRITORIO + GAP }
  ];
}

/** El trompo de las cajas: 5200 ms, el valor de `crateRoulette.ts`. */
const DURACION = 5200;

async function main() {
  // =========================================================================
  //  1. La curva del frenado
  // =========================================================================
  {
    check('curva: los extremos son exactos',
      avance(0) === 0 && avance(1) === 1,
      `avance(0)=${avance(0)} avance(1)=${avance(1)}`);

    // Crece y no se estanca. Una curva que se queda en un tramo tiene la cinta
    // clavada durante ese tramo, y el trompo se lee como un salto.
    let saltos = 0;
    let anterior = -1;
    for (let i = 0; i <= 200; i++) {
      const y = avance(i / 200);
      if (y <= anterior) saltos++;
      anterior = y;
    }
    check('curva: crece en todos los puntos, sin mesetas',
      saltos === 0, 'puntos que no avanzan=' + saltos);

    // POR QUE SE COMPRUEBA CONTRA LA FISICA Y NO CONTRA OTRA CURVA. `FRENADO`
    // es el ajuste de `d = 2t - t2`, que es una rueda frenando con
    // desaceleracion constante. Si alguien cambia la constante por un
    // `ease-out` mas effectivo, esta es la prueba que lo dice, y el detalle dice
    // por que: el ajuste ya no frena por fisica.
    let peor = 0;
    for (let i = 0; i <= 100; i++) {
      const p = i / 100;
      peor = Math.max(peor, Math.abs(avance(p) - (2 * p - p * p)));
    }
    check('curva: frena como una rueda con desaceleracion constante',
      peor < 0.002, 'error maximo contra 2t-t2 = ' + peor.toFixed(5));

    // Y de aqui sale lo que el jugador percibe: la velocidad baja. La velocidad
    // es el avance por tramo, y para compararla los tramos tienen que medir lo
    // mismo: comparar un tramo de 0.1 con uno de 0.15 mide dos distancias
    // distintas y da un aceleron que no existe. Con once tramos de 0.1 la
    // velocidad es directamente el avance del tramo.
    //
    // Con la curva que habia antes el primer cuarto de tiempo se llevaba el 90%
    // del camino y luego venia un arrastre sin salida: eso es lo que hace que
    // una ruleta se lea como una espera y no como una tirada.
    const velocidades: number[] = [];
    for (let i = 0; i < 10; i++) velocidades.push(avance((i + 1) / 10) - avance(i / 10));
    let crecientes = 0;
    for (let i = 1; i < velocidades.length; i++) {
      if (velocidades[i] >= velocidades[i - 1]) crecientes++;
    }
    check('curva: la velocidad baja en todos los tramos',
      crecientes === 0,
      'tramos que aceleran=' + crecientes + '  velocidades=' +
      velocidades.map(v => v.toFixed(3)).join(' '));

    // Y el frenado tiene que notarse, no ser una diferencia de milisegundos.
    // Si el primer tramo y el ultimo fueran casi iguales, la curva estara frenando
    // en teoria y el jugador no lo notaria en practica.
    check('curva: el frenado se nota, no es teorico',
      velocidades[0] > velocidades[9] * 8,
      `primer tramo=${velocidades[0].toFixed(3)} ultimo=${velocidades[9].toFixed(3)}`);

    // El reparto tiene que ser el de una tirada: mucho camino pronto y un
    // final largo. Si la curva no cumple las dos cosas, es que no esta frenando.
    check('curva: se recorre rapido al principio y lento al final',
      avance(0.25) > 0.3 && avance(0.5) > 0.7 && avance(0.9) > 0.95,
      `25%=${avance(0.25).toFixed(3)} 50%=${avance(0.5).toFixed(3)} 90%=${avance(0.9).toFixed(3)}`);
  }

  // =========================================================================
  //  2. La curva y su inversa
  // =========================================================================
  {
    // Esto es lo que ata el sonido al movimiento. `instante()` existe para
    // responder "que instante del giro es este punto del camino", y si no
    // deshace bien la curva, cada chasquido cae en un sitio que no es el que
    // dice la pista. El sintoma no es un fallo visible: es una ruleta que
    // chirria, y el ojo no sabe si es ella o el juego.
    let peor = 0;
    for (let i = 1; i < 100; i++) {
      const f = i / 100;
      peor = Math.max(peor, Math.abs(avance(instante(f)) - f));
    }
    check('curva: instante() deshace avance()',
      peor < 1e-6, 'error maximo al deshacer = ' + peor.toExponential(2));

    let peorVuelta = 0;
    for (let i = 1; i < 100; i++) {
      const p = i / 100;
      peorVuelta = Math.max(peorVuelta, Math.abs(instante(avance(p)) - p));
    }
    check('curva: y al reves, sin perderse por el camino',
      peorVuelta < 1e-6, 'error maximo = ' + peorVuelta.toExponential(2));

    check('curva: los extremos de la inversa estan clavados',
      instante(0) === 0 && instante(1) === 1,
      `${instante(0)} / ${instante(1)}`);
  }

  // =========================================================================
  //  3. La geometria del trompo
  // =========================================================================
  {
    for (const g of geometrias()) {
      const giro = geometria({ ventanaPx: g.ventana, pasoPx: g.paso, casillaPx: g.casilla });

      // LA REGLA DE ORO DE LA RULETA, en aritmetica. El centro de la casilla
      // ganadora esta en `winIndex * paso + casilla / 2` dentro de la pista, y
      // la pista se desplaza `-viaje`. Para que ese centro caiga en la mitad de
      // la ventana, que es donde esta la aguja, tiene que cumplirse la ecuacion
      // de abajo. Si algun dia deja de cumplirse, el marcador senala una casilla
      // y el cartel anuncia otra.
      const centro = giro.winIndex * g.paso + g.casilla / 2 - giro.viaje;
      check(`geometria (${g.nombre}): la casilla ganadora para en el marcador`,
        Math.abs(centro - g.ventana / 2) < 1e-9,
        `centro=${centro} aguja=${g.ventana / 2}`);

      // Y tiene que quedar cinta por delante de la aguja. Si la pista se acaba
      // en el premio, el jugador ve el borde vacio de la cinta bajo el marcador
      // y el trompo parece haber salido del carril.
      check(`geometria (${g.nombre}): queda cinta por delante del premio`,
        giro.casillas - giro.winIndex >= giro.visibles,
        `casillas=${giro.casillas} winIndex=${giro.winIndex} visibles=${giro.visibles}`);

      // El trompo tiene que dar las vueltas que dice, no menos: se mide en
      // ventanas visibles, que es lo que el jugador ve, y no en casillas.
      const vueltasVistas = (giro.viaje + g.ventana / 2) / g.ventana;
      check(`geometria (${g.nombre}): da al menos ${VUELTAS} vueltas de la ventana`,
        vueltasVistas >= VUELTAS,
        `vueltas=${vueltasVistas.toFixed(2)}`);

      check(`geometria (${g.nombre}): la ganadora no es la primera casilla`,
        giro.winIndex > 0, 'winIndex=' + giro.winIndex);
    }

    // La razon de contar las vueltas en ventanas y no en casillas. En el movil
    // caben cuatro casillas y en el escritorio seis; con un numero de vueltas
    // fijo en casillas el trompo del movil seria la mitad de largo y el juego se
    // leeria distinto en cada pantalla. Con ventanas visibles, el trompo dura lo
    // mismo en las dos.
    const vueltas = geometrias().map(g => {
      const giro = geometria({ ventanaPx: g.ventana, pasoPx: g.paso, casillaPx: g.casilla });
      return (giro.viaje + g.ventana / 2) / g.ventana;
    });
    check('geometria: el trompo dura igual en movil y en escritorio',
      Math.abs(vueltas[0] - vueltas[1]) < 0.35,
      `movil=${vueltas[0].toFixed(2)} escritorio=${vueltas[1].toFixed(2)}`);

    // Con menos movimiento el Carril se monta con una vuelta, y tiene que
    // seguir siendo un trompo y no un salto de cero casillas.
    const corto = geometria({ ventanaPx: MOVIL, pasoPx: CASILLA_MOVIL + GAP, casillaPx: CASILLA_MOVIL, vueltas: 1 });
    check('geometria: con una vuelta sigue habiendo cinta que cruzar',
      corto.winIndex > 0 && corto.casillas > corto.winIndex && corto.viaje > 0,
      `winIndex=${corto.winIndex} casillas=${corto.casillas} viaje=${corto.viaje}`);
  }

  // =========================================================================
  //  4. Los chasquidos
  // =========================================================================
  {
    for (const g of geometrias()) {
      const giro = geometria({ ventanaPx: g.ventana, pasoPx: g.paso, casillaPx: g.casilla });
      const cruces = crucesDeCasilla({
        viajePx: giro.viaje, pasoPx: g.paso, ventanaPx: g.ventana, duracionMs: DURACION
      });

      check(`chasquidos (${g.nombre}): hay uno por casilla que pasa`,
        cruces.length >= 12,
        'chasquidos=' + cruces.length);

      let desordenados = 0;
      for (let i = 1; i < cruces.length; i++) if (cruces[i] <= cruces[i - 1]) desordenados++;
      check(`chasquidos (${g.nombre}): van en orden y no se pisan`,
        desordenados === 0 && cruces.every(ms => ms > 0 && ms < DURACION),
        'fuera de orden=' + desordenados + ' rango=' + cruces[0] + '..' + cruces[cruces.length - 1]);

      // LA ATENUACION, que es el motivo de que el sonido importara. Con un
      // intervalo constante el primer tramo y el ultimo suenan igual, y el
      // ultimo es el que mira el jugador. Aqui los intervalos CRECEN: el
      // metronomo se va espaciando, que es exactamente lo que hace una ruleta
      // al frenarse. Este es el numero que define si el trompo "itera bien".
      const intervalos = cruces.slice(1).map((ms, i) => ms - cruces[i]);
      let seEspacian = 0;
      for (let i = 1; i < intervalos.length; i++) if (intervalos[i] > intervalos[i - 1]) seEspacian++;
      check(`chasquidos (${g.nombre}): los intervalos se van espaciando al frenar`,
        seEspacian >= intervalos.length - 3,
        'intervalos=' + intervalos.map(v => Math.round(v)).join(','));

      check(`chasquidos (${g.nombre}): el ultimo tramo es el mas lento`,
        intervalos[intervalos.length - 1] > intervalos[0] * 3,
        `primero=${intervalos[0]}ms ultimo=${intervalos[intervalos.length - 1]}ms`);

      // Y cada chasquido tiene que caer en una frontera de casilla DE VERDAD.
      // Esto ata el sonido a los pixeles: si el chasquido no coincide con una
      // frontera, la pista pasa otro tanto y el jugador oye una casilla que no
      // es la que ve.
      const desfases: number[] = [];
      for (const ms of cruces) {
        const d = avance(ms / DURACION) * giro.viaje;
        const frontera = Math.round((d + g.ventana / 2) / g.paso) * g.paso - g.ventana / 2;
        desfases.push(Math.abs(d - frontera));
      }
      const peorDesfase = Math.max(...desfases);
      check(`chasquidos (${g.nombre}): cada uno cae en una frontera de casilla`,
        peorDesfase < 1,
        'desfase maximo=' + peorDesfase.toFixed(3) + 'px');
    }

    // Un trompo que no se mueve no tiene chasquidos que dar. Ni uno: cero
    // casillas, cero sonido, y el premio se enseña igual.
    const parado = crucesDeCasilla({ viajePx: 0, pasoPx: 104, ventanaPx: MOVIL, duracionMs: DURACION });
    check('chasquidos: sin viaje no hay chasquidos', parado.length === 0, 'n=' + parado.length);

    const negativo = crucesDeCasilla({ viajePx: -50, pasoPx: 104, ventanaPx: MOVIL, duracionMs: 0 });
    check('chasquidos: un giro sin duracion ni camino no rompe nada',
      negativo.length === 0, 'n=' + negativo.length);
  }

  // =========================================================================
  //  5. La constante de la curva, que el CSS tiene que escribir tal cual
  // =========================================================================
  {
    // `rouletteStrip.ts` construye el `cubic-bezier` con `FRENADO.join(', ')`.
    // Si la constante dejara de ser de cuatro numeros, el `cubic-bezier` que
    // sale en el estilo seria invalido y el navegador DEJARIA DE MOVER EL
    // CARRIL entero: una ruleta que no gira, sin ningun error en la consola.
    check('curva: FRENADO son cuatro numeros para el cubic-bezier',
      FRENADO.length === 4 && FRENADO.every(n => typeof n === 'number' && n >= 0 && n <= 1),
      'FRENADO=' + JSON.stringify(FRENADO));

    check('curva: los puntos de control estan dentro del rango',
      FRENADO[0] <= FRENADO[2] && FRENADO[1] <= FRENADO[3],
      FRENADO.join(', '));
  }

  // =========================================================================
  //  6. Que la ruleta del sintonizador no enseñe una tirada que no hubo
  //
  //  Esta seccion no mira la geometria: mira el CONTRATO entre el motor y la
  //  ruleta. Y nace de un fallo de razon que es facil de cometer y que ningun
  // banco habria visto: `upgradeEquippedCollector` devuelve `{ success: false }`
  // tanto cuando el dado falla como cuando la operacion se RECHAZA antes de
  // tirar (no hay cristal, faltan unidades, ya esta en el techo). Los dos casos
  // son `false`, pero son cosas opuestas para el jugador: uno gasto el cristal y
  // hay que enseñarle el fallo, el otro no gasto nada y lo que corresponde es
  // un aviso.
  //
  //  Sin `rolled`, un rechazo hacia girar la ruleta entera para una operacion
  //  que no ocurrio, con un cartel de "FALLO" y un mensaje que habla de otra
  //  cosa ("Necesitas 4 x Cristal de Afino"). Y no habria ningun error: la
  //  ruleta habria girado bien, con su casilla y su cartel.
  // =========================================================================
  {
    // EL ACIERTO: el dado salio, y la ruleta tiene que girar.
    const g = await boot(baseSave([
      collector('r1', 3, { damage: 60, level: 4 }),
      crystal('x1', 3, 9)
    ], { nanites: 0 }));
    g.equipCollector('r1');
    const nivelAntes = find(g, 'r1').level;
    const res = conRoll(0, () => g.upgradeEquippedCollector());
    const roll = tuningRoll(res, nivelAntes, find(g, 'r1').level);

    check('contrato: en el acierto se tira el dado', res.rolled === true,
      `rolled=${res.rolled}`);
    check('contrato: y la ruleta lo enseña como acierto',
      roll.rolled === true && roll.success === true,
      `rolled=${roll.rolled} success=${roll.success}`);
    // Y la flecha. El motor sube el nivel en el mismo objeto del almacen, asi
    // que si `levelBefore` se leyera despues de la llamada daria el nivel nuevo
    // en los dos casos y la ruleta pintaria "5 -> 5", un numero que no existe.
    check('contrato: la flecha del acierto es "4 -> 5"',
      roll.levelBefore === 4 && roll.levelAfter === 5,
      `${roll.levelBefore} -> ${roll.levelAfter}`);

    const g2 = await reload();
    check('contrato: el acierto sobrevive a la recarga', find(g2, 'r1')?.level === 5,
      'nivel=' + find(g2, 'r1')?.level);
  }
  {
    // EL FALLO DEL DADO: se gasto el cristal, y hay que decirlo.
    const g = await boot(baseSave([
      collector('r1', 3, { damage: 60, level: 4 }),
      crystal('x1', 3, 9)
    ], { nanites: 0 }));
    g.equipCollector('r1');
    const nivelAntes = find(g, 'r1').level;
    const res = conRoll(0.999, () => g.upgradeEquippedCollector());
    const roll = tuningRoll(res, nivelAntes, find(g, 'r1').level);

    check('contrato: el fallo del dado tambien es una tirada', res.rolled === true,
      `rolled=${res.rolled}`);
    check('contrato: y la ruleta lo enseña como fallo',
      roll.rolled === true && roll.success === false,
      `rolled=${roll.rolled} success=${roll.success}`);
    check('contrato: el fallo deja el nivel donde estaba',
      roll.levelAfter === roll.levelBefore && find(g, 'r1').level === 4,
      `${roll.levelBefore} -> ${roll.levelAfter}, el item esta en ${find(g, 'r1').level}`);
    // Y se paga. Un fallo que no costara nada seria un fallo que no es un
    // fallo: seria el ruleta echando el premio.
    check('contrato: el fallo se paga con el cristal',
      find(g, 'x1').stackCount === 9 - collectorUpgradeCost(4),
      'x1=' + find(g, 'x1').stackCount);
  }
  {
    // LOS RECHAZOS, que es lo que la ruleta tiene que NO representar.
    //
    // Cada uno se monta con la partida que lo provoca y se mira lo mismo: que el
    // motor diga `rolled: false`, que la ruleta se entere, y que no se haya
    // gastado nada. La ultima es la que de verdad lo demuestra: si el cristal
    // sigue entero, no hubo tirada que mostrar, y una ruleta girando aqui seria
    // inventarse un resultado.
    const rechazos: Array<{ nombre: string; save: any; equipo?: string }> = [
      {
        // F26 · Un T3 con cristal T1: el rejections ya no es "el jugador pidió
        // otro nivel", es "este recolector necesita el suyo y no lo tienes".
        // Antes el caso era un `crystal('x1', 1, ...)` con un `upgrade...(1)`
        // explícito; ahora el nivel lo pone el item y no se puede pedir otro.
        nombre: 'sin cristales de ese nivel',
        save: baseSave([collector('r1', 3, { damage: 60, level: 4 }), crystal('x1', 1, 5)], { nanites: 0 })
      },
      {
        nombre: 'con menos cristales de los necesarios',
        save: baseSave([collector('r1', 3, { damage: 60, level: 10 }), crystal('x1', 3, 1)], { nanites: 0 })
      },
      {
        nombre: 'en el techo de niveles',
        save: baseSave([collector('r1', 3, { damage: 60, level: 20, maxLevel: 20 }), crystal('x1', 3, 99)], { nanites: 0 })
      },
      {
        nombre: 'sin recolector equipado',
        save: baseSave([crystal('x1', 1, 9)], { nanites: 0 })
      }
    ];

    for (const caso of rechazos) {
      const g = await boot(caso.save);
      if (caso.equipo !== null) g.equipCollector('r1');
      const crystalsAntes = (g.getState().warehouse as any[])
        .filter((w: any) => w.type === 'crystal')
        .reduce((a: number, w: any) => a + (w.stackCount || 1), 0);

      const nivelAntes = find(g, 'r1')?.level;
      const res = g.upgradeEquippedCollector();
      const roll = tuningRoll(res, nivelAntes ?? 0, find(g, 'r1')?.level ?? 0);
      const crystalsDespues = (g.getState().warehouse as any[])
        .filter((w: any) => w.type === 'crystal')
        .reduce((a: number, w: any) => a + (w.stackCount || 1), 0);

      check(`rechazo (${caso.nombre}): el motor dice que no se tiro el dado`,
        res.success === false && res.rolled === false,
        `success=${res.success} rolled=${res.rolled} msg=${res.msg ?? ''}`);
      check(`rechazo (${caso.nombre}): y la ruleta no lo presenta como tirada`,
        roll.rolled === false,
        `rolled=${roll.rolled}: con esto el selector avisa por toast y no gira nada`);
      check(`rechazo (${caso.nombre}): no se gasta ni un cristal`,
        crystalsDespues === crystalsAntes,
        `antes=${crystalsAntes} despues=${crystalsDespues}`);
      check(`rechazo (${caso.nombre}): el nivel no se mueve`,
        (find(g, 'r1')?.level ?? 0) === (nivelAntes ?? 0),
        `antes=${nivelAntes} ahora=${find(g, 'r1')?.level}`);
    }
  }
  {
    // Y el caso degenerado: un motor viejo, o un mock sin `rolled`. Se trata
    // como "no hay ruleta", que es la salida que no le enseña al jugador un
    // resultado que nadie ha tirado. Mismo criterio que R11 con los saves.
    const viejo = tuningRoll({ success: true, msg: 'x' } as any, 4, 5);
    check('contrato: sin `rolled` no se gira la ruleta',
      viejo.rolled === false && viejo.success === false,
      `rolled=${viejo.rolled} success=${viejo.success}`);

    // Y el motor da siempre el nivel con el que se queda. La ruleta lo usa
    // para la flecha, y sin el tendria que releer el item, que es el error del
    // "5 -> 5" que esta seccion existe para cerrar.
    const g = await boot(baseSave([
      collector('r1', 3, { damage: 60, level: 4 }),
      crystal('x1', 3, 9)
    ], { nanites: 0 }));
    g.equipCollector('r1');
    const ok = conRoll(0, () => g.upgradeEquippedCollector());
    const mal = conRoll(0.999, () => g.upgradeEquippedCollector());
    check('contrato: el motor devuelve el nivel con el que se queda',
      ok.level === 5 && mal.level === 5,
      `acierto=${ok.level} fallo=${mal.level}: el fallo no retrocede, asi que los dos suben`);
  }
  {
    // F17: el check de saltar la ruleta. Es una preferencia de vista por
    // dispositivo (`localStorage`, como el tema), no progreso: el premio ya
    // está decidido y aplicado antes de montar nada, así que saltar no puede
    // cambiar la economía. Lo que se ata aquí es que la preferencia exista,
    // persista y coaccione: un valor raro es "no saltar", nunca un trompo
    // a medias. El cartel directo se mira en `ruleta-preview.html`, porque
    // necesita medir que sin cinta no queda una cinta quieta a la vista.
    const anterior = getSkipRoulette();
    try {
      setSkipRoulette(false);
      check('salto: por defecto no se salta nada',
        getSkipRoulette() === false,
        `skip=${getSkipRoulette()}`);
      setSkipRoulette(true);
      check('salto: el check persiste al releer',
        getSkipRoulette() === true,
        `skip=${getSkipRoulette()}`);
      localStorage.setItem('cyberforge_skip_roulette', 'cualquier cosa');
      check('salto: un valor raro es no saltar, no un estado roto',
        getSkipRoulette() === false,
        `skip=${getSkipRoulette()}`);
      setSkipRoulette(true);
      await reload();
      check('salto: sobrevive a la recarga, como el tema',
        getSkipRoulette() === true,
        `skip=${getSkipRoulette()}`);
    } finally {
      setSkipRoulette(anterior);
    }
  }

  resumen('giro de la ruleta');
}

export default main();
