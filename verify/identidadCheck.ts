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

import { check, resumen, boot, baseSave, reload, s, collector } from './kit';
import { miniIdentity } from '../src/ui/identity';
import { identityCard } from '../src/ui/profilePage';
import { COSMETICS, cosmeticsAlcanzables, viasSinResolver } from '../src/data/cosmetics';
import { BOARD_KINDS, BOARDS, boardValue, computeScore, CORE_WEIGHT } from '../src/services/rankingService';
import { coresGastadosEnArbol } from '../src/data/tree';

const RANK_DOC = 'rankings/test';

async function main() {
  const alcanzables = (e: any) => cosmeticsAlcanzables(e);
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
    // **EL BANNER VA DETRÁS DEL NÚCLEO Y SE ESCALA, QUE ES LO QUE LO HACE HALO Y NO
    // FONDO ENTERO.** Se comprueba el orden y no el número del escalado: el número
    // exacto es una decisión de aspecto —1,9 era el valor viejo y ahora es 1,7 para lo
    // circular y 1,32 para lo que no lo es, porque el banner se ve de más al 50 %— y una
    // prueba clavada en un 1,9 solo sirve para avisar cuando se cambia el gusto, que no
    // es un fallo. El orden sí es una regla: el banner detrás del núcleo o no es un
    // banner.
    const iBanner = html.indexOf('transform:scale(');
    const iNucleo = html.indexOf('avatar-core');
    check('identidad: el banner va de halo detrás del núcleo, no de fondo entero',
      iBanner !== -1 && iNucleo !== -1 && iBanner < iNucleo,
      `banner=${iBanner} nucleo=${iNucleo}`);
    // Y el marco, ENCIMA del núcleo: el banner es el fondo del retrato y el marco es
    // el borde. Si el marco se colara debajo, el avatar lo taparía.
    const iMarco = html.lastIndexOf('avatar-frame');
    check('identidad: el marco va encima del núcleo, y el banner debajo',
      iMarco > iNucleo, `marco=${iMarco} nucleo=${iNucleo}`);
    // ---------------------------------------------------------------------------
    //  F54 · EL HALO NO SE SALE DE LA CAJA, Y EL MARCO NO ENTRA EN EL RECORTE
    //
    //  El banner se escala para leerse como halo y el avatar no recorta: medido en el
    //  perfil, con una caja de 80 px, el halo salía **13 px por cada lado**, y en la
    //  cabecera, donde la caja es de 32 px y el hueco hasta el nombre de 8, se comía las
    //  primeras letras. El arreglo es un envoltorio que recorta **solo el banner**.
    //
    //  Lo que se comprueba es la estructura, porque lo que se rompió fue la estructura:
    //  el banner tiene que estar **dentro** del envoltorio y el marco **fuera**, y el
    //  marco fuera es medio problema —su trazo está centrado en el borde, así que
    //  recortarlo deja medio píxel y todos los marcos se ven más finos unos que otros—.
    // ---------------------------------------------------------------------------
    {
      const iHalo = html.indexOf('avatar-halo');
      const iCierreHalo = html.indexOf('</span>', iHalo);
      check('F54: el halo existe y envuelve al banner',
        iHalo !== -1 && iCierreHalo !== -1
        && html.indexOf('transform:scale(', iHalo) > iHalo
        && html.indexOf('transform:scale(', iHalo) < iCierreHalo,
        `halo=${iHalo} cierre=${iCierreHalo}`);
      check('F54: y el marco queda FUERA del recorte, con su trazo entero',
        iMarco > iCierreHalo, `marco=${iMarco} cierre del halo=${iCierreHalo}`);
      check('F54: y el núcleo va entre el halo y el marco, que es el orden de las capas',
        iHalo < iNucleo && iNucleo < iMarco, `halo=${iHalo} nucleo=${iNucleo} marco=${iMarco}`);
      // **Y QUE SIN BANNER NO SALGA EL ENVOLTORIO VACÍO.** Un envoltorio sin nada
      // dentro es un nodo que no pinta nada y que sí pinta en el inspector: la mitad de
      // los avatares del juego no llevan banner.
      const sinBanner = miniIdentity('Ab', { title: 'title_default', frame: 'frame_neon' });
      check('F54: y sin banner no hay envoltorio que no pinte nada',
        sinBanner.indexOf('avatar-halo') === -1, 'aparece=' + sinBanner.indexOf('avatar-halo'));
    }
    // **Y QUE EL PERFIL USE EL MISMO AVATAR QUE LA CABECERA.** El markup estaba
    // copiado en `identityCard()` y las dos copias ya se habían separado. La prueba
    // compara el trozo de avatar de las dos funciones, y es la que falla el día que
    // alguien toca uno de los dos y no el otro.
    //
    // **CON LOS MISMOS TAMAÑOS A PROPÓSITO.** El perfil pinta el avatar a 56 px y la
    // cabecera a 32, y eso es lo correcto; comparar el markup entero fallaría siempre.
    // Lo que se compara es el resto —el halo, el marco y su estilo—, que es lo que se
    // separó.
    const misma = miniIdentity('Ab', {
      title: 'title_champion', frame: 'frame_neon', banner: 'banner_abyss'
    }, { hideDefaultTitle: true, avatarClass: 'w-14 h-14', glyphClass: 'text-lg' });
    const perfil = identityCard({
      name: 'Ab',
      cosmetics: { title: 'title_champion', frame: 'frame_neon', banner: 'banner_abyss' }
    });
    const trozo = (h: string) => h.slice(h.indexOf('avatar-stack'), h.indexOf('avatar-core') + 40);
    check('identidad: el perfil y la cabecera pintan el mismo avatar',
      trozo(misma) === trozo(perfil), 'perfil=' + trozo(perfil).slice(0, 110));
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
  }
  {
    // F29 · EL HISTÓRICO DE LAS PARTIDAS VIEJAS. Solo se ve con una partida que
    // ascendió antes de que existiera el campo, y **dejaba al jugador atascado**.
    //
    // La reconstrucción usaba `pendingCores(producido)`, que responde a "cuántos
    // núcleos daría si empezaras desde cero". Pero una partida vieja YA GASTÓ
    // producción en sus propias ascensiones, así que salía enorme —con 412 M y 12
    // reinicios daba 296— y como `nextCores` resta el histórico, el siguiente
    // Ascenso pedía 0 más. Se podía ver la pantalla, pero no se podía ascender.
    const gastado = coresGastadosEnArbol({ core_sink: 3, click_power: 4 });
    check('F29: se puede sumar lo gastado en el árbol',
      gastado > 0 && Number.isFinite(gastado), 'gastado=' + gastado);
    check('F29: el gasto en el árbol sale de la función que cobra',
      coresGastadosEnArbol({ core_sink: 1 }) === 1,
      'un nivel = su coste, no un estimado');

    // El caso real del jugador: ascendió, gastó casi todo y el campo no existe.
    const g = await boot(baseSave([], {
      totalNanitesProduced: 120_000_000, resets: 6, cores: 3, totalCores: 0,
      nodeLevels: { core_sink: 3, click_power: 4, forge_luck: 2 }
    }));
    const st = s(g);
    check('F29: el histórico viejo se reconstruye con cartera + gastado',
      st.totalCores === 3 + coresGastadosEnArbol({ core_sink: 3, click_power: 4, forge_luck: 2 }),
      `totalCores=${st.totalCores} (cartera 3 + gastado ${coresGastadosEnArbol({ core_sink: 3, click_power: 4, forge_luck: 2 })})`);
    check('F29: y sobre todo: puede volver a ascender',
      g.getPrestigeInfo().pending > 0,
      `pending=${g.getPrestigeInfo().pending} — la estimación vieja lo dejaba en 0`);

    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    const docViejo = (globalThis as any).__MEM_DB__?.[RANK_DOC] ?? {};
    check('F29: y el número reconstruido llega al documento del ranking',
      docViejo.cores === st.totalCores,
      `ranking=${docViejo.cores} estado=${st.totalCores}`);

    // Y una partida que YA tiene el campo no se toca: es el caso normal después
    // de migrar una vez, y una migración que lo pisara haría perder núcleos cada
    // vez que se abriera el juego.
    const g2 = await boot(baseSave([], {
      totalNanitesProduced: 120_000_000, resets: 6, cores: 3, totalCores: 120,
      nodeLevels: { core_sink: 3 }
    }));
    check('F29: una partida con el campo guardado no se toca',
      s(g2).totalCores === 120, 'totalCores=' + s(g2).totalCores);

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

  // ---------------------------------------------------------------------------
  //  LOS CAMINOS DEL CATÁLOGO, Y QUE NO QUEDE NINGUNO MUERTO
  //
  //  El hallazgo: el catálogo declaraba cuatro vías de desbloqueo y **solo la caja
  //  repartía algo**. El Tóxico y el Carmesí ponían "se desbloquea con un logro" y el
  //  logro no repartía nada: eran inalcanzables para siempre, y el jugador lo veía en su
  //  propia lista de cosméticos con el candado al lado.
  //
  //  Lo que se comprueba aquí son las tres cosas que crean el bug: que la regla de la vía
  //  funciona, que el motor la llama, y **que no queda ninguna vía sin reconciliar** salvo
  //  la de ranking, que se declara a propósito y por qué.
  // ---------------------------------------------------------------------------
  {
    // **LA VÍA DEL LOGRO.** Con el logro dentro, el cosmético es alcanzable; sin él, no.
    check('cosmeticos: el logro abre su cosmetico',
      alcanzables({ unlockedAchievements: ['ascendant'] }).some((c: any) => c.id === 'banner_crimson'),
      alcanzables({ unlockedAchievements: ['ascendant'] }).map((c: any) => c.id).join(','));
    check('cosmeticos: y sin el logro, no',
      !alcanzables({ unlockedAchievements: [] }).some((c: any) => c.id === 'banner_crimson'));
    // Un logro que no existe no abre nada: es la coacción del Catálogo de logros aplicada
    // aquí, y sin ella un `value` mal escrito abriría un cosmético cualquiera.
    check('cosmeticos: un id de logro que no existe no abre nada',
      alcanzables({ unlockedAchievements: ['no_existe'] }).length === 0,
      alcanzables({ unlockedAchievements: ['no_existe'] }).map((c: any) => c.id).join(','));

    // **LA VÍA DEL NÚCLEO, Y CON `totalCores`, NO CON EL SALDO.** El saldo baja al
    // gastar, así que un cosmético por saldo se perdería al comprar un nodo.
    check('cosmeticos: 20 nucleos attained abren el Atardecer',
      alcanzables({ totalCores: 20 }).some((c: any) => c.id === 'banner_sunset') &&
      !alcanzables({ totalCores: 19 }).some((c: any) => c.id === 'banner_sunset'),
      '19=' + alcanzables({ totalCores: 19 }).map((c: any) => c.id).join(','));
    // **Y EL `value: 0` NO ES "GRATIS".** El Singularidad lo declara con cero porque su
    // vía era "comprar el nodo", que esta función no puede preguntar. Con `0` el filtro lo
    // daría a todo el mundo al cargar, y es un título Divino.
    check('cosmeticos: un tope de nucleos 0 no abre nada',
      !alcanzables({ totalCores: 99999 }).some((c: any) => c.id === 'title_singularity'),
      alcanzables({ totalCores: 99999 }).map((c: any) => c.id).join(','));

    // **LA VÍA SECRETA ES LA VÍA DEL LOGRO.** Los dos ids `secret` del catálogo son
    // ids de logro, y por eso la misma pregunta los abre.
    check('cosmeticos: un logro secreto abre su banner',
      alcanzables({ unlockedAchievements: ['hidden'] }).some((c: any) => c.id === 'banner_hidden'),
      alcanzables({ unlockedAchievements: ['hidden'] }).map((c: any) => c.id).join(','));

    // **Y LA DE CAJA NO SE CUENTA AQUI.** `crateCosmetics()` es la que la reparte, y si esta
    // también la mirara, el cosmético de caja se daría dos veces por caminos distintos.
    check('cosmeticos: los de caja no se reparten por vía de estado',
      !alcanzables({ unlockedAchievements: [], totalCores: 99999 })
        .some((c: any) => c.unlock.kind === 'crate'),
      alcanzables({ totalCores: 99999 }).filter((c: any) => c.unlock.kind === 'crate').map((c: any) => c.id).join(','));
    check('cosmeticos: ni los de {"sin marco"}, que nacen puestos',
      !alcanzables({ totalCores: 99999 }).some((c: any) => c.unlock.kind === 'default'));

    // **LA ÚLTIMA, Y ES LA IMPORTANTE: NO QUEDA NINGÚN VÍA SIN RECONCILIAR EN SILENCIO.**
    // `viasSinResolver()` declara la de ranking con su motivo. Si alguien añade una vía
    // nueva al catálogo y no la implementa, esta lista la enseña el mismo día; sin ella,
    // //  el cosmético aparece en la pantalla del jugador como inalcanzable y nadie lo sabe.
    const vias = viasSinResolver();
    check('cosmeticos: la unica vía sin reconciliar es el ranking, y se declara',
      vias.length === 1 && vias[0].kind === 'ranking' && vias[0].count === 5,
      JSON.stringify(vias));

    // Y que el ranking sean los únicos cinco: los de top 1, top 3 y top 10.
    check('cosmeticos: los cinco del ranking son los de permanencia en la tabla',
      COSMETICS.filter((c: any) => c.unlock.kind === 'ranking').length === 5);
  }

  // ---------------------------------------------------------------------------
  //  EL MOTOR LO LLAMA, Y ESO ES LO QUE NO SE COMPRUEBA SIN UN JUEGO
  // ---------------------------------------------------------------------------
  {
    // Un guardado con logros ya dentro tiene que **reconciliar al cargar**, no solo cuando
    // salta el logro. Es el caso real: el jugador lleva semanas con el Carmesí bloqueado.
    const g = await boot(baseSave([collector('r1')], {
      unlockedAchievements: ['ascendant', 'jackpot', 'smith_25', 'first_click'],
      totalCores: 250
    }));
    const tiene = s(g).cosmetics.unlocked as string[];
    check('cosmeticos: al cargar, un logro viejo abre su cosmetico',
      tiene.includes('banner_crimson'), tiene.join(','));
    // **250 NÚCLEOS, QUE ES LO QUE NECESITA EL NEÓN.** Con 30 el catalogue abria cinco y el
    // marco de 40 seguía bloqueado: la prueba estaba contando con un número que no
    // daba para lo que afirmaba.
    check('cosmeticos: y tambien los de los demas logros, de una sola pasada',
      tiene.includes('banner_toxic') && tiene.includes('frame_ember') && tiene.includes('frame_steel'),
      tiene.join(','));
    check('cosmeticos: y los de nucleos del guardado viejo',
      tiene.includes('banner_sunset') && tiene.includes('frame_neon'), tiene.join(','));
    // La Corona y el titulo Divino son de **ranking**, la vía que no se reconcilia.
    check('cosmeticos: cargar NO abre nada de la vía del ranking',
      !tiene.includes('banner_crown') && !tiene.includes('frame_gold') && !tiene.includes('title_champion'),
      tiene.join(','));
    check('cosmeticos: el de singularidad sigue bloqueado, porque su vía no es núcleos',
      !tiene.includes('title_singularity'), tiene.join(','));

    // Y que **no se rompa al volver a cargar**: la reconciliación es idempotente porque
    // `desbloquearCosmetico()` ya devuelve false de lo que estaba, y no duplica la lista.
    const antes = tiene.length;
    const g2 = await reload();
    check('cosmeticos: recargar no duplica la lista de desbloqueados',
      (s(g2).cosmetics.unlocked as string[]).length === antes,
      `antes=${antes} despues=${(s(g2).cosmetics.unlocked as string[]).length}`);
  }

  resumen('identidad: lo equipado llega al ranking');
}

export default main();
