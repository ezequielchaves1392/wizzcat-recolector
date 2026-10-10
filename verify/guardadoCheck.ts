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

import { boot, reload, check, resumen, baseSave, guardado, s } from './kit';
import { computeScore } from '../src/services/rankingService';
import { CLAVE_MODO_PRUEBAS } from '../src/gameLoop';

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
  //  B38 · UN FALLO AL PUBLICAR LA FILA REINTENTA EN EL SIGUIENTE PERIODO.
  // -------------------------------------------------------------------------
  //  La fila sale como mucho una vez cada quince minutos (F104), y el envío
  //  solo se marca después de escribir: con la escritura fallida, el siguiente
  //  periodo la ve pendiente y no espera al siguiente. Sin esto, un fallo
  //  dejaría la fila congelada un cuarto de hora con un daño viejo.
  //
  //  **EL RELOJ SIMULADO, Y POR QUÉ.** Quince minutos no se esperan en un
  //  banco: se adelanta `Date.now` y se devuelve en `finally`. Sin reboot en
  //  medio no hay comparación de fechas que romper, y la cola usa la misma
  //  marca para anotar y confirmar, así que tampoco se descompasa.
  {
    const g = await boot(baseSave([], { nanites: 1234, totalNanitesProduced: 5000 }));
    g.click();
    const saldo = s(g).nanites;
    (globalThis as any).__MEM_DB__.fallarDoc = 'rankings/';
    await g.flush();
    await asentar();
    delete (globalThis as any).__MEM_DB__.fallarDoc;
    const usersDoc = (globalThis as any).__MEM_DB__['users/test'];
    const rankDoc1 = (globalThis as any).__MEM_DB__[claveDeRanking()];
    check('B38: con la red caída en rankings, la partida se guarda y la fila no sale',
      usersDoc?.nanites === saldo && rankDoc1?.totalClicks === 0,
      `users=${usersDoc?.nanites} fila-clics=${rankDoc1?.totalClicks}`);
    // El siguiente periodo, con la red vuelta: la fila sale aunque no haya
    // nada nuevo en ella que la dispare.
    const ahoraReal = Date.now;
    let t = ahoraReal();
    Date.now = () => t;
    try {
      t += 16 * 60_000;
      s(g).afkCards = 1;
      await g.flush();
      await asentar();
    } finally {
      Date.now = ahoraReal;
    }
    const rankDoc2 = (globalThis as any).__MEM_DB__[claveDeRanking()];
    check('B38: el siguiente periodo reintenta la fila aunque no haya nada nuevo en ella',
      rankDoc2?.totalClicks === 1 && rankDoc2?.danoFinal !== undefined,
      `fila=${JSON.stringify(rankDoc2)}`);
  }

  // -------------------------------------------------------------------------
  //  3. UN FALLO DE VERDAD SÍ LO ENCIENDE
  // -------------------------------------------------------------------------
  await conIndicador(async () => {
    const g = await boot(baseSave([], { nanites: 4321, totalNanitesProduced: 9000 }));

    // **POR QUÉ ESTA COMPROBACIÓN, Y POR QUÉ ESTÁ ANTES DE LA DEL AVISO.**
    //
    // Esta prueba fallaba después de B28, y el motivo **no era el aviso**: era que el
    // `flush()` no tenía nada que escribir. El arranque ya dejó la partida guardada, y
    // entre el arranque y aquí el jugador no ha hecho nada, así que el documento sería
    // idéntico byte a byte y la escritura se salta —que es exactamente lo que B28
    // quiere—. Con la red caída **no hay nada que escribir, así que no hay nada que
    // falle, y el aviso correctamente no se enciende.** El motor hacía bien y la
    // comprobación miraba un caso que ya no podía pasar.
    //
    // Por eso aquí se afirma **la causa** antes que el síntoma: con la red en su sitio,
    // un guardado sin cambios no escribe. Y por eso el aviso se prueba **con un cambio
    // de verdad**: un fallo que no intenta escribir no puede encender nada, y una
    // comprobación que espera ver el aviso sin cambiar nada estaría probando que el
    // motor escribe de más.
    const db: any = (globalThis as any).__MEM_DB__;
    db.escrituras = 0;
    await g.flush();
    await asentar();
    check('aviso: un guardado sin cambios ni siquiera intenta escribir (o no falla)',
      db.escrituras === 0,
      `escrituras=${db.escrituras}`);

    (globalThis as any).__MEM_DB__.fallar = true;
    // **El cambio que hace falta: la partida se mueve.** Es el ingreso pasivo, que sube
    // el saldo solo, o sea lo mismo que un jugador que está jugando de verdad. Sin esto
    // el guardado se salta y el aviso no se enciende porque no hay nada que ocultar.
    g.getState().nanites += 500;
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


  // =========================================================================
  // =========================================================================
  //  CUANTAS ESCRITURAS HACE EL JUEGO, Y POR QUE SE MIDEN EN VEZ DE CALCULARSE.
  // =========================================================================
  //
  // **LA CUOTA ES DEL PROYECTO, NO DEL JUGADOR.** Firestore da 20.000 escrituras al
  // dia en el plan gratuito y las gastan a la vez todas las pestanas de todas las
  // personas. Es un presupuesto compartido, asi que la pregunta que importa no es
  // "cuanto escribe este jugador" sino "cuanto escribe el que deja la partida abierta
  // sin hacer nada", que es el caso que de verdad lo quemaba.
  //
  // **Y SE MIDE CON EL CONTADOR DEL STUB, NO CON UNA SUMA DE INTERVALOS.** Un numero
  //  estimado puede estar mal y seguir pareciendo una cifra exacta; aqui se cuentan las
  //  escrituras que el stub ha visto de verdad, que es lo que se cobra.
  {
    const g = await boot(baseSave([]));

    // **EL CONTADOR SE COGE DESPUÉS DEL ARRANQUE, Y NO ANTES.** `boot()` reemplaza
    // `__MEM_DB__` entero por uno limpio, así que una referencia cogida ANTES apunta al
    // objeto viejo y cuenta ceros siempre: la prueba pasaría sin mirar nada.
    const db = (globalThis as any).__MEM_DB__;

    // El ranking se escribe UNA vez al arrancar —el jugador tiene que existir en la
    // tabla— y a partir de ahí la fila solo se toca si cambia o si pasan cinco minutos.
    const filasAlArrancar: number = db.filas ?? 0;

    // Seis guardados seguidos **sin que cambie nada**. Y aquí la regla **cambió con
    // B28**: antes la partida se escribía seis veces porque una compra no puede
    // esperar, y el ranking ninguna. Ahora **las dos son cero**, y el motivo es que un
    // guardado que no cambia nada no tiene nada que guardar: el documento quedaría
    // byte a byte idéntico y Firestore cobra la escritura igual. Con el temporizador de
    // 30 segundos, una pestaña abierta mirando el almacén una hora son 120 escrituras
    // de la nada, y la cuota es de 20.000 al día **para el proyecto entero**.
    //
    // **Y NO ES "NO GUARDAR NUNCA": es "guardar cuando algo cambia", y eso se afirma
    // justo debajo.** La compra no puede esperar, y esta prueba no la ha quitado de en
    // medio: la que viene después dice que un cambio escribe.
    db.escrituras = 0;
    db.filas = 0;
    for (let n = 0; n < 6; n++) {
      await g.flush();
      await new Promise((r) => setTimeout(r, 0));
    }

    check(
      'cuota: seis guardados SIN CAMBIOS no cuestan ni una escritura',
      db.escrituras === 0,
      `escrituras=${db.escrituras} de 6 guardados sin cambios`
    );
    check(
      'cuota: y el ranking tampoco, que era la mitad de las escrituras',
      db.filas === 0,
      `filas=${db.filas} de 6 guardados`
    );
    check(
      'cuota: y al arrancar sí se escribe, o el jugador no estaría en la tabla',
      filasAlArrancar === 1,
      `filas=${filasAlArrancar}`
    );

    // Y LA CONTRAPARTIDA NUEVA (F104): EL RANKING YA NO SIGUE AL MARCADOR.
    //
    // Antes, si el marcador cambiaba, la fila se escribía aunque no hubiera
    // pasado el rato: el pasivo mueve el producido cada segundo, así que en la
    // práctica la fila salía en cada guardado con red. Ahora sale como mucho
    // una vez cada quince minutos, y un clic no la adelanta. Una clasificación
    // con un cuarto de hora de retraso no miente a nadie; cuarenta escrituras
    // por revisita sí cuestan. Si la fila falló, el siguiente bloque la
    // reintenta sin esperar al periodo (B38 sigue valiendo).
    db.filas = 0;
    db.escrituras = 0;
    // Un clic sube `totalNanitesProduced`, que es justo lo que la fila enseña.
    // El clic no guarda por su cuenta —guardar en cada clic sería lo contrario
    // de lo que se está buscando—, así que el guardado se pide a mano, como lo
    // haría cualquier otra acción.
    g.click();
    await g.flush();
    await new Promise((r) => setTimeout(r, 0));
    check(
      'cuota: un clic ya NO publica la fila (sale cada 15 min, no por marcador)',
      db.filas === 0,
      `filas=${db.filas} tras un clic`
    );
    check(
      'cuota: pero la partida SI se escribe en el mismo bloque',
      (db.escrituras ?? 0) >= 1,
      `escrituras=${db.escrituras} tras un clic`
    );
  }

  // =========================================================================
  //  5. La tarjeta pública NO pisa el contador, y va al ritmo del ranking
  // =========================================================================
  //
  // **ESTE BLOQUE COMPRUEBA TAMBIÉN UNA COSA DEL AHORRO DE CUOTA.** La tarjeta se
  //  publica dentro del mismo `if` que el ranking, o sea que **no cuesta una
  //  escritura por guardado**: escribirla en cada guardado la convertiría en media
  //  partida de las escrituras del juego, que es justo lo que el arreglo anterior se
  //  quitó de en medio. Con F104 el ritmo son quince minutos: un clic no la
  //  republica, y lo que se afirma es que tampoco la ensucia.
  {
    const perfil = 'perfiles/test';
    const g = await boot(baseSave([], { nanites: 5_000, totalNanitesProducidas: 5_000 }));
    const db = (globalThis as any).__MEM_DB__;

    check(
      'cuota: la tarjeta se publica al arrancar, o el perfil no existiria',
      !!db[perfil],
      Object.keys(db).join(',')
    );
    check(
      'cuota: y su documento no lleva ni el saldo ni el inventario',
      !('nanites' in (db[perfil] ?? {})) && !('warehouse' in (db[perfil] ?? {})),
      Object.keys(db[perfil] ?? {}).join(',')
    );

    // **LO QUE SE COMPRUEBA ES QUIÉN ESCRIBE QUÉ.** Se deja un contador
    // heredado a mano, se juega un clic y se fuerza el bloque: como la fila no
    // toca (quince minutos), la tarjeta tampoco, y el contador sigue intacto.
    db[perfil].visitas = 7;
    db[perfil].visitantes = ['a', 'b'];
    const clicsPublicados = db[perfil].totalClicks;

    db.escrituras = 0;
    db.filas = 0;
    g.click();
    await g.flush();
    await new Promise((r) => setTimeout(r, 0));

    check(
      'cuota: publicar la tarjeta NO pone el contador a cero',
      db[perfil].visitas === 7 && db[perfil].visitantes.length === 2,
      `visitas=${db[perfil].visitas} lista=${JSON.stringify(db[perfil].visitantes)}`
    );
    check(
      // Sin republicación, la tarjeta sigue con lo del arranque: el clic sube
      // el contador en memoria, pero el documento no se toca hasta el periodo.
      // Si esto cambiara, la tarjeta estaría saliendo en cada bloque.
      'cuota: y un clic no la republica antes del periodo',
      db[perfil].totalClicks === clicsPublicados && (db.filas ?? 0) === 0,
      `clics=${db[perfil].totalClicks} filas=${db.filas}`
    );
  }

  // =========================================================================
  //  F104 · VEINTE ACCIONES SEGUIDAS SON UNA SOLA ESCRITURA, Y LA FILA NI UNA
  // =========================================================================
  //
  // **ESTA ES LA COMPROBACIÓN QUE FALTABA, Y ES LA QUE CONTESTA AL PICO.** El
  // gráfico que agotó la cuota no era el reloj: eran ráfagas de hasta 150
  // escrituras por minuto, una por acción (más sus derivadas). Con el agrupado,
  // las llamadas intermedias anotan la cola local y vuelven; la red se toca
  // una vez por bloque.
  //
  // **POR QUÉ `updateState` Y NO VEINTE COMPRAS.** Lo que se mide es el
  // agrupado, no la tienda: veinte llamadas por la vía real que guarda en el
  // acto, sin montar veinte items ni veinte saldos. Cada una cambia el estado,
  // así que sin agrupado serían veinte escrituras.
  {
    const { fijarCoalescenciaMs, RITMO_GUARDADO_MS } = await import('../src/gameLoop');
    const g = await boot(baseSave([], { nanites: 5_000 }));
    await g.flush();
    await asentar();
    // Con el ritmo de verdad, como en producción: `boot()` lo pone a 0 para
    // que los demás bancos midan lo suyo, y aquí se sube a propósito.
    fijarCoalescenciaMs(RITMO_GUARDADO_MS);
    try {
      const db = (globalThis as any).__MEM_DB__;
      db.escrituras = 0;
      db.filas = 0;
      for (let n = 0; n < 20; n++) g.updateState({ nanites: 5_000 + n });
      await asentar();
      check(
        'cuota: veinte acciones seguidas no tocan la red (se agrupan)',
        (db.escrituras ?? 0) === 0,
        `escrituras=${db.escrituras} de 20 acciones`
      );
      await g.flush();
      await asentar();
      check(
        'cuota: y el siguiente bloque lo sube todo de una vez',
        (db.escrituras ?? 0) === 1,
        `escrituras=${db.escrituras} de 1 bloque`
      );
      check(
        'cuota: ...y la fila sigue a su ritmo, no en cada bloque',
        (db.filas ?? 0) === 0,
        `filas=${db.filas}`
      );
    } finally {
      fijarCoalescenciaMs(0);
    }
  }

  // -------------------------------------------------------------------------
  //  B40 · EL MODO PRUEBAS NO PAGA LA TABLA, PERO LA PARTIDA SIGUE GUARDADA
  // -------------------------------------------------------------------------
  //
  // Quien testea sin parar mueve la fila del ranking y la tarjeta sin necesitarlo,
  // y esas son las escrituras que quemaron la cuota. Con el flag puesto esas dos se
  // saltan; la partida —el documento que no se puede perder— se guarda igual, y al
  // quitar el flag lo pendiente se publica en el siguiente guardado, no en el
  // periodo entero.
  {
    const db = () => (globalThis as any).__MEM_DB__;
    const g = await boot(baseSave([], {
      nanites: 5_000,
      totalNanitesProduced: 90_000_000
    }));
    await g.flush();
    await asentar();
    const filasAntes = db().filas ?? 0;

    localStorage.setItem(CLAVE_MODO_PRUEBAS, '1');
    try {
      db().escrituras = 0;
      g.click();
      await g.flush();
      await asentar();
      check(
        'cuota: en modo pruebas la partida SE guarda',
        (db().escrituras ?? 0) >= 1,
        'escrituras=' + db().escrituras
      );
      check(
        'cuota: ...pero la fila del ranking NO se escribe',
        (db().filas ?? 0) === filasAntes,
        `filas=${db().filas} antes=${filasAntes}`
      );
    } finally {
      // Sin esto, los bancos que vienen detrás heredarían el flag: el `localStorage`
      // del runner es uno solo para todos, igual que el `__MEM_DB__`.
      localStorage.removeItem(CLAVE_MODO_PRUEBAS);
    }

    // Sin el flag vuelve a publicar en su periodo: el modo pausa el ritmo, no
    // lo rompe. Quince minutos no se esperan: se adelanta el reloj y se
    // devuelve en `finally`, igual que en B38.
    const ahoraReal = Date.now;
    let t = ahoraReal();
    Date.now = () => t;
    try {
      t += 16 * 60_000;
      g.click();
      await g.flush();
      await asentar();
    } finally {
      Date.now = ahoraReal;
    }
    check(
      'cuota: sin el flag la fila vuelve a publicarse en su periodo',
      (db().filas ?? 0) > filasAntes,
      `filas=${db().filas} antes=${filasAntes}`
    );
  }

  resumen('el guardado: que el aviso diga la verdad');
}

/** La clave del documento del ranking, que lleva el uid del banco. */
function claveDeRanking(): string {
  return Object.keys((globalThis as any).__MEM_DB__).find(k => k.startsWith('rankings/')) ?? 'rankings/test';
}

export default main();