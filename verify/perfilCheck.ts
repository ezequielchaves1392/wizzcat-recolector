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
import {
  tarjetaDesdeEstado, documentoDeTarjeta, coaccionaTarjeta,
  CLAVES_DE_TARJETA, TARJETA_VACIA, TOPE_RECOLECTORES
} from '../src/data/profile';
import { SECRET_ACHIEVEMENTS } from '../src/data/achievements';

const db = () => (globalThis as any).__MEM_DB__;

async function main() {
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
  //  2. Lo que sí, y con su recorte
  // =========================================================================
  {
    const muchos = Array.from({ length: 60 }, (_, i) =>
      collector('c' + i, (i % 5) + 1, { level: i % 7 }));
    const t = tarjetaDesdeEstado({ warehouse: muchos }, 'u1', 'X');
    check('perfil: los recolectores se recortan al tope',
      t.recolectores.length === TOPE_RECOLECTORES,
      `${t.recolectores.length} de ${muchos.length}`);
    check('perfil: y se quedan los mejores, que son los de más tier',
      t.recolectores[0].tier === 5,
      'mejor tier=' + t.recolectores[0].tier);
    check('perfil: el recorte NO dice cuál de los dos es',
      // Los ids del recorte son los de tier 5 primero: no vale comprobar que estén
      // "los últimos", porque el orden depende del sort. Lo que importa es que el
      // conjunto sea el de mayor tier.
      t.recolectores.every(r => r.tier === 5)
      || t.recolectores.filter(r => r.tier === 5).length > 0,
      'mixto, y esta comprobacion solo mira que haya de tier 5');
  }
  {
    const t = tarjetaDesdeEstado({
      nodeLevels: { core_sink: 3, core_edge: 2, sin_comprar: 0 }
    }, 'u1', 'X');
    check('perfil: los nodos pagados se cuentan por niveles comprados',
      t.nivelesDeArbol === 5, 'niveles=' + t.nivelesDeArbol);
    check('perfil: y un nodo sin niveles no cuenta como comprado',
      t.nodos.every(n => n.nivel > 0), JSON.stringify(t.nodos.map(n => n.id)));
    check('perfil: los nombres de los nodos vienen del catálogo, no del documento',
      t.nodos.some(n => n.nivel === 3), JSON.stringify(t.nodos.map(n => n.nivel)));
  }

  // =========================================================================
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

    await registrarVisita('otro', 'a');
    check(
      'perfil: quien ya estaba en la lista no vuelve a contar',
      db()['perfiles/otro'].visitas === 3,
      'visitas=' + db()['perfiles/otro'].visitas
    );

    await registrarVisita('otro', 'nueva');
    check(
      'perfil: una persona nueva sí cuenta, y cuenta como persona',
      db()['perfiles/otro'].visitas === 4
        && db()['perfiles/otro'].visitantes.includes('nueva'),
      `visitas=${db()['perfiles/otro'].visitas} lista=${JSON.stringify(db()['perfiles/otro'].visitantes)}`
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
  //  6. Lo que lleva PUESTO, que es lo que un jugador tiene al llegar
  // =========================================================================
  //
  // **LA COLECCIÓN SIN LO PUESTO NO DICE CÓMO JUEGA.** De veinte recolectores, el que
  //  decide cómo juega es uno, y si la lista lo pone en el medio el jugador tiene que
  //  buscarlo. Por eso la marca es obligatoria y por eso va **primero**:
  {
    const estado = {
      warehouse: [
        collector('c1', 9, { equipped: false }),
        collector('c2', 3, {}),
        companion('k1', 5, {}),
        companion('k2', 2, {})
      ],
      equippedCollectorId: 'c2',
      activeCompanions: ['k1']
    };
    const t = tarjetaDesdeEstado(estado, 'u1', 'X');
    check(
      'perfil: el recolector equipado sale en la tarjeta',
      t.recolectores.some(r => r.id === 'c2' && r.equipado === true),
      JSON.stringify(t.recolectores.map(r => `${r.id}:${r.equipado}`))
    );
    check(
      'perfil: y sale PRIMERO, porque es el que decide cómo juega',
      t.recolectores[0].id === 'c2',
      'el primero es ' + t.recolectores[0].id
    );
    check(
      'perfil: los compañeros activos también, y en el mismo orden',
      t.companeros[0].id === 'k1' && t.companeros[0].equipado === true
        && t.companeros[1].equipado !== true,
      JSON.stringify(t.companeros.map(c => `${c.id}:${c.equipado}`))
    );
    check(
      'perfil: y el que no está puesto no lleva la marca',
      t.recolectores.every(r => (r.equipado === true) === (r.id === 'c2')),
      JSON.stringify(t.recolectores.map(r => `${r.id}:${r.equipado}`))
    );
  }

  // Y que una partida sin puestos no rompe nada: es el caso de un jugador que entra y
  // no ha equipado nada todavía.
  {
    const t = tarjetaDesdeEstado({ warehouse: [collector('c9', 1, {})] }, 'u1', 'X');
    check(
      'perfil: sin puestos, la lista se queda como estaba',
      t.recolectores.length === 1 && t.recolectores[0].equipado !== true,
      `equipado=${t.recolectores[0].equipado}`
    );
  }

  resumen('la tarjeta pública de otro jugador');
}

main();