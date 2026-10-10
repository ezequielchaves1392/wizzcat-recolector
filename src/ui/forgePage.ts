// ==========================================================================
// Forja · Fusión de recolectores
//
// Es la pantalla con más estados simultáneos del juego: selección de
// materiales, probabilidad, consumo de piedras, animación y resultado. Se
// resuelve con un estado único a nivel de módulo y un solo delegado de
// eventos, en vez de varias variables booleanas sueltas por función.
//
// La razón concreta: la primera versión guardaba la selección en variables
// locales de `renderForgePage` y se redirigía la página entera en cada clic.
// Como `renderForgePage` volvía a crear las variables, la selección se
// borraba en el primer toque: un flujo de 6 toques se convertía en 6 toques
// sin efecto. El estado tiene que sobrevivir al re-render, y eso significa
// vivir fuera de la función.
//
// Decisiones de diseño visibles en la pantalla:
//   - La probabilidad se enseña ANTES de confirmar, con el desglose. Un
//     gambling opaco se siente como un timo; uno con números, como una apuesta.
//   - La ruleta es decorativa. El resultado ya está decidido en `attemptForge`
//     antes de que la animación arranque: si la ruleta decidiera, mentiría
//     sobre las probabilidades y el jugador lo notaría en 20 tiradas.
//   - F33 · La receta son 2 materiales del mismo tier, y el potencial de la
//     nueva es la MEDIA de los dos: la forja consolida. **La enmienda** es la
//     tirada de potencial que hace la propia fusión —sube una estrella con
//     probabilidad decreciente y el Éter le suma puntos—, que es la única vía
//     con la que el resultado puede quedar por encima de la media. Los 2 se
//     consumen aciertes o falles, y el Éter también.
// ==========================================================================

import { ic } from './icons';
import { pageShell, mountInto, wireNav, statStrip, emptyState, sectionHead } from './pageShell';
import { successChance, baseSuccessChance, MAX_PIEDRAS_POR_FUSION, PIEDRA_APORTA, AFFIX_BY_ID, estrellasDe, MATERIALES_POR_FUSION, explicacionDeAfijos, PROB_CONSERVA_RAREZA, afijosCompartidos, potencialFusionado, potencialDe, rarezaCalculadaDeForja, rarezaDeCompanionForjado, POOL_AFIJOS_COMPANERO } from '../data/crafting';
import { pctDe, PROB_SUBE_POTENCIAL, BONO_ETTER } from '../data/constants';
import { formatNumber } from '../utils/format';
import { sfx } from '../utils/audio';
import { showConfirmModal, htmlToNode } from '../utils/modal';
import { showToast } from '../utils/toast';
import { rarityClass, raritySlug } from '../components/crateLoot';
import { esEquipado, statCelda, visibleStacksFor } from '../components/warehouse';
import { puntosDeAfijos } from './fichas';

/** Estado de la pantalla. Vive aquí para sobrevivir a los re-renders. */
interface ForgeUIState {
  selected: string[];
  stones: number;
  nano: boolean;
  /**
   * EL ÉTER DE REFINAMIENTO, Y POR QUÉ NO COMPARTE LA LÍNEA DE LA NANOPARTÍCULA.
   *
   * Es el tercer consumible de la forja y hace otra cosa: no toca la probabilidad
   * de acierto, suma puntos a la tirada de subida de potencial. Interruptor como
   * la nanopartícula porque solo se gasta uno por fusión, y aparte porque los dos
   * se cobran por separado y apagar uno no puede apagar al otro.
   *
   * **SE APAGA SOLO EN DOS CASOS**: sin Éter en el almacén, o con el promedio de
   * los materiales ya en ★5 —no hay escalón encima, y ofrecer gastarlo ahí sería
   * cobrar por un efecto imposible (R3)—.
   */
  eter: boolean;
  /**
   * LOS CHECKS DE LA SERIE, Y POR QUÉ SON DOS Y VAN APARTE DE LOS DE ARRIBA.
   *
   * La forja de a uno elige piedras con botones 1..N y nano con interruptor;
   * la serie gasta de golpe, sin elegir par a par, así que lo único que puede
   * decidir es usar o no usar. Son dos checks separados porque son dos
   * consumibles con dos precios: apagar las piedras y dejar la nano (o al
   * revés) tiene que poder decirse. Y van aparte de `stones`/`nano` porque el
   * yunque y la serie son dos decisiones distintas: marcar nano arriba no
   * puede gastar nanos abajo sin avisar.
   *
   * **POR DEFECTO, PIEDRAS SÍ Y NANO NO**, que es lo que hacía la serie hasta
   * ahora: las necesarias por tirada y ni una nano. Y **ÉTER NO**: la serie no
   * lo gasta porque decidirlo por pareja —que es cuando tiene sentido, si el
   * promedio todavía puede subir— es una decisión que este check no puede tomar.
   */
  serieStones: boolean;
  serieNano: boolean;
  tier: number;
  /**
   * Qué se está fundiendo. La misma pantalla, dos resultados distintos: el
   * recolector forjado hereda afijos y el compañero forjado hereda potencial.
   *
   * **ES ESTADO DE MÓDULO Y NO UN PARÁMETRO, PORQUE TIENE QUE SOBREVIVIR AL
   * RE-RENDER.** Si fuera un argumento, marcar una piedra devolvería la pantalla a
   * recolectores con el yunque medio lleno.
   */
  tipo: 'collector' | 'companion';
  /**
   * ORDEN DE LA REJILLA DE MATERIALES, Y POR QUÉ ES ESTADO.
   *
   * Como el tipo: cambia al pulsar y tiene que sobrevivir al repintado que provoca el
   * propio cambio. Si fuera un parametro, cada vez que se elige otro criterio la pantalla
   * volveria al de antes y el selector no responderia a nada.
   *
   * La clave es de `visibleStacksFor()`, no un número: el orden vive en el almacen.
   */
  orden: string;
}

const ui: ForgeUIState = {
  selected: [], stones: 0, nano: false, eter: false, serieStones: true, serieNano: false, tier: 0, tipo: 'collector',
  // **'stat' Y NO '': EL VALOR POR DEFECTO ES EL QUE YA HABIA.** La rejilla se ha
  // ordenado siempre por stat final, y por eso el statCelda de la esquina esta a la
  // vista: sin el número, un orden por algo que no se ve no se puede comprobar.
  orden: 'stat'
};

/**
 * Los dos nombres del tipo elegido, en todas las formas que hace falta.
 *
 * **ESTO NO ES COSMÉTICA: ES LO QUE DICE EL JUGADOR CUANDO RECHAZA ALGO.** Un
 * "selecciona 2 recolectores" en un yunque de compañeros hace pensar que la
 * pantalla va mal, no que el jugador tocó el material equivocado.
 */
const NOMBRES = {
  collector: {
    uno: 'recolector', muchos: 'recolectores', icono: 'collector',
    verbo: 'forjada', participio: 'forjadas', vacio: 'recolectores'
  },
  companion: {
    uno: 'compañero', muchos: 'compañeros', icono: 'companion',
    verbo: 'forjado', participio: 'forjados', vacio: 'compañeros'
  }
} as const;

/** Punto de entrada. Re-monta la página conservando la selección. */
export function renderForgePage(container: HTMLElement, game: any, go?: (r: any) => void) {
  draw(container, game, go);
}

/**
 * Los materiales de un tipo, en el orden en el que los enseña la rejilla.
 *
 * **ESTÁ FUERA DE `draw()` PORQUE MIENTE SI NO, Y PORQUE ASÍ LA COMPRUEBA UN BANCO.**
 * `visibleStacksFor()` del almacén se extrajo por el mismo motivo: una regla de orden
 * que vive dentro de una función que pinta no la puede comprobar nadie, porque para
 * llamarla hay que tener un DOM. Aquí el orden es una regla —qué va antes que qué— y las
 * reglas se comprueban.
 *
 * ## EL ORDEN ES POR EL VALOR FINAL, Y NO POR EL DE BASE
 *
 * Era `(a.tier - b.tier) || (b.damage || b.power)`: primero por tier y, a igualdad de
 * tier, por el daño o el poder **de fábrica**. Esos dos campos son lo que el item trae
 * sin que le hayas subido nada: el `damage` de un recolector es `danioDeRango(tier,
 * potencial)` sin el multiplicador de nivel, y el `power` de un compañero es su poder de
 * base, sin `multiplicadorDeNivel`.
 *
 * Lo que pasaba en pantalla es que un compañero de nivel 20 con poder 2 quedaba **debajo**
 * de uno de nivel 0 con poder 3. Y el número que ordenaba no era ninguno de los que se
 * veían en la celda, así que el orden no se podía comprobar ni con los números a la vista.
 * Ahora ordena `getStatPrincipal()`, que es el motor y es lo mismo que pinta la celda: si
 * la celda y el orden se separan, es el mismo defecto de siempre con dos sitios.
 *
 * **Y EL TIER PASA A DESEMPATE, QUE ES LO QUE ERA.** La rejilla solo pinta los materiales
 * de `ui.tier`, así que ordenar por tier era ordenar por una constante: no decidía nada y
 * ocupaba la primera comparación. Sigue haciendo falta como desempate porque `materiales`
 * sí mezcla tiers, y sin él el orden entre dos materiales iguales depende del guardado.
 *
 * **Y EL MULTIPLICADOR SE QUEDA AL FINAL, CON EL MISMO MOTIVO QUE EN EL ALMACÉN.** Su stat
 * es "1,75 veces lo de los demás", no unidades por segundo; ordenarlo contra un pasivo de
 * 65/s compara dos grandezas distintas con el mismo tipo de letra. Un `null` no es un
 * cero: es "en este eje no hay cifra", y tratarlo como cero lo pondría delante de todo.
 * `sort` es estable en V8, así que devolver 0 conserva el orden de entrada y entre ellos no
 * hay que hacer nada más.
 */
/**
 * Los materiales fundibles de un tipo, en el orden pedido.
 *
 * `orden` es una clave de `visibleStacksFor()` y vale 'stat' por defecto, que es lo que
 * ha hecho siempre esta rejilla.
 */
export function materialesDeForja(game: any, tipo: string, orden: string = 'stat'): any[] {
  const state = game.getState();
  // **LO EQUIPADO NO SE PINTA, Y ANTES SE PINTA GRIS.**
  //
  // El motor ya lo rechaza --`materialesDeForja()` en el game loop dice "no puedes
  // fusionar el equipado, desequipalo primero"-- asi que la celda gris era una celda
  // que solo servia para recordar una regla: **ocupaba el hueco de un material que si
  // se puede usar, y el jugador tiene que saltarsela con el dedo.** En una rejilla de
  // veinte con tres equipados, tres huecos muertos.
  //
  // Que el filtro este **aqui** y no en la celda es lo que hace que los tabs de tier
  // tambien sean ciertos: si el unico T4 que tiene el jugador esta equipado, el tab
  // de T4 no aparece, y con el dibujado aparecia con un 1 que no se podia tocar.
  //
  // **Y NO SE PIERDE NADA:** desequipar es una ficha de la tienda y el item sigue ahi.
  // Lo que se pierde es la lista de lo que no se puede usar, que es informacion que el
  // motor ya dice con su propio mensaje.
  // **EL PREDICADO ES EL DEL ALMACEN, NO UNO NUEVO.** Ver `esEquipado()`: el id manda y
  // la bandera de la ficha no, y por que es asi esta escrito alli.
  // **EL ORDEN ES EL DEL ALMACÉN, NO UNO NUEVO.** `visibleStacksFor()` ya sabe
  // ordenar por stat final, por rareza, por valor y por nombre, con el desempate por
  // tier y con el multiplicador al final porque su 1,75 no son unidades por segundo.
  // Escribir la mitad de esa regla otra vez en la Forja es la forma de que las dos
  // rejillas ordenen distinto un dia de estos, y el jugador veria dos almacenes.
  //
  // `ejeDe()` resuelve el unico detalle que no es copia: **la Forja ya filtra por tipo**
  // con el interruptor de arriba, asi que nunca hay un recolector y un companero en la
  // misma lista, y por eso el "eje" se deduce del tipo y no se le pregunta al jugador.
  // El multiplicador sigue quedandose fuera del stat por su cuenta, que es lo que hace
  // `visibleStacksFor()` con el eje de segundo.
  const equipado = (w: any) => esEquipado(w, state);
  return visibleStacksFor(game, state, tipo, ejeDe(tipo, orden))
    .map((c: any) => c.item)
    .filter((w: any) => !equipado(w));
}

/**
 * Eje de stat que le toca a cada tipo en la rejilla de la Forja.
 *
 * El recolector se mide por clic y el companero por segundo, y comparar 30 por clic con
 * 65 por segundo no dice nada --el clic ocurre mil veces en un segundo--. En el
 * almacen son dos opciones porque una rejilla puede tener los dos; aqui son dos
 * ramas de la misma pantalla porque el interruptor de arriba ya escogió uno.
 */
