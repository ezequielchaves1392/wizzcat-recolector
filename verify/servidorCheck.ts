// ==========================================================================
//  F103 · LA ELECCIÓN DE SERVIDOR SE DECIDE EN UN SOLO SITIO
// ==========================================================================
//
//  **EL BUG QUE ESTE BANCO IMPIDE, Y YA PASÓ UNA VEZ.** La salida al otro
//  servidor (F101) se enseñaba o no según una variable del build
//  (`VITE_URL_OTRO_SERVIDOR`): un despliegue sin la variable no ofrecía nada
//  y el jugador se quedaba mirando el cartel de mantenimiento sin salida.
//  La lección es la de siempre en este proyecto —dos sitios decidiendo lo
//  mismo acaban diciendo cosas distintas—, así que la pregunta "¿en qué
//  servidor juego?" vive en `src/data/servidores.ts` y aquí se ata su orden:
//  el enlace manda sobre lo guardado, y lo guardado sobre la serie.
//
//  **LO QUE NO SE COMPRUEBA AQUÍ.** El pintado del selector y de la pastilla
//  del acceso son DOM, y `verify/` no cubre render por diseño: se miran en
//  `auth-preview.html`. Lo que sí se comprueba es que ninguna combinación de
//  enlace, recuerdo y serie pueda dejar al jugador en un servidor que no
//  pidió, porque eso es perder su partida de vista.
import { check, resumen } from './kit';
import {
  claveServidor,
  esServidor,
  leerParametroServidor,
  resolverServidor
} from '../src/data/servidores';

async function main() {
  // ---- 1. EL ENLACE MANDA SOBRE TODO ----
  //
  // Un enlace es una decisión de ahora mismo: si alguien te manda al 2,
  // ni tu recuerdo del 1 ni la serie del build pueden retenerte en el 1.
  {
    check('F103: ?servidor=2 gana a lo guardado (1) y a la serie (1)',
      resolverServidor('2', '1', '1') === '2', 'param=2, guardado=1, defecto=1');
    check('F103: ?servidor=1 gana a lo guardado (2)',
      resolverServidor('1', '2', '1') === '1', 'param=1, guardado=2, defecto=1');
  }

  // ---- 2. SIN ENLACE, MANDA LO GUARDADO ----
  {
    check('F103: sin enlace se vuelve al servidor elegido ayer (2)',
      resolverServidor(null, '2', '1') === '2', 'param=nada, guardado=2');
    check('F103: sin enlace ni recuerdo toca la serie del build',
      resolverServidor(null, null, '1') === '1', 'param=nada, guardado=nada, defecto=1');
    check('F103: y la serie también puede ser el 2 (despliegue con la variable)',
      resolverServidor(null, null, '2') === '2', 'defecto=2 por VITE_FIREBASE_SERVIDOR');
  }

  // ---- 3. LO QUE NO VALE NO DECIDE ----
  //
  // Un `?servidor=3` no es un servidor: si valiera, un enlace roto te
  // sacaría de tu partida. Y un recuerdo corrupto no puede pesar más que
  // la serie, que siempre vale.
  {
    check('F103: un enlace que no es servidor se ignora y manda lo guardado',
      resolverServidor(leerParametroServidor('?servidor=3'), '1', '2') === '1',
      '?servidor=3 con recuerdo del 1');
    check('F103: un recuerdo que no es servidor se ignora y manda la serie',
      resolverServidor(null, 'perdido', '1') === '1', 'guardado="perdido"');
    check('F103: sin nada que valga no hay vacío: siempre hay un servidor',
      resolverServidor(null, null, '1') === '1', 'todo vacío');
  }

  // ---- 4. EL ENLACE SE LEE BIEN ----
  {
    check('F103: el enlace trae el 2',
      leerParametroServidor('?servidor=2') === '2', '?servidor=2');
    check('F103: el enlace convive con otros parámetros',
      leerParametroServidor('?ops=1&servidor=1') === '1', '?ops=1&servidor=1');
    check('F103: sin parámetro no hay decisión',
      leerParametroServidor('?ops=1') === null, 'sin servidor=');
    check('F103: con la cadena vacía tampoco',
      leerParametroServidor('') === null, 'cadena vacía');
  }

  // ---- 5. CADA SERVIDOR TIENE SUS RECUERDOS ----
  //
  // La misma persona puede tener cuenta en los dos con contraseñas
  // distintas: sin sufijo, el segundo probaría la contraseña del primero.
  {
    const user1 = claveServidor('cyberforge_remember_user', '1');
    const user2 = claveServidor('cyberforge_remember_user', '2');
    check('F103: el recuerdo del 1 y el del 2 no comparten clave',
      user1 !== user2, `${user1} frente a ${user2}`);
    check('F103: y la clave es estable para el mismo servidor',
      claveServidor('cyberforge_remember_user', '1') === user1, 'dos lecturas iguales');
    check('F103: solo el 1 y el 2 valen como servidor',
      esServidor('1') && esServidor('2') && !esServidor('3') && !esServidor(''),
      '1 y 2 sí; 3 y vacío no');
  }

  resumen('F103: la elección de servidor se decide en un solo sitio');
}

export default main();
