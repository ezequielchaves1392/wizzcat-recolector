// ==========================================================================
//  EL GUARDADO: QUE EL AVISO DIGA LA VERDAD
//
//  El aviso "Sin guardar en el servidor" aparecía sin motivo, y sin motivo es
//  la peor forma de que un aviso exista: el jugador aprende a ignorarlo, y el día
//  que de verdad importa ya no lo lee.
//
//  Este banco mide las tres cosas que lo hacen mentir:
//
//    1. **El ranking va en otro documento y puede fallar solo.** Con las dos
//       escrituras en el mismo `try`, un fallo del ranking encendía el aviso con
//       la partida perfectamente guardada.
//    2. **El ranking no es el saldo.** Se guardaba `state.nanites`, y la Ascensión
//       lo pone a cero: ascendías y caías al último puesto del ranking.
//    3. **Un fallo de verdad sí lo enciende.** Que no se encienda siempre no
//       sirve de nada si no se enciende nunca.
//
//  Y nada de esto es comprobable mirando el código a ojo: los tres son
//  combinaciones de "qué escritura falló" con "qué dice el aviso".
// ==========================================================================

import { boot, reload, check, resumen, baseSave, guardado } from './kit';
import { computeScore } from '../src/services/rankingService';

/**
 * lush() NO espera al setDoc -es una promesa suelta-, as� que hay que dar un
 * turno al bucle de eventos para que la escritura llegue. queueCheck hace lo
 * mismo con un setTimeout de 20 ms y por eso sus pruebas no son instantáneas.
 */
async function asentar(): Promise<void> {
  await new Promise((r) => setTimeout(r, 20));
}

/** El nodo del aviso grande, tal y como lo deja `marcarPendiente`. */
function indicador(): any {
  return (globalThis as any).__DOM__?.['#pending-save-indicator'] ?? null;
}

/** Enciende el indicador como hace `marcarPendiente(true)`. */
function conIndicador(prueba: () => Promise<void>): Promise<void> {
  const el: any = {
    clases: new Set<string>(),
    classList: {
      toggle: (_c: string, quitar: boolean) => { if (quitar) el.clases.add('hidden'); else el.clases.delete('hidden'); }
    }
  };
  (globalThis as any).__DOM__ = { ...((globalThis as any).__DOM__ ?? {}), '#pending-save-indicator': el };
  return prueba().finally(() => {
    delete (globalThis as any).__DOM__['#pending-save-indicator'];
  });
}

/** ¿El indicador grande está encendido? */
function avisado(): boolean {
  const el = indicador();
  return !!el && !el.clases.has('hidden');
}