function ejeDe(tipo: string, orden: string): string {
  return orden === 'stat' ? (tipo === 'collector' ? 'stat' : 'statSeg') : orden;
}

/**
 * Los cuatro ejes del selector, y por que el de stat se llama "Mejor".
 *

 * "Mejor" y no "Mayor dano" porque la lista mezcla lo que sea del tipo elegido, y
 * porque el stat que se compara es el final, con el nivel y los afijos dentro.
 */
const ORDENES_DE_FORJA: { id: string; label: string }[] = [
  { id: 'stat', label: 'Mejor' },
  { id: 'level', label: 'Nivel' },
  { id: 'rarity', label: 'Rareza' },
  { id: 'value', label: 'Valor' },
  { id: 'name', label: 'Nombre' }
];

/**
 * Por que la rejilla esta vacia, y si es por culpa del filtro.
 *
 * Sin esto el jugador ve una pantalla que dice "No tienes recolectores" con doce
 * recolectores en el almacen, y no hay forma de que sepa que son los que tiene
 * **equipados**: el filtro los saca de la lista, no del almacen. Es el fallo que hace
 * que un filtro parezca un robo.
 */
function motivoDeRejillaVacia(game: any, tipo: string): string {
  const state = game.getState();
  const enAlmacen = ((state.warehouse as any[]) || []).filter((w: any) => w.type === tipo);
  if (enAlmacen.length === 0) {
    return 'Compra ' + (tipo === 'companion' ? 'compañeros' : 'recolectores') +
      ' en la tienda o abre cajas. Necesitas ' + MATERIALES_POR_FUSION + ' del mismo tier para fusionar.';
  }
  return `Tienes ${enAlmacen.length} en el almacen y todos estan equipados. ` +
    `Desequipa ${enAlmacen.length === 1 ? 'el que hay' : 'alguno'} en el almacen y aparecera aqui. ` +
    `Se necesitan ${MATERIALES_POR_FUSION} del mismo tier.`;
}

/** El titulo del estado vacio, en la misma linea que el motivo. */
function catalogoVacio(game: any, tipo: string): string {
  const state = game.getState();
  const enAlmacen = ((state.warehouse as any[]) || []).filter((w: any) => w.type === tipo);
  return enAlmacen.length === 0
    ? `No tienes ${NOMBRES[tipo as 'companion'].muchos}`
    : 'Todo lo que tienes esta equipado';
}

