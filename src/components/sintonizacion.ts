// ==========================================================================
//  LA HOJA DE SINTONIZACIÓN, PARA RECOLECTORES Y PARA COMPAÑEROS
// ==========================================================================
//
//  **UNA SOLA HOJA PARA LOS DOS, Y POR QUÉ NO SON DOS.** Antes el botón del
//  compañero y el del recolector acababan en sitios distintos: el del recolector
//  abría esta hoja —coste, saldo, probabilidad y una ruleta— y el del compañero un
//  `showConfirmModal` con dos frases y un aviso. Dos caminos para la misma acción, con
//  dos formas de Lehrsenlo, y el jugador tenía que aprender una hoja nueva cada vez
//  que cambiaba de tipo de objeto.
//
//  Ahora los dos botones abren esto. Lo que cambia entre un objetivo y otro son **tres
//  cosas y solo tres**: de dónde sale el item, cuál es su techo de niveles y a qué
//  método del motor se llama. El resto —el coste, la probabilidad, el saldo, la ruleta,
//  los mensajes— es literalmente el mismo código, y por eso no puede desincronizarse.
//
//  Y el motivo de que la ruleta sea la misma no es pereza: es que **el resultado ya
//  está decidido cuando se llama al motor**. La ruleta no elige el premio, lo enseña. Si
//  un caminoAnimase el premio, el jugador descubriría en veinte tiradas que la ruleta no
//  es la fuente de verdad, y a partir de ahí ninguna otra cifra del juego le creería.
// ==========================================================================
//  POR QUÉ ESTE FICHERO SE LLAMA ASÍ Y NO COMO EL ANTERIOR.
//
//  Antes se llamaba `crystalPicker`: *selector* de cristal. Elegir entre varios
//  cristales era exactamente lo que hacía, y lo que F26 dejó de permitir cuando la
//  regla pasó a ser "el cristal del mismo nivel".
//
//  Ahora el cristal **es un recurso**: no hay varios, no hay nada que elegir y no
//  hay nada que(listar). Lo que queda de este fichero es una hoja que dice cuánto
//  cuesta, cuánto tienes y qué probabilidad hay, y que al confirmar tira.
//
//  **POR QUÉ SE HA HECHO UNA HOJA Y NO UN BOTÓN QUE TIRE DIRECTO.** Porque el
//  número sigue siendo una decisión: el coste sube con el nivel, la probabilidad
//  baja con el nivel, y fallar **gasta los cristales sin bajar el nivel**. Eso no
//  se puede hacer con un botón que se pulsa sin mirar. La hoja es el sitio donde
//  el jugador ve el coste y el riesgo antes de que sea tarde.
//
//  Y **LO QUE SE PIERDE ESTÁ DICHO**, porque es la parte de este cambio que se
//  nota al jugar: antes el cristal tenía un multiplicador de probabilidad y el
//  jugador podía elegir cuánto riesgo compraba. Con un solo recurso la
//  sintonización es determinista dado el nivel —en el 20 acierta el 35 %, en el 0
//  el 95 %— y **el riesgo que queda es el del nivel, que sube con cada subida**.
// ==========================================================================

import { showToast } from '../utils/toast';
import { sfx } from '../utils/audio';
import { ic } from '../ui/icons';
import { formatNumber } from '../utils/format';
import { showTuningRoulette, tuningRoll } from './tuningRoulette';
import { rarityClass } from './crateLoot';
import { previewUpgradeChance, previewUpgradeCost } from '../gameLoop';
import { collectorMaxLevel, nivelMaximoDeCompanio, costeDeNivel, valorDeUnCristal } from '../data/crafting';
import { CRISTAL_NOMBRE, bandaDeProbabilidad } from '../data/items';
import type { BandaDeProbabilidad } from '../data/items';

/**
 * Qué se está sintonizando. El único sitio donde se diferencian las dos ramas.
 *
 * **EL RECOLECTOR TAMBIÉN ACEPTA `item`, Y POR QUÉ ES OPCIONAL.** Mientras solo se podía
 * mejorar al equipado no hacía falta: la hoja lo buscaba por su cuenta. En cuanto se
 * puede mejorar **cualquiera**, buscar el equipado abriría la hoja del item equivocado
 * con otro delante —el jugador leería un coste y una probabilidad de un recolector y los
 * gastaría sobre otro—, así que el id tiene que viajar. Opcional para no romper a quien
 * llama sin él, que es el caso de siempre: el equipado.
 */
