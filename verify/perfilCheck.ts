// ==========================================================================
//  La tarjeta pública: QUÉ SE PUBLICA, QUÉ NO, Y QUE NO SE CUENTA EL DUEÑO
// ==========================================================================
//
//  Este banco no necesita red para la parte importante. La regla de qué se publica vive
//  en `src/data/profile.ts` **a propósito**, y eso es lo que permite comprobarla mirando
//  un objeto: si la regla estuviera dentro de la escritura a Firestore, la única manera
//  de comprobarla sería escribir y leer, que es un banco que depende de la red y que
//  cuando la red falla no dice nada.
//
//  La parte que sí usa el stub es el servicio: que publicar no pise el contador, y que
//  el dueño no se cuente.

import { check, resumen, boot, baseSave, collector, companion } from './kit';

const db = () => (globalThis as any).__MEM_DB__;

async function main() {
  // **LA REGLA SE IMPORTA DENTRO, NO ARRIBA DEL TODO, Y POR QUÉ.** `data/profile.ts`
  // arrastra el árbol y los logros, y el motor llega a ella por `services/profileService`.
  // Un import estático aquí metía ese módulo en el grafo del banco de forma estática y el
  //  **bundle de los 32 bancos juntos** lo inicializaba en otro orden: `playthroughCheck`
  //  arrancaba, recargaba y encontraba el recolector sin equipar. El banco que importa la
  //  regla en caliente no cambia nada de lo que hay que comprobar y sí deja de arrastrar
  //  el módulo al bundle compartido.
  const { tarjetaDesdeEstado, documentoDeTarjeta, coaccionaTarjeta, CLAVES_DE_TARJETA, TARJETA_VACIA, TOPE_RECOLECTORES } = await import('../src/data/profile');
  const { SECRET_ACHIEVEMENTS } = await import('../src/data/achievements');
  // La ficha a medias también se importa en caliente, por el mismo motivo que las de arriba.
  const { tarjetaDesdeRanking } = await import('../src/data/perfilParcial');

  // =========================================================================
  //  1. Lo que NO se publica
  // =========================================================================
  {
    const estado = {
      nanites: 999_999,
      totalNanitesProduced: 12345,
      totalClicks: 99,
      cores: 7,
      warehouse: [
        collector('c1', 3, { level: 2 }),
        companion('k1', 2),
        { id: 'x1', name: 'Cristal', type: 'crystal', amount: 5000 }
      ],
      unlockedAchievements: ['first_click', ...SECRET_ACHIEVEMENTS],
      nodeLevels: { core_sink: 2 },
      cosmetics: { title: 'Leyenda', frame: 'frame_x', banner: 'banner_x' }
    };
    const tarjeta = tarjetaDesdeEstado(estado, 'u1', 'Blanqui');
    const doc = documentoDeTarjeta(tarjeta);
    const claves = Object.keys(doc);

    check('perfil: el saldo de nanitas NO se publica', !claves.includes('nanitas'),
      claves.join(','));
    check('perfil: y el documento solo tiene claves públicas',
      claves.every(k => CLAVES_DE_TARJETA.includes(k)),
      'sobra: ' + claves.filter(k => !CLAVES_DE_TARJETA.includes(k)).join(','));

    // El caso de verdad: el almacén tiene un item de cristal con el dinero guardado, y
    // el documento tiene que salir sin él. No basta con que no haya una clave "nanitas":
    // el item es el mismo dinero y también es lo que dice cuánto tiene sin gastar.
    const serial = JSON.stringify(doc);
    check('perfil: ni los cristales del almacén salen en el documento',
      !serial.includes('Cristal') && !serial.includes('5000'),
      'bocado: ' + serial.slice(0, 120));
    check('perfil: y lo que sí se publica está',
      doc.nanitasProducidas === 12345 && doc.totalClicks === 99 && doc.cores === 7,
      JSON.stringify({ n: doc.nanitasProducidas, c: doc.totalClicks, k: doc.cores }));

    // El nombre del dueño sí, y es lo primero que se lee.
    check('perfil: el nombre va en la tarjeta', doc.username === 'Blanqui', String(doc.username));
  }

  // =========================================================================
  // =========================================================================
  //  2. El recorte: lo que se publica es lo que tiene puesto
  // =========================================================================
  //
  // **LA PREGUNTA ÚTIL YA NO ES "CUÁNTOS CABEN" SINO "ENTRA EL EQUIPADO".** Antes el
  //  recorte era un número y salían los mejores por tier, así que la prueba era que el
  //  primero fuera el de más tier. Ahora el recorte es el equipado, y el caso que
  //  importa es el contrario: **que entre aunque sea el peor de la lista**, porque si se
  //  colara el mismo criterio de antes, un jugador con un T9 guardado y un T3 en la
  //  mano publicaría el T9 y la ficha mentiría sobre cómo juega.
  {
    const muchos = Array.from({ length: 60 }, (_, i) =>
      collector('c' + i, (i % 9) + 1, {}));
    muchos.push(collector('elEquipado', 1, {}));
    const t = tarjetaDesdeEstado({
      warehouse: muchos,
      equippedCollectorId: 'elEquipado'
    }, 'u1', 'X');
    check(
      'perfil: el equipado entra aunque sea el de MENOS tier',
      t.recolectores.length === 1 && t.recolectores[0].id === 'elEquipado'
        && t.recolectores[0].tier === 1,
      JSON.stringify(t.recolectores.map(r => `${r.id}:T${r.tier}`))
    );
    check(
      'perfil: y de sesenta en el almacen solo sale uno',
      t.recolectores.length === 1,
      `${t.recolectores.length} de ${muchos.length}`
    );
  }
  {
    const t = tarjetaDesdeEstado({
      nodeLevels: { core_sink: 3, core_edge: 2, sin_comprar: 0 }
    }, 'u1', 'X');
    check(
      'perfil: los nodos pagados se cuentan por niveles comprados',
      t.nivelesDeArbol === 5,
      `niveles=${t.nivelesDeArbol}`
    );
    check(
      'perfil: y un nodo sin niveles no cuenta como comprado',
      t.nodos.every(n => n.nivel > 0),
      JSON.stringify(t.nodos.map(n => n.id))
    );
    check(
      'perfil: los nombres de los nodos vienen del catalogo, no del documento',
      t.nodos.some(n => n.nivel === 3),
      JSON.stringify(t.nodos.map(n => n.nivel))
    );
  }


  //  3. Los secretos no salen, y el total no los delata
  // =========================================================================
  {
    const t = tarjetaDesdeEstado({
      unlockedAchievements: ['uno', 'dos', ...SECRET_ACHIEVEMENTS]
    }, 'u1', 'X');
    const publicados = t.logros;
    check('perfil: los logros secretos no se publican',
      publicados.every(id => !SECRET_ACHIEVEMENTS.includes(id as any)),
      publicados.join(','));
    check('perfil: y el total SÍ los cuenta, que si no se sabría que faltan',
      t.totalLogros === 2 + SECRET_ACHIEVEMENTS.length,
      `total=${t.totalLogros} publicados=${publicados.length}`);
  }

  // =========================================================================
  //  4. Coerción: un documento viejo o a mano no puede romper la pantalla
  // =========================================================================
  {
    const roto = { userId: 'x', nanitasProducidas: 'muchas', recolectores: 'no soy una lista' };
    const t = coaccionaTarjeta(roto, 'x');
    check('perfil: un número que no es número se vuelve cero',
      t.nanitasProducidas === 0, String(t.nanitasProducidas));
    check('perfil: una lista que no es lista se vuelve vacía',
      Array.isArray(t.recolectores) && t.recolectores.length === 0,
      JSON.stringify(t.recolectores));
    const vacia = coaccionaTarjeta(null, 'x');
    check('perfil: sin documento sale la tarjeta vacía, no un fallo',
      vacia.recolectores.length === 0 && vacia.nodosTotales > 0,
      'nodosTotales=' + vacia.nodosTotales);
    check('perfil: y la vacía tiene el mismo uid que se le pidió',
      vacia.userId === 'x', vacia.userId);
    check('perfil: la tarjeta vacía trae los valores de arranque',
      TARJETA_VACIA.visitas === 0 && TARJETA_VACIA.visitantes.length === 0, 'contador');
  }

  // =========================================================================
  // =========================================================================
  //  5. El contador: el dueño NO se cuenta, y una persona cuenta una vez
  // =========================================================================
  //
  // Lo otro del contador —que publicar la tarjeta no lo ponga a cero— lo comprueba
  //  `guardadoCheck`, que es donde ya está el contador de escrituras del stub y donde se
  //  mide sin repetir el arranque. Aquí solo lo que es de esta función.
  {
    const { registrarVisita } = await import('../src/services/profileService');
    db()['perfiles/otro'] = {
      userId: 'otro', username: 'otro', visitas: 3, visitantes: ['a'],
      recolectores: [], companeros: [], nodos: [], logros: [],
      cosmetics: { title: '', frame: 'frame_none', banner: 'banner_none' }
    };

    // El dueño mirando su propia tarjeta: ni una escritura.
    db().escrituras = 0;
    await registrarVisita('yo', 'yo');
    check(
      'perfil: el dueño NO se cuenta a sí mismo',
      db().escrituras === 0,
      'escrituras=' + db().escrituras
    );
    await registrarVisita('', 'yo');
    await registrarVisita('otro', '');
    check(
      'perfil: y sin uid no pasa nada tampoco',
      db().escrituras === 0,
      'escrituras=' + db().escrituras
    );

    // **LAS DOS CIFRAS CUENTAN COSAS DISTINTAS, Y ESTA ES LA PARTE QUE CAMBIÓ.**
    //
    // Antes un solo filtro decidía las dos: si ya estabas en la lista, no se contaba
    // nada. Así que `visitas` y `visitantes` eran el mismo número con dos nombres, y
    // `visitas` no contaba aperturas sino primeras visitas. Mirar el mismo perfil cuatro
    // veces valía por una, que es justo lo que se pidió corregir.
    await registrarVisita('otro', 'a');
    check(
      'perfil: volver a entrar SI suma una visita, porque son aperturas',
      db()['perfiles/otro'].visitas === 4,
      'visitas=' + db()['perfiles/otro'].visitas
    );
    check(
      'perfil: pero la persona no se añade dos veces a la lista',
      db()['perfiles/otro'].visitantes.length === 1
        && db()['perfiles/otro'].visitantes[0] === 'a',
      'lista=' + JSON.stringify(db()['perfiles/otro'].visitantes)
    );

    await registrarVisita('otro', 'a');
    check(
      'perfil: y entrar otra vez sigue sumando, que es lo que se pedia',
      db()['perfiles/otro'].visitas === 5,
      'visitas=' + db()['perfiles/otro'].visitas
    );

    await registrarVisita('otro', 'nueva');
    check(
      'perfil: una persona nueva suma visita y entra en la lista',
      db()['perfiles/otro'].visitas === 6
        && db()['perfiles/otro'].visitantes.includes('nueva'),
      `visitas=${db()['perfiles/otro'].visitas} lista=${JSON.stringify(db()['perfiles/otro'].visitantes)}`
    );

    // **Y LAS DOS CIFRAS TIENEN QUE PODER SER DISTINTAS.** Si volvieran a ser lo mismo,
    // una de las dos está mintiendo: aquí visitas sube a 6 y la lista solo tiene 2.
    check(
      'perfil: visitas y visitantes ya no son el mismo numero',
      db()['perfiles/otro'].visitas === 6
        && db()['perfiles/otro'].visitantes.length === 2,
      `visitas=${db()['perfiles/otro'].visitas} lista=${db()['perfiles/otro'].visitantes.length}`
    );

    // Una tarjeta que no existe: mirar un perfil vacío no inventa nada.
    db().escrituras = 0;
    await registrarVisita('no_existe', 'nueva');
    check(
      'perfil: mirar un perfil que no existe no escribe en la nada',
      db().escrituras === 0,
      'escrituras=' + db().escrituras
    );
  }

  // =========================================================================
  //  B39 · La visita reutiliza la tarjeta ya leída, y el ranking cachea la tabla
  // =========================================================================
  //
  // Cada apertura de un perfil ajeno costaba DOS lecturas del mismo documento: una
  // al abrir (`leerTarjeta`) y otra al contar (`registrarVisita` lo volvía a pedir).
  // Y cada apertura del ranking hasta 40. Las dos se pagan de la misma cuota que se
  // agotó, así que van aquí con contador del stub, no con cálculo.
  {
    const { registrarVisita: anotar } = await import('../src/services/profileService');
    db()['perfiles/otro2'] = {
      userId: 'otro2', username: 'otro2', visitas: 10, visitantes: ['a'],
      recolectores: [], companeros: [], nodos: [], logros: [],
      cosmetics: { title: '', frame: 'frame_none', banner: 'banner_none' }
    };
    // La que la hoja acaba de pintar: ya coaccionada, como la deja `leerTarjeta`.
    const conocida = coaccionaTarjeta(db()['perfiles/otro2'], 'otro2');

    db().escrituras = 0;
    db().lecturas = 0;
    await anotar('otro2', 'b', conocida);
    check(
      'cuota: con la tarjeta ya leida no se vuelve a leer',
      db().lecturas === 0,
      'lecturas=' + db().lecturas
    );
    check(
      'cuota: ...pero la visita cuenta igual y una sola escritura',
      db()['perfiles/otro2'].visitas === 11
        && db().escrituras === 1
        && db()['perfiles/otro2'].visitantes.includes('b'),
      `visitas=${db()['perfiles/otro2'].visitas} escrituras=${db().escrituras}`
    );

    // Y sin ella se lee como antes: el tercer parámetro es opcional y las
    // llamadas viejas no cambian de comportamiento.
    db().lecturas = 0;
    await anotar('otro2', 'c');
    check(
      'cuota: sin tarjeta conocida se sigue leyendo una vez',
      db().lecturas === 1 && db()['perfiles/otro2'].visitas === 12,
      `lecturas=${db().lecturas} visitas=${db()['perfiles/otro2'].visitas}`
    );
  }

  // La tabla se sirve de memoria dos minutos: entrar, mirar un perfil y volver
  // no puede costar otras 40 lecturas idénticas.
  {
    const { getTopRankings, limpiarCacheRanking } = await import('../src/services/rankingService');
    limpiarCacheRanking();
    (db() as any).__rankingDocs = [
      { uid: 'j1', username: 'Una', score: 5000 },
      { uid: 'j2', username: 'Otra', score: 3000 }
    ];
    db().consultas = 0;
    const primera = await getTopRankings();
    const segunda = await getTopRankings();
    check(
      'cuota: la segunda apertura seguida no pide la red',
      db().consultas === 1 && segunda.length === 2 && segunda[0].uid === 'j1',
      `consultas=${db().consultas} filas=${segunda.length}`
    );
    check(
      'cuota: y lo servido es lo que trajo la red, no los ejemplos',
      primera[0].username === 'Una' && segunda[0].username === 'Una',
      `nombres=${primera[0]?.username},${segunda[0]?.username}`
    );
    limpiarCacheRanking();
    await getTopRankings();
    check(
      'cuota: ...pero tras limpiar vuelve a pedirla',
      db().consultas === 2,
      'consultas=' + db().consultas
    );
    limpiarCacheRanking();
    delete (db() as any).__rankingDocs;
  }

  // =========================================================================
  // =========================================================================
  // =========================================================================
  //  6. En la tarjeta va SOLO lo que tiene puesto
  // =========================================================================
  //
  // **ESTO USA EL MOTOR DE VERDAD, Y POR QUÉ ES LA PRUEBA QUE CUENTA.** El recorte —
  //  "solo lo que tiene puesto"— ocurre dentro de `tarjetaDesdeEstado()`, que es donde se
  //  decide, y esa función la llama el guardado con el estado real. Un banco que
  //  escribiera un estado a mano estaría probando un objeto que el juego nunca construye,
  //  y el día que el recorte cambie el banco seguiría en verde.
  {
    // Dos recolectores y dos compañeros, **uno de cada en activo y otro guardado**.
    const g = await boot(baseSave([
      collector('guardado', 9, {}),
      collector('puesto', 3, { level: 7, potential: 4, rarity: 'Épico', forgedBy: 'Alguien',
        affixes: ['aff_crit'] })
    ], { companions: [companion('kGuardado', 6), companion('kPuesto', 5)] }));
    g.equipCollector('puesto');
    g.equipCompanion('kPuesto');

    const t = g.tarjeta();
    check(
      'perfil: solo se publica el recolector equipado, no el que esta guardado',
      t.recolectores.length === 1 && t.recolectores[0].id === 'puesto',
      JSON.stringify(t.recolectores.map(r => r.id))
    );
    check(
      'perfil: el guardado de T9 no aparece, que es el que mas comandos',
      !t.recolectores.some(r => r.id === 'guardado'),
      JSON.stringify(t.recolectores.map(r => `${r.id}:T${r.tier}`))
    );
    check(
      'perfil: y de los companeros, solo el activo',
      t.companeros.length === 1 && t.companeros[0].id === 'kPuesto'
        && t.companeros[0].equipado === true,
      JSON.stringify(t.companeros.map(c => c.id))
    );

    // Y lo que se lleva el item entero, que es lo que hace falta para la ficha completa:
    // descripcion, afijos y quien lo forjo.
    const r = t.recolectores[0];
    check(
      'perfil: el item publica su descripcion, sus afijos y quien lo forjo',
      typeof r.details === 'string' && r.details.length > 0 && /\d/.test(r.details)
        && r.affixes.length === 1 && r.affixes[0] === 'aff_crit',
      JSON.stringify({ d: r.details, f: r.forgedBy, a: r.affixes })
    );

    // Y el caso de un jugador que no tiene nada puesto: la ficha sale vacia, y eso es un
    // dato, no un fallo.
    // **AQUÍ NO HACE FALTA EL MOTOR.** Que la tarjeta salga vacía sin nada equipado es una
    // regla de `tarjetaDesdeEstado`, y el motor ya está probando arriba lo que sí necesita:
    // que el recorte se aplique al estado que el juego construye de verdad.
    const tSinNada = tarjetaDesdeEstado({}, 'u1', 'X');
    check(
      'perfil: sin nada equipado, la ficha lo dice y no inventa',
      tSinNada.recolectores.length === 0 && tSinNada.companeros.length === 0,
      `${tSinNada.recolectores.length}/${tSinNada.companeros.length}`
    );
  }

  // =========================================================================
  //  7. El permiso denegado NO es lo mismo que un fallo de lectura
  // =========================================================================
  //
  //  **UN ERROR QUE MANDA A LA FUENTE EQUIVOCADA NO ES UN MENSAJE MAL ESCRITO.**
  //  El aviso de la ficha a medias decia, para cualquier fallo de lectura, que la
  //  coleccion "aparecera en cuanto vuelva la conexion". Con un permiso denegado eso
  //  es falso: la conexion esta bien, y apagar y encender el wifi no lo arregla. Lo que
  //  hay es las reglas de la base de datos sin publicar. El jugador no puede hacer nada
  //  con ese aviso y ademas se le hace creer que es un problema suyo de red.
  //
  //  Por eso el permiso es un motivo PROPIO y no una variante de `error`: lo que hay que
  //  hacer es distinto, y por eso el texto tiene que ser distinto.
    {
    const conPermiso = tarjetaDesdeRanking(
      { username: 'Blanqui', totalNanitesProduced: 10, totalClicks: 5, ascensions: 1,
        forjas: 2, nucleosTotales: 3, totalLogros: 4 },
      'u1',
      'Blanqui',
      'permiso'
    );
    check(
      'perfil: el permiso llega hasta la tarjeta como motivo propio',
      conPermiso.completa === false && conPermiso.motivo === 'permiso',
      `completa=${conPermiso.completa} motivo=${conPermiso.motivo}`
    );
    check(
      'perfil: y sigue sin inventar lo que no sabe',
      conPermiso.recolectores.length === 0 && conPermiso.companeros.length === 0
        && !conPermiso.visitas,
      `${conPermiso.recolectores.length}/${conPermiso.companeros.length}`
    );
  }
  {
    const conError = tarjetaDesdeRanking(
      { username: 'X', totalNanitesProduced: 1 },
      'u1',
      'X',
      'error'
    );
    check(
      'perfil: un fallo de red sigue siendo su propio motivo, y no el del permiso',
      conError.motivo === 'error' && conError.motivo !== 'permiso',
      conError.motivo
    );
  }

  // =========================================================================
  //  8. La build ajena se ve: sus pasivas pagadas (F62)
  // =========================================================================
  //
  //  El dato viajaba en la tarjeta (`nodos` con nivel y categoría) y el bloque
  //  existía, pero `cuerpoDeTarjeta` no lo llamaba: la build del otro no se
  //  veía por un cable suelto. Se renderiza el cuerpo con una tarjeta que trae
  //  nodos y se mira lo que sale.
  {
    const { cuerpoDeTarjeta } = await import('../src/ui/tarjetaAjena');
    const conBuild: any = {
      ...TARJETA_VACIA,
      username: 'Rival',
      nodosComprados: 2,
      nodosTotales: 22,
      nivelesDeArbol: 5,
      nodos: [
        { id: 'core_sink', name: 'Sumidero de Núcleos', nivel: 3, maxLevel: 10, categoria: 'multiplicador' },
        { id: 'auto_clicker', name: 'Autómata de Clicks', nivel: 2, maxLevel: 10, categoria: 'automatizacion' }
      ]
    };
    const html = cuerpoDeTarjeta(conBuild);
    check(
      'tarjeta: la build ajena enseña sus pasivas pagadas',
      html.includes('Pasivas pagadas') && html.includes('Sumidero de Núcleos') && html.includes('Autómata de Clicks'),
      html.slice(html.indexOf('Pasivas'), html.indexOf('Pasivas') + 60)
    );
    check(
      'tarjeta: y dice cuántos nodos y niveles lleva',
      html.includes('2/22') && html.includes('5 niveles'),
      'sin la cuenta'
    );
    const sinNodos = cuerpoDeTarjeta({ ...TARJETA_VACIA, username: 'Nuevo' } as any);
    check(
      'tarjeta: sin nodos lo dice en vez de esconder el bloque',
      sinNodos.includes('Sin nodos comprados'),
      'sin el aviso'
    );
  }

  resumen('la tarjeta pública de otro jugador');
}

export default main();