function draw(container: HTMLElement, game: any, go?: (r: any) => void) {
  const state = game.getState();
  const info = game.getForgeInfo();
  const N = NOMBRES[ui.tipo];

  // El orden de la rejilla vive en `materialesDeForja()`, fuera de esta funcion, para
  // que un banco lo pueda comprobar sin un DOM, y **reutiliza el comparador del
  // almacen**: el orden no se escribe dos veces. Ver el JSDoc de las dos funciones.
  const materiales = materialesDeForja(game, ui.tipo, ui.orden);

  const tiers = Array.from(new Set(materiales.map(w => w.tier))).sort((a, b) => a - b);

  // Saneado del estado: si el jugador vendió un material, se quita de la
  // selección. Sin esto, el yunque mostraría un recolector que ya no existe y el
  // botón de forjar fallaría al ejecutarse.
  ui.selected = ui.selected.filter(id => materiales.some(w => w.id === id));
  if (ui.selected.length > MATERIALES_POR_FUSION) ui.selected = ui.selected.slice(0, MATERIALES_POR_FUSION);
  if (!tiers.includes(ui.tier)) ui.tier = tiers[0] ?? 1;

  const stonesItem = ((state.warehouse as any[]) || []).find(w => w.buffId === 'calibrationStone');
  const stoneCount = stonesItem?.stackCount || 0;
  // **EL TOPE DE PIEDRAS NO ES UN 5 ESCRITO AQUÍ.** Estaba `Math.min(5, stoneCount)` en la
  // vista y `Math.min(5, ...)` en el motor, y el segundo era el que mandaba: con el 5 el
  // T10 se quedaba en 0,93 y el jugador pagaba cinco piedras por una tirada que sabía
  // que no iba a llegar. Ahora el tope sale de `MAX_PIEDRAS_POR_FUSION`, que es el mismo
  // número que usa la cuenta de "las necesarias", así que el interruptor no puede
  // ofrecer más de lo que el motor cobra.
  const maxStones = Math.min(MAX_PIEDRAS_POR_FUSION, stoneCount);
  if (ui.stones > maxStones) ui.stones = maxStones;

  const nanoItem = ((state.warehouse as any[]) || []).find(w => w.buffId === 'stabilityNano');
  const nanoCount = nanoItem?.stackCount || 0;
  // Si el jugador no tiene ninguna, el interruptor se desactiva solo
  if (nanoCount === 0) ui.nano = false;
  // Y en compañeros tampoco se ofrece: la nanopartícula sube la rareza, y la del
  // compañero la pone el tier. Un interruptor que no hace nada sería un interruptor
  // que miente, así que se apaga en cuanto se cambia de pestaña.
  if (ui.tipo === 'companion') ui.nano = false;

  const eterItem = ((state.warehouse as any[]) || []).find(w => w.buffId === 'refiningEther');
  const eterCount = eterItem?.stackCount || 0;
  if (eterCount === 0) ui.eter = false;

  const elegidos = ui.selected
    .map(id => materiales.find(w => w.id === id))
    .filter(Boolean) as any[];

  // **EL PROMEDIO DE POTENCIAL, Y POR QUÉ SE CALCULA AQUÍ CON LAS MISMAS FUNCIONES.**
  // Es lo que decide si el Éter tiene algo que subir: el motor lo promedia dentro de
  // `attemptForge` con `potencialFusionado()` y `potencialDe()`, y aquí se usan las
  // mismas dos funciones con los mismos materiales, para que no haya una segunda
  // cuenta que pueda decir ★4 mientras la tirada sale ★5 (R2/R3).
  const potMedio = elegidos.length === MATERIALES_POR_FUSION
    ? potencialFusionado(elegidos.map((w: any) => ui.tipo === 'collector' ? potencialDe(w) : w.potential))
    : 0;
  // ★5 no tiene escalón encima: sin eso, el Éter solo cobraría. Y con el promedio
  // aún sin cerrar —faltan materiales— tampoco se apaga, porque el ★5 se puede
  // descartar al elegir y una casilla que se enciende sola sin saber es ruido.
  if (potMedio >= 5) ui.eter = false;

  const matTier = elegidos[0]?.tier ?? 0;
  // **LOS COMPAÑEROS TAMBIÉN SUMAN `affixLuck`: TAMBIÉN HEREDAN.** La suerte
  // de afijos es +2 % por afijo de los materiales, y cuenta en las dos
  // fusiones desde que el compañero forjado hereda afijos con la misma regla
  // que el recolector. La cuenta sale de aquí y no del motor porque la
  // probabilidad se enseña antes de tirar, y los dos tienen que usar la misma
  // fórmula (R3).
  const affixLuck = elegidos.reduce((a, w) => a + (w.affixes?.length || 0) * 0.02, 0);
  const chance = elegidos.length === MATERIALES_POR_FUSION && matTier
    ? successChance(matTier, info.craftLuck, ui.stones, affixLuck)
    : 0;
  const ready = elegidos.length === MATERIALES_POR_FUSION;

  // **LO QUE HACE FALTA PARA LLEGAR AL OBJETIVO, Y LO PIDE EL MOTOR.**
  //
  // El número depende de tres cosas —el tier, el árbol y los afijos de los materiales
  // elegidos—, y el cobro ocurre en `gastaConsumiblesDeForja()`. Si la cuenta la hiciera
  // esta pantalla, el botón prometería un número y el motor cobraría otro, que es el peor
  // sitio posible para una diferencia de uno. Se le pasa el `affixLuck` que **esta misma
  // pantalla ya calculaba** para no meter una segunda copia de esa cuenta.
  //
  // Y trae también `chanceConNecesarias`: con diez piedras de 1,2 puntos el 95 % ya no
  // llega en todos los tiers, así que el botón enseña **el porcentaje al que llega de
  // verdad** y solo dice "95 %" cuando de verdad se alcanza.
  const piedrasNecesarias = ready && matTier
    ? game.previewPiedrasNecesarias?.(matTier, affixLuck) ?? null
    : null;
  // F97 · LA CANTIDAD LA PONE LA RAREZA QUE SALGA, Y TODAVÍA NO HA SALIDO. Antes
  // esta línea decía cuántos afijos "aportaban" los materiales, porque el linaje
  // subía el techo. Ahora el número es fijo por rareza y la rareza depende del
  // potencial que aún no ha salido del dado: no hay cantidad que enseñar sin
  // mentir. Lo que sí se enseña —abajo— son los compartidos, que entran primero,
  // y la explicación de la tabla, que es la única cifra que ya se sabe.

  // F60 · LO COMPARTIDO, Y POR QUÉ SE ENSEÑA ANTES DE TIRAR. La forja conserva
  // la rareza compartida 3 de cada 4 y los afijos compartidos entran primero:
  // son las dos mitades de "forzar por probabilidades", y las dos se deciden
  // con lo que hay en el yunque. Si no se enseñaran, forzar sería superstición.
  //
  // Los números salen de la regla, no de aquí: la probabilidad es la que tira
  // el motor y los nombres los del catálogo. Una cifra escrita a mano sería la
  // segunda copia del número que decide.
  const rarezaCompartida = ui.tipo === 'collector' && ready && elegidos.length === MATERIALES_POR_FUSION
    && elegidos[0].rarity && elegidos[0].rarity === elegidos[1].rarity
    ? String(elegidos[0].rarity) : null;
  // Los compartidos entran primero en las DOS forjas —el compañero ahora
  // hereda afijos—, pero lo que no está en el pool de compañero no cuenta, y
  // esta pantalla lo filtra igual que filtra el motor: si enseñara un
  // compartido que la mezcla va a descartar, el cartel prometería un linaje
  // que no sale (R3).
  const compartidos = ready
    ? afijosCompartidos(elegidos).filter(id =>
        ui.tipo === 'collector' || POOL_AFIJOS_COMPANERO.some(a => a.id === id))
    : [];
  const nombresCompartidos = compartidos.map(id => AFFIX_BY_ID[id]?.name ?? id).filter(Boolean);

  // --- Fragmentos -------------------------------------------------------

  const slot = (i: number) => {
    const w = elegidos[i];
    if (!w) {
      return `
        <button class="forge-slot" data-act="clear" data-slot="${i}" aria-label="Hueco ${i + 1}">
          <span class="text-[var(--text-muted)] opacity-30 [&>span>svg]:w-5 [&>span>svg]:h-5">${ic('plus')}</span>
        </button>`;
    }
    return `
      <button class="forge-slot is-filled relative" data-act="clear" data-slot="${i}"
              style="border-color: color-mix(in srgb, var(--accent) 55%, transparent)"
              aria-label="Quitar ${w.name}">
        <span class="flex flex-col items-center gap-0.5 min-w-0 w-full">
          <span class="${rarityClass(w.rarity)} [&>span>svg]:w-5 [&>span>svg]:h-5">${ic(N.icono)}</span>
          <!--
            EL NIVEL VA AQUÍ TAMBIÉN (Q6), Y EN LA MISMA LÍNEA QUE EL TIER POR LO MISMO
            QUE EN LA CELDA DE LA MATERIA: el hueco es un cuadrado y una línea más lo
            desborda. Es el número que decide cuánto rinde la fusión, y hasta ahora
            desaparecía en cuanto el item pasaba del listado al hueco.
          -->
          <span class="text-[9px] font-mono text-center leading-tight">
            T${w.tier}${nivelDe(w) !== 0 ? ` · N${nivelDe(w)}` : ''}
          </span>
          ${`<span class="text-[9px] text-amber-400 leading-none">${estrellasDe(w.potential)}</span>`}
        </span>
        ${puntosDeAfijos(w.affixes)}
      </button>`;
  };

/**
 * El nivel de un material, o 0 si no lo tiene.
 *
 * `level` es un campo opcional y un companero recien salido de una caja no lo trae. La
 * celda lo enseña solo cuando no es cero, asi que el numero que ve el jugador existe de
 * verdad: mostrar "nivel 0" seria inventar un dato que el item no tiene.
 */
function nivelDe(w: any): number {
  const n = Number(w?.level);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

  const matCell = (w: any) => {
    const isSel = ui.selected.includes(w.id);
    // Q6 · Los afijos, igual que en el almacén: puntos de color arriba a la izquierda
    // —la celda es un cuadrado y no admite una fila más— y los nombres en el title. La
    // celda ya enseñaba el nivel, que fue el otro hueco que se corrigió aquí.
    const afijos = (w.affixes || [])
      .map((id: string) => AFFIX_BY_ID[id]?.name).filter(Boolean);
    // **SIN ESTADO DE EQUIPADO, PORQUE AQUÍ NO HAY NINGUNO.** La celda lo llevaba
    // para ponerla a media opacidad y marcarla con EQ, y el filtro de
    // materialesDeForja() hace que eso no tenga a quien marcar: los equipados no
    // llegan aquí. Una pregunta de "¿está equipado?" en la celda sería una pregunta
    // que la lista ya respondió.
    return `
      <button class="inv-cell ${isSel ? 'is-selected' : ''}"
              data-act="pick" data-id="${w.id}"
              title="${w.name}${afijos.length ? ` · Afijos: ${afijos.join(' · ')}` : ''}">
        <span class="ring-${raritySlug(w.rarity)} w-9 h-9 rounded-lg grid place-items-center
                     [&>span>svg]:w-4 [&>span>svg]:h-4 ${rarityClass(w.rarity)}">${ic(N.icono)}</span>
        <span class="text-[9px] font-mono text-[var(--text-main)] text-center leading-tight line-clamp-2 w-full">
          ${w.name}
        </span>
        <!--
          **LO QUE FALTA EN LA CELDA ERA EL NIVEL, Y ES EL NÚMERO MÁS IMPORTANTE**
          de la Forja: la fusion promedia lo que aporta el item y **el nivel multiplica
          el daño entero**. Dos recolectores del mismo tier, el mismo potencial y el mismo
          afijo se forjan distinto si uno es nivel 1 y el otro nivel 15, y la celda no lo
          decia. El stat de la esquina lo disimula --va dentro-- pero el jugador que compara
          dos celdas ve una cifra que no puede deconstruir.

          Sale **solo si no es cero**, porque un companero recien salido de una caja no
          tiene nivel y el "nivel 0" es una cosa inventada. Y en el title va la regla: el
          nivel sube con cristales, no con la forja, y el material lo hereda multiplicado.
        -->
        <span class="text-[9px] font-mono text-[var(--text-muted)]">
          T${w.tier} · ${estrellasDe(w.potential)}${nivelDe(w) !== 0 ? ` · N${nivelDe(w)}` : ''}
        </span>
        ${puntosDeAfijos(w.affixes)}
        <!-- **LA ESQUINA CON EL STAT FINAL, Y ES LA MISMA FUNCIÓN QUE LA DEL ALMACÉN.**
             La celda enseña el tier y las estrellas, y con eso se ordenaba por la base:
             el nivel no aparecía por ninguna parte. Ahora la rejilla se ordena por el
             stat final, y un orden por un número que no se ve es un orden que el jugador
             no puede comprobar ni siquiera con los números delante. La función está
             exportada del almacén a propósito: dos copias de este badge acabarían
             enseñando cosas distintas el día que cambie la regla. -->
        ${statCelda(w, game)}
      </button>`;
  };

  // --- Cuerpo -----------------------------------------------------------

  const body = `
    ${statStrip([
      { label: N.muchos[0].toUpperCase() + N.muchos.slice(1), value: String(materiales.length) },
      { label: 'Forjadas', value: String(state.forgedCount) },
      { label: 'Piedras', value: String(stoneCount) }
    ])}

    <div class="flex gap-1.5 mb-3 p-1 rounded-xl bg-[var(--bg-app)] border border-[var(--border-color)]">
      ${(['collector', 'companion'] as const).map(t2 => `
        <button class="flex-1 h-10 rounded-lg text-[10px] font-mono font-bold cursor-pointer transition
                       ${ui.tipo === t2 ? 'accent-bg text-slate-950' : 'btn-ghost text-[var(--text-muted)]'}"
                data-act="tipo" data-tipo="${t2}" aria-pressed="${ui.tipo === t2}">
          ${t2 === 'collector' ? 'Recolectores' : 'Compañeros'}
        </button>
      `).join('')}
    </div>
    <p class="text-[9px] text-[var(--text-muted)] mb-3 leading-relaxed">
      ${ui.tipo === 'collector'
        ? 'El recolector forjado hereda los afijos de sus materiales; cuántos lleva los decide la rareza que le toca.'
        : 'El compañero forjado hereda el potencial por media y los afijos de sus materiales; cuántos lleva los decide la rareza que le pone el tier.'}
      Misma probabilidad, mismas piedras y mismo fallo en las dos.
    </p>

    <section class="card-glass rounded-2xl p-3 md:p-4 mb-3">
      ${sectionHead('Yunque de fusión', 'anvil', `
        <!-- EL "2 DEL MISMO TIER" TAMBIEN SALE DE LA RECETA. Con el numero escrito
             en el span y otro en el yunque, un cambio de MATERIALES_POR_FUSION dejaba
             media pagina diciendo la receta vieja. Una receta no se escribe en dos sitios. -->
        <span class="text-[9px] font-mono text-[var(--text-muted)] hidden sm:inline">${MATERIALES_POR_FUSION} del mismo tier → 1 del siguiente</span>
      `)}

      <!-- **EL NÚMERO DE COLUMNAS LO PONE LA RECETA, Y POR AQUÍ.** Estaba en el CSS como
           repeat(3, 1fr) desde los tiempos de la receta de tres, y cuando la receta
           pasó a dos la rejilla siguió con tres: los dos huecos caían a la izquierda y
           la tercera columna se leía como un campo de texto vacío al lado del yunque.
           B12 entero. Ahora sale de MATERIALES_POR_FUSION, que es el módulo que impone la
           receta, y el ancho de cada hueco está acotado porque un yunque no crece con la
           pantalla. -->
      <div class="forge-anvil"
           style="grid-template-columns: repeat(${MATERIALES_POR_FUSION}, minmax(0, 5.5rem))">
        ${Array.from({ length: MATERIALES_POR_FUSION }, (_, i) => slot(i)).join('')}
      </div>

      <div class="mt-3">
        <div class="flex items-center justify-between gap-2 mb-1.5">
          <span class="label-caps">Probabilidad</span>
          <span class="font-['Orbitron'] font-bold text-sm tabular
                       ${!ready ? 'text-[var(--text-muted)]'
                          : chance >= 0.6 ? 'text-emerald-400'
                          : chance >= 0.42 ? 'text-amber-400'
                          : 'text-rose-400'}">
            ${ready ? `${Math.round(chance * 100)}%` : '—'}
          </span>
        </div>
        <div class="chance-bar">
          <span style="width:${(chance * 100).toFixed(1)}%;
                       background: linear-gradient(to right, var(--accent),
                         color-mix(in srgb, var(--accent) 50%, transparent))"></span>
        </div>
        ${ready ? `
          <p class="text-[9px] font-mono text-[var(--text-muted)] mt-1.5 leading-relaxed">
            base T${matTier} ${Math.round(baseSuccessChance(matTier) * 100)}%
            ${info.craftLuck > 0 ? ` · árbol +${Math.round(info.craftLuck * 100)}%` : ''}
            ${ui.stones > 0 ? ` · piedras +${pctDe(ui.stones * PIEDRA_APORTA)}%` : ''}
            · tope 95%
          </p>
        ` : `
          <p class="text-[9px] font-mono text-[var(--text-muted)] mt-1.5">
            Selecciona ${MATERIALES_POR_FUSION} ${N.muchos} del mismo tier.
          </p>
        `}
        <!--
          F51 · LOS AFIJOS, Y POR QUÉ ESTÁN AQUÍ Y NO EN LA FICHA.

          La ficha del almacén enseña **qué afijos lleva** un item forjado, que es un
          hecho. Lo que no decía en ninguna parte es **cómo se decide cuántos**: el suelo
          lo pone la rareza y el techo los materiales que pones. Sin esa frase, buscar
          buenos materiales parece superstición, y forjar con los dos primeros que
          aparezcan parece exactamente lo mismo.

          Y va **debajo del desglose de probabilidad** porque es el otro número que se
          está decidiendo en esta pantalla y porque tiene la misma forma: la cifra grande
          es el resultado y la línea de debajo es de dónde sale. Aquí la línea dice de
          dónde sale el número de afijos: de la tabla por rareza, que es lo único que
          ya se sabe antes de tirar.

          **EL NÚMERO SALE DE LA REGLA, NO DE AQUÍ.** Es explicacionDeAfijos(), la
          misma pieza que usa la regla. Los compartidos van en su propia línea
          debajo, con sus nombres.
        -->
        ${ready ? `
          <p class="text-[9px] font-mono text-[var(--text-muted)] mt-1.5 leading-relaxed">
            ${ui.tipo === 'collector'
              ? `Lleva los afijos de su rareza · ${explicacionDeAfijos()}`
              : `Lleva los afijos de su rareza (la pone el tier) · ${explicacionDeAfijos()}`}
          </p>
        ` : ''}
        ${rarezaCompartida && ready ? `
          <p class="text-[9px] font-mono text-[var(--text-muted)] mt-1.5 leading-relaxed">
            Rareza compartida (${rarezaCompartida}): ${Math.round(PROB_CONSERVA_RAREZA * 100)}% de conservarla
          </p>
        ` : ''}
        ${nombresCompartidos.length > 0 && ready ? `
          <p class="text-[9px] font-mono text-[var(--text-muted)] mt-1.5 leading-relaxed">
            Compartidos: ${nombresCompartidos.join(' · ')} (entran primero)
          </p>
        ` : ''}
        <!-- **LA OTRA TIRADA, LA DEL POTENCIAL, EN LA MISMA LÍNEA QUE LOS DEMÁS NÚMEROS.**
             La forja tira dos: la de acierto —que es la cifra grande de arriba— y la de
             subir el potencial una ★. Sin esta línea, el Éter se compra sin saber qué
             probabilidad añade, y con ella el jugador ve la media que va a salir, la
             probabilidad base y la que alcanza con Éter. Los tres números salen de
             potencialFusionado() y de la tabla de probabilidades, no de una copia de aquí. -->
        ${ready && potMedio > 0 ? `
          <p class="text-[9px] font-mono text-[var(--text-muted)] mt-1.5 leading-relaxed">
            Potencial promedio ${estrellasDe(potMedio)}${potMedio < 5
              ? ` · sube una ★ con un ${pctDe(PROB_SUBE_POTENCIAL[potMedio] ?? 0)} %${ui.eter ? `, con Éter un ${pctDe((PROB_SUBE_POTENCIAL[potMedio] ?? 0) + BONO_ETTER)} %` : ''}`
              : ' · ya está en ★5: no puede subir más'}
          </p>
        ` : ''}
        <!--
          F76 · LA RAREZA DE LO CRAFTEADO, AL LADO DEL POTENCIAL Y NO EN OTRA
          PANTALLA. La forja decía el potencial promedio y la probabilidad de
          conservar la compartida, pero no qué rareza trae el resultado: el
          jugador elegía materiales a ciegas en el eje que decide los afijos.

          **LO QUE SE ENSEÑA ES LA CALCULADA, Y DICE "CALCULADA".** Los tres
          dados que todavía no salieron —conservar la compartida, subir la ★ y
          la Nanopartícula— solo pueden dejarla igual o mejorarla, nunca
          empeorarla: el suelo es honesto y el techo no se promete. En
          compañeros no hay dado: la rareza la pone el tier y se enseña tal cual.
          Los dos números salen de data/crafting, de las mismas funciones que
          los estampan al forjar (R2/R3).
        -->
        ${ready && matTier ? `
          <p class="text-[9px] font-mono text-[var(--text-muted)] mt-1.5 leading-relaxed">
            ${ui.tipo === 'collector'
              ? `Rareza calculada: ${rarezaCalculadaDeForja(matTier + 1, potMedio)}${potMedio < 5 ? ' · puede subir si sube la ★' : ''}${ui.nano ? ' · con Nano un escalón más, 50 %' : ''}`
              : `Rareza del resultado: ${rarezaDeCompanionForjado(matTier + 1)} (la pone el tier)`}
          </p>
        ` : ''}
      </div>

      <div class="mt-3 pt-3 border-t border-[var(--border-color)]">
        <div class="flex items-center justify-between gap-2 mb-2">
          <span class="label-caps flex items-center gap-1.5">
            <span class="accent-text [&>span>svg]:w-3.5 [&>span>svg]:h-3.5">${ic('flask')}</span>
            Piedras de calibración
          </span>
          <span class="text-[10px] font-mono text-[var(--text-muted)]">${stoneCount} en almacén</span>
        </div>
        <div class="flex items-center gap-1.5 flex-wrap">
          ${Array.from({ length: maxStones }).map((_, i) => `
            <button class="w-9 h-9 rounded-lg border text-[11px] font-mono font-bold cursor-pointer transition
                           ${i < ui.stones ? 'accent-bg text-slate-950 border-transparent' : 'btn-ghost text-[var(--text-muted)]'}"
                    data-act="stones" data-n="${i + 1}" aria-label="Usar ${i + 1}">${i + 1}</button>
          `).join('')}
          ${maxStones === 0
            ? `<span class="text-[10px] text-[var(--text-muted)] leading-relaxed">
                 No tienes piedras. Se venden en la tienda y salen de cajas Épicas y Legendarias.
               </span>`
            : `<button class="ml-1 px-2.5 h-9 rounded-lg btn-ghost text-[10px] font-mono cursor-pointer"
                      data-act="stones" data-n="0">Quitar</button>`}
          ${ui.stones > 0 ? `<span class="ml-auto text-[10px] font-mono accent-text">+${pctDe(ui.stones * PIEDRA_APORTA)}%</span>` : ''}
        </div>

        <!--
          "GASTAR LAS NECESARIAS", Y POR QUÉ EL NÚMERO LO DICE EL MOTOR.

          Antes las piedras eran cinco botones y poco más: quien quería subir la
          probabilidad tenía que contar de dos en dos cuántas le hacían falta y pulsar
          hasta acertar.

          **EL OBJETIVO YA NO ES SIEMPRE EL 95 %, Y EL BOTÓN LO DICE.** Diez piedras
          suman 12 puntos, y en los tiers medios y altos con eso no se llega al 95 %:
          por eso el motor devuelve además la probabilidad **real** con esas piedras
          —chanceConNecesarias, que sale de successChance(), la misma que cobra— y
          el botón enseña esa. Solo pone "para el 95 %" cuando de verdad se alcanza.
          Prometer el tope con un tope de 12 sería mentir con el número que más se
          mira justo cuando peor va (R3).

          **EL BOTÓN SE APAGA CUANDO NO LLEGA, Y LO DICE.** Si no hay piedras suficientes no
          se ofrece un "gastar 7" que al pulsarlo devolvería un error: se enseña cuántas
          faltan. Un botón que promete un cobro y luego se niega es peor que un número.

          **Y EL POR QUÉ DE QUE ESTÉ DEBAJO DE LOS NÚMEROS:** los botones 1..N eligen
          cuántas; este elige por ti. Que venga después de ellos es lo que dice "si has
          elegido otra cosa, esto es tu alternativa", y no al revés.
        -->
        ${(() => {
          const p = piedrasNecesarias;
          if (!p) return '';
          const objetivo = Math.round((p.chanceConNecesarias ?? 0) * 100);
          const llegaAl95 = objetivo >= 95;
          if (p.necesarias === 0) {
            return `<p class="text-[10px] font-mono text-emerald-400/90 mt-1.5">
                      Ya llegas al 95 % sin gastar ninguna piedra.
                    </p>`;
          }
          if (!p.suficientes) {
            return `<p class="text-[10px] font-mono text-amber-400/90 mt-1.5 leading-relaxed">
                      ${llegaAl95 ? 'Para el 95 %' : `Para llegar al ${objetivo} %`}
                      harían falta ${p.necesarias} y tienes ${p.disponibles}.
                    </p>`;
          }
          const donde = llegaAl95 ? 'para el 95 %' : `— sube al ${objetivo} %`;
          return `<button data-act="stones-auto" data-n="${p.necesarias}"
                    class="w-full mt-2 px-2.5 h-9 rounded-lg btn-ghost text-[11px] font-mono
                           cursor-pointer transition active:scale-[0.99] flex items-center
                           justify-center gap-2"
                    title="Gasta exactamente las ${p.necesarias} piedras que hacen falta para llegar al ${objetivo} % de probabilidad">
                    <span class="accent-text [&>span>svg]:w-3.5 [&>span>svg]:h-3.5">${ic('bolt')}</span>
                    Gastar las ${p.necesarias} necesarias ${donde}
                  </button>`;
        })()}

        <!--
          LOS DOS CONSUMIBLES QUE NO SON PIEDRAS, Y POR QUÉ CADA UNO EN SU FILA.

          Nanopartícula y Éter son interruptores porque solo se gasta uno por fusión,
          pero **no comparten fila ni párrafo**: tocan cosas distintas —la rareza y el
          potencial— y apagar uno no puede apagar al otro.

          **LA NANOPARTÍCULA NO SE OFRECE EN COMPAÑEROS.** Su efecto es subir la rareza
          y la del compañero la pone el tier, así que un interruptor ahí sería un
          interruptor que no hace nada: se oculta entero en cuanto se cambia de pestaña
          (y el motor, además, no la cobra).

          **Y EL ÉTER SE APAGA SOLO EN DOS CASOS**, decididos arriba: sin Éter, o con
          el promedio ya en ★5 —no hay escalón encima, y cobrarlo sería R3—.
        -->
        ${ui.tipo === 'collector' ? `
        <div class="mt-2 pt-2 border-t border-[var(--border-color)] flex items-center gap-2.5">
          <button class="flex items-center gap-2 flex-1 min-w-0 text-left cursor-pointer"
                  data-act="nano" ${nanoCount > 0 ? '' : 'disabled style="opacity:.4;cursor:not-allowed"'}>
            <span class="w-5 h-5 rounded-md grid place-items-center flex-shrink-0 border transition
                         ${ui.nano ? 'accent-bg text-slate-950 border-transparent' : 'btn-ghost text-[var(--text-muted)]'}"
                  aria-hidden="true">
              <span class="[&>span>svg]:w-3 [&>span>svg]:h-3">${ic('check')}</span>
            </span>
            <span class="min-w-0">
              <span class="block text-[10px] font-bold text-[var(--text-main)] leading-tight">
                Nanopartícula de Estabilidad
              </span>
              <span class="block text-[9px] font-mono text-[var(--text-muted)] leading-tight">
                ${nanoCount > 0
                  ? `${nanoCount} en almacén · sube la rareza un escalón, 50 %`
                  : 'No tienes ninguna'}
              </span>
            </span>
          </button>
          ${ui.nano ? `<span class="text-[10px] font-mono accent-text flex-shrink-0">activa</span>` : ''}
        </div>` : ''}
        <div class="mt-2 ${ui.tipo === 'collector' ? '' : 'pt-2 border-t border-[var(--border-color)]'} flex items-center gap-2.5">
          <button class="flex items-center gap-2 flex-1 min-w-0 text-left cursor-pointer"
                  data-act="eter" ${eterCount > 0 && potMedio > 0 && potMedio < 5 ? '' : 'disabled style="opacity:.4;cursor:not-allowed"'}
                  title="${potMedio >= 5 ? 'El promedio ya está en ★5: no puede subir más'
                        : potMedio > 0 && eterCount === 0 ? 'No tienes Éter de Refinamiento'
                        : `Añade ${pctDe(BONO_ETTER)} puntos a la probabilidad de subir el potencial una ★`}">
            <span class="w-5 h-5 rounded-md grid place-items-center flex-shrink-0 border transition
                         ${ui.eter ? 'accent-bg text-slate-950 border-transparent' : 'btn-ghost text-[var(--text-muted)]'}"
                  aria-hidden="true">
              <span class="[&>span>svg]:w-3 [&>span>svg]:h-3">${ic('check')}</span>
            </span>
            <span class="min-w-0">
              <span class="block text-[10px] font-bold text-[var(--text-main)] leading-tight">
                Éter de Refinamiento
              </span>
              <span class="block text-[9px] font-mono text-[var(--text-muted)] leading-tight">
                ${potMedio >= 5 && potMedio > 0
                  ? 'Promedio ★5: ya no puede subir'
                  : eterCount > 0
                    ? `${eterCount} en almacén · +${pctDe(BONO_ETTER)} puntos a subir la ★`
                    : 'No tienes ninguno'}
              </span>
            </span>
          </button>
          ${ui.eter ? `<span class="text-[10px] font-mono accent-text flex-shrink-0">activa</span>` : ''}
        </div>
      </div>

      <button data-act="forge" ${ready ? '' : 'disabled'}
        class="w-full mt-3 rounded-xl font-['Orbitron'] font-bold text-[12px] tracking-wide cursor-pointer
               ${ready ? 'btn-primary' : 'btn-ghost opacity-40 cursor-not-allowed'}"
        style="min-height:52px">
        ${ready ? `FORJAR ${N.uno.toUpperCase()}` : `FALTA ${MATERIALES_POR_FUSION - elegidos.length} ${MATERIALES_POR_FUSION - elegidos.length === 1 ? 'MATERIAL' : 'MATERIALES'}`}
      </button>
      <p class="text-[9px] text-[var(--text-muted)] text-center mt-2 leading-relaxed">
        El nuevo sale con el potencial promedio de los dos; la propia fusión puede
        subirlo una ★, y el Éter suma puntos a esa tirada.
        Los ${MATERIALES_POR_FUSION} se consumen, aciertes o falles, y el Éter también.
      </p>

      <!--
        EL BOTÓN DE FORJARLO TODO, Y POR QUÉ DICE CUÁNTOS ANTES DE HACER NADA.

        Es la otra mitad de la forja: la de arriba hace **una** fusión con lo que el
        jugador elige, y esta hace **todas** las del tier. Estaba pedido como "forjar
        todos los de un tier", así que el botón habla del tier y no de "todos": en el
        T4 con doce materiales, "todos" no significaría nada.

        **LOS NÚMEROS SON DEL MOTOR Y NO UN CÁLCULO DE AQUÍ.** Cuántas tiradas salen,
        cuántos materiales entran y cuántos sobran los dice autoForgePreview(), que es
        la misma función que reparte por dentro. Si esta pantalla contara los
        recolectores del tier por su cuenta, el botón podría decir tres y la serie
        hacer dos, y el jugador no vería por qué.

        **Y CUANDO NO SE PUEDE, NO SE MUERE EN SILENCIO.** Con un solo material sin
        equipar sale el motivo, porque un botón gris sin explicación es el mismo fallo
        que el "se necesitan 2" que ya se corrigió: el jugador ve algo apagado y tiene
        que adivinar la regla.

        **LA LÍNEA PEQUEÑA DICE QUE SE MEZCLA POR POTENCIAL, Y POR QUÉ IMPORTA.** En este
        botón el jugador deja de elegir qué dos se fusionan, que es justo lo que hacía
        bien la forja manual. Sin una frase que diga que el orden es por potencial
        descendente, parece que el juego gasta las cosas por su cuenta. Con la frase, es
        una decisión: el mejor se gasta el primero porque es el que más rinde.
      -->
      ${(() => {
        const plan = game.autoForgePreview?.(ui.tipo, ui.tier, ui.serieStones, ui.serieNano) ?? null;
        if (!plan || !plan.puede) {
          return `<p class="text-[9px] text-[var(--text-muted)] text-center mt-3 leading-relaxed">
                    ${plan?.msg ?? ''}
                  </p>`;
        }
        const sobra = plan.sobrantes > 0
          ? ` · sobra ${plan.sobrantes}`
          : '';
        // **LOS DOS CHECKS DE CONSUMIBLES, Y POR QUÉ VAN AQUÍ.** La serie
        // gasta de golpe: sin estos checks, las piedras salen siempre y la
        // nano sale si el yunque la tenía marcada, que es gastar por una
        // decisión tomada en otra pantalla. Los números (stock) salen del
        // mismo preview que el botón, no de una cuenta de aquí.
        const checkFila = (act: string, on: boolean, titulo: string, linea: string) => `
          <button class="flex items-center gap-2 flex-1 min-w-0 text-left cursor-pointer"
                  data-act="${act}" aria-pressed="${on}">
            <span class="w-5 h-5 rounded-md grid place-items-center flex-shrink-0 border transition
                         ${on ? 'accent-bg text-slate-950 border-transparent' : 'btn-ghost text-[var(--text-muted)]'}"
                  aria-hidden="true">
              <span class="[&>span>svg]:w-3 [&>span>svg]:h-3">${ic('check')}</span>
            </span>
            <span class="min-w-0">
              <span class="block text-[10px] font-bold text-[var(--text-main)] leading-tight">
                ${titulo}
              </span>
              <span class="block text-[9px] font-mono text-[var(--text-muted)] leading-tight">
                ${linea}
              </span>
            </span>
          </button>`;
        return `
        <div class="mt-3 pt-2.5 border-t border-[var(--border-color)] flex flex-col gap-2">
          ${checkFila('serie-stones', ui.serieStones, 'Piedras de calibración',
            ui.serieStones
              ? `${plan.piedrasStock} en almacén · las necesarias en cada tirada`
              : 'Apagadas: la serie no gasta ninguna')}
          ${ui.tipo === 'collector'
            ? checkFila('serie-nano', ui.serieNano, 'Nanopartícula de Estabilidad',
                !ui.serieNano
                  ? 'Apagada: la serie no gasta ninguna'
                  : plan.nanoStock > 0
                    ? `${plan.nanoStock} en almacén · una por tirada, sube la rareza`
                    : 'No tienes ninguna')
            : ''}
        </div>
        <button data-act="auto-forge" ${plan.puede ? '' : 'disabled'}
                  class="w-full mt-3 px-3 rounded-xl btn-ghost font-mono text-[11px] font-bold
                         tracking-wide cursor-pointer transition active:scale-[0.99]"
                  style="min-height:44px"
                  title="Reparte los ${plan.disponibles} ${N.uno}s del tier ${ui.tier} por potencial descendente y forja cada pareja">
                  FORJAR LOS ${plan.disponibles} DEL T${ui.tier} — ${plan.tiradas} ${plan.tiradas === 1 ? 'TIRADA' : 'TIRADAS'}${sobra}
                </button>
                <p class="text-[9px] text-[var(--text-muted)] text-center mt-1.5 leading-relaxed">
                  Se mezclan por potencial, de mayor a menor${sobra ? ', y los que sobren se quedan' : ''}.
                </p>`;
      })()}
    </section>

    <section class="card-glass rounded-2xl p-3 md:p-4">
<!-- LO QUE LLAMA A LOS MATERIALES: LA SECCIÓN DECÍA "MATERIALES" Y EL JUEGO NO TIENE
         ESA PALABRA. El almacén guarda recolectores y compañeros, y el interruptor de
         arriba ya dice cuáles. Una cabecera que dice una cosa y la lista de debajo dice
         otra es el mismo fallo del "se necesitan 2" de A1 en pequeño: el jugador tiene
         que adivinar si lo que busca es una cosa o la misma con otro nombre.

         Y sale de NOMBRES[ui.tipo], el mismo sitio del que salen el "queda 1 material" y
         el "ya hay un T7 en el yunque": una fuente para cómo llama el juego a cada tipo.
         Aquí no hay texto nuevo que mantener. -->
      <!-- Con mayúscula inicial porque es una cabecera de sección, y el plural sale del
           mismo sitio que el resto de los textos del tipo: mayúscula no es un caso
           especial, es lo que pasa cuando el nombre está en un sitio y no repetido. -->
      ${sectionHead(N.vacio[0].toUpperCase() + N.vacio.slice(1), 'layers', `
        <span class="text-[10px] font-mono text-[var(--text-muted)]">${ui.selected.length}/${MATERIALES_POR_FUSION}</span>
      `)}

      ${materiales.length === 0
        ? emptyState(N.icono, catalogoVacio(game, ui.tipo),
            // **EL MOTIVO VA EN EL TITULO Y DICE CUAL DE LOS DOS ES.** Un "no tienes"
            // cuando lo que pasa es que "todo lo que tienes esta equipado" es la
            // diferencia entre un jugador que abre una caja y uno que va a desequipar.
            motivoDeRejillaVacia(game, ui.tipo))
        : `
          <!--
            EL ORDEN, Y POR QUE ES UN SELECT Y NO MAS BOTONES.

            El almacen lo tiene y la Forja no, con veinte celdas de material en un
            mismo tier: encontrar los dos mejores de nivel 12 es recorrer la rejilla a
            ojo. Un select y no cinco botones porque **la eleccion es de una sola vez y
            la opcion activa se ve sola**: cinco botones serian cinco cosas permanentes
            compitiendo por el sitio al lado de los tabs de tier, que son los que de
            verdad se cambian.

            Y **las claves son las de visibleStacksFor(), no numeros**: el orden vive
            en el almacen y las dos rejillas usan la misma regla. Ver
            materialesDeForja().
          -->
          <div class="flex items-center gap-1.5 mb-2.5">
            <label class="text-[9px] font-mono text-[var(--text-muted)] flex-shrink-0"
                   for="forge-sort">Orden</label>
            <select id="forge-sort" data-act="orden"
                    class="h-9 px-2 rounded-lg btn-ghost text-[10px] font-mono cursor-pointer">
              ${ORDENES_DE_FORJA.map((o) => `
                <option value="${o.id}" ${ui.orden === o.id ? 'selected' : ''}>${o.label}</option>
              `).join('')}
            </select>
          </div>
          <div class="flex gap-1 mb-2.5 overflow-x-auto pb-1">
            ${tiers.map(t => {
              const n = materiales.filter(w => w.tier === t).length;
              // **UN TIER CON UN SOLO MATERIAL SE VSE, PERO NO SE USA.**
              //
              // Antes el tab salía como los demás y se podía tocar: se entraba en él, se veía
              // un único material y el yunque se quedaba en "FALTA 1 MATERIAL" sin explicación
              // de por qué. Ahora **el tab enseña su número y avisa**, porque un tab que no
              // aparece parece un bug y un tab que no avisa parece un error.
              //
              // Y no se oculta: **ocultarlo es peor**. El jugador tiene ese item delante en el
              // almacén y ve un tier que no aparece en la Forja, que es exactamente el fallo
              // de "un filtro que parece un robo" que ya se corrigió una vez aquí.
              const corto = n < MATERIALES_POR_FUSION;
              return `
              <button class="px-3 h-10 rounded-lg text-[10px] font-mono flex-shrink-0 transition
                             ${corto
                               ? 'btn-ghost text-[var(--text-muted)] opacity-60 cursor-not-allowed'
                               : 'cursor-pointer'} ${t === ui.tier && !corto ? 'accent-bg text-slate-950' : 'btn-ghost text-[var(--text-muted)]'}"
                      ${corto ? 'disabled aria-disabled="true"' : ''}
                      ${corto ? `title="Solo tienes ${n} de este tier. Se necesitan ${MATERIALES_POR_FUSION} del mismo tier."` : ''}
                      data-act="tier" data-tier="${t}">
                T${t} · ${n}${corto ? ` <span class="opacity-70">(${n === 1 ? 'solo 1' : `solo ${n}`})</span>` : ''}
              </button>`;
            }).join('')}
          </div>
          <div class="inv-grid">
            ${materiales.filter(w => w.tier === ui.tier).map(matCell).join('') ||
              `<p class="text-[11px] text-[var(--text-muted)] col-span-full">Sin ${N.muchos} en este tier.</p>`}
          </div>
        `}
    </section>
  `;

  const root = mountInto(container, pageShell({
    title: 'Forja',
    icon: 'anvil',
    route: 'forja',
    state,
    // **LA PILDORA DE 'SI FALLA' SE HA QUITADO, Y POR QUE EL DATO ERA PEOR QUE
    // INUTIL.** Ensenaba cristalesDeConsuelo(tier) * valorDeUnCristal(tier), que
    // **cambia con el tier de los materiales**, y eso es lo que la hacia enganosa: un
    // numero pegado en la cabecera parece una cantidad fija, asi que un T1 que falla y
    // un T3 que falla dan lo mismo. No es verdad: el fallo paga cristalesDeConsuelo(tier),
    // que sube con el tier. El jugador leia 'por 2.025 K me quedo con esto' y el 'esto'
    // es quince veces mas grande si los materiales eran de un tier alto.
    //
    // **LA REGLA NO SE HA TOCADO**, que es lo importante: el fallo sigue pagando
    // cristales por el tier de los materiales. Lo que se ha quitado es el numero fijo, no
    // la compensacion. Y si algun dia hace falta ver el numero, el sitio honesto es
    // dentro del yunque y calculandolo con los materiales ya elegidos: ahi el numero ya
    // no varia bajo los pies del jugador.
  }, body));

  wireNav(root, { go });
  wire(root, game, go);
}

/**
 * Conecta los manejadores de la Forja.
 *
 * **EL LISTENER VA SOBRE `root`, Y NO SOBRE EL CONTENEDOR.** El contenedor
 * sobrevive a todos los repintados, así que un `addEventListener` en cada
 * `draw()` deja el anterior vivo y el mismo clic llega N veces, donde N es el
 * número de repintados desde que se entró en la Forja. Eso ya se pagó una vez en
 * el almacén, y allí está escrito con el detalle: equipar y desequipar se
 * ejecutaban tantas veces como listeners hubiera, y como el toggle es su propia
 * inversa, con un número par el estado acababa igual que estaba.
 *
 * Aquí el síntoma era distinto pero del mismo género: el guardia de duplicados
 * que ya no cortaba, así que cada copia del listener añadía el material otra vez
 * y un solo clic llenaba las dos casillas.
 *
 * Lo que sí necesita el contenedor es el **repintado**, y eso no tiene nada que
 * ver: `draw()` recibe el contenedor, y por eso se recupera con
 * `root.parentElement`, que es exactamente el padre que usó `mountInto`. Son
 * dos cosas distintas y se confundían.
 */
function wire(root: HTMLElement, game: any, go?: (r: any) => void) {
  const container = root.parentElement as HTMLElement;
  const redraw = () => draw(container, game, go);

  // Estado derivado que los manejadores necesitan. Se recalcula aquí en vez de
  // capturarlo en `draw`, porque cuando llegan los eventos `draw` ya ha
  // terminado y sus variables locales están fuera de alcance.
  const context = () => {
    const lista = ((game.getState().warehouse as any[]) || []).filter(w => w.type === ui.tipo);
    const selected = ui.selected
      .map(id => lista.find(w => w.id === id))
      .filter(Boolean) as any[];
    return { lista, selected };
  };

  /**
   * EL ORDEN SE APLICA EN `change`, Y NO EN `click`. ESTO ESTABA MAL PUESTO.
   *
   * El comentario de al lado ya decía "es un `change` y no un `click`", y el código
   * estaba en `click`. La consecuencia era el bug que reportó el jugador: al tocar el
   * `<select>` salía un `click` —no un `change`, porque nada había cambiado todavía—,
   * el delegado lo tomaba por un cambio de orden, llamaba a `redraw()` y **sustituía
   * el nodo entero, incluido el propio `<select>`**. El desplegable se cerraba solo
   * antes de llegar a abrirse y la página volvía arriba.
   *
   * **UN `CLICK` EN UN SELECT NO ES "HAN ELEGIDO ALGO".** Es "han tocado el control".
   * Entre el toque y la elección hay un desplegable abierto, una lista, y un dedo
   * por el medio; redibujar en el toque es redibujar mientras el jugador está
   * eligiendo. Por eso esto va en `change`: `change` solo salta cuando el valor
   * **ha** cambiado, que es justo lo que hay que repintar.
   *
   * Va en un `addEventListener` aparte y no dentro del `switch` de `click` porque son
   * dos eventos distintos, y porque el `switch` empieza con `closest('[data-act]')` y
   * el objetivo de un `change` sí es el propio `<select>` —eso se conserva.
   */
  root.addEventListener('change', (e) => {
    const sel = e.target as HTMLSelectElement;
    if (sel.tagName !== 'SELECT') return;
    if (sel.dataset.act !== 'orden') return;
    // Una preferencia de lectura: la lista se vuelve a pedir al motor con otro
    // criterio y **la selección del yunque se queda**, porque reordenar no ha tocado
    // lo que hay seleccionado.
    ui.orden = sel.value || 'stat';
    sfx.nav();
    redraw();
  });

  root.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
    if (!btn) return;
    const act = btn.dataset.act;

    switch (act) {
// **CAMBIAR DE TIPO VACÍA LA SELECCIÓN, Y DICE POR QUÉ.** Los ids de un tipo no
      // son de otro: al cambiar, el yunque se quedaría con huecos invisibles y el
      // jugador creería que ha perdido materiales que no tocó.
      //
      // **Y EL AVISO NO ES COSMÉTICA, ES LA PARTE QUE FALTA DE B11.** El aviso del cambio
      // de *tier* ya existía —"cambiaste de T7 a T10 y los materiales tenían que ser del
      // mismo nivel"— y el del cambio de *tipo* no: **el yunque se vaciaba en silencio**.
      // Con dos rejillas que no mezclan, un jugador que llena el yunque de recolectores y
      // toca "Compañeros" pierde la selección sin una sola palabra, y lo único que ve es
      // que el yunque aparece vacío. Es el mismo síntoma que el "ya está al tope" sin
      // motivo: una cosa que pasa y no se explica.
      case 'tipo': {
        const nuevoTipo = btn.dataset.tipo as 'collector' | 'companion';
        if (nuevoTipo === ui.tipo) return;
        sfx.nav();
        if (ui.selected.length) {
          showToast(
            `Yunque vaciado: cambiaste de ${NOMBRES[ui.tipo].vacio} a ` +
            `${NOMBRES[nuevoTipo].vacio} y no se fusionan entre ellos.`,
            'info'
          );
        }
        ui.tipo = nuevoTipo;
        ui.selected = [];
        ui.tier = 0;
        redraw();
        break;
      }
      case 'tier': {
        sfx.nav();
        const nuevo = Number(btn.dataset.tier);
        // **CAMBIAR DE NIVEL VACÍA EL YUNQUE, IGUAL QUE CAMBIAR DE TIPO, Y NO ES
        // COSMÉTICO.** El yunque guarda ids, no objetos, así que sobrevive a cualquier
        // redibujado: al pulsar otra pestaña, la rejilla pasa a enseñar los materiales de
        // ese nivel **mientras el yunque sigue con los del anterior**. La pantalla queda
        // diciendo dos cosas a la vez —"estoy viendo unos T10" y "en el yunque hay unos
        // T7"— y el que tenga que resolver la contradicción es el jugador.
        //
        // Vaciarlo es la respuesta obvia, pero solo si **se dice**. Un yunque que se
        // vacía solo parece un fallo, así que el aviso va antes de que se vacíe.
        if (ui.selected.length) {
          showToast(
            `Yunque vaciado: cambiaste de T${ui.tier} a T${nuevo} y los materiales ` +
            `tenían que ser del mismo nivel.`,
            'info'
          );
          ui.selected = [];
        }
        ui.tier = nuevo;
        redraw();
        break;
      }
      case 'pick': {
        if (ui.selected.length >= MATERIALES_POR_FUSION) {
          showToast(`El yunque ya tiene ${MATERIALES_POR_FUSION} materiales. Quita uno primero.`, 'info');
          return;
        }
        // La regla del mismo tier se filtra AQUÍ y no solo en el game loop.
        // Si se dejara pasar, el jugador llenaría el yunque, vería la
        // probabilidad de un tier y, al forjar, recibiría un error: la pantalla
        // le habría mentido dos veces seguidas.
        const { lista, selected } = context();
        const picked = lista.find(w => w.id === btn.dataset.id);
        if (!picked) return;
        // F24 · Un id por material.
        //
        // **ESTE GUARDIA NO EXISTÍA, Y POR ESO ESTA LÍNEA.** Se escribía
        // `selected.includes(picked.id)`, y `selected` es un array de **fichas**:
        // `includes` compara por identidad, así que eso es "¿este array de objetos
        // contiene la cadena 'f'?", y la respuesta es siempre no.
        //
        // El síntoma era el peor posible: un clic metía el material y el segundo
        // volvía a meterlo, así que el yunque se llenaba con **el mismo item en las
        // dos casillas** y el botón se activaba. Y como el motor sí comprueba que
        // los ids sean distintos, la pantalla montaba una combinación imposible y
        // el FORJAR contestaba "selecciona 2 distintos". Pantalla llena y botón
        // muerto.
        //
        // Lo de comparar es lo que cuesta: `some(w => w.id === ...)` para fichas y
        // `includes()` para ids. Un array de ids y uno de objetos se parecen
        // muchísimo y fallan al revés de lo que uno espera.
        if (selected.some((w: any) => w.id === picked.id)) {
          sfx.error();
          showToast(`Ese ${NOMBRES[ui.tipo].uno} ya está en el yunque. Toca su casilla para quitarlo.`, 'info');
          return;
        }
        if (selected.length && picked.tier !== selected[0].tier) {
          sfx.error();
          showToast(`Ya hay un T${selected[0].tier} en el yunque. La fusión exige ${MATERIALES_POR_FUSION} del mismo tier.`, 'info');
          return;
        }
        const st = game.getState();
        const estaEquipado = ui.tipo === 'collector'
          ? picked.id === st.equippedCollectorId
          : (st.activeCompanions || []).includes(picked.id);
        if (estaEquipado) {
          sfx.error();
          showToast(`Desequipa ese ${NOMBRES[ui.tipo].uno} antes de consumirlo como material.`, 'info');
          return;
        }
        sfx.pick();
        // El tope va AQUÍ y no solo en el saneado del redibujo. Antes no había
        // ninguno al añadir: se podían elegir tres, el botón se activaba, y el
        // motor rechazaba la fusión porque exige dos. El jugador veía un tercer
        // material que ni siquiera tenía hueco en el yunque.
        ui.selected = [...ui.selected, btn.dataset.id!].slice(0, MATERIALES_POR_FUSION);
        redraw();
        break;
      }
      case 'clear': {
        sfx.pick();
        ui.selected.splice(Number(btn.dataset.slot), 1);
        redraw();
        break;
      }
      case 'stones': {
        sfx.nav();
        const n = Number(btn.dataset.n);
        // Ajuste exacto en vez de alternar uno a uno: bajar de 5 a 2 con un
        // toggle sería cinco toques.
        ui.stones = n === 0 ? 0 : (ui.stones === n ? 0 : n);
        redraw();
        break;
      }
      case 'stones-auto': {
        // **EL NÚMERO VIENE EN EL BOTÓN, Y VINO DEL MOTOR.** No se recalcula aquí: el
        // botón lo pintó con lo que dijo `previewPiedrasNecesarias()`, y volver a calcularlo
        // en el clic es exactamente la copia que separa el número del cobro. El `data-n` lo
        // escribió el motor y se usa tal cual.
        const objetivo = Math.max(0, Math.floor(Number(btn.dataset.n) || 0));
        if (objetivo === 0) return;
        sfx.nav();
        ui.stones = objetivo;
        redraw();
        break;
      }
      case 'nano': {
        const count = ((game.getState().warehouse as any[]) || [])
          .filter(w => w.buffId === 'stabilityNano')
          .reduce((a, w) => a + (w.stackCount || 1), 0);
        if (count === 0) {
          sfx.error();
          showToast('No tienes Nanopartículas de Estabilidad.', 'info');
          return;
        }
        sfx.nav();
        ui.nano = !ui.nano;
        redraw();
        break;
      }
      case 'eter': {
        // **EL ÉTER MIRA DOS COSAS Y NO UNA.** No basta con tenerlo: el promedio de
        // los materiales tiene que ser menor que ★5, porque en ★5 no hay escalón
        // encima y gastarlo sería pagar por una tirada que no se puede hacer. El
        // botón ya sale deshabilitado con el motivo en el `title`; aquí se repite la
        // comprobación porque el estado del almacén puede cambiar entre el repintado
        // y el clic.
        const count = ((game.getState().warehouse as any[]) || [])
          .filter(w => w.buffId === 'refiningEther')
          .reduce((a, w) => a + (w.stackCount || 1), 0);
        if (count === 0) {
          sfx.error();
          showToast('No tienes Éter de Refinamiento.', 'info');
          return;
        }
        const elegidosAhora = ui.selected
          .map(id => ((game.getState().warehouse as any[]) || []).find((w: any) => w.id === id))
          .filter(Boolean) as any[];
        if (elegidosAhora.length === MATERIALES_POR_FUSION) {
          const media = potencialFusionado(elegidosAhora.map((w: any) =>
            ui.tipo === 'collector' ? potencialDe(w) : w.potential));
          if (media >= 5) {
            sfx.error();
            showToast('El potencial promedio ya está en ★5: no puede subir más.', 'info');
            return;
          }
        }
        sfx.nav();
        ui.eter = !ui.eter;
        redraw();
        break;
      }
      case 'serie-stones': {
        // **DOS CHECKS Y NADA MÁS.** La serie no elige cuántas: o gasta las
        // necesarias en cada tirada, o no gasta ninguna. El número lo
        // dice el preview con este mismo flag, así que aquí no se calcula nada.
        sfx.nav();
        ui.serieStones = !ui.serieStones;
        redraw();
        break;
      }
      case 'serie-nano': {
        sfx.nav();
        ui.serieNano = !ui.serieNano;
        redraw();
        break;
      }
      case 'forge': {
        confirmForge(container, game, redraw);
        break;
      }
      case 'auto-forge': {
        confirmAutoForge(container, game, redraw);
        break;
      }
    }
  });
}