export type ObjetivoDeSintonizacion =
  | { tipo: 'recolector'; item?: any }
  | { tipo: 'companero'; item: any };

/**
 * La frase que explica cuánto cuesta, y por qué está en una función.
 *
 * **ESTABA ESCRITA PARA UN CASO Y LEÍA MAL EN OTRO.** Decía "un T{n} cuesta mucho más
 * que un T1", y para un item de T1 salía **"un T1 cuesta mucho más que un T1"** — que no
 * es una frase, es una contradicción, y se leía en la primera sintonización de la
 * partida, que es la primera vez que el jugador ve esta hoja.
 *
 * Los dos casos necesitan texto distinto, no el mismo con otro número:
 *
 * · **T1** no tiene con qué compararse: es el más barato. Se dice eso y se da su precio,
 *   que es lo único que el jugador puede usar para decidir si sube o ahorra.
 * · **T2 en adelante** sí tiene comparación, y es la que explica la regla: el coste sale
 *   del precio de la caja de ese nivel, así que el número que aparece arriba es una
 *   cantidad que el jugador ya conoce de la tienda.
 *
 * Y los dos números salen de `costeDeNivel()`, la misma función que cobra el motor: la
 * nota no puede enseñar un precio distinto del que se paga (R3).
 */
function notaDeCoste(tier: number): string {
  const delItem = formatNumber(costeDeNivel(tier, 0));
  // **LA UNIDAD DEL CRISTAL, DICHA DE UNA VEZ Y EN TODAS LAS PARTIDAS.**
  //
  // Preguntado: "cada cristal no me da una unidad? cuantos me esta dando?". La respuesta
  // corta es que **una unidad de cristal es una nanita**: `state.crystals` y
  // `state.nanites` son dos contadores de la misma unidad, y la caja da
  // `rand(3 t, 5 t) x valorDeUnCristal(t)` de ellos. O sea que el "1.234 de cristal" de
  // arriba **son 1.234 nanitas**, y sin esta linea no hay forma de saberlo: el jugador ve
  // el saldo de una moneda nueva y un precio, y ninguna de las dos cosas dice en que
  // estan contadas.
  //
  // Y el segundo dato es el que hace util la linea: **un cristal vale lo que una caja de
  // ese nivel**, porque `valorDeUnCristal()` **es** `costeDeCaja()`. Con eso el jugador
  // lee su propio progreso sin tener que recordar la tabla: "me falta lo que cuesta
  // una caja T3" es literalmente lo que dice el numero.
  //
  // Los dos salen de funciones y no de numeros escritos, para que el dia que el cristal
  // deje de valer una nanita, esta frase sea la que avisa. Que hoy valga una nanita es
  // una decision de diseno, no un descuido: esta es la frase que la dice en pantalla.
  const enQue = `1 de ${CRISTAL_NOMBRE.toLowerCase()} = 1 ◆, y ${formatNumber(valorDeUnCristal(tier))} es lo que cuesta una caja T${tier}`;
  if (tier <= 1) {
    return `Este es el item más barato del juego: ${delItem} por nivel, y el coste sube en cada nivel. ${enQue}.`;
  }
  // El segundo numero es del T1 con la misma funcion, no con el del precio de la caja:
  // son el mismo numero --`costeDeNivel(tier, 0)` **es** `costeDeCaja(tier)` por
  // construccion-- y usar dos llamadas distintas para decir la misma regla es
  // constructores distintos, y es un aviso a que un dia dejen de coincidir.
  return `Un T${tier} cuesta ${delItem} por nivel, contra ${formatNumber(costeDeNivel(1, 0))} de un T1: el coste sale del precio de la caja de ese nivel. ${enQue}.`;
}

