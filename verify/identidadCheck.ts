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
import { miniIdentity, rellenoDeBanner } from '../src/ui/identity';
import { identityCard, unlockHint } from '../src/ui/profilePage';
import {
  SECRET_ACHIEVEMENTS, ACHIEVEMENT_REWARDS, LOGROS_DIFICILES, sumaDeBonificacion,
  type AchievementId
} from '../src/data/achievements';
import { ACHIEVEMENTS } from '../src/achievements';
import { COSMETICS, cosmeticsAlcanzables, viasSinResolver, cosmeticStyle } from '../src/data/cosmetics';
import {
  BOARD_KINDS, BOARDS, boardValue, computeScore, CORE_WEIGHT, FILAS_DE_EJEMPLO
} from '../src/services/rankingService';
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

{
  // ---------------------------------------------------------------------------
  //  F53 · EL BANNER DE FONDO DE LA FILA DEL RANKING, Y DOS COSAS QUE SALIERON
  //
  //  El banner ya llegaba al avatar como halo, pero en el ranking una fila es una tira
  //  larga y el halo solo ocupaba 32 px de ella. Puesto detrás de la tira entera, el
  //  banner es lo que se ve al llegar a la pantalla.
  //
  //  Y al hacerlo aparecieron dos cosas que ninguna prueba miraba:
  //
  //  · **`border-radius: inherit` tiene que ir AL FINAL.** El estilo del catálogo va en
  //    el atributo `style`, y ahí manda la última declaración de la misma propiedad, no
  //    el `!important` de una hoja. Un banner circular de fondo en una tira de 1056 px no
  //    es un banner: es un disco recortado a una franja.
  //  · **`backgroundImage` no es CSS.** Es `background-image`. En un `style` en línea una
  //    propiedad que no existe **se descarta en silencio**, así que el banner "Rejilla" y
  //    el "Tormenta de Datos" salían **sin fondo ninguno** en todos los sitios del juego,
  //    antes de esto. Dos banners del catálogo, invisibles, sin que nada lo delatara.
  // ---------------------------------------------------------------------------
  const bannerRejilla = COSMETICS.find(c => c.id === 'banner_grid')!;
  const bannerCircular = COSMETICS.find(c => c.id === 'banner_crown')!;

  const estilo = cosmeticStyle(bannerRejilla);
  check('F53: el estilo del catálogo sale en kebab-case, que es lo que CSS entiende',
    /background-image:/.test(estilo) && !/backgroundImage:/.test(estilo),
    `estilo=${estilo.slice(0, 60)}`);
  check('F53: y con background-size, que antes tampoco se aplicaba',
    /background-size:\s*18px\s+18px/.test(estilo),
    `estilo=${estilo.slice(-40)}`);

  // **Y QUE LAS DOS BANDERAS QUE SALÍAN VACÍAS AHORA TIENEN FONDO.** Es la prueba que
  //  habría pillado el bug: no "el estilo tiene una propiedad", sino "este cosmético
  //  concreto pinta algo".
  check('F53: y el banner que se perdía ahora tiene fondo de verdad',
    /background-image:\s*linear-gradient/.test(estilo.replace(/\s/g, '')),
    'el de la rejilla vuelve a pintar');
  const circular = cosmeticStyle(bannerCircular);
  check('F53: el circular conserva su relleno entero',
    /conic-gradient/.test(circular), `circular=${circular.slice(0, 50)}`);

  // **LAS DOS MARCAS DEL CATÁLOGO NO SON CSS.** `glow` y `gradient` los lee
  // `titleStyleFor()` por su nombre; si seorzaran en el `style` saldrían como
  // propiedades inventadas, que es inocuo pero mentira: el mapa dice qué es CSS y qué no.
  const conMarcas = cosmeticStyle({
    id: 'x', type: 'title', name: 'x', description: 'x', rarity: 'Común',
    unlock: { kind: 'default', value: 0 },
    style: { color: '#fff', glow: true, gradient: true, borderColor: '#0f0' } as any
  });
  check('F53: glow y gradient no se cuelan como si fueran CSS',
    !/glow:/.test(conMarcas) && !/gradient:/.test(conMarcas),
    `estilo=${conMarcas}`);
  check('F53: y una clave nueva en camelCase sale convertida sin tocar nada más',
    /border-color:#0f0/.test(conMarcas), `estilo=${conMarcas}`);

  // **Y LA FORMA LA MANDA LA FILA, NO EL CATÁLOGO.** Es lo que evita el disco recortado.
  const relleno = rellenoDeBanner(bannerCircular);
  const iRadio = relleno.lastIndexOf('border-radius');
  check('F53: el relleno del fondo deja la forma para el sitio que lo pinta',
    iRadio !== -1 && relleno.slice(iRadio).startsWith('border-radius:inherit'),
    `final=${relleno.slice(-34)}`);
  check('F53: y lo pone al final, que en un style en línea es lo que gana',
    relleno.trim().endsWith('border-radius:inherit'),
    `relleno=${relleno.slice(-30)}`);

  // **Y QUE LAS FILAS DE EJEMPLO LLEVEN COSMÉTICOS.** El respaldo del ranking existe para
  // que se vea algo cuando no hay nadie registrado, y se veía sin marco, sin banner y
  // sin título: cuatro rectángulos idénticos. Con eso, esta feature no se podía mirar en
  // el preview, que es la única superficie donde se comprueba el render.
  check('F53: las filas de ejemplo llevan título, marco y banner',
    FILAS_DE_EJEMPLO.length > 0
    && FILAS_DE_EJEMPLO.every((f: any) => !!(f.title && f.frame && f.banner)),
    'el respaldo del ranking va sin cosméticos');
  check('F53: y con ids que existen en el catálogo, que si no la fila sale sin fondo',
    FILAS_DE_EJEMPLO.every((f: any) =>
      COSMETICS.some(c => c.id === f.title)
      && COSMETICS.some(c => c.id === f.frame)
      && COSMETICS.some(c => c.id === f.banner)),
    FILAS_DE_EJEMPLO
      .filter((f: any) => !COSMETICS.some(c => c.id === f.banner))
      .map((f: any) => String(f.banner)).join(',') || 'todos existen');
}


{
  // ---------------------------------------------------------------------------
  //  F53 (segunda parte) · LOS MARCOS DEL CATÁLOGO Y LA PISTA QUE LOS DESPBLOQUEA
  //
  //  **LOS NUEVE MARCOS ERAN EL MISMO CÍRCULO DE UN PÍXEL.** `glassBase` traía
  //  `borderRadius: '9999px'` y lo heredaban todos: lo único que cambiaba entre marco y
  //  marco era el color. Los nombres prometían cosas que el estilo no cumplía —"Óxido:
  //  borde corroído", "Cascada: borde con degradado animado"— y un catálogo que miente es
  //  peor que un marco feo.
  //
  //  Lo que se comprueba es la **forma**: radio, grosor y despiece. Es la regla que se
  //  rompió, y una comprobación de "el estilo tiene un border-radius" habría pasado
  //  con los nueve iguales.
  // ---------------------------------------------------------------------------
  const marcos = COSMETICS.filter(c => c.type === 'frame' && c.id !== 'frame_none');
  // **LA HUELLA ES EL ESTILO ENTERO, Y POR QUÉ.** Dos marcos con el mismo estilo se
  // renderizan igual: no hay forma de distinguirlos. Es la propiedad que se rompió, y
  // compararla entera la hace imposible de colar.
  const huella = (c: any) => JSON.stringify(Object.entries((c.style || {})).sort());
  const repetidas = marcos.map(m => huella(m)).filter((f, i, t) => t.indexOf(f) !== i);
  check('F53: ningun marco es una copia de otro, que es como se veían iguales',
    repetidas.length === 0,
    repetidas.length ? `${repetidas.length} estilos repetidos` : `${marcos.length} marcos distintos`);

  // **Y QUE NO SE DISTINGAN SOLO POR EL COLOR.** Con la forma sola, nueve círculos de un
  // píxel de colores distintos pasan la comprobación anterior y siguen siendo el mismo
  // marco. Esta es la que se habría pasado entonces.
  const forma = (c: any) => {
    const s = c.style || {};
    // El radio sale del catálogo; si no lo trae, `frameStyle()` le pone un círculo, que es
    // el mismo valor para todos y por eso **no** cuenta como diferencia.
    return [s.borderRadius ?? 'circulo', s.borderWidth ?? '1px', s.borderStyle ?? 'solid'].join('|');
  };
  check('F53: y hay de verdad varias formas, no solo varios colores',
    new Set(marcos.map(m => forma(m))).size >= 4,
    'formas=' + [...new Set(marcos.map(m => forma(m)))].join(' / '));
  check('F53: y la base del catálogo NO declara un radio, que era lo que los igualaba',
    !marcos.some((m: any) => (m.style || {}).borderRadius === undefined
      && Object.keys(m.style || {}).length > 0
      && !Object.values(m.style || {}).some((v: any) => String(v).includes('borderRadius'))),
    'la base vuelve a declarar radio: ' + marcos.length);

  // **Y QUE NINGUN MARCO HEREDE EL RADIO DE LA BASE.** La base ya no lleva radio: es lo
  // que hacía que todos fueran círculos. Si alguien lo vuelve a añadir, todos los marcos
  // que no declaren el suyo vuelven a ser iguales.
  const conRadioEnBase = marcos.filter((m: any) => {
    const r = (m.style || {}).borderRadius;
    return r === undefined && forma(m) === 'circulo|1px|solid';
  });
  check('F53: los marcos circulares son los que lo dicen, no los que lo heredan',
    conRadioEnBase.length === 0,
    'heredan el radio: ' + conRadioEnBase.map((m: any) => m.id).join(','));

  // ---------------------------------------------------------------------------
  //  LA PISTA DE LOS LOGROS, CON SU NOMBRE.
  //
  //  Decía "Se desbloquea con un logro" para los cinco cosméticos que vienen de un
  //  logro, y eso no es una pista: es la ausencia de pista. El perfil **sí** enseña la
  //  lista de logros con su progreso, pero sin el nombre no hay forma de cruzar uno con el
  //  otro.
  // ---------------------------------------------------------------------------
  const deLogro = COSMETICS.filter(c => c.unlock.kind === 'achievement');
  const sinNombre = deLogro.filter(c => !/«.+»/.test(unlockHint(c)));
  check('F53: los cosméticos de logro dicen CUAL logro es',
    deLogro.length > 0 && sinNombre.length === 0,
    sinNombre.length ? `sin nombre: ${sinNombre.map(c => c.id).join(',')}` : `${deLogro.length} nombrados`);
  check('F53: y el nombre es el del logro, no el id del catálogo',
    unlockHint(deLogro.find(c => c.id === 'frame_ember')!).includes('Maestro de Forja'),
    unlockHint(deLogro.find(c => c.id === 'frame_ember')!));

  // **Y UN LOGRO SECRETO NO SE NUNCA DICE, QUE ES LO ÚNICO QUE LO HACE SECRETO.**
  // El filtro está en `nombreDeLogro()` y no en quien llama, para que ningún camino lo
  // salte: mañana se añade un cosmético desde un secreto y esto sigue sin hablar.
  const secretos: any[] = [];
  for (const c of COSMETICS as any[]) {
    const v = c.unlock.value;
    if (c.unlock.kind === 'achievement' && SECRET_ACHIEVEMENTS.includes(v)) secretos.push(c);
  }
  check('F53: y si el logro es secreto, la pista no lo nombra',
    secretos.length === 0 || secretos.every(c => !/«.+»/.test(unlockHint(c))),
    secretos.map(c => c.id).join(',') || 'ningún cosmético viene de un secreto todavía');
  check('F53: y un id que no existe no inventa un nombre',
    unlockHint({ ...deLogro[0], id: 'x', unlock: { kind: 'achievement', value: 'no_existe' } } as any)
      === 'Se desbloquea con un logro',
    unlockHint({ ...deLogro[0], id: 'x', unlock: { kind: 'achievement', value: 'no_existe' } } as any));

// ---------------------------------------------------------------------------
  //  3 · LOS DOCE DIFÍCILES: QUE SE PUEDAN HACER, Y QUE NO TOQUEN LA ECONOMÍA
  //
  //  **EL RIESGO DE UN LOGRO NUEVO NO ES QUE NO SALGA: ES QUE NO SE PUEDA HACER.**
  //  Un logro con un `target` de 12 compañeros se ve en la lista y no se completa nunca,
  //  y el síntoma es que el jugador cree que le falta algo. Un logro que se completa solo
  //  tampoco: es un logro de mentira.
  //
  //  Las cinco pruebas de abajo atacan las dos formas de mentira. Que el objetivo sea un
  //  número finito. Que un estado vacío no lo complete. Que un estado absurdo **no lo
  //  rebase** —una barra al 140 % es una barra rota—. Y que un estado maduro **sí** lo
  //  complete, los doce a la vez, que es donde se ve si dos condiciones se están pisando.
  // ---------------------------------------------------------------------------
  {
    const vacio = () => ({
      warehouse: [], companions: [], activeCompanions: [],
      nanites: 0, totalNanitesProduced: 0, totalClicks: 0, cratesOpened: 0, forgedCount: 0,
      cores: 0, totalCores: 0, resets: 0, unlockedAchievements: [], unlockedNodes: [],
      passiveIncome: 0, passiveMultiplier: 1, warehouseCapacity: 0, bonus: { storageSlots: 0 }
    } as any);

    // El estado que los completa a la vez. Cada campo es el que un logro mide, y el
    // almacén lleva diez items de cinco estrellas de los cuales uno es Divino, así que
    // `perfect_10` y `relicario` se cumplen sin que uno estorbe al otro.
    const maduro = () => ({
      ...vacio(),
      warehouse: [
        ...Array.from({ length: 10 }, () => ({ type: 'collector', rarity: 'Divino', potential: 5 })),
        { type: 'collector', rarity: 'Legendario', potential: 3 }
      ],
      activeCompanions: Array.from({ length: 12 }, (_, i) => `c${i}`),
      totalCores: 10_000, resets: 20, totalNanitesProduced: 1_000_000_000,
      passiveIncome: 100_000, cratesOpened: 500, totalClicks: 100_000,
      passiveMultiplier: 2, unlockedNodes: Array.from({ length: 20 }, (_, i) => `n${i}`),
      warehouseCapacity: 115, bonus: { storageSlots: 0 }
    } as any);

    const porId = (id: string) => ACHIEVEMENTS.find(a => a.id === id) as any;
    const ids = LOGROS_DIFICILES.map(l => l.id);
    const achievement = ids.map(porId);

    check('logros: los doce difíciles están en el catálogo y en su tabla',
      achievement.every(a => a) && ids.length === 12,
      `faltan: ${ids.filter(i => !porId(i)).join(',') || 'ninguno'} (${ids.length} en la tabla)`);

    // **CADA UNO DICE POR QUÉ ES TAN DIFÍCIL, Y NO ES UNA FRASE DE RELLENO.** Es un
    // banco de contenido, como el de las leyendas: la documentación de estos doce vive
    // en `porQue`, y una tabla de doce líneas en blanco es documentación que no existe.
    const sinPorque = LOGROS_DIFICILES.filter(l => (l.porQue ?? '').trim().length < 40);
    check('logros: y cada uno explica por qué es difícil',
      sinPorque.length === 0,
      sinPorque.map(l => `${l.id}="${l.porQue}"`).join(' | ') || `${ids.length} explicaciones`);

    // **LOS DOCE PREMIAN UN COSMÉTICO Y NADA MÁS.** Un `clickBonus` aquí sería tocar el
    // equilibrio en un commit de contenido, y el equilibrio es del jugador. Se comprueba
    // contra los `Record` que el motor suma, no contra un comentario.
    const conBono = ids.filter(id => {
      const r = ACHIEVEMENT_REWARDS[id as AchievementId];
      return !r || r.clickBonus !== 0 || r.passiveBonus !== 0;
    });
    check('logros: los doce no dan bonificación numérica, solo cosmético',
      conBono.length === 0, conBono.join(',') || 'los doce dan 0, 0');
    check('logros: y la suma de la bonificación sale de los otros, no de estos',
      sumaDeBonificacion().passiveBonus > 0
        && ids.every(id => ACHIEVEMENT_REWARDS[id as AchievementId].passiveBonus === 0),
      `pasivo total ${sumaDeBonificacion().passiveBonus}, de los doce: 0`);

    const vacios = achievement.filter(a => a && a.progress(vacio()).current !== 0);
    check('logros: una partida vacía no completa ninguno',
      vacios.length === 0,
      vacios.map(a => `${a.id}=${a.progress(vacio()).current}`).join(' | ') || `${ids.length} en cero`);

    // **LA BARRA NO SE PASA.** `current` va acotado con `Math.min` en los doce, y esto lo
    // comprueba con un estado imposible: si mañana alguien quita un `Math.min`, la barra
    // pasa de 100 % y el banco lo dice.
    const desbordados: string[] = [];
    const exagerado = { ...maduro(), totalCores: 10 ** 12, resets: 9999, cratesOpened: 10 ** 7, totalClicks: 10 ** 8 };
    for (const a of achievement.filter(Boolean)) {
      const { current, target } = a.progress(exagerado);
      if (current > target || current < 0) desbordados.push(`${a.id}=${current}/${target}`);
    }
    check('logros: ni con un estado imposible se pasa del objetivo',
      desbordados.length === 0, desbordados.join(' | ') || 'los doce se quedan en su 100 %');

    const incompletos = achievement.filter(a => a && a.progress(maduro()).current < a.progress(maduro()).target);
    check('logros: y hay una partida que los completa a los doce a la vez',
      incompletos.length === 0,
      incompletos.map(a => {
        const p = a.progress(maduro());
        return `${a.id}=${p.current}/${p.target}`;
      }).join(' | ') || 'los doce, en la misma partida');

    // **Y CADA COSMÉTICO DE LOS DOCE LO ABRE UNO DE ELLOS, DE VERDAD.** La vía del logro
    // la reconcilia el motor desde `unlockedAchievements`, así que esto no mira el
    // catálogo: mira lo que `cosmeticsAlcanzables` devuelve cuando el logro está
    // desbloqueado. Un cosmético escrito con un id mal escrito no abre nunca, y esta es
    // la prueba que lo dice.
    const sinPremio: string[] = [];
    const queNoAbren: string[] = [];
    for (const id of ids) {
      const suyos = (COSMETICS as any[]).filter(c => c.unlock.kind === 'achievement' && c.unlock.value === id);
      if (suyos.length === 0) { sinPremio.push(id); continue; }
      const abiertos = alcanzables({ unlockedAchievements: [id] }).map((c: any) => c.id);
      for (const c of suyos) if (!abiertos.includes(c.id)) queNoAbren.push(`${id}->${c.id}`);
    }
    check('logros: cada uno de los doce premia al menos un cosmético',
      sinPremio.length === 0, sinPremio.join(',') || 'los doce tienen premio');
    check('logros: y el premio se abre de verdad al desbloquear el logro',
      queNoAbren.length === 0, queNoAbren.join(',') || `${ids.length} premios abiertos`);
  }
}


  resumen('identidad: lo equipado llega al ranking');
}

export default main();