/**
 * CONFIRMAR EL AUTO-FORGE, Y POR QUÉ PIDE CONFIRMACIÓN CUANDO LA DE A UNO TAMBIÉN.
 *
 * Este botón gasta N materiales de golpe, sin preguntar. Una fusión gasta dos. **La
 * diferencia de riesgo es de tamaño, no de clase**, y el jugador tiene que ver el uno y
 * el otro antes de que ninguno gaste: si el botón grande fuera directo y el pequeño
 * pidiera confirmación, la pantalla estaría enseñando que tirar más es más seguro.
 *
 * El texto dice **qué va a pasar y qué no**: cuántos entran, cuántas tiradas salen, si
 * sobran materiales y cuánto se gasta en consumibles. Lo que no dice es cuántos van a
 * acertar, porque eso no lo sabe nadie antes de tirar —y ponerlo sería mentir con una
 * cifra que el jugador no puede verificar—.
 */
function confirmAutoForge(container: HTMLElement, game: any, redraw: () => void) {
  const plan = game.autoForgePreview?.(ui.tipo, ui.tier, ui.serieStones, ui.serieNano);
  if (!plan || !plan.puede) {
    showToast(plan?.msg ?? 'No hay materiales suficientes en este tier.', 'info');
    return;
  }

  const N = NOMBRES[ui.tipo];

  // **EL CONTENIDO VA ESTRUCTURADO, NO EN UN PÁRRAFO.** Antes eran frases
  // seguidas en un solo párrafo y todo se leía plano: qué entra, cuántas
  // tiradas, qué sobra y qué se gasta, sin jerarquía. Ahora cada dato va en su
  // fila con su etiqueta, y lo que advierte (el consumo por tirada) va en el
  // `sublabel`, que es donde se lee antes de decidir.
  //
  // Los números salen del preview del motor, como antes: aquí no se calcula
  // nada, solo se ordena lo que ya se decía.
  const filas: Array<{ etiqueta: string; valor: string; tono?: string }> = [
    { etiqueta: 'Entran', valor: `${plan.disponibles} ${N.muchos} del tier ${ui.tier}, de dos en dos y por potencial` },
    { etiqueta: 'Tiradas', valor: `${plan.tiradas}`, tono: 'accent-text' }
  ];
  if (plan.sobrantes > 0) {
    filas.push({ etiqueta: 'Sobran', valor: `${plan.sobrantes}, se quedan en el almacén` });
  }
  // **EL TOTAL DE PIEDRAS ES EL DEL PREVIEW, NO UNA CUENTA DE AQUÍ.** Cada par gasta un
  // número distinto según los afijos que tenga, y la suma la hace el motor. Calcularlo
  // aquí con un afix luck de cero daría el número **más alto** de los posibles —el de una
  // pareja sin afijos—, o sea que el modal prometería más de lo que va a cobrar.
  //
  // **Y CON EL CHECK APAGADO NO SE PROMETE NINGUNA.** El preview ya las trae a
  // cero, y la fila lo dice en vez de esconderla: una fila que desaparece al
  // apagar el check no se distingue de una fila que nunca existió.
  if (!ui.serieStones) {
    filas.push({ etiqueta: 'Piedras', valor: 'apagadas: la serie no gasta ninguna' });
  } else if ((plan.stonesTotal ?? 0) > 0) {
    filas.push({ etiqueta: 'Piedras', valor: `${plan.stonesTotal} en total, las necesarias en cada tirada` });
  } else {
    filas.push({ etiqueta: 'Piedras', valor: 'no gastas: no tienes o no hacen falta' });
  }
  // **LA NANO SOLO SALE SI SU CHECK ESTÁ PUESTO, Y SOLO EN RECOLECTORES.** Y con el
  // stock corto se dice lo que de verdad pasa: **no es un fallo, es una rareza que no
  // sube**. Antes el mensaje prometía "esas tiradas fallarían", que era cierto cuando
  // la nano garantizaba el éxito; ya no la toca, así que la fila tiene que hablar de
  // lo único que hace —subir la rareza la mitad de las veces—. Y el `ui.tipo` va
  // dentro del `if` porque en compañeros `nanoPorTirada` es 0: un mensaje de stock
  // para un check que el motor ignora sería mentir con la fila entera.
  if (ui.serieNano && ui.tipo === 'collector') {
    const stock = plan.nanoStock ?? 0;
    filas.push({
      etiqueta: 'Nano',
      valor: stock <= 0
        ? 'no tienes ninguna: ninguna tirada subirá la rareza'
        : `una por tirada · tienes ${stock}${stock < plan.tiradas ? ` (solo alcanza para ${stock})` : ''}`,
      tono: stock < plan.tiradas ? 'accent-text' : undefined
    });
  }

  showConfirmModal(
    htmlToNode(`
      <div class="flex flex-col gap-0 rounded-xl border border-[var(--border-color)] divide-y divide-[var(--border-color)] text-left">
        ${filas.map(f => `
          <div class="flex items-baseline gap-3 px-3 py-1.5">
            <span class="text-[10px] font-mono text-[var(--text-muted)] w-[86px] flex-shrink-0">${f.etiqueta}</span>
            <span class="text-[11px] font-mono text-[var(--text-main)] min-w-0 ${f.tono ?? ''}">${f.valor}</span>
          </div>`).join('')}
      </div>
    `),
    () => runAutoForge(game, redraw),
    {
      sublabel: 'Cada tirada consume sus materiales acierte o falle',
      confirmText: `Forjar ${plan.tiradas}`,
      danger: false
    }
  );
}