/**
 * Abre la hoja de sintonización del objetivo dado.
 *
 * **EL TERCER ARGUMENTO ES LO ÚNICO QUE HA HECHO FALTA.** Sin él la función era la del
 * recolector y se llamaba sin argumentos; ahora recibe a quién va dirigido y, si no se
 * pasa, sigue siendo el recolector equipado. El valor por defecto está para que los
 * llamadores del recolector no tengan que escribir `{ tipo: 'recolector' }` en un sitio
 * donde ya se sabe que es un recolector: un argumento obligatorio que siempre vale lo
 * mismo es ruido.
 *
 * **LO QUE ESTA HOJA ENSEÑA Y DE DÓNDE SALE CADA NÚMERO.** Los tres salen del
 * motor, nunca se recalculan aquí: el techo, el coste y la probabilidad. Copiar una
 * fórmula en la vista es la forma más barata de que el botón diga una cifra y el
 * cobro otra, y ya se ha pagado una vez con el 35 a pelo de `collectorMaxLevel`.
 *
 * **Y LA RESERVA ES DE UN RECURSO, NO DE UN ITEM.** El saldo sale de
 * `state.crystals`; no hay `find()` en el almacén, ni nivel que deducir del
 * nombre, ni la comprobación de que exista una pila compatible. Es la mitad de lo
 * que había antes.
 */
