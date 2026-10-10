// ==========================================================================
//  B31 · CUÁNTO CUESTA UNA HORA DE JUEGO REAL, MEDIDA CON EL RELOJ DE VERDAD
// ==========================================================================
//
//  **POR QUÉ ESTE BANCO EXISTE, Y ES PORQUE DI UN NÚMERO QUE NO MEDÍ.**
//
//  B30 ató el latido al documento del guardado, y la nota de parche dice que una pestaña
//  24 h pasa de 8.160 a 5.280 escrituras. **Ese 5.280 salió de restar una cifra
//  inventada**, de suponer que el latido bajaría a 40 por hora. **La única forma de
//  saberlo es medirlo con el reloj corriendo**, y este banco existe para que la cifra que
//  se diga en voz alta salga de aquí y no de una resta.
//
//  **LA DUDA QUE RESUELVE, Y ES CONCRETA.** El ahorro del latido de viaje depende de una
//  carrera entre dos relojes que **no son el mismo**:
//
//    · el guardado escribe la partida cada `RITMO_GUARDADO_MS` (2 min);
//    · el latido se considera fresco durante `VENTANA_MS / 2` (2,5 min).
//
//  Para que el piggyback ahorre, el guardado tiene que ocurrir **más a menudo** que la
//  ventana de frescura. **Ocurre**: 2 min es más rápido que 2,5 min. O sea que entre dos
//  guardados no hay ningún latido que se vaya solo mientras haya progreso, y el latido
//  suelto solo sale cuando el bloque se salta por "sin cambios". Esto no lo averigua
//  leyendo el código —se puede leer y pensar que sí—: lo averigua mirando un contador
//  mientras pasa el tiempo.
//
//  **LO QUE SE MIDE, Y CÓMO.** Se levanta el juego de verdad, se conecta el latido como en
//  `main.ts`, y se dejan correr **los relojes de verdad** durante un rato. **No se simula
//  el paso del tiempo con un bucle apretado**: un bucle de un milisegundo mide una
//  arranquera y no un minuto de reloj. Por eso el banco **espera** de verdad y por eso es
//  lento a propósito: la velocidad no sirve aquí, la cuenta sí.
//
//  **EL NÚMERO QUE SE PUEDE DECIR.** Escrituras por hora, con el juego guardado, latido y
//  presencia conectados, y la partida quieta (que es el caso caro: jugando, el guardado
//  escribe igual, así que el número de abajo es el mínimo y el de jugando es mayor).
import { boot, check, resumen, baseSave } from './kit';
import { campoLatido, confirmarLatido, anotarLatido, VENTANA_MS } from '../src/services/sessionService';
import { RITMO_GUARDADO_MS } from '../src/gameLoop';

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

function escritas(): number {
  return ((globalThis as any).__MEM_DB__?.escrituras ?? 0) as number;
}

async function main() {
  // **LOS MINUTOS QUE SE MIDEN. CUATRO, Y NO UNO**, porque con uno el número sale de un
  // solo intervalo de guardado y **el resultado depende de dónde cae el principio**: con
  // cuatro, cualquier fase del reloj queda dentro y el número es el mismo llegue donde
  // llegue. Es la diferencia entre medir y sacar una cifra de un momento afortunado.
  const MINUTOS = 4;
  const g: any = await boot(baseSave([], { nanites: 5_000 }), {
    campoDeLatido: () => campoLatido('test', 'dispositivo') as any,
    confirmarLatido,
  });

  // Antes de contar, un guardado para que el reloj arranque limpio.
  await g.flush();
  await dormir(50);
  const inicio = Date.now();
  const antes = escritas();

  // **LOS TRES RELOJES, LOS MISMOS QUE EN EL JUEGO, CORRIENDO A LA VEZ.**
  //   · el latido, cada `VENTANA_MS / 2`;
  //   · el guardado, cada `RITMO_GUARDADO_MS`;
  //   · y la partida quieta, que es lo que hace que el guardado se salte (B28) y lo que
  //     hace que la cifra sea **el mínimo**.
  // Los dos pasos se leen del juego, no de una copia: si alguien mueve un ritmo
  // y no el otro, el banco sigue midiendo el juego de verdad.
  const pasoLatido = Math.floor(VENTANA_MS / 2);
  const pasoGuardado = RITMO_GUARDADO_MS;
  const t0 = Date.now();
  let ultimoLatido = 0;
  let ultimoGuardado = 0;
  while (Date.now() - t0 < MINUTOS * 60_000) {
    const ahora = Date.now() - t0;
    if (ahora - ultimoLatido >= pasoLatido) {
      ultimoLatido = ahora;
      await anotarLatido('test', 'dispositivo');
    }
    if (ahora - ultimoGuardado >= pasoGuardado) {
      ultimoGuardado = ahora;
      await g.flush();
    }
    await dormir(250);
  }

  const gastadas = escritas() - antes;
  const minutos = (Date.now() - inicio) / 60_000;
  const porHora = Math.round((gastadas / minutos) * 60);
  await g.cleanup?.();

  check('B31: los cuatro minutos se han medido de verdad, no simulados',
    minutos >= MINUTOS - 0.2 && minutos < MINUTOS + 0.5,
    `${minutos.toFixed(2)} min de reloj`);
  check('B31: y sale un número por hora que se puede decir en voz alta',
    porHora > 0,
    `${gastadas} escrituras en ${minutos.toFixed(1)} min = ${porHora}/hora`);

  // **LO QUE ESTA CIFRA DICE Y LO QUE NO.** Es el gasto de **una pestaña, con la partida
  // quieta**: ni compras, ni aperturas, ni forja. **Es el mínimo**, porque el guardado se
  // salta y el jugador parado es el que menos hace. Y no incluye lo que se gasta al
  // arrancar, que es lo que pasa en cada recarga.
  console.log(`      [B31] ${gastadas} escrituras en ${minutos.toFixed(1)} min de reloj = ${porHora}/hora/pestaña`);

  resumen('B31: lo que cuesta una hora de juego, con el reloj de verdad');
}

export default main();