/**
 * Ejecuta la serie y enseña la lista de resultados.
 *
 * **AQUÍ NO HAY RULETA, Y ES A CONSCIENTE.** La ruleta es decorativa y está pensada
 * para una tirada: con diez, el jugador vería el mismo gif diez veces seguidas, o
 * peor, uno solo mientras el almacén baja sin que se entienda qué ha pasado. En una
 * serie lo que informa es la lista de lo que salió de cada par.
 *
 * **Y LAS PIEDRAS NO SE PIDEN DESDE AQUÍ.** Que el motor calcule cuántas hacen falta
 * en cada tirada no es una comodidad: es que **cada par tiene sus propios afijos**
 * y son los afijos los que bajan el número de piedras. La vista no puede saberlo sin
 * repasar el almacén otra vez, y si lo hiciera con los materiales de toda la serie
 * gastaría de más en las parejas que salieran sin afijos. El check dice si se
 * gastan o no, y el motor resuelve cuántas par a par.
 *
 * **LA SELECCIÓN MANUAL SE VACÍA.** En este botón el jugador no eligió nada, así que
 * lo que se limpia es la lista de la forja de a uno: si no, quedaría con ids que ya
 * no existen y la siguiente fusión daría error de material no encontrado.
 */
function runAutoForge(game: any, redraw: () => void) {
  sfx.hammer();
  // **LOS MISMOS FLAGS DEL DIÁLOGO.** El preview que enseñó los números y la
  // serie que cobra reciben los dos checks: prometer con unos y cobrar con
  // otros sería cobrar por lo que el botón no dijo.
  const r = game.autoForge(ui.tipo, ui.tier, ui.serieStones, ui.serieNano);

  if (!r.success) {
    sfx.forgeFail();
    showToast(r.msg ?? 'No se pudo forjar', 'error');
    redraw();
    return;
  }

  if (r.hechos > 0) sfx.forgeSuccess();
  else sfx.forgeFail();

  ui.selected = [];

  showAutoForgeResults(r, redraw);
  redraw();
}