export function showSintonizacion(
  game: any,
  redraw: () => void,
  objetivo: ObjetivoDeSintonizacion = { tipo: 'recolector' }
) {
  const state = game.getState();

  // **DE DÓNDE SALE EL ITEM, Y POR QUÉ ES LO ÚNICO QUE SE RESUELVE AQUÍ.**
  // El recolector es el equipado, y se busca por su id; el compañero es el que el
  // jugador está mirando, y viene dado. No hay una función común para esto porque no
  // hay un item común: lo común es la acción.
  let equipo: any;
  if (objetivo.tipo === 'companero') {
    equipo = objetivo.item;
    if (!equipo) {
      showToast('El compañero ya no está en el almacén.', 'info');
      return;
    }
  } else {
    // **EL RECOLECTOR TAMBIÉN VIENE DADO, Y ANTES SE BUSCABA EL EQUIPADO.**
    // Mientras solo se podía mejorar al equipado da igual; en cuanto se puede mejorar
    // cualquiera, buscar el equipado abriría **la hoja del item equivocado** con otro
    // delante: el jugador leería un coste y una probabilidad de un recolector y los
    // gastaría sobre otro. Por eso el `item` es lo que manda y el equipado es solo el
    // respaldo de quien llama sin decir cuál —los bancos, el guardado—.
    equipo = objetivo.item
      ?? (state.warehouse as any[]).find((w: any) => w.id === state.equippedCollectorId);
    if (!equipo) {
      showToast('Equipa un recolector primero.', 'info');
      return;
    }
  }

  const esCompanero = objetivo.tipo === 'companero';

  // El techo lo decide el recolector, con la MISMA regla que usa el game loop.
  // Aquí había un 35 a pelo: el máximo absoluto, que solo corresponde a un
  // recolector forjado de potencial 5. Con un recolector de la tienda (techo 20)
  // la hoja se abría en el nivel 20 y la sintonización se le rechazaba. Dos
  // números distintos para la misma regla en la misma partida.
  // **EL TECHO, Y SON DOS REGLAS DISTINTAS.** El recolector lo fija su `maxLevel`; el
  // compañero, su potencial —cada estrella da tres niveles— con el mismo suelo. No se
  // unifican porque no son la misma regla, y usar la del recolector para el compañero
  // le dejaría niveles de más o le quitaría de golpe.
  const tope = esCompanero
    ? nivelMaximoDeCompanio(equipo.potential, equipo.maxLevel)
    : collectorMaxLevel(equipo.maxLevel);
  const nivel = equipo.level || 0;
  if (nivel >= tope) {
    // **EL QUE ESTÁ AL TECHO, Y NO SIEMPRE "EL RECOLECTOR".** La frase estaba escrita
    // con la palabra del recolector porque el camino del recolector se escribió primero,
    // y el del compañero se añadió encima sin tocarla: sintonizar un compañero al máximo
    // decía "El recolector ya está al nivel máximo". Es el mismo fallo del subtítulo de
    // la ruleta, en un sitio donde el jugador ya ha leido todo lo demas y solo le queda
    // leer esto: y si dice la palabra equivocada, parece que el boton va al objeto equivocado.
    showToast(`El ${esCompanero ? 'compañero' : 'recolector'} ya está al nivel máximo.`, 'info');
    return;
  }

  // **EL TIER SOLO SIRVE PARA EL COSTE, Y ESO ES TODO.** Ya no decide el cristal —
  // no hay—, no hay un techo de cristal que comprobar y por tanto **desaparecen
  // tres bloques enteros de esta función**: la búsqueda de la pila válida, el
  // `crystalTierFromName()` para los items sin nivel, y el rechazo de "un T30
  // todavía no se puede sintonizar".
  //
  // Ese último es la mejor noticia de las tres. La forja es infinita, así que
  // produce items por encima del T10, y antes **no se podían subir de nivel**.
  // Ahora sí, por mucho más caros.
  const tierItem = Math.max(1, Math.floor(Number(equipo.tier) || 1));
  const coste = previewUpgradeCost(tierItem, nivel);
  const tienes = state.crystals ?? 0;
  const alcanza = tienes >= coste;
  const prob = previewUpgradeChance(nivel);

  // **LA PROBABILIDAD, EN GRANDE Y CON COLOR, Y LA REGLA DEL COLOR NO ESTÁ AQUÍ.**
  // Antes de este cambio el número iba en la línea gris de debajo del nombre, en
  // `text-[10px]`, mezclado con el nivel y el coste: un dato que es la razón entera por
  // la que se está mirando la hoja aparecía como el cuarto dato de una línea de letra
  // pequeña, y la diferencia entre un 87 % y un 41 % —que son decisiones opuestas— no se
  // veía a nada.
  //
  // El corte (de 80 en verde, de 50 en ámbar) lo decide `bandaDeProbabilidad()`, en
  // `data/items.ts`, que es donde vive la probabilidad que se está mostrando. Aquí solo
  // se traduce el tramo a un color y a una palabra, que es lo único que una vista puede
  // inventarse: si el corte viviera en este fichero, la misma regla tendría dos sitios y
  // el banco solo podría comprobar uno.
  const banda = bandaDeProbabilidad(prob);
  // **EL COLOR VA COMO PROPIEDAD, PORQUE EL TINTE LO NECESITA Y LAS CLASES NO LO DAN.**
  // El fondo del bloque es un `color-mix` con el color de la banda, y un `color-mix` no
  // se puede escribir con una clase de Tailwind. La primera versión lo hizo con
  // `currentColor`, que es el color de texto del bloque —el del texto normal, no el de
  // la banda—, y el tinte salía siempre del mismo gris. Por eso la banda trae su color
  // en hexadecimal y el `style` lo usa para las dos cosas: el tinte y el texto.
  //
  // Los tres hex son los de las clases de texto que ya usa el proyecto para lo mismo:
  // `emerald-400`, `amber-400` y `rose-400`. El "amarillo" del enunciado es ámbar, que es
  // el amarillo del juego, y no se ha metido un cuarto color.
  const ASPECTO_BANDA: Record<BandaDeProbabilidad, { color: string; caja: string; palabra: string }> = {
    alta: { color: '#34d399', caja: 'border-emerald-500/40', palabra: 'alta' },
    media: { color: '#fbbf24', caja: 'border-amber-500/40', palabra: 'media' },
    baja: { color: '#fb7185', caja: 'border-rose-500/40', palabra: 'baja' },
  };
  const aspecto = ASPECTO_BANDA[banda];
  const textoBanda = `color:${aspecto.color}`;

  const overlay = document.createElement('div');
  // `sheet-overlay` + `sheet-panel` (ver `style.css`): abajo en el móvil, que es
  // donde el pulgar llega, y centrado en escritorio. Estas cuatro utilidades
  // estaban escritas a mano aquí, y el resultado en escritorio era una hoja de
  // 90 px pegada al borde inferior de una pantalla de 900 px.
  overlay.className = 'sheet-overlay z-[70]';
  overlay.innerHTML = `
    <div class="absolute inset-0 bg-black/60 pointer-events-auto" data-cerrar></div>
    <div class="sheet-panel card-glass-elevated animate-rise-in">
      <div class="flex items-start gap-3 mb-3">
        <span class="w-11 h-11 rounded-xl grid place-items-center flex-shrink-0 ${rarityClass('Raro')}
                     [&>span>svg]:w-5 [&>span>svg]:h-5">${ic('crystal')}</span>
        <div class="min-w-0 flex-1">
          <h3 class="font-['Orbitron'] font-bold text-[14px] text-[var(--text-main)] leading-tight truncate">
            Sintonizar ${equipo.name}
          </h3>
          <p class="text-[10px] font-mono text-[var(--text-muted)] mt-0.5">
            Nivel ${nivel} → ${nivel + 1} · ${formatNumber(coste)} de ${CRISTAL_NOMBRE}
          </p>
        </div>
        <button data-cerrar class="hit-expand w-9 h-9 rounded-lg btn-ghost flex items-center justify-center cursor-pointer flex-shrink-0"
                aria-label="Cerrar">
          <span class="[&>span>svg]:w-4 [&>span>svg]:h-4">${ic('close')}</span>
        </button>
      </div>

      <!-- LA PROBABILIDAD, QUE ES POR QUÉ SE ABRE ESTA HOJA.
           Un bloque con borde y tinte del color de la banda, el número en
           'Orbitron' grande y tabular para que no baile, y la palabra al lado.
           El tinte es un 10 % del color sobre transparente en vez de un fondo
           sólido: el 'card-glass' de la hoja ya tiene su propio fondo, y una
           capa opaca encima lo tapaba y la hoja perdía el cristal de debajo. -->
      <div class="rounded-xl border ${aspecto.caja} px-3 py-2.5 flex items-center gap-3"
           style="background: color-mix(in srgb, ${aspecto.color} 10%, transparent)">
        <span class="font-['Orbitron'] font-bold text-2xl leading-none tabular" style="${textoBanda}">${prob}%</span>
        <span class="min-w-0">
          <span class="block text-[11px] font-bold leading-tight" style="${textoBanda}">Probabilidad ${aspecto.palabra}</span>
          <span class="block text-[9px] text-[var(--text-muted)] leading-tight mt-0.5">de que esta mejora salga</span>
        </span>
      </div>

      <button data-sintonizar ${alcanza ? '' : 'disabled style="opacity:.45"'}
              class="w-full rounded-xl border px-3 py-2.5 flex items-center gap-2.5 text-left
                     ${alcanza ? 'cursor-pointer transition active:scale-[0.99] hover:border-[var(--accent)]' : ''}
                     border-[var(--border-color)]"
              style="background: color-mix(in srgb, var(--accent) 7%, transparent)">
        <span class="flex-shrink-0 ${rarityClass('Raro')} [&>span>svg]:w-4 [&>span>svg]:h-4">${ic('crystal')}</span>
        <span class="min-w-0 flex-1">
          <span class="block text-[12px] font-bold text-[var(--text-main)] truncate">${CRISTAL_NOMBRE}</span>
          <span class="block text-[9px] font-mono ${alcanza ? 'text-[var(--text-muted)]' : 'text-rose-400'} mt-0.5">
            ${alcanza
              ? (esCompanero
                  // **EL QUE PROMETE ES EL EFECTO REAL DE SUBIR ESE OBJETO, Y NO UN
                  // TEXTO ÚNICO.** El recolector sube daño y el compañero sube el ingreso
                  // del recolector, así que decir lo mismo en los dos sería mentir en uno
                  // de los dos. Es la única línea de la hoja que cambia por tipo.
                  ? 'Sube el nivel y el ingreso que da al recolector.'
                  : 'Sube el nivel y el daño del recolector.')
              : `Te faltan ${formatNumber(coste - tienes)}. Salen de las cajas T${tierItem}.`}
          </span>
        </span>
        <span class="text-right flex-shrink-0">
          <span class="block text-[11px] font-mono accent-text tabular">${formatNumber(tienes)}</span>
          <span class="block text-[9px] font-mono ${alcanza ? 'text-[var(--text-muted)]' : 'text-rose-400'}">
            ${alcanza ? `−${formatNumber(coste)}` : `faltan ${formatNumber(coste - tienes)}`}
          </span>
        </span>
      </button>

      <p class="text-[10px] font-mono text-[var(--text-muted)] mt-3 leading-relaxed">
        ${notaDeCoste(tierItem)} La
        probabilidad <strong>baja</strong> con el nivel y no hay forma de comprarse más:
        si fallas, pierdes el cristal y ${esCompanero ? 'el compañero' : 'el recolector'} no baja de nivel.
      </p>
    </div>
  `;

  const cerrar = () => overlay.remove();
  overlay.querySelectorAll('[data-cerrar]').forEach(b => b.addEventListener('click', cerrar));
  overlay.querySelectorAll('[data-sintonizar]:not([disabled])').forEach(b => {
    b.addEventListener('click', () => {
      cerrar();
      sfx.use();
      // POR QUÉ EL NIVEL SE LEE ANTES DE TIRAR EL DADO. El game loop sube
      // `item.level` en el mismo objeto del almacén, así que leerlo después
      // devolvería el nivel nuevo en los dos casos y la ruleta no podría
      // pintar "4 → 5": enseñaría "5 → 5" en el acierto, que es un número que
      // no existe. `equipo` es la referencia viva al item, no una copia.
      const nivelAntes = equipo.level || 0;
      // SIN ARGUMENTO DE CRISTAL, a propósito. El motor lee el recurso del
      // estado, así que esta vista no puede proponer un gasto que no vaya a
      // pasar (R3).
      // **LA TERCERA Y ÚLTIMA DIFERENCIA ENTRE LOS DOS CAMINOS.** Todo lo de arriba —el
      // texto, el saldo, la ruleta, los mensajes— es el mismo código; aquí solo se decide
      // a quién se llama. Y se decide con una condición y no con dos manejadores, para
      // que un cambio futuro en la hoja llegue a los dos sin poder olvidarse del segundo.
      const res = esCompanero
        ? game.upgradeCompanion(equipo.id)
        // **EL ID DEL RECOLECTOR, Y NO EL DEL EQUIPADO.** Es el otro mitad del arreglo de
        // "mejorar el que sea": sin esto la hoja muestra el coste y la probabilidad del
        // item que tiene delante y el motor sube el equipado.
        : (game.upgradeCollector?.(equipo.id) ?? game.upgradeEquippedCollector());
      // `tuningRoll()` decide qué niveles enseña la ruleta, y el porqué de que
      // el de antes se lea ANTES de la llamada está en su JSDoc.
      const roll = tuningRoll(res, nivelAntes, equipo.level || 0);
      // Y SI EL MOTOR NO TIRÓ EL DADO, NO HAY RULETA. Un rechazo —no hay saldo, ya
      // está en el techo, no hay item— no es un fallo de la tirada: no se ha gastado
      // nada y no ha pasado nada. Girar igualmente sería una ruleta mintiendo.
      //
      // Es un camino raro —la hoja desactiva el botón cuando no llega, y el
      // techo se comprueba al abrir—, pero "raro" no es "imposible": el estado
      // puede cambiar entre abrir la hoja y pulsar, y el juego no puede depender
      // de que la vista lo compruebe una vez.
      if (!roll.rolled) {
        sfx.error();
        showToast(roll.msg || 'No se pudo sintonizar.', 'error');
        redraw();
        return;
      }
      // POR QUÉ `success` Y NO `ok`. El game loop tiene DOS convenciones de
      // resultado y no están unificadas: `sellItem`, `useConsumable` y
      // `openCrateBox` devuelven `{ ok, msg }`, mientras que
      // `upgradeCollector`, la Forja y la Ascensión devuelven
      // `{ success, msg }`. Aquí se leía `res.ok`, que en un `{ success }` es
      // `undefined`: `!undefined` es `true`, así que TODA sintonización caía en
      // la rama de error. Es decir, un acierto pintaba un toast rojo de "error"
      // con el texto "¡Mejora exitosa!" dentro y sonaba el sonido de fallo.
      //
      // Y POR QUÉ `res.msg` EN VEZ DE UN MENSAJE NUEVO. El texto del acierto y
      // del fallo lo redacta el motor, que es quien sabe cuánto costó y a qué
      // nivel quedó.
      showTuningRoulette(roll, redraw);
    });
  });
  document.body.appendChild(overlay);
}