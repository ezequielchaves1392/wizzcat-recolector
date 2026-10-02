// ==========================================================================
//  La identidad viaja al ranking: marco y banner, no solo el título
// ==========================================================================
//  POR QUÉ ESTE BANCO EXISTE.
//
//  El documento `rankings/{uid}` solo escribía `title`: el marco y el banner
//  se quedaban en `users/{uid}`, que es otro documento y otra colección, así
//  que la consulta del ranking no los veía nunca. Y el tipo
//  `LeaderboardEntry.cosmetics` declaraba `{ title, frame, banner }` pero
//  nadie lo rellenaba. Ningún banco lo detectó porque los bancos comprueban
//  números, y aquí lo que faltaba era una lectura.
//
//  Es el patrón de D4 con otro disfraz: una tabla que describe (el catálogo
//  de cosméticos) y un reparto que nunca la menciona (el guardado del
//  ranking). Este banco pregunta "lo equipado, ¿llega al documento?", no
//  cuánto vale.
//
//  LO QUE NO SE COMPRUEBA, A PROPÓSITO: que la fila lo pinte. Eso necesita
//  el `avatar-stack` de verdad y es `preview.html` con viewport real.
// ==========================================================================

import { check, resumen, boot, baseSave, reload, s } from './kit';
import { miniIdentity } from '../src/ui/identity';
import { BOARD_KINDS, BOARDS, boardValue, computeScore, CORE_WEIGHT } from '../src/services/rankingService';

const RANK_DOC = 'rankings/test';