function confirmForge(container: HTMLElement, game: any, redraw: () => void) {
  const state = game.getState();
  const N = NOMBRES[ui.tipo];
  const lista = ((state.warehouse as any[]) || []).filter(w => w.type === ui.tipo);
  const sel = ui.selected
    .map(id => lista.find(w => w.id === id))
    .filter(Boolean) as any[];
  if (sel.length !== MATERIALES_POR_FUSION) {
    showToast(`Selecciona ${MATERIALES_POR_FUSION} ${N.muchos} del mismo tier.`, 'info');
    return;
  }

  const tier = sel[0].tier;
  const info = game.getForgeInfo();
  const affixLuck = ui.tipo === 'collector'
    ? sel.reduce((a, w) => a + (w.affixes?.length || 0) * 0.02, 0)
    : 0;
  const chance = successChance(tier, info.craftLuck, ui.stones, affixLuck);

  // **LO QUE PROMETE ESTE DIÁLOGO, EN EL MISMO ORDEN EN QUE SE COBRA.** La media
  // primero, la tirada de potencial después —la única que puede subirla—, y el Éter
  // con su letra porque **se gasta aunque la fusión falle**, que es lo que el jugador
  // tiene que saber antes de pulsar y no después.
  showConfirmModal(
    `${ui.tipo === 'collector' ? 'Dos recolectores' : 'Dos compañeros'} de tier ${tier} ` +
    `se funden en uno de tier ${tier + 1}. El potencial del nuevo es la media ` +
    `de los dos, con una tirada que puede subirlo una ★, y los dos se consumen.` +
    (ui.eter ? ' El Éter de Refinamiento se gasta también si la tirada sale mal.' : ''),
    () => runForge(game, sel, ui.stones, ui.nano, ui.eter, redraw),
    {
      sublabel: `Probabilidad ${Math.round(chance * 100)}%`,
      confirmText: 'Forjar',
      danger: chance < 0.45
    }
  );
}