async function main() {
  // -------------------------------------------------------------------------
  //  1. EL RANKING GUARDA EL HISTÓRICO, NO EL SALDO
  // -------------------------------------------------------------------------
  {
    const g = await boot(baseSave([], {
      nanites: 5_000,
      totalNanitesProduced: 90_000_000
    }));
    await g.flush();
    await asentar();
    const rank = (globalThis as any).__MEM_DB__['rankings/user_test'] ?? (globalThis as any).__MEM_DB__['rankings/test'];
    const claves = Object.keys((globalThis as any).__MEM_DB__).filter(k => k.startsWith('rankings/'));
    check('guardado: se ha escrito el documento del ranking', claves.length === 1, claves.join(','));
    const doc = (globalThis as any).__MEM_DB__[claves[0]];
    check('guardado: el ranking guarda lo PRODUCIDO, no el saldo',
      doc.score === 90_000_000,
      `score=${doc.score} producido=${90_000_000} saldo=${5_000}`);
  }
  {
    // **Y LA ASCENSIÓN NO LO TOCA.** Este es el bug: el ranking se guardaba con el
    // saldo, y la Ascensión lo reinicia. Ascendías y caías al último puesto, y
    // el jugador que más había jugado era el que más perdía.
    const g = await boot(baseSave([], {
      nanites: 50_000_000,
      totalNanitesProduced: 900_000_000,
      resets: 0
    }));
    await g.flush();
    await asentar();
    const antes = { ...(globalThis as any).__MEM_DB__[claveDeRanking()] };
    const asc = g.prestige();
    check('guardado: la asension se puede hacer', asc?.success === true, asc?.msg ?? '');
    await g.flush();
    await asentar();
    const despues = (globalThis as any).__MEM_DB__[claveDeRanking()];
    check('guardado: la asension NO baja la puntuacion del ranking',
      despues.score === antes.score && despues.score === 900_000_000,
      `antes=${antes.score} despues=${despues.score}`);
    check('guardado: ni la del definitivo, que es la que ordena la tabla',
      computeScore(despues) >= computeScore(antes) - 1,
      `antes=${computeScore(antes)} despues=${computeScore(despues)}`);
  }

  // -------------------------------------------------------------------------
  //  2. EL SEGUNDO ASCENSO SIGUE SIENDO POSIBLE
  // -------------------------------------------------------------------------
  //  Este era el bug más caro de todo el lote, y no lo pedía nadie explícitamente:
  //  salía de "reiniciar los contadores" sin mirar quién los leía.
  //
  //  Los núcleos del siguiente ascenso son
  //  `max(0, pendingCores(totalNanitesProduced) − totalCores)`. Con
  //  `totalNanitesProduced` a cero tras el ascenso, `pendingCores(0)` vale cero y
  //  el segundo ascenso **no existía**: botón muerto, mensaje de "necesitas
  //  producir más", sin ninguna explicación de por qué.
  {
    const g = await boot(baseSave([], { nanites: 60_000_000, totalNanitesProduced: 900_000_000 }));
    const p1 = g.prestige();
    check('historico: el primer ascenso se paga', p1?.success === true, p1?.msg ?? '');

    const trasP1 = (globalThis as any).__MEM_DB__['users/test'];
    check('historico: la produccion acumulada NO se reinicia con el ascenso',
      trasP1.totalNanitesProduced === 900_000_000,
      `tras el ascenso=${trasP1.totalNanitesProduced}`);

    // Ahora la partida sigue, el jugador vuelve a producir y se guarda. Se
    // recarga desde el documento, que es lo que de verdad pasa al refrescar.
    const g2 = await reload();

    // **QUE EL SEGUNDO ASCENSO SEA ALCANZABLE, NO QUE SEA GRATIS.**
    //
    // El escalado es correcto y hay que respetarlo: los núcleos ya cobrados se
    // restan (`nextCores` es la diferencia), así que el primer ascenso agota
    // todo lo que la producción de ese momento justificaba y el siguiente pide
    // más producción. Por eso esta comprobación no afirma que Pending sea > 0
    // sin más —con la producción justa da cero, y está bien que dé cero—, sino
    // que **subir la producción lo vuelve a mover**. Con el contador a cero ese
    // incremento no existía: Pending se quedaba en cero para siempre.
    const antesDeProducir = g2.getPrestigeInfo().pending;
    g2.getState().totalNanitesProduced = 9_000_000_000;
    const despuesDeProducir = g2.getPrestigeInfo();
    check('historico: producing mas vuelve a mover el siguiente ascenso',
      despuesDeProducir.pending > antesDeProducir && despuesDeProducir.pending > 0,
      `antes=${antesDeProducir} despues=${despuesDeProducir.pending} ` +
      `producido=${despuesDeProducir.totalProduced} totalCores=${despuesDeProducir.totalCores}`);

    // Y el segundo ascenso, de verdad, a través de la misma puerta.
    const p2 = g2.prestige();
    check('historico: el SEGUNDO ascension se puede hacer',
      p2?.success === true && p2?.gained > 0,
      `${p2?.msg ?? ''} ganado=${p2?.gained}`);
    check('historico: y el segundo da MAS que el primero',
      (p2?.gained ?? 0) > (p1?.gained ?? 0),
      `primero=${p1?.gained} segundo=${p2?.gained}`);
    check('historico: y la produccion acumulada sigue adelante, sin pararse',
      (g2.getState() as any).totalNanitesProduced >= 9_000_000_000,
      `produccion=${(g2.getState() as any).totalNanitesProduced}`);
  }

  // -------------------------------------------------------------------------
  //  3. LOS HISTÓRICOS QUE NO SON DE ESTA SUBIDA
  // -------------------------------------------------------------------------
  {
    // Clics y cajas abiertas salen en las tablas y en el panel de administración:
    // son la marca de haber jugado, no el progreso de la subida actual.
    const g = await boot(baseSave([], {
      nanites: 60_000_000,
      totalNanitesProduced: 900_000_000,
      totalClicks: 4321,
      cratesOpened: 87
    }));
    g.prestige();
    const e = g.getState() as any;
    check('historico: los clics no se pierden al ascender',
      e.totalClicks === 4321, `totalClicks=${e.totalClicks}`);
    check('historico: las cajas abiertas no se pierden al ascender',
      e.cratesOpened === 87, `cratesOpened=${e.cratesOpened}`);

    // Y lo que SÍ es de la subida, sí se reinicia. Si esto no pasara, el Ascenso
    // no sería un Ascenso: sería F2 con un contador.
    check('historico: pero el saldo SÍ se reinicia', e.nanites === 0, `nanites=${e.nanites}`);
    check('historico: y los companeros vuelven al de partida',
      (e.companions ?? []).length === 1, `companions=${(e.companions ?? []).length}`);
  }

  // -------------------------------------------------------------------------
  //  4. LAS RANURAS DE COMPAÑERO COMPRADAS NO SE PIERDEN
  // -------------------------------------------------------------------------
  //  `maxCompanionSlots` no es progreso: es una compra. Y se cobraba con recurso.
  //  Ascender después de comprarlas era pagar por algo que el siguiente ascenso se
  //  llevaba. Las del árbol nunca tuvieron ese problema —viven en `nodeLevels`—,
  //  así que el bug solo se veía en las compradas, que son las únicas que cuestan.
  {
    const g = await boot(baseSave([], { nanites: 60_000_000, totalNanitesProduced: 900_000_000, maxCompanionSlots: 4 }));
    check('historico: las ranuras compradas son 4 antes de ascender',
      (g.getState() as any).maxCompanionSlots === 4, `${(g.getState() as any).maxCompanionSlots}`);
    g.prestige();
    check('historico: y siguen siendo 4 despues de ascender',
      (g.getState() as any).maxCompanionSlots === 4,
      `tras=${(g.getState() as any).maxCompanionSlots}`);
    check('historico: y el guardado tamben las lleva',
      (globalThis as any).__MEM_DB__['users/test'].maxCompanionSlots === 4,
      `guardado=${(globalThis as any).__MEM_DB__['users/test'].maxCompanionSlots}`);
  }

  // -------------------------------------------------------------------------
  //  5. UN FALLO DEL RANKING NO ENCIENDE EL AVISO DE "SIN GUARDAR"
  // -------------------------------------------------------------------------
  await conIndicador(async () => {
    const g = await boot(baseSave([], { nanites: 1234, totalNanitesProduced: 5000 }));
    (globalThis as any).__MEM_DB__.fallarDoc = 'rankings/';
    await g.flush();
    await asentar();
    delete (globalThis as any).__MEM_DB__.fallarDoc;

    const guardadoDeLaPartida = guardado();
    check('aviso: con el ranking caido, la partida SI esta guardada',
      !!guardadoDeLaPartida && guardadoDeLaPartida.nanites === 1234,
      `nanites=${guardadoDeLaPartida?.nanites}`);
    check('aviso: y el aviso de "sin guardar" NO se enciende',
      !avisado(),
      avisado() ? 'encendido con la partida guardada' : 'apagado');
  });

  // -------------------------------------------------------------------------
  //  3. UN FALLO DE VERDAD SÍ LO ENCIENDE
  // -------------------------------------------------------------------------
  await conIndicador(async () => {
    const g = await boot(baseSave([], { nanites: 4321, totalNanitesProduced: 9000 }));
    (globalThis as any).__MEM_DB__.fallar = true;
    await g.flush();
    await asentar();
    delete (globalThis as any).__MEM_DB__.fallar;

    check('aviso: sin red, el aviso de "sin guardar" se enciende',
      avisado(),
      avisado() ? 'encendido' : 'apagado');

    // Y se apaga al volver. Un aviso que no se apaga es una mentira más.
    await g.flush();
    await asentar();
    check('aviso: y se apaga en cuanto el servidor responde otra vez',
      !avisado(),
      avisado() ? 'sigue encendido' : 'apagado');
  });

  // -------------------------------------------------------------------------
  //  4. LAS DOS ESCRITURAS SIGUEN SIENDO DOS
  // -------------------------------------------------------------------------
  {
    const g = await boot(baseSave([], { nanites: 10, totalNanitesProduced: 20 }));
    await g.flush();
    await asentar();
    const claves = Object.keys((globalThis as any).__MEM_DB__);
    check('guardado: el juego sigue escribiendo partida Y ranking',
      claves.includes('users/test') && claves.some(k => k.startsWith('rankings/')),
      claves.join(','));
    check('guardado: y el documento del ranking lleva los nucleos ganados',
      (globalThis as any).__MEM_DB__[claveDeRanking()].cores === (globalThis as any).__MEM_DB__['users/test'].totalCores,
      `${(globalThis as any).__MEM_DB__[claveDeRanking()].cores} vs ${(globalThis as any).__MEM_DB__['users/test'].totalCores}`);
  }


  // =========================================================================
  //  La carga fallida NO puede guardarse. Y esto no es una prueba de que "no
  //  pasa": es la prueba de que el daño NO ocurre.
  // =========================================================================
  //
  // **POR QUE ESTA EN `guardadoCheck` Y NO EN UNO NUEVO.** El fallo no es del
  //  arranque: es del guardado. Si la lectura inicial falla, el motor se queda con una
  //  partida nueva en memoria, y a los quince segundos el guardado automático escribe
  //  esos valores encima de la partida de verdad. **La escritura tiene éxito**, así que
  //  no falla, no avisa y no hay ni un error en el journey que lo explique: la partida
  //  entera desaparece sin ruido. Es el peor fallo posible en este juego y el más
  //  silencioso, y solo se detecta comprobando que el documento sigue como estaba.
  {
    // **LA FOTO SE SACA DEL MISMO `baseSave` QUE VA EN LA BASE DE DATOS.** Antes se
    // copiaba el documento que habia antes del `boot`, y eso comparaba la partida de un
    // banco con la de otro: la diferencia la hacia el `boot`, no el guardado, y la
    // prueba podia fallar con el motor haciendo lo correcto.
    const esperado: any = JSON.parse(JSON.stringify(baseSave([])));
    (globalThis as any).__MEM_DB__.fallarLectura = true;
    const g = await boot(baseSave([]));
    (globalThis as any).__MEM_DB__.fallarLectura = false;

    check(
      'guardado: si la carga falla, el motor lo dice',
      g.cargaFallida() === true,
      'cargaFallida=' + String(g.cargaFallida?.())
    );

    // **LO QUE SE COMPRUEBA ES EL DAÑO, NO LA LLAMADA.** Que `saveToFirebase` no se
    // llama es un detalle de implementación; lo que importa es que el documento de la
    // partida **sigue siendo exactamente el que había**. Por eso la comparación es
    // documento entero contra documento entero, y no un contador de escrituras: un
    // guardado en blanco se distingue por haber cambiado cualquier campo.
    g.flush();
    g.flush();
    const ahora: any = JSON.parse(JSON.stringify(guardado()));
    const cambiados = Object.keys(esperado).filter((k) =>
      JSON.stringify(ahora[k]) !== JSON.stringify(esperado[k]));
    check(
      'guardado: y no se escribe una partida en blanco encima',
      cambiados.length === 0,
      'han cambiado: ' + (cambiados.join(',') || 'nada')
    );
    check(
      'guardado: ni las nanitas ni el inventario se pisan',
      ahora.nanites === esperado.nanites
      && JSON.stringify(ahora.warehouse) === JSON.stringify(esperado.warehouse),
      `nanites=${ahora.nanites} esperado=${esperado.nanites}`
    );

    // Y el estado bueno: con la lectura bien, el motor dice que se puede guardar.
    const g2 = await boot(baseSave([]));
    check(
      'guardado: y con la lectura bien, guardar si esta habilitado',
      g2.cargaFallida() === false,
      'cargaFallida=' + String(g2.cargaFallida?.())
    );
  }

  resumen('el guardado: que el aviso diga la verdad');
}

/** La clave del documento del ranking, que lleva el uid del banco. */
function claveDeRanking(): string {
  return Object.keys((globalThis as any).__MEM_DB__).find(k => k.startsWith('rankings/')) ?? 'rankings/test';
}

export default main();