async function main() {
  // -----------------------------------------------------------------------
  //  1. LO EQUIPADO LLEGA AL DOCUMENTO DEL RANKING.
  //
  //     Se equipa marco y banner por la API del motor (la única que puede
  //     mutar el estado, R1) y se mira lo guardado, no la memoria: lo que
  //     solo vive en memoria es un bug (R13/R28).
  // -----------------------------------------------------------------------
  {
    const g = await boot(baseSave([], {
      cosmetics: {
        title: 'title_default',
        frame: 'frame_none',
        banner: 'banner_none',
        unlocked: ['title_default', 'frame_none', 'banner_none', 'frame_neon', 'banner_abyss'],
      },
    }));
    check('equipar marco por la API funciona',
      g.equipCosmetic('frame', 'frame_neon') === true,
      `marco=${g.getState().cosmetics.frame}`);
    check('equipar banner por la API funciona',
      g.equipCosmetic('banner', 'banner_abyss') === true,
      `banner=${g.getState().cosmetics.banner}`);
    // El guardado va sin await: tres turnos para que los dos `setDoc`
    // (juego + ranking) terminen antes de mirar.
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    const doc = (globalThis as any).__MEM_DB__?.[RANK_DOC] ?? {};
    check('el marco equipado llega al documento del ranking',
      doc.frame === 'frame_neon',
      `frame=${doc.frame}`);
    check('el banner equipado llega al documento del ranking',
      doc.banner === 'banner_abyss',
      `banner=${doc.banner}`);
    check('el título sigue viajando como antes',
      doc.title === 'title_default',
      `title=${doc.title}`);
    check('el objeto cosmetics lleva los tres juntos',
      doc.cosmetics?.title === 'title_default'
        && doc.cosmetics?.frame === 'frame_neon'
        && doc.cosmetics?.banner === 'banner_abyss',
      `cosmetics=${JSON.stringify(doc.cosmetics)}`);
  }

  // -----------------------------------------------------------------------
  //  2. UNA PARTIDA VIEJA SIN MARCO NI BANNER NO ROMPE NADA.
  //
  //     El documento puede venir de antes de este cambio, sin esas claves.
  //     La lectura los trata como "ninguno", no como `undefined` pintado en
  //     el HTML: por eso `fila()` los resuelve contra el catálogo y los
  //     `*_none` se saltan el marco.
  // -----------------------------------------------------------------------
  {
    const g2 = await reload();
    const st = g2.getState();
    check('tras recargar el marco sigue equipado',
      st.cosmetics.frame === 'frame_neon',
      `frame=${st.cosmetics.frame}`);
    check('tras recargar el banner sigue equipado',
      st.cosmetics.banner === 'banner_abyss',
      `banner=${st.cosmetics.banner}`);
  }

  // -----------------------------------------------------------------------
  //  3. EL HELPER PINTA LO QUE VIAJA.
  //
  //     `miniIdentity` es puro (cadena entra, cadena sale), así que se puede
  //     mirar sin navegador: la cabecera y la fila del ranking comparten este
  //     HTML, y si divergiera volvería el bug de F8 por la puerta de atrás.
  // -----------------------------------------------------------------------
  {
    const html = miniIdentity('Ab', {
      title: 'title_champion', frame: 'frame_neon', banner: 'banner_abyss',
    }, { hideDefaultTitle: true });
    check('identidad: pinta las iniciales del nombre',
      html.includes('>AB<'), 'sin AB');
    check('identidad: pinta el título equipado',
      html.includes('Campeón'), 'sin Campeón');
    check('identidad: el marco viaja en el estilo del avatar',
      html.includes('var(--accent)'), 'sin el borde de Neón');
    check('identidad: el banner va de halo, no de fondo entero',
      html.includes('scale(1.9)'), 'sin halo');
    const defecto = miniIdentity('Ab', {
      title: 'title_default', frame: 'frame_none', banner: 'banner_none',
    }, { hideDefaultTitle: true });
    check('identidad: el título por defecto no hace ruido en la cabecera',
      !defecto.includes('Sin título') && !defecto.includes('avatar-frame'),
      defecto.slice(0, 120));
    const roto = miniIdentity('Ab', {
      title: 'no_existe', frame: 'no_existe', banner: 'no_existe',
    });
    check('identidad: un id desconocido no rompe el HTML',
      roto.includes('>AB<') && !roto.includes('undefined'), 'roto=' + roto.slice(0, 80));
  }

  // -----------------------------------------------------------------------
  //  4. F29 · LOS NÚCLEOS AL RANKING, Y LOS PESOS A LA OCULTA.
  //
  //     Lo que cuenta es `totalCores` —los núcleos GANADOS al ascender— y no
  //     `cores`, que es el saldo que queda después de gastar en el árbol. Es la
  //     diferencia entre "cuánto has Ascendido en total" y "cuánto te queda en
  //     el bolsillo", y para un ranking la segunda es la que no dice nada: un
  //     jugador que lo invirtió todo saldría con menos que uno que nunca ha
  //     Ascendido.
  //
  //     Y no cuenta el número de ascensiones, que es `resets`: se puede haber
  //     ascendido tres veces y haber sacado doce núcleos.
  // -----------------------------------------------------------------------
  {
    // `baseSave` con la forma que espera el juego: un array de ITEMS, no un
    // objeto de estado. Pasarle `{ cores: 4 }` a pelo no ponía nada y el test
    // miraba un documento que no tenía esos campos —que es como un banco pasa
    // en verde mientras comprueba nada.
    const g = await boot(baseSave([], { cores: 4, totalCores: 17, resets: 3 }));
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    const doc = (globalThis as any).__MEM_DB__?.[RANK_DOC] ?? {};

    check('F29: el guardado de prueba tiene los tres números distintos',
      s(g).totalCores === 17 && s(g).cores === 4 && s(g).resets === 3,
      `saldo=${s(g).cores} histórico=${s(g).totalCores} ascensiones=${s(g).resets}`);
    check('F29: al documento van los núcleos GANADOS, no el saldo',
      doc.cores === 17, `cores=${doc.cores} y el saldo era ${s(g).cores}`);
    check('F29: y no el número de ascensiones',
      doc.cores === 17 && doc.cores !== s(g).resets,
      `rees=${s(g).resets} y en el documento=${doc.cores}`);
  }
  {
    // La pestaña existe y mide lo que dice medir.
    check('F29: hay una pestaña de núcleos',
      BOARD_KINDS.includes('nucleos') && BOARDS.some(b => b.id === 'nucleos'),
      BOARD_KINDS.join(','));
    check('F29: la pestaña cuenta los núcleos, no las ascensiones',
      boardValue({ cores: 12 }, 'nucleos') === 12, 'cores=12');
    check('F29: y sin el campo no rompe: 0, no undefined',
      boardValue({}, 'nucleos') === 0, String(boardValue({}, 'nucleos')));

    // Y los núcleos CUENTAN en el definitivo, que es la otra mitad de la
    // decisión: puntúan y además se ven.
    const sinNucleos = computeScore({ score: 1000 });
    const conNucleos = computeScore({ score: 1000, cores: 10 });
    check('F29: los núcleos suman en el definitivo',
      conNucleos - sinNucleos === 10 * CORE_WEIGHT,
      `${conNucleos - sinNucleos} puntos con 10 núcleos (peso ${CORE_WEIGHT})`);
    check('F29: y el peso no depende de si el núcleo está gastado',
      computeScore({ cores: 10 }) === computeScore({ cores: 10, resets: 99 }),
      'ascender más veces no sube el definitivo por sí solo');

    // F29, la otra mitad, y es la que no parece un cambio: **el juego ya no
    // enseña los pesos**. El texto de debajo del Definitivo decía que un logro
    // vale 50.000 y uno secreto 250.000, que es exactamente la receta para
    // optimizar la puntuación en vez de la partida — y en cuanto F19 deje
    // regalar logros, es la forma más rentable de jugarle a otro.
    const pistaDefinitivo = BOARDS.find(b => b.id === 'definitivo')!.hint;
    check('F29: la pista ya NO dice cuánto pesa un logro',
      !pistaDefinitivo.includes('50.000') && !pistaDefinitivo.includes('250.000'),
      pistaDefinitivo.slice(0, 90));
    check('F29: y explica qué mide sin dar la receta',
      pistaDefinitivo.includes('resumen') || pistaDefinitivo.includes('combina'),
      pistaDefinitivo.slice(0, 90));
  }

  resumen('identidad: lo equipado llega al ranking');
}

export default main();