/**
 * LA LISTA DE LO QUE SALIÓ DE CADA PAR, Y POR QUÉ ES UNA LISTA Y NO UN TOTAL.
 *
 * **LO PIDO EXPRESAMENTE: "UNA LISTA COMO CUANDO ABRO LAS CAJAS".** Un "4 de 6 forjados"
 * no dice qué salió de la pareja que mejor salió, y con una tirada de fondo el jugador
 * se queda sin poder comparar los pares entre sí, que es justo para lo que ordena por
 * potencial: para poder ver que el mejor material del tier se gastó el primero.
 *
 * **LOS FALLOS TAMBIÉN APARECEN, Y POR QUÉ.** Una serie de diez tiradas en la que cuatro
 * fallan es una serie normal, y enseñar solo las seis buenas daría una impresión de que
 * todo salió bien. El fallo se pinta en su fila con el motivo que devuelve el motor, que
 * es texto que el jugador ya puede actuar: si dice que no había materiales, el jugador
 * entiende que el almacén se vació.
 *
 * **LO GASTADO VA ARRIBA, ANTES DE LA LISTA.** Es lo único que cambia lo que va a hacer
 * después —si le quedan piedras o se las ha gastado todas—, y va arriba porque es la
 * pregunta que se hace uno al cerrar la pantalla.
 */
function showAutoForgeResults(r: any, onClose: () => void) {
  const cont = document.createElement('div');
  cont.innerHTML = `
    <div class="fixed inset-0 z-[200] grid place-items-end sm:place-items-center
                bg-black/70 backdrop-blur-sm p-0 sm:p-4 overflow-y-auto">
      <div class="card-glass rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md
                  p-4 max-h-[85vh] overflow-y-auto" data-forge-cerrar>
        <div class="flex items-baseline justify-between gap-2 mb-1">
          <span class="label-caps accent-text">Forja en serie</span>
          <span class="font-mono text-[10px] text-[var(--text-muted)]">T${ui.tier}</span>
        </div>
        <div class="font-['Orbitron'] font-bold text-lg leading-tight">
          ${r.hechos} de ${r.resultados.length} ${r.hechos === 1 ? 'acertada' : 'acertadas'}
        </div>

        <div class="rounded-xl border border-[var(--border-color)] px-3 py-2 mt-3 mb-1">
          <div class="flex items-baseline gap-3">
            <span class="text-[10px] font-mono text-[var(--text-muted)] w-[86px] flex-shrink-0">Piedras</span>
            <span class="text-[11px] font-mono text-[var(--text-main)]">${r.stonesTotal ?? 0}</span>
          </div>
          <div class="flex items-baseline gap-3">
            <span class="text-[10px] font-mono text-[var(--text-muted)] w-[86px] flex-shrink-0">Nanopartículas</span>
            <span class="text-[11px] font-mono text-[var(--text-main)]">${r.nanoTotal ?? 0}</span>
          </div>
          ${r.sobrantes > 0 ? `
          <div class="flex items-baseline gap-3">
            <span class="text-[10px] font-mono text-[var(--text-muted)] w-[86px] flex-shrink-0">Sin forjar</span>
            <span class="text-[11px] font-mono accent-text">${r.sobrantes} en el almacén</span>
          </div>` : ''}
        </div>

        <div class="rounded-xl border border-[var(--border-color)] divide-y divide-[var(--border-color)] mt-2">
          ${r.resultados.map((x: any, i: number) => filaDeSerie(x, i)).join('')}
        </div>

        <button class="w-full py-2.5 mt-3 accent-bg text-slate-950 font-['Orbitron'] font-bold
                       text-xs rounded-xl hover:opacity-90 transition cursor-pointer">
          CONTINUAR
        </button>
      </div>
    </div>`;

  document.body.appendChild(cont);
  const cerrar = () => { cont.remove(); onClose(); };
  cont.querySelector('[data-forge-cerrar]')?.addEventListener('click', cerrar);
}

/**
 * UNA FILA DEL RESUMEN DE LA SERIE, Y POR QUÉ NO ERA UNA LÍNEA.
 *
 * **LO QUE HABÍA:** el número, una casilla con `sparkle`, y el nombre. Tres cosas de
 * un objeto que tiene seis. Y lo peor no era lo que faltaba: era que **la fila tenía
 * el COLOR de la rareza del item y no su FORMA**, o sea media ficha. Un recolector y
 * un compañero salían con la misma cara y solo se distinguían por el color del borde.
 *
 * **LO QUE TRAE AHORA, Y DE DÓNDE SALE CADA COSA.** Todo del `item` que el motor ya
 * devolvía entero por resultado —`r.collector`/`r.companion`, con su `potential`, su
 * `tier` y su `affixes`—. **La vista no calculaba nada: leía.** Eso es lo que hace que
 * esta fila pueda ser la mitad de la ficha sin ser la regla de la mitad de la ficha:
 * las cuatro cosas que faltan son **lectura**, y si algún día el motor deja de traer
 * un campo, esta fila lo enseña vacío en vez de inventarlo.
 *
 * **LAS CUATRO SON LAS MISMAS QUE EN EL RESUMEN DE APERTURA, Y POR QUÉ.** Las
 * estrellas y el tier son **las dos dimensiones del objeto**: dónde cayó dentro de su
 * tier, y cuál es el tier. Sin las dos, dos filas del mismo nombre de la misma serie
 * no se distinguen, y el jugador no puede elegir cuál se forja mejor — que es la
 * pregunta más cara de la serie entera.
 *
 * **LOS AFIJOS VAN COMO TAG Y NO COMO TEXTO, PORQUE SON HASTA SEIS.** En texto se
 * comen la fila entera y el nombre del item deja de leerse; como tags caben en dos
 * líneas y son justo lo que se compara entre las dos filas. El estilo es el mismo de
 * la ficha del almacén —`rarity-${slug}` y `currentColor` en el borde— para que un
 * afijo se vea igual en los dos sitios.
 *
 * **EL FALLO NO TIENE ITEM Y NO PONE NADA DE ESTO.** Ni estrellas, ni tier, ni afijos,
 * ni iconos de objeto: solo la cruz y el motivo. Es la misma regla que `tierDeFila()`
 * en el resumen de apertura, y por el mismo motivo: un `undefined` pintado es un dato
 * inventado, y una fila de fallo con un "T2" al lado sería mentira.
 *
 * **Y EL ICONO ES EL DEL TIPO, Y EL TIPO ES UN ARGUMENTO Y NO EL ESTADO DE LA
 * PÁGINA.** `ui.tipo` es estado de módulo, y una función que lo lee no se puede
 * examinar desde un banco: hay que montar la página entera para ver qué pinta. Pasarlo
 * como argumento la hace comprobable sin DOM, que es lo único que hay para esto —
 * `preview.ts` no trae la serie en su mock, así que el banco visual no la puede
 * abrir. Y el que llama pasa `ui.tipo`, que es el mismo interruptor que decide a qué
 * motor llama la serie: los dos leen la misma variable, así que una fila de compañero
 * no puede pintar el icono de recolector.
 */
export function filaDeSerie(x: any, i: number, tipo: 'collector' | 'companion' = 'collector'): string {
  if (!x.exito) {
    return `
      <div class="flex items-center gap-2.5 px-3 py-2">
        <span class="text-[10px] font-mono text-[var(--text-muted)] w-[22px] flex-shrink-0">${i + 1}</span>
        <span class="w-7 h-7 rounded-lg grid place-items-center flex-shrink-0 border border-rose-500/40 text-rose-400"
              data-ico="close">
          <span class="[&>span>svg]:w-3.5 [&>span>svg]:h-3.5">${ic('close')}</span>
        </span>
        <span class="text-[11px] font-mono min-w-0 flex-1 text-rose-400 break-words">
          ${x.msg || 'La fusión falló'}
        </span>
      </div>`;
  }

  const it = x.item || {};
  // **EL POTENCIAL SE COMPRUEBA, Y NO ES PARANOIA.** `estrellasDe(undefined)` devuelve
  // `★★★`: la función tiene un valor por defecto para lo que no trae el campo, y ese
  // valor es tres. Pintarla sin mirar es **el bug de G4 otra vez**, el de "un item sin
  // potencial sale con tres estrellas": el resumen estaría prometiendo una calidad que
  // el item no tiene, y el jugador compararía dos filas por un número inventado.
  // La regla es la misma que en la rejilla: **estrellas solo si el campo es un número.**
  const estrellas = typeof it.potential === 'number' ? estrellasDe(it.potential) : '';
  const tier = typeof it.tier === 'number' && it.tier >= 1 ? `T${it.tier}` : '';
  const afijos: string[] = Array.isArray(it.affixes) ? it.affixes : [];

  return `
    <div class="px-3 py-2">
      <div class="flex items-center gap-2.5">
        <span class="text-[10px] font-mono text-[var(--text-muted)] w-[22px] flex-shrink-0">${i + 1}</span>
        <span class="w-7 h-7 rounded-lg grid place-items-center flex-shrink-0 border
                     ${rarityClass(it.rarity ?? '')} accent-bg text-slate-950"
              data-ico="${ui.tipo === 'companion' ? 'companion' : 'collector'}">
          <span class="[&>span>svg]:w-3.5 [&>span>svg]:h-3.5">${ic(ui.tipo === 'companion' ? 'companion' : 'collector')}</span>
        </span>
        <span class="min-w-0 flex-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span class="text-[11px] font-mono text-[var(--text-main)] break-words">${x.nombre ?? ''}</span>
          ${estrellas ? `<span class="text-[10px] text-amber-300 flex-shrink-0">${estrellas}</span>` : ''}
          ${tier ? `<span class="text-[10px] font-mono text-[var(--text-muted)] flex-shrink-0">${tier}</span>` : ''}
        </span>
      </div>
      ${afijos.length ? `
        <div class="flex items-center gap-1 flex-wrap mt-1.5 pl-[38px]">
          ${afijos.map(id => {
            const a = AFFIX_BY_ID[id];
            return a
              ? `<span class="text-[9px] font-mono px-1 py-[1px] rounded border rarity-${raritySlug(a.rarity)}"
                         style="border-color: currentColor" title="${a.description}">${a.name}</span>`
              : '';
          }).join('')}
        </div>` : ''}
    </div>`;
}

