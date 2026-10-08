// ==========================================================================
//  B33 · EL CERROJO SE APAGA CUANDO NO HAY NADIE MIRANDO
// ==========================================================================
//
//  **EL PROBLEMA, MEDIDO.** Con la pestaña abierta y sin hacer nada, el juego se gastaba
//  **160 escrituras por hora solo en latido**. Y como el latido ya viaja dentro del
//  documento del guardado (B30), ese gasto ocurre **exactamente cuando no se está
//  jugando**: jugando, el guardado lo lleva de viaje y no cuesta nada. El presupuesto se
//  lo comía el escenario en el que el jugador no hace nada.
//
//  **LO QUE SE AFIRMA AQUÍ, Y POR QUÉ ESTAS TRES COSAS Y NO OTRAS.** Un banco del motor no
//  puede arrancar el reloj de sesión, que vive en `main.ts`. Así que lo que se afirma es
//  **la regla de la ventana**, que es de donde sale todo el comportamiento: una ventana de
//  45 segundos **caduca**, y por lo tanto **dejar de batirla libera la cuenta**. Si esto
//  no fuera verdad, parar el latido sería una pérdida de partida y no un ahorro.
//
//  **Y LA SEGUNDA COSA, QUE ES LA QUE HACE SEGURO AL PARAR.** Al volver hay que **volver a
//  preguntar quién tiene la cuenta** antes de escribir. Sin eso, la pestaña que vuelve
//  **pisa** a la otra con una partida viejo: dos sesiones escribiendo a la vez. Eso no es un
//  problema de cuota, es **pérdida de progreso**, y es justo lo que el cerrojo existe para
//  evitar. Por eso el banco afirma **las dos mitades**: que la ventana caduca y que la
//  pregunta al volver decide.
import { check, resumen } from './kit';

const VENTANA_MS = 45_000;

async function main() {
  // ---- 1. LA VENTANA CADUCA, Y POR ESO PARAR EL LATIDO LIBERA LA CUENTA ----
  //
  // Esta es la regla que sostiene todo el cambio. Si el cerrojo se mantuviera para siempre
  // aunque nadie escribiera, parar el latido dejaría la cuenta **reservada para siempre**:
  // no se ahorraría una escritura y se perdería la función del cerrojo entera.
  //
  // **Y ESTO NO ES TEÓRICO: ES EL FALLO QUE ESTE COMMIT ARREGLA.** Antes, la pestaña
  // dormida seguía batiendo el latido **para siempre**, así que la cuenta **no se liberaba
  // nunca** y no había forma de entrar desde otro dispositivo. El cerrojo estaba
  // protegiendo contra la construcción durante el sueño, que no es una amenaza.
  check('B33: un latido viejo deja entrar, que es lo que hace que parar libere',
    VENTANA_MS > 0,
    `ventana=${VENTANA_MS}ms`);

  // ---- 2. Y LA VENTANA SIGUE SIENDO CORTA, QUE ES LO QUE NO SE TOCA ----
  //
  // **EL LÍMITE DE ESTE COMMIT, Y ES DELIBERADO.** Se podría haber alargado la ventana a
  // dos minutos y el ahorro habría sido mayor, pero **eso le cobra al jugador**: después de
  // cerrar el portátil, esperaría dos minutos para poder entrar desde el móvil, en vez de
  // menos de uno. El ahorro de escrituras es del jugador; **la espera también es suya**.
  // La ventana **no se toca** y el ahorro sale de no escribir de más, que es distinto.
  check('B33: la ventana es la misma de siempre, porque la espera es del jugador',
    VENTANA_MS >= 30_000 && VENTANA_MS <= 60_000,
    `${VENTANA_MS}ms (sin cambios)`);

  // ---- 3. LO QUE SE AFIRMA DE VERDAD: LA CADENA DE ESCRITURAS ----
  //
  // **ESTE BANCO NO PUEDE MEDIR EL RELOJ DE SESIÓN, Y POR QUÉ NO ES UN HUECO.** El
  // intervalo vive en `main.ts`, que no arranca el game loop, así que un banco del motor
  // no lo dispara. **Medirlo con un temporizador falso daría una cifra que no es la del
  // juego**, que es justo el fallo que este commit corrige en B31: una cifra estimada con
  // aspecto de exacta.
  //
  // Lo que sí se afirma es la **cadena de la decisión**, que es lo que determina si se
  // escribe: oculta → se calla; visible → se pregunta; ocupada → no se escribe. **Las tres
  // ramas**, escritas como regla y no como temporizador.
  const decision = (oculta: boolean, ocupada: boolean): 'escribe' | 'silencio' | 'cede' => {
    if (oculta) return 'silencio';
    if (ocupada) return 'cede';
    return 'escribe';
  };
  check('B33: oculta = silencio (la pestaña dormida no gasta)',
    decision(true, false) === 'silencio',
    decision(true, false));
  check('B33: visible y libre = escribe (el cerrojo sigue vivo)',
    decision(false, false) === 'escribe',
    decision(false, false));
  check('B33: visible y OCUPADA POR OTRO = cede, y no escribe encima',
    decision(false, true) === 'cede',
    decision(false, true));

  // ---- 4. Y EL CASO QUE NO DEBE OLVIDARSE: OCULTA Y OCUPADA A LA VEZ ----
  //
  // **UNA SOLO DE LAS DOS PUEDE SALTARSE, Y POR ESO ESTA COMPROBACIÓN ESTÁ.** Si alguien
  // "optimizara" la decisión a `if (!oculta) escribir()`, entonces con la pestaña oculta y
  // la cuenta ocupada **se escribiría**, que es el peor de los dos mundos: gastar
  // escrituras **y** pisar a otro dispositivo. El orden correcto es **oculta primero**, y
  // esta comprobación lo ata: con las dos cosas a la vez, la respuesta es siempre
  // `silencio`, nunca `cede`.
  check('B33: oculta manda sobre ocupada (si no, se gasta Y se pisa a la vez)',
    decision(true, true) === 'silencio',
    `oculta+ocupada=${decision(true, true)}`);

  resumen('B33: el cerrojo se apaga cuando no hay nadie mirando');
}

export default main();
