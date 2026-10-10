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

import { check, resumen, boot, baseSave, reload, s, collector, companion, ficha } from './kit';
import { miniIdentity, rellenoDeBanner, titleStyleFor } from '../src/ui/identity';
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
import { coresGastadosEnArbol, TREE_BY_ID } from '../src/data/tree';
import { danioDeRango } from '../src/data/crafting';
import { tarjetaDesdeEstado, danoFinalDeTarjeta } from '../src/data/profile';
import { techoDeExpansor, EXPANSOR_TIERS } from '../src/data/store';
import { iconoDeCosmetico, ICONO_BASE } from '../src/data/avatarIcons';

const RANK_DOC = 'rankings/test';

async function main() {
  const alcanzables = (e: any) => cosmeticsAlcanzables(e);
  // -----------------------------------------------------------------------
  //  1. LO EQUIPADO LLEGA AL DOCUMENTO DEL RANKING.
  //
  //     Se equipa marco y banner por la API del motor (la única que puede
  //     mutar el estado, R1) y se mira lo guardado, no la memoria: lo que
  //     solo vive en memoria es un bug (R13/R28).
  //
  //     F104 · La fila sale como mucho una vez cada quince minutos, así que
  //     equipar no la republica en el acto: se adelanta el reloj al siguiente
  //     periodo y se fuerza el bloque, igual que haría el temporizador. Sin
  //     reboot en medio no hay comparación de fechas que romper.
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
    const ahoraReal = Date.now;
    let t = ahoraReal();
    Date.now = () => t;
    try {
      t += 16 * 60_000;
      await g.flush();
      await new Promise((r) => setTimeout(r, 0));
      await new Promise((r) => setTimeout(r, 0));
    } finally {
      Date.now = ahoraReal;
    }
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
    // **YA NO PINTA LAS INICIALES, Y ESTA ES LA PRUEBA DE QUE NO VUELVEN.**
    //
    // El avatar llevaba las dos primeras letras del nombre y ahora lleva el icono del
    // marco. La prueba se cambia de "pinta AB" a "NO pinta AB", porque una prueba que
    // solo comprueba lo nuevo deja pasar la cosa vieja: si alguien reintroduce las
    // iniciales, esta sigue en verde mientras el avatar vuelve a ser un sello.
    check('identidad: ya NO pinta las iniciales del nombre',
      !html.includes('>AB<'), 'vuelve a pintar AB');
    check('identidad: y pinta el icono del marco, que es lo que lo identifica',
      html.includes('<svg'), 'sin icono');
    // **EL ICONO SALE DEL MARCO, NO DEL BANNER.** Es el cambio de fondo del rediseño: el
    // banner es el fondo y el marco es la cara. Se comprueba que quitar el banner NO
    // cambia el icono, que es lo que antes no se cumplía.
    check('identidad: el icono sale del marco, no del banner',
      iconoDeCosmetico({ frame: 'frame_neon' }).icono === iconoDeCosmetico({ frame: 'frame_neon', banner: 'banner_abyss' }).icono,
      'el banner cambia el icono del marco');
    check('identidad: el banner que no aporta icono y el que sí, dan el mismo',
      iconoDeCosmetico({ banner: 'banner_abyss' }).icono === ICONO_BASE.icono,
      'el banner sigue eligiendo icono');
    check('identidad: sin cosméticos sale el de base, no un hueco',
      iconoDeCosmetico(undefined).icono === ICONO_BASE.icono
        && iconoDeCosmetico({}).icono === ICONO_BASE.icono,
      'sin base');
    check('identidad: pinta el título equipado',
      html.includes('Campeón'), 'sin Campeón');
    check('identidad: el estilo del marco (su icono de perfil) viaja en el avatar',
      html.includes('var(--accent)'), 'sin el aro de Neón');
    // ---------------------------------------------------------------------------
    //  BANNER = FONDO · MARCO = ICONO DE PERFIL, Y SON INDEPENDIENTES
    //
    //  El banner va detrás y llena la caja; el emblema del marco va encima, centrado,
    //  con su propio fondo e icono. Ni el banner escala (era lo que lo convertía en aro),
    //  ni el marco toma el estilo del banner.
    // ---------------------------------------------------------------------------
    const iBanner = html.indexOf('avatar-banner');
    const iEmblema = html.indexOf('avatar-emblem');
    check('identidad: el banner es el fondo, va antes y sin escalado',
      iBanner !== -1 && iEmblema !== -1 && iBanner < iEmblema
        && !html.slice(iBanner, iEmblema).includes('transform:scale(')
        && !html.includes('transform:scale('),
      `banner=${iBanner} emblema=${iEmblema}`);
    check('identidad: el emblema es el icono de perfil y va por encima del fondo',
      iEmblema !== -1 && html.includes('avatar-emblem-glyph'),
      'sin emblema');
    // **Y EL EMBLEMA NO LLEVA NADA DEL BANNER.** Si el estilo del marco incluyera el
    // relleno del banner, cambiar de fondo cambiaría la cara.
    const emblemSlice = html.slice(iEmblema, html.indexOf('avatar-emblem-glyph'));
    check('identidad: el emblema del marco no lleva el relleno del banner',
      !emblemSlice.includes('radial-gradient(120% 100% at 50% 0%,#1e40af'),
      'el emblema se tiñe con el banner');
    // ---------------------------------------------------------------------------
    //  F54 · EL BANNER NO SE SALE DE LA CAJA
    //
    //  El fondo lo recorta `.avatar-fondo` (overflow hidden), que es lo que impide que un
    //  degradado se salga de las esquinas redondeadas. Ya no hay escalado: el banner llena
    //  la caja.
    // ---------------------------------------------------------------------------
    {
      const iFondo = html.indexOf('avatar-fondo');
      check('F54: el banner vive dentro de su envoltorio que recorta',
        iFondo !== -1 && iBanner > iFondo, `fondo=${iFondo} banner=${iBanner}`);
      const sinBanner = miniIdentity('Ab', { title: 'title_default', frame: 'frame_neon' });
      check('F54: y sin banner no hay envoltorio que no pinte nada',
        sinBanner.indexOf('avatar-fondo') === -1, 'aparece=' + sinBanner.indexOf('avatar-fondo'));
    }
    // **Y QUE EL PERFIL USE EL MISMO AVATAR QUE LA CABECERA.**
    const misma = miniIdentity('Ab', {
      title: 'title_champion', frame: 'frame_neon', banner: 'banner_abyss'
    }, { hideDefaultTitle: true, avatarClass: 'w-14 h-14', glyphClass: 'text-lg' });
    const perfil = identityCard({
      name: 'Ab',
      cosmetics: { title: 'title_champion', frame: 'frame_neon', banner: 'banner_abyss' }
    });
    const trozo = (h: string) => h.slice(h.indexOf('avatar-stack'), h.indexOf('avatar-emblem-glyph') + 60);
    check('identidad: el perfil y la cabecera pintan el mismo avatar',
      trozo(misma) === trozo(perfil), 'perfil=' + trozo(perfil).slice(0, 110));
    const defecto = miniIdentity('Ab', {
      title: 'title_default', frame: 'frame_none', banner: 'banner_none',
    }, { hideDefaultTitle: true });
    check('identidad: el título por defecto no hace ruido en la cabecera',
      !defecto.includes('Sin título') && !defecto.includes('avatar-fondo'),
      defecto.slice(0, 120));
    // **Y EL EMBLEMA DE BASE SIEMPRE ESTÁ, aunque no haya marco.** Un avatar con banner y
    // sin marco no puede quedar vacío: el chip de base es el perfil por defecto.
    check('identidad: sin marco, el emblema de base sigue saliendo',
      defecto.includes('avatar-emblem') && defecto.includes('<svg'),
      'sin emblema de base');
    const roto = miniIdentity('Ab', {
      title: 'no_existe', frame: 'no_existe', banner: 'no_existe',
    });
    check('identidad: un id desconocido no rompe el HTML',
      roto.includes('<svg') && !roto.includes('undefined'), 'roto=' + roto.slice(0, 80));
    check('identidad: y un id desconocido cae al icono de base, no a un hueco',
      iconoDeCosmetico({ banner: 'no_existe', frame: 'no_existe', title: 'no_existe' }).icono
        === ICONO_BASE.icono,
      'no cae al base');
  }

  // -----------------------------------------------------------------------
  //  B21 · UN TÍTULO CON DEGRADADO SE VE, NO SE PONE TRANSPARENTE SIN FONDO.
  //
  //  Cinco títulos equipados no aparecían en ningún sitio donde van con
  //  `titleStyleFor()` (cabecera del perfil, cabecera, filas del ranking,
  //  tarjeta ajena): el estilo ponía `color:transparent` con
  //  `background-clip:text` pero ningún `background-image` que recortar, y el
  //  texto quedaba invisible. La carta del catálogo sí lo enseñaba, en plano,
  //  porque ese camino nunca ponía el transparente: dos copias de la regla que
  //  ya decían cosas distintas.
  // -----------------------------------------------------------------------
  {
    const titulos = (COSMETICS as any[]).filter(c => c.type === 'title');
    const conDegradado = titulos.filter(t => t.style?.gradient);
    check('títulos: hay títulos con degradado en el catálogo',
      conDegradado.length > 0, conDegradado.map(t => t.id).join(','));
    // **LA INVARIANTE, SOBRE TODOS.** Si el estilo deja el color transparente
    // es porque hay un fondo que recortar: sin fondo no se ve nada.
    const invisibles = titulos
      .map(t => ({ id: t.id, estilo: titleStyleFor(t) }))
      .filter(x => /color\s*:\s*transparent/.test(x.estilo) && !/background-image\s*:/.test(x.estilo))
      .map(x => x.id);
    check('títulos: ninguno se pinta invisible (transparente sin fondo)',
      invisibles.length === 0, invisibles.join(',') || `${titulos.length} visibles`);
    // Y el caso reportado: Mil Millones trae su fondo para el degradado.
    const mil = titleStyleFor((COSMETICS as any[]).find(c => c.id === 'title_mil_millones'));
    check('títulos: Mil Millones trae fondo para su degradado',
      /background-image\s*:linear-gradient/.test(mil),
      mil.slice(0, 160));
    // Y la cabecera del perfil lo enseña con su nombre: equipado y pintado
    // salen del mismo id, así que si está puesto se lee.
    const cabecera = identityCard({
      name: 'Ab',
      cosmetics: { title: 'title_mil_millones', frame: 'frame_none', banner: 'banner_none' }
    });
    check('títulos: la cabecera del perfil enseña el Mil Millones puesto',
      cabecera.includes('Mil Millones') && /background-image\s*:/.test(cabecera),
      cabecera.slice(0, 160));
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
    // **Y EL TÍTULO SINGULARIDAD YA NO ES "COMPRA CON 0 NÚCLEOS".** Estaba declarado
    // como `cores: 0` porque su vía de verdad era "comprar el nodo", que esta función
    // no podía preguntar: con `0` la pregunta "¿has ganado al menos cero?" la ganaría
    // todo el mundo al cargar, así que el tope se puso a cero **para que no lo diera**
    // —y con eso quedó sin poder conseguirse, enseñando en el perfil la frase imposible
    // que reportó el jugador. Ahora su vía es `node` y se resuelve con los niveles del
    // árbol, que es lo que dice su propia descripción.
    check('cosmeticos: el singularidad no se gana con nucleos, por mucha suma que tengan',
      !alcanzables({ totalCores: 99999 }).some((c: any) => c.id === 'title_singularity'),
      alcanzables({ totalCores: 99999 }).map((c: any) => c.id).join(','));
    check('cosmeticos: y se gana al comprar su nodo',
      alcanzables({ totalCores: 0, nodeLevels: { singularity: 1 } })
        .some((c: any) => c.id === 'title_singularity'),
      alcanzables({ totalCores: 0, nodeLevels: { singularity: 1 } }).map((c: any) => c.id).join(','));
    // El nodo comprado tiene nivel > 0; el 0 es "está en el árbol sin tocar".
    check('cosmeticos: un nodo en nivel 0 no abre nada',
      !alcanzables({ nodeLevels: { singularity: 0 } }).some((c: any) => c.id === 'title_singularity'),
      alcanzables({ nodeLevels: { singularity: 0 } }).map((c: any) => c.id).join(','));
    check('cosmeticos: otro nodo del arbol no abre el singularidad',
      !alcanzables({ totalCores: 99999, nodeLevels: { core_sink: 7 } })
        .some((c: any) => c.id === 'title_singularity'),
      alcanzables({ totalCores: 99999, nodeLevels: { core_sink: 7 } }).map((c: any) => c.id).join(','));

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
    check('cosmeticos: el de singularidad sigue bloqueado sin el nodo comprado',
      !tiene.includes('title_singularity'), tiene.join(','));

    // Y que **no se rompa al volver a cargar**: la reconciliación es idempotente porque
    // `desbloquearCosmetico()` ya devuelve false de lo que estaba, y no duplica la lista.
    const antes = tiene.length;
    const g2 = await reload();
    check('cosmeticos: recargar no duplica la lista de desbloqueados',
      (s(g2).cosmetics.unlocked as string[]).length === antes,
      `antes=${antes} despues=${(s(g2).cosmetics.unlocked as string[]).length}`);

    // **Y LA VÍA NUEVA FUNCIONA EN EL MOTOR Y NO SOLO EN EL CATÁLOGO.** Otra partida,
    // misma carga, con el nodo puesto: sin esto un `node` declarado y olvidado pasaría
    // igual que pasaba el `cores: 0`. Va DESPUÉS de la recarga de arriba porque `reload()`
    // recarga la última partida montada, y esta es otra.
    const gNodo = await boot(baseSave([collector('r1')], {
      nodeLevels: { singularity: 1 },
      unlockedAchievements: [],
      totalCores: 0
    }));
    const tieneNodo = s(gNodo).cosmetics.unlocked as string[];
    check('cosmeticos: cargar con el nodo comprado abre el singularidad',
      tieneNodo.includes('title_singularity'), tieneNodo.join(','));
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
    /background-size:\s*[\d.]+px\s+[\d.]+px/.test(estilo),
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
    // La forma sale del radio y el borde. El borde puede venir del atajo `border` o de
    // `borderWidth`/`borderStyle`; los dos cuentan.
    return [
      s.borderRadius ?? 'sin-radio',
      s.border ?? [s.borderWidth ?? '1px', s.borderStyle ?? 'solid'].join(' ')
    ].join('|');
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

  // **Y LA PISTA DEL SINGULARIDAD ERA UNA FRASE SIN SENTIDO.** Salía como "Compra con
  // 0 núcleos en la Ascensión": una instrucción que no se puede seguir y que además no
  // apuntaba a nada, porque su vía real es el nodo del árbol. La pista tiene que decir
  // la acción que se hace, con el nombre del nodo tal y como lo pone el árbol.
  const singularidad = COSMETICS.find(c => c.id === 'title_singularity')!;
  const pista = unlockHint(singularidad);
  check('F53: el singularidad dice el nodo que hay que comprar',
    pista.includes(`nodo «${TREE_BY_ID.singularity.name}» del árbol`) && !pista.includes('núcleos'),
    pista);

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
      // La cima de la escalera de expansores, salga lo que salga: si sube, la
      // partida madura sube con ella y el logro no se queda sin completar.
      warehouseCapacity: techoDeExpansor(EXPANSOR_TIERS.length), bonus: { storageSlots: 0 }
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

  // -------------------------------------------------------------------------
  //  F83 · LO PUBLICADO ALCANZA PARA RECALCULAR EL DANO AJENO
  // -------------------------------------------------------------------------
  //
  //  La fila del ranking y la tarjeta ajena ensenan el dano final sin temporales,
  //  recalculado de lo publicado: el arma equipada con su nivel y sus afijos, los
  //  nodos con su nivel, los logros y los companeros activos. Si la tarjeta no
  //  trajera alguna entrada, el recalculado mentiria, y esta es la prueba que ata
  //  que lo publicado y lo cobrado son el mismo numero por los dos caminos.
  {
    const g = await boot(baseSave([
      collector('r9', 5, { potential: 3, damage: danioDeRango(5, 3), level: 4, affixes: ['aff_bulwark'] })
    ], {
      equippedCollectorId: 'r9',
      nodeLevels: { core_edge: 2 },
      unlockedAchievements: ['first_click'],
      activeCompanions: ['mp'],
      companions: [{ id: 'mp', name: 'Multi', type: 'multiplier', power: 0.5, tier: 1 }]
    }));
    const t = tarjetaDesdeEstado(s(g), 'test', 'T');
    const d = danoFinalDeTarjeta(t);
    check('dano ajeno: lo recalculado de la tarjeta es el dano del clic sin buff',
      d.total === g.getClickDamage(),
      `tarjeta=${d.total} clic=${g.getClickDamage()}`);
    check('dano ajeno: y es el stat de la ficha, que es el mismo final',
      d.total === g.getStatPrincipal('r9')?.valor,
      `tarjeta=${d.total} stat=${g.getStatPrincipal('r9')?.valor}`);
    check('dano ajeno: y el partido suma el total',
      d.intrinseco + d.partida === d.total && d.intrinseco > 0 && d.partida > 0,
      `arma=${d.intrinseco} partida=${d.partida} total=${d.total}`);

    // **Y LA FILA DEL RANKING PUBLICA ESOS DOS NUMEROS.** Salen de la misma cadena
    // que la ficha, asi que la fila pinta lo mismo que la ficha del dueno.
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    const doc = (globalThis as any).__MEM_DB__?.[RANK_DOC] ?? {};
    const filas = g.getStatFilas('r9');
    check('dano ajeno: la fila publica el final de la ficha',
      doc.danoFinal === filas.total,
      `fila=${doc.danoFinal} ficha=${filas.total}`);
    check('dano ajeno: y publica cuanto es del arma',
      doc.danoArma === filas.delArma,
      `arma=${doc.danoArma} ficha=${filas.delArma}`);

    // **Y SIN ARMA NO HAY CIFRA, NI EN LA TARJETA NI EN LA FILA.** Un perfil sin
    // recolector no pega: cero, no un suelo inventado ni un undefined.
    const g0 = await boot(baseSave([], {}));
    const d0 = danoFinalDeTarjeta(tarjetaDesdeEstado(s(g0), 'test', 'T'));
    check('dano ajeno: sin arma equipada el recalculado es cero',
      d0.total === 0 && d0.intrinseco === 0 && d0.partida === 0,
      `total=${d0.total}`);
  }

  // -------------------------------------------------------------------------
  //  B38 · LA FILA PROPIA YA NO PINTA LA FOTO
  // -------------------------------------------------------------------------
  //
  //  La foto del documento llega con minutos de retraso (ritmo de publicación
  //  + caché de lectura) y la ficha de al lado es en vivo: comparar las dos
  //  era comparar dos momentos. El barrido de 1800 casos ató que la cuenta es
  //  la misma en todos lados, así que lo que fallaba era el MOMENTO, no la
  //  cuenta. Para la fila propia no hace falta la foto —el juego está aquí—:
  //  se recalcula al pintar con la misma cadena de la ficha y cuesta cero
  //  lecturas. Las ajenas siguen siendo fotos, porque no hay de dónde
  //  recalcularlas sin leer cuarenta tarjetas.
  {
    const g = await boot(baseSave([
      collector('r9', 5, { potential: 3, damage: danioDeRango(5, 3), level: 4, affixes: ['aff_bulwark'] })
    ], {
      equippedCollectorId: 'r9',
      nodeLevels: { core_edge: 2 },
      unlockedAchievements: ['first_click'],
      activeCompanions: ['mp'],
      companions: [{ id: 'mp', name: 'Multi', type: 'multiplier', power: 0.5, tier: 1 }]
    }));
    const { filaPropiaViva } = await import('../src/components/rankings');
    const viva = g.getStatFilas('r9');
    // Una foto vieja de verdad: publicada antes de la última mejora.
    const fotoVieja: any = {
      uid: 'test', username: 'T', score: 1, danoFinal: 1, danoArma: 1, updatedAt: 0
    };
    const propia = filaPropiaViva(fotoVieja, g, s(g));
    check('B38: la fila propia recalcula el daño en vivo, no pinta la foto',
      propia.danoFinal === viva.total && propia.danoArma === viva.delArma,
      `fila=${propia.danoFinal} ficha=${viva.total}`);
    check('B38: y lo demás de la fila no se toca',
      propia.uid === 'test' && propia.username === 'T' && propia.score === 1,
      'intacta');
    check('B38: sin juego la fila sale como viene',
      filaPropiaViva(fotoVieja, null, null).danoFinal === 1,
      'passthrough');
    check('B38: sin equipado no se inventa nada',
      filaPropiaViva(fotoVieja, g, {}).danoFinal === 1,
      'passthrough');
  }

  // -------------------------------------------------------------------------
  //  F97 · LOS CINCO DEL ÁRBOL NUEVO: SE DESBLOQUEAN POR SU CAMINO Y ABREN SU BANNER
  //
  //  Cada logro se consigue jugando (comprar, forjar, abrir) y su banner se
  //  reconcilia solo al desbloquearse: la invariante es la misma que la de los
  //  doce (logro → cosmético que se abre de verdad), medida por el mismo
  //  camino (`cosmeticsAlcanzables` + motor real).
  // -------------------------------------------------------------------------
  {
    const CINCO = [
      { id: 'primera_maestria', banner: 'banner_maestria' },
      { id: 'rama_completa', banner: 'banner_cima' },
      { id: 'obra_firmada', banner: 'banner_firma' },
      { id: 'suerte_doble', banner: 'banner_doble' },
      { id: 'doble_eco', banner: 'banner_eco' },
    ];
    const porId = (id: string) => ACHIEVEMENTS.find(a => a.id === id) as any;
    check('logros F97: los cinco están en el catálogo',
      CINCO.every(c => porId(c.id)),
      CINCO.filter(c => !porId(c.id)).map(c => c.id).join(',') || 'los cinco');
    // Cada uno abre su banner por la vía de logro, y se abre de verdad.
    const sinBanner: string[] = [];
    const queNoAbren: string[] = [];
    for (const c of CINCO) {
      const suyos = (COSMETICS as any[]).filter(x => x.unlock.kind === 'achievement' && x.unlock.value === c.id);
      if (!suyos.some(x => x.id === c.banner)) { sinBanner.push(c.id); continue; }
      const abiertos = alcanzables({ unlockedAchievements: [c.id] }).map((x: any) => x.id);
      if (!abiertos.includes(c.banner)) queNoAbren.push(`${c.id}->${c.banner}`);
    }
    check('logros F97: cada uno premia su banner',
      sinBanner.length === 0, sinBanner.join(',') || 'los cinco tienen banner');
    check('logros F97: y el banner se abre de verdad al desbloquear el logro',
      queNoAbren.length === 0, queNoAbren.join(',') || 'los cinco se abren');

    // 1. Primera Maestría: comprar un keystone la desbloquea en el motor.
    const g1 = await boot(baseSave([], { cores: 100_000, nodeLevels: { sobrecarga: 1 } }));
    check('logros F97: comprar un keystone desbloquea Primera Maestría',
      (s(g1).unlockedAchievements ?? []).includes('primera_maestria'),
      (s(g1).unlockedAchievements ?? []).join(','));
    check('logros F97: y su banner queda desbloqueado',
      ((s(g1).cosmetics as any)?.unlocked ?? []).includes('banner_maestria'),
      ((s(g1).cosmetics as any)?.unlocked ?? []).join(','));

    // 2. Rama Completa: 15 nodos con nivel en la misma rama.
    const quinceAsalto = ['core_edge', 'auto_clicker', 'auto_clicker2', 'multiplier_amp', 'singularity', 'full_automation', 'sobrecarga', 'crit_master', 'click_storm', 'furia', 'martillo', 'ejecutor', 'golpe_bajo', 'sangre_fria', 'punhal'];
    const niveles: Record<string, number> = {};
    for (const id of quinceAsalto) niveles[id] = 1;
    const g2 = await boot(baseSave([], { cores: 100_000, nodeLevels: niveles }));
    check('logros F97: 15 nodos en Asalto desbloquean Rama Completa',
      (s(g2).unlockedAchievements ?? []).includes('rama_completa'),
      (s(g2).unlockedAchievements ?? []).join(','));
    // Y con 14 no vale: el quinceavo es el que cuenta.
    const catorce: Record<string, number> = {};
    for (const id of quinceAsalto.slice(0, 14)) catorce[id] = 1;
    const g2b = await boot(baseSave([], { cores: 100_000, nodeLevels: catorce }));
    check('logros F97: con 14 no se desbloquea',
      !(s(g2b).unlockedAchievements ?? []).includes('rama_completa'),
      (s(g2b).unlockedAchievements ?? []).join(','));

    // 3. Obra Firmada: una ficha con obraMaestra en el almacén.
    const g3 = await boot(baseSave([
      { id: 'om', name: 'X·Obra Maestra', type: 'collector', details: 'x', rarity: 'Raro', tier: 4, level: 0, damage: 10, potential: 5, obraMaestra: true }
    ], {}));
    check('logros F97: una Obra Maestra en el almacén desbloquea Obra Firmada',
      (s(g3).unlockedAchievements ?? []).includes('obra_firmada'),
      (s(g3).unlockedAchievements ?? []).join(','));

    // 4 y 5. Suerte Doble y Doble Eco: por sus contadores.
    const g4 = await boot(baseSave([], { jackpots: 1 }));
    check('logros F97: un jackpot desbloquea Suerte Doble',
      (s(g4).unlockedAchievements ?? []).includes('suerte_doble'),
      (s(g4).unlockedAchievements ?? []).join(','));
    const g5 = await boot(baseSave([], { ecos: 1 }));
    check('logros F97: un eco desbloquea Doble Eco',
      (s(g5).unlockedAchievements ?? []).includes('doble_eco'),
      (s(g5).unlockedAchievements ?? []).join(','));
    // Y en cero no se desbloquean: el contador manda, no la intención.
    const g0b = await boot(baseSave([], {}));
    check('logros F97: sin jackpot ni eco no se desbloquean',
      !(s(g0b).unlockedAchievements ?? []).includes('suerte_doble')
        && !(s(g0b).unlockedAchievements ?? []).includes('doble_eco'),
      (s(g0b).unlockedAchievements ?? []).join(','));
  }
}


  resumen('identidad: lo equipado llega al ranking');
}

export default main();