/**
 * Ejecuta la fusión y muestra la ruleta.
 *
 * El resultado ya está decidido cuando se llama a `game.forgeCollector`. La
 * animación solo lo enseña: si la ruleta eligiera el premio, el jugador
 * descubriría en veinte tiradas que la ruleta no es la fuente de verdad, y a
 * partir de ahí ninguna otra cifra del juego le creería.
 */
function runForge(game: any, materials: any[], stones: number, nano: boolean, eter: boolean, redraw: () => void) {
  sfx.hammer();
  // **LA MISMA PAGINA LLAMA A UNO DE LOS DOS MOTORES, Y NO A UNO INTERMEDIO.**
  // Un `forge()` único que repartiera dentro sería una regla más que mantener;
  // dos funciones del motor que comparten la validación y la tirada es lo que
  // garantiza que no se separen.
  //
  // **Y EL ÉTER VA EN LAS DOS LLAMADAS**, porque las dos lo aceptan y las dos lo
  // gastan: la tirada de potencial es la misma en recolectores y en compañeros.
  // La nanopartícula, en cambio, la pone solo quien la va a usar —la de
  // compañeros la ignora sin cobrarla—, y aquí `ui.nano` ya viene a false desde
  // la pestaña.
  const ids = materials.map(m => m.id);
  const result = ui.tipo === 'companion'
    ? game.forgeCompanion(ids, stones, nano ? 1 : 0, eter ? 1 : 0)
    : game.forgeCollector(ids, stones, nano ? 1 : 0, eter ? 1 : 0);
  const hecho = result.collector || result.companion;
  // **B22 · `chance` DICE SI HUBO TIRADA, Y ES LO QUE SEPARA UN FALLO DE UN RECHAZO.**
  //
  // El motor devuelve `success: false` en **tres** casos que el jugador vive como
  // uno, y **solo uno es un fallo de forja**:
  //
  //   · Materiales que no valen, o piedras que no hay: `chance` NO viene. No se
  //     tiró nada y **los materiales NO se gastaron**.
  //   · La tirada salió mal: `chance` viene. Se gastaron los dos materiales.
  //
  // Antes los tres pintaban la MISMA card —"Forja fallida · El yunque se enfrió ·
  // Los materiales se gastan igual"—, y en los dos primeros **esa última línea es
  // falsa**: el yunque no se gastó. El jugador ve un fallo rojo, cierra, mira el
  // almacén y ve sus dos materiales intactos: su lectura es que la forja le devolvió
  // el item, o que le dio algo sin shouldnarlo.
  //
  // Y no es que el mensaje fuera ambiguo: `msg` traía el motivo real y **la card lo
  // tiraba a la basura**, porque solo leía `success` y `crystals`. El motivo era
  // exactamente la información que hacía falta y estaba en el mismo objeto.
  const huboTirada = typeof result.chance === 'number';

  showForgeResult(result, () => {
    if (result.success && hecho) {
      sfx.forgeSuccess();
      showToast(`${hecho.name} — ${NOMBRES[ui.tipo].verbo} por ti`, 'success');
      // La selección se vacía: los materiales ya se consumieron
      ui.selected = [];
    } else if (!huboTirada) {
      // **NO FUE UN FALLO, Y EL SONIDO LO CONFIRMA.** El de fallo es el golpe seco
      // del yunque frío; un rechazo no ha tocado el yunque, así que suena el error
      // de botón y no el de forja. Con el mismo sonido, el jugador creekía que había
      // perdido los dos materiales cuando no se ha gastado nada.
      sfx.error();
      showToast(result.msg ?? 'No se pudo forjar.', 'error');
      ui.selected = [];
    } else {
      sfx.forgeFail();
      showToast(result.msg ?? 'La fusión falló', 'error');
      ui.selected = [];
    }
    redraw();
  }, ui.tipo === 'companion');
}

/**
 * LA CARTA DEL RESULTADO, Y POR QUÉ ES UNA CARTA Y NO UNAS LÍNEAS DE TEXTO.
 *
 * El resultado de una forja es **un objeto**, y se estaba enseñando como tres líneas de
 * texto centradas: el nombre, el tier con sus estrellas y la rareza, y los afijos. Es la
 * misma información que enseña la ficha del almacén, partida y más pequeña, y esa es
 * exactamente la razón de que no se leyera bien: **una cifra suelta al lado de un nombre
 * es una etiqueta, y una etiqueta hay que descifrarla**. Con la card, el objeto se ve
 * como un objeto: el anillo de la rareza, el nombre, y debajo las líneas con su etiqueta
 * al lado, que es como se lee en todas partes lo demás.
 *
 * Y hay una razón de juego además de estética: **el fallo también es una card**. Antes el
 * fallo salía como una frase suelta con un "+N cristales" y se leía como un mensaje de
 * error, no como el resultado de la tirada que fue. Con la misma card y el color del
 * yunque, el jugador ve que lo que pasó es que no salió —no que el juego se rompió— y que
 * le ha costado lo que cuesta.
 *
 * **EL AFUSO DE ESTA FUNCIÓN ES `result`, QUE ES LO QUE DECIDIÓ EL MOTOR.** Nada se
 * calcula aquí: ni el nivel, ni los afijos, ni la cantidad de cristales. Si la forja
 *mintiera, no lo haría esta tarjeta.
 */
function cardDeResultado(
  result: any,
  esCompanion: boolean,
  onClose: () => void
): string {
  const exito = !!result.success;
  const w = result.collector || result.companion;

  /**
   * B22 · TRES ESTADOS, Y EL TERCERO ES EL QUE FALTAVA.
   *
   * El motor devuelve `success: false` para **un fallo** y para **un rechazo**, y no
   * son lo mismo ni para el motor ni para el jugador:
   *
   *   · **Rechazo** (`chance` no viene): materiales que no valen, o piedras/nano que
   *     no hay. **No se tiró nada y los materiales siguen en el almacén.** Es lo que
   *     dice `msg`, y es la información que el jugador necesita para arreglarlo.
   *   · **Fallo** (`chance` viene): la tirada salió mal. Se gastaron los dos
   *     materiales y deja el consuelo.
   *
   * Antes los dos pintaban "Forja fallida · El yunque se enfrió · Los materiales se
   * gastan igual". En el rechazo **las dos últimas líneas son falsas**, y el jugador
   * ve un fallo rojo y después sus dos materiales intactos en el almacén. De ahí la
   * lectura de "falló pero me dio el item", que es lo que se reportó.
   *
   * **Y EL MOTIVO SE TIRABA A LA BASURA.** `msg` lo traía el motor en el mismo
   * objeto, y la card solo leía `success` y `crystals`. No era un dato que faltara:
   * era un dato que ya estaba y no se leía.
   */
  const huboTirada = typeof result.chance === 'number';
  const rechazo = !exito && !huboTirada;

  const nombre = exito
    ? (w?.name ?? 'Forja completada')
    : rechazo
      ? 'No se forjó nada'
      : 'El yunque se enfrió';
  const tono = exito ? rarityClass(w?.rarity ?? '') : 'text-rose-400';

  // Las tres líneas de abajo. La del medio es la única que cambia por tipo, y por eso
  // lleva su propio comentario: un "sin afijos" debajo de un compañero sería una fila
  // que no significa nada, porque no le faltan afijos — es que no tiene ese atributo.
  const lineas = exito ? [
    { etiqueta: 'Nivel', valor: `T${w.tier} · ${estrellasDe(w.potential)}` },
    {
      etiqueta: esCompanion ? 'Poder' : 'Afijos',
      valor: esCompanion
        ? `+${w.power}/s al ingreso`
        : ((w.affixes || []).length
          ? (w.affixes as string[]).map(id => AFFIX_BY_ID[id]?.name).filter(Boolean).join(' · ')
          : 'Ninguno heredado')
    },
    { etiqueta: esCompanion ? 'Forja' : 'Forjada por', valor: esCompanion ? 'Por ti' : (w.forgedBy ?? '-') }
  ] : rechazo ? [
    { etiqueta: 'Motivo', valor: result.msg ?? 'No se pudo forjar.' },
    { etiqueta: 'Yunque', valor: 'Intacto. No se gastó ningún material.' }
  ] : [
    { etiqueta: 'Consuelo', valor: `+${formatNumber(result.crystals ?? 0)} cristales` },
    { etiqueta: 'Yunque', valor: 'Sigue frío. Los materiales se gastan igual.' }
  ];

  return `
    <div class="absolute inset-0 bg-black/55" data-forge-cerrar></div>
    <div class="relative card-glass-elevated border rounded-2xl w-full max-w-xs p-4 flex flex-col gap-3
                pointer-events-auto animate-rise-in">
      <div class="flex items-start gap-3">
        <span class="w-12 h-12 rounded-xl grid place-items-center flex-shrink-0 border ${tono}">
          <span class="[&>span>svg]:w-6 [&>span>svg]:h-6">${ic(exito ? 'sparkle' : 'close')}</span>
        </span>
        <div class="min-w-0 flex-1">
          <div class="label-caps ${exito ? 'accent-text' : 'text-rose-400'}">
            ${exito ? 'Forja completada' : rechazo ? 'Forja no realizada' : 'Forja fallida'}
          </div>
          <div class="font-['Orbitron'] font-bold text-[14px] ${tono} leading-tight mt-0.5 break-words">
            ${nombre}
          </div>
        </div>
      </div>

      <div class="rounded-xl border border-[var(--border-color)] divide-y divide-[var(--border-color)]">
        ${lineas.map(l => `
          <div class="flex items-baseline gap-3 px-3 py-1.5">
            <span class="text-[10px] font-mono text-[var(--text-muted)] w-[86px] flex-shrink-0">${l.etiqueta}</span>
            <span class="text-[11px] font-mono text-[var(--text-main)] min-w-0 break-words">${l.valor}</span>
          </div>`).join('')}
      </div>

      <button data-forge-cerrar
              class="w-full py-2.5 accent-bg text-slate-950 font-['Orbitron'] font-bold text-xs rounded-xl
                     hover:opacity-90 transition cursor-pointer">
        CONTINUAR
      </button>
    </div>`;
}

/**
 * EL RESULTADO DE LA FORJA, DIRECTO Y SIN TROMPO.
 *
 * Antes esto era una cinta con su aguja: dieciocho casillas que se desplazaban
 * hasta clavar la ganadora. La ruleta se ha quitado del juego entero (B17) y lo
 * que queda es lo que ya se enseñaba con el ajuste de saltar: la card del
 * resultado, directa. El resultado lo decidió el motor antes de montar nada.
 */
function showForgeResult(result: any, onDone: () => void, esCompanion: boolean) {
  const cerrar = () => {
    onDone();
    overlay.style.transition = 'opacity 320ms ease';
    overlay.style.opacity = '0';
    window.setTimeout(() => overlay.remove(), 340);
  };

  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 z-[75] flex flex-col items-center justify-center gap-5 p-4';
  overlay.style.cssText = 'background: rgb(0 0 0 / 0.82); backdrop-filter: blur(8px);';
  overlay.style.animation = 'riseIn 240ms ease both';

  overlay.innerHTML = `
    <div class="w-full max-w-md flex flex-col gap-4">
      ${cardDeResultado(result, esCompanion, () => {})}
    </div>`;

  document.body.appendChild(overlay);
  overlay.querySelectorAll('[data-forge-cerrar]').forEach(el =>
    el.addEventListener('click', () => { cerrar(); }));
}
