// ==========================================================================
//  Los buffs: cuánto duran y a qué campo del guardado apuntan
// ==========================================================================
//  POR QUÉ ESTE FICHERO, Y POR QUÉ ES UNA MUDANZA LITERAL.
//
//  Lo que hay aquí son las TRES cosas que definen un buff, y las tres son
//  conocimiento del juego, no del motor: qué campo del guardado lleva el tiempo
//  restante, cuánto dura una tarjeta, y cuál es el tope.
//
//  Estaban en `gameLoop.ts`, un fichero de 3.352 líneas, y no tocaban ni `state`
//  ni Firebase. Mudanza literal: los mismos números y las mismas cuatro claves.
//  Y es LITERAL a propósito, porque el caso del buff de AFK tiene una forma
//  especial que es fácil de "mejorar" sin querer y romper:
//
//    `state.afkExpiresAt` NO está dentro de `state.buffs`, así que `afk` no es una
//    clave de `BUFF_FIELDS`: es un caso aparte del tipo `BuffKey`, y `cancelBuff()`
//    lo trata por separado. Si alguien metía `afk` en el mapa para dejarlo todo
//    junto, el resultado sería un buff que se cancela escribiendo en un campo que
//    no existe.
//
//  Y el `buffId` estable NO está aquí, para que no se busque: vive en
//  `data/store.ts`, con el resto de consumibles, porque es un campo del item. El
//  almacén busca el efecto por `buffId` y nunca por el texto del nombre, que es
//  lo que hizo que un buff llamado "Clics x2" no se activara nunca al buscar
//  "Clics".
// ==========================================================================

/** Cada TARJETA de AFK da 10 minutos. */
export const AFK_CARD_DURATION_MS = 10 * 60 * 1000;

/** Tope acumulable del buff de AFK: tres tarjetas y nada más. */
export const MAX_AFK_BUFF_DURATION_MS = 30 * 60 * 1000;

/**
 * Campo del guardado que lleva el tiempo restante de cada buff.
 *
 * El nombre de la clave ES el campo de `state.buffs`. Por eso `cancelBuff()`
 * puede pedir "cuánto le queda" sin una tabla aparte: mira el campo y ya está.
 *
 * `afkCard` NO está, y no por descuido: el tiempo de AFK vive en
 * `state.afkExpiresAt`, fuera de `state.buffs`. Por eso `BuffKey` lo añade a
 * mano y `cancelBuff()` lo trata en una rama aparte.
 */
export const BUFF_FIELDS = {
  clickBoost: 'clickBoostExpiresAt',
  clickX2: 'clickX2ExpiresAt',
  clickX3: 'clickX3ExpiresAt',
  passiveBoost: 'passiveBoostExpiresAt',
  compPassiveBoost: 'compPassiveBoostExpiresAt',
  compClickBoost: 'compClickBoostExpiresAt',
  compGlobalBoost: 'compGlobalBoostExpiresAt'
} as const;

export type BuffKey = keyof typeof BUFF_FIELDS | 'afk';

/**
 * SI UN BUFF SE PUEDE CANCELAR DESDE EL HUD.
 *
 * **POR QUE ESTA AQUI Y NO EN CADA SITIO.** La regla la leen dos: el boton de la
 * tarjeta, que tiene que decidir si se pinta, y el motor, que tiene que negarla. Si
 * cada uno escribiera su propio `if (key === 'afk')`, bastaria con que uno de los
 * dos se quedara atras para que el sintoma fuera un boton que no hace nada -- que es
 * peor que no tenerlo, porque el jugador no tiene forma de saber por que.
 *
 * **Y POR QUE EL AFK NO.** Cancelar es razonable en una mejora temporal: se deja de
 * usar y el tiempo se pierde. El AFK no es una mejora, es **lo que permite jugar sin
 * mirar la ventana**, y su tiempo se acumula -- tres tarjetas son media hora --, asi que
 * la cruce era un boton de veinte pixeles para tirar media hora y la tarjeta que la
 * compro. Ademas el efecto no se ve en el boton: al cancelarlo el HUD lo esconde y no
 * hay ningun sitio donde volver a ponerlo sin gastar otra tarjeta, o sea que la cruce
 * podia dejar la partida en un estado del que no se sale.
 *
 * El valor por defecto de un buff nuevo es **que se puede cancelar**, porque es lo
 * esperable; negar es lo que hay que escribir a proposito.
 */
export const BUFF_CANCELABLE: Record<BuffKey, boolean> = {
  clickBoost: true,
  clickX2: true,
  clickX3: true,
  passiveBoost: true,
  compPassiveBoost: true,
  compClickBoost: true,
  compGlobalBoost: true,
  afk: false
};

/** Si este buff ofrece su boton de cancelar. La funcion es la que usan los dos. */
export function sePuedeCancelar(buffId: string): boolean {
  return (BUFF_CANCELABLE as Record<string, boolean>)[buffId] ?? true;
}

/**
 * EL NOMBRE DE CADA BUFF, ESCRITO UNA SOLA VEZ (Q1).
 *
 * **POR QUE ESTA AQUI Y NO EN CADA SITIO.** El nombre se escribia en DOS tablas:
 * la del HUD (`BUFF_DEFS`, en `ui/buffHud.ts`) y una copia privada dentro de
 * `cancelBuff()`. Con dos copias, renombrar la palabra "clic" por "click" movio
 * una y dejo la otra -- y el resultado era un dialogo que decia "Clicks x2
 * (tarjeta)" y, un segundo despues, otro que decia lo mismo con el nombre viejo.
 * Aqui vive la tabla y las dos la leen.
 *
 * **Y POR QUE LLEVAN EL PARENTESIS.** `clickBoost` (30 min, se compra) y
 * `clickX2` (30 s, es la tarjeta) se ven igual en el HUD porque ahi los
 * distingue el descriptor `rápida`; el dialogo y el aviso no llevan descriptor,
 * asi que sin el parentesis los dos serian "Clicks x2" y el jugador no sabria
 * cual de los dos esta a punto de perder.
 *
 * El HUD pinta su propia cadena corta (`BUFF_DEFS[].label`) porque esa es
 * presentacion, como sus colores: aqui esta la IDENTIDAD, que es la que tiene
 * que decir lo mismo en el dialogo y en el aviso.
 */
export const BUFF_LABELS: Record<BuffKey, string> = {
  clickBoost: 'Clicks x2',
  clickX2: 'Clicks x2 (tarjeta)',
  clickX3: 'Clicks x3 (tarjeta)',
  passiveBoost: 'Recolección por segundo x2',
  compPassiveBoost: 'Recolección por segundo (compañero)',
  compClickBoost: 'Clicks (compañero)',
  compGlobalBoost: 'Recolección por segundo global (compañero)',
  afk: 'AFK'
};
/**
 * CUÁNTAS VECES CABE UN CONSUMIBLE, Y POR QUÉ ES UNA FUNCIÓN Y NO UN NÚMERO EN CADA
 * `case`.
 *
 * El consumible se usaba **de a uno**, y con veinte tarjetas AFK en la pila eso son
 * veinte confirmaciones para un efecto que el propio juego limita a tres. El tope de cada
 * uno estaba escrito dentro del `case` que lo aplica --`Math.min(base + afkMs, ahora +
 * afkMs * 3)`, `Math.min(..., ahora + 30 * 60_000)`-- así que **para preguntar "cuántas
 * puedo gastar" había que volver a escribir los topes en otro sitio**, y un tope escrito
 * dos veces es un tope que se separan.
 *
 * Aquí están los topes como números, **y solo como números**:
 *
 * · `AFK`: tres tarjetas. El buff se recalcula con `afkCardDurationMs()`, que es la misma
 *   función que usa el `case` y la que lee el árbol, así que subir de nivel el AFK también
 *   sube el tope sin tocar este sitio.
 * · Las tarjetas de click: 30 minutos para la x2, 30 minutos para la x3, 2 horas para la de
 *   pasivo. Es lo que ya ponían los `case`, escrito una vez.
 *
 * Y **el expansor no entra aquí** porque su tope no es un tiempo sino el **almacén**:
 * el expansor T{n} vale hasta `maxCap`, y el expansor de una partida vieja hasta
 * `WAREHOUSE_MAX_CAP`. El motor lo pregunta con la misma tabla, en `planUseConsumable()`.
 */
export const TOPE_DE_TARJETA_AFK = 3;
export const TOPE_MS_CLICK_X2 = 30 * 60_000;
export const TOPE_MS_CLICK_X3 = 30 * 60_000;
export const TOPE_MS_CLICK_BOOST = 30 * 60_000;
export const TOPE_MS_PASSIVE_BOOST = 2 * 60 * 60_000;

/**
 * Los tres buffers de compañero (F97 Lote 2d).
 *
 * Cada uno da boost a un tipo de compañero: pasivos, clicks o global.
 * Se usan como consumibles normales: se compran de caja y se gastan desde el
 * almacén. El tope evita que un jugador con muchas unidades acumule demasiado.
 */
export const TOPE_MS_COMP_PASSIVE_BOOST = 2 * 60 * 60_000;
export const TOPE_MS_COMP_CLICK_BOOST = 2 * 60 * 60_000;
export const TOPE_MS_COMP_GLOBAL_BOOST = 60 * 60_000;

/**
 * Lo que una tarjeta tiene que mover para que cuente como gastada.
 *
 * ## POR QUÉ HAY UN SEGUNDO Y POR QUÉ NO ES UN NÚMERO MAGO
 *
 * El tope se mide **en el instante de la llamada** —`ahora + tope`— y `ahora` se lee en
 * cada uso. Dos usos separados por un milisegundo dan dos techos distintos: el segundo
 * "cabe" por un milisegundo, el `ceil` lo cuenta como una unidad entera y el jugador
 * pierde una tarjeta por un tic del reloj. Eso es lo que pasaba con la segunda tarjeta
 * de click, y es la mitad de lo que motivó el uso en lote.
 *
 * Un segundo es **una unidad de reloj, no una unidad de juego**: por debajo de eso el
 * efecto no se ve, el número del temporizador tampoco cambia y la tarjeta es una
 * etiqueta vacía. Y por encima sigue mandando el `ceil`, que es lo que conserva el caso
 * bueno: un buff con veinte minutos puestos y treinta de tope **sí** acepta una tarjeta
 * para llegar hasta el tope, y sin este margen también se rechazaría.
 */
export const MIN_MS_DE_UNIDAD = 1_000;

/**
 * Los únicos que se pueden usar en ráfaga y los que no, y por qué.
 *
 * `null` es "no tiene tope: se usa mientras haya unidades" — que hoy no es ninguno, pero
 * lo deja escrito para que añadir un consumible nuevo sin tope sea una decisión y no un
 * olvido.
 *
 * Las piedras y la nanopartícula **no están**, y no por descuido: se consumen en la
 * Forja, una por tirada, y aplicarlas desde el almacén las gastaría sin que la Forja
 * las viera. `useConsumable()` ya lo rechaza y este lo dice antes de preguntar.
 */
export function topeDeConsumible(buffId: string, afkMs: number): number | null {
  switch (buffId) {
    // B26 · ESTA LÍNEA ERA `TOPE_DE_TARJETA_AFK * afkMs`, Y ERA UN ERROR DE MAGNITUD.
    //
    // **`TOPE_DE_TARJETA_AFK` ES UN NÚMERO DE TARJETAS Y `afkMs` ES UN TIEMPO.** El tope
    // del AFK está escrito como "tres tarjetas y nada más", o sea que son **tres
    // unidades**, no tres veces un tiempo. Multiplicarlos produce un tope que **crece con
    // el nodo del árbol**, y el nodo existe precisamente para alargar la tarjeta.
    //
    // **EL DAÑO, CON LOS NÚMEROS DEL CÓDIGO.** Con un nivel de `afk_extend` (que da
    // `afkHours: 0.5`, o sea +30 min): la tarjeta pasa de 10 a 40 min, y el tope se va a
    // `3 × 40 = 120 min` cuando el jugador compró **60 min** (los 30 de base más sus 30).
    // Al máximo del nodo son 390 minutos: **trece veces** el tope de base.
    //
    // **Y POR QUÉ NO SE DI ANTES, QUE ES LA LECIÓN.** Sin nivel del nodo, `afkMs` es
    // `AFK_CARD_DURATION_MS` y `3 × 10 min` da exactamente `MAX_AFK_BUFF_DURATION_MS`:
    // **las dos definiciones coincidían de milagro**, así que el banco que comprobaba el
    // tope sin tocar el nodo pasaba en verde. Un número que solo se rompe cuando otro
    // camino lo toca **no está protegido por el banco que no lo toca**.
    //
    // **LO QUE SE ESCRIBE AHORA: EL TOPE ES UN TIEMPO, Y EL EXTRA CUENTA UNA VEZ.** La
    // regla que dice el nombre de la constante —"treinta minutos de AFK como mucho"— es un
    // techo de reloj, y el nodo lo sube **una** vez, no lo multiplica.
    case 'afk': return MAX_AFK_BUFF_DURATION_MS + extraDelArbol(afkMs);
    case 'clickX2': return TOPE_MS_CLICK_X2;
    case 'clickX3': return TOPE_MS_CLICK_X3;
    case 'clickBoost': return TOPE_MS_CLICK_BOOST;
    case 'passiveBoost': return TOPE_MS_PASSIVE_BOOST;
    case 'compPassiveBoost': return TOPE_MS_COMP_PASSIVE_BOOST;
    case 'compClickBoost': return TOPE_MS_COMP_CLICK_BOOST;
    case 'compGlobalBoost': return TOPE_MS_COMP_GLOBAL_BOOST;
    default: return null;
  }
}

/**
 * Lo que el nodo del árbol le ha alargado a **una** tarjeta de AFK, en milisegundos.
 *
 * **POR QUÉ ES UNA FUNCIÓN Y NO UN PARÁMETRO.** Porque `topeDeConsumible()` recibe
 * `afkMs`, que es la duración **ya con el nodo aplicado** (`10 min + extra`), y el tope lo
 * necesita **por separado**. Restarlo de la base es la única forma de no pasar un tercer
 * número por medio de todo el juego, y de paso **hace imposible que el extra entre dos
 * veces**: si alguien vuelve a multiplicar, el test se pone rojo enseguida.
 *
 * **Y POR QUÉ NUNCA NEGATIVO.** Una partida muy vieja puede no tener el nodo, y entonces
 * `afkMs` sería exactamente la base y el extra sería cero. Si algún día `afkMs` llegara por
 * debajo —una migración, un cambio de regla—, el tope **bajaría por debajo de los 30
 * minutos** y dejaría de poder usarse ni una tarjeta: un fallo que no puede pasar, pero que
 * el `Math.max(0, ...)` hace imposible en vez de improbable.
 */
function extraDelArbol(afkMs: number): number {
  return Math.max(0, afkMs - AFK_CARD_DURATION_MS);
}

/**
 * Campo del guardado que lleva **cuánto se concedió en el último uso** de cada buff.
 *
 * ## POR QUÉ HACE FALTA, Y POR QUÉ NO VALE EL TECHO
 *
 * El HUD pinta la barra como `restante / duración de una unidad`, y con eso la barra
 * miente justo en el caso que la hace inútil: **el motor acumula**. Tres tarjetas de
 * click x2 de treinta segundos dejan el buff puesto **treinta minutos**, y al ser el
 * denominador treinta segundos, la barra se queda clavada en el 100 % con el contador
 * corriendo: se ve como una barra muerta.
 *
 * La primera tentación es usar el **tope** (treinta minutos) de denominador, y es
 * Peor: con una sola tarjeta de treinta segundos la barra saldría al 1,6 % y parecería
 * que no hay buff. El denominador honrado es **lo que este buff tiene delante**, que no
 * se deduce de nada guardado: hace falta un campo.
 *
 * ## POR QUÉ "EN EL ÚLTIMO USO" Y NO UNA SUMA HISTÓRICA
 *
 * Porque la barra tiene que **empezar en 100 % y bajar**. Si fuera la suma de todo lo
 *concedido, un buff al que se le suma una tarjeta con diez minutos puestos se
 * quedaría con un denominador mayor y la barra bajaría de golpe, como si se hubiera
 * lost tiempo. Con "el último uso concedes lo que había al aplicarlo", la barra es
 * "cuánto de lo que te dieron queda", que es lo que el jugador quiere ver.
 *
 * El AFK sigue estando **fuera** de `state.buffs` —su expiración es
 * `state.afkExpiresAt`—, así que su total vive en `state.afkTotalMs` y las dos funciones
 * de abajo tratan ese caso aparte, igual que ya hacía `BUFF_FIELDS`.
 */
export const BUFF_TOTAL_FIELDS = {
  clickBoost: 'clickBoostTotalMs',
  clickX2: 'clickX2TotalMs',
  clickX3: 'clickX3TotalMs',
  passiveBoost: 'passiveBoostTotalMs',
  compPassiveBoost: 'compPassiveBoostTotalMs',
  compClickBoost: 'compClickBoostTotalMs',
  compGlobalBoost: 'compGlobalBoostTotalMs'
} as const;

/** Dónde vive la expiración de un buff, sea cual sea el buff. */
export function expiracionDe(state: any, buffId: string): number {
  if (buffId === 'afk') return Number(state.afkExpiresAt) || 0;
  const campo = (BUFF_FIELDS as Record<string, string>)[buffId];
  return campo ? Number(state.buffs?.[campo]) || 0 : 0;
}

/**
 * Anota cuánto se acaba de conceder, para que la barra tenga un denominador real.
 *
 * Se llama **una vez por uso**, después de aplicar: con tres tarjetas aplicadas en
 * bucle son tres anotaciones y gana la última, que es la que sabe cuánto queda en total.
 *
 * @returns El total anotado, o 0 si el buff no lleva expiración (o sea, ninguno).
 */
export function anotaTotalDeBuff(state: any, buffId: string, ahora: number): number {
  const expira = expiracionDe(state, buffId);
  const total = expira > ahora ? expira - ahora : 0;
  if (buffId === 'afk') {
    state.afkTotalMs = total;
    return total;
  }
  const campo = (BUFF_TOTAL_FIELDS as Record<string, string>)[buffId];
  if (campo) state.buffs[campo] = total;
  return total;
}

/** Cuánto se concedió en el último uso. 0 significa "no se sabe", y el HUD lo deduce. */
export function totalConcedidoDe(state: any, buffId: string): number {
  if (buffId === 'afk') return Number(state.afkTotalMs) || 0;
  const campo = (BUFF_TOTAL_FIELDS as Record<string, string>)[buffId];
  return campo ? Number(state.buffs?.[campo]) || 0 : 0;
}

/** Los cinco totalizadores, para la coacción de la carga (R8). */
export const BUFF_TOTAL_CAMPOS = Object.values(BUFF_TOTAL_FIELDS);

/**
 * Cuántas veces cabe un consumible, y por qué es una función y no un número en cada
 * `case`.

/**
 * Cuántas unidades se pueden usar de un golpe sin que la siguiente se pierda.
 *
 * ## POR QUÉ ES UN `ceil` Y NO UN RESTO
 *
 * El tope se **recorta**, no se rechaza: con un AFK que vence dentro de dos minutos y
 * un tope de veinte, una tarjeta deja el tope y no "lo que le queda". Así que el número de
 * usos que caben es **cuántas tarjetas hacen falta para llegar al tope**, no las que caben
 * *entras*: `ceil((techo - base) / paso)`. Un `floor` daría 0 con dieciocho minutos
 * puestos de un tope de veinte, y el `case` del motor --que recorta en vez de rechazar--
 * aceptaría esa tarjeta: el botón "no hace nada" con el motor diciendo que sí.
 *
 * `base` es **el buff que hay**, no cero: una tarjeta que alarga veinte minutos sobre un
 * buff de diez deja 30, y el total sigue siendo el tope. Por eso el argumento es
 * `base`, no `ahora`.
 *
 * @returns El número de usos que caben de verdad. Nunca negativo.
 */
export function cuantasVecesCabe(entrada: {
  buffId: string;
  ahora: number;
  /** Milisegundos de efecto que aporta **una** unidad. */
  pasoMs: number;
  /** Cuánto le queda al efecto ahora mismo: su expiración. */
  expiraEn?: number;
  /** Cuántas unidades hay en el almacén. */
  unidades: number;
  /** Duración de una tarjeta AFK; solo para el AFK. */
  afkMs: number;
}): number {
  const tope = topeDeConsumible(entrada.buffId, entrada.afkMs);
  // Sin tope declarado, o sin unidades, no hay nada que calcular.
  if (tope === null) return entrada.unidades;
  if (entrada.unidades <= 0) return 0;
  if (!(entrada.pasoMs > 0)) return 0;
  // **EL TOPE ES UNA DURACIÓN Y `base` ES UN INSTANTE, ASÍ QUE LA RESTA ES ENTRE
  //  INSTANTES.** El `case` recorta a `ahora + tope`, no a `tope`: son dos números de
  //  la misma magnitud, pero no de la misma unidad. Restarlos tal cual da un número
  //  negativo y este sitio dice "ya está al tope" para todo, que es lo que pasó la
  //  primera vez --media partida entera con todos los consumibles rechazados--.
  const base = Math.max(entrada.ahora, entrada.expiraEn ?? 0);
  const falta = (entrada.ahora + tope) - base;
  // **LO QUE SOBRA POR DEBAJO DE UN SEGUNDO NO CUENTA COMO UNA TARJETA.** Es el
  //  desfase entre dos llamadas: el tope se mide en el instante de cada una, así que
  //  usar dos veces seguidas deja siempre unos milisegundos de margen y el `ceil` los
  //  redondearía a una tarjeta entera. Con este margen, la segunda tarjeta de un buff
  //  lleno **se rechaza y no se cobra**, que es lo que el jugador espera.
  if (falta < Math.min(entrada.pasoMs, MIN_MS_DE_UNIDAD)) return 0;
  return Math.max(0, Math.min(entrada.unidades, Math.ceil(falta / entrada.pasoMs)));
}

/**
 * Milisegundos de efecto que aporta **una** unidad de este consumible.
 *
 * Es el otro medio de la misma pregunta que `topeDeConsumible()`: el tope dice hasta
 * donde llega el efecto y el paso cuánto se alarga cada vez. **Están en el mismo
 * sitio y por el mismo motivo**: los dos salen de los `Math.min()` que aplicaban los
 * `case` del motor, escritos una sola vez.
 *
 * El expansor **no aparece**, porque su paso son ranuras de almacén y no milisegundos:
 * ese lo pregunta el motor con `EXPANSOR_TIERS`. Devolver `0` es lo honesto para
 * "aquí no aplica esta regla", y no un número inventado.
 */
export function pasoDeConsumible(buffId: string, afkMs: number): number {
  switch (buffId) {
    case 'afk': return afkMs;
    case 'clickX2': return 30_000;
    case 'clickX3': return 30_000;
    case 'clickBoost': return 30 * 60_000;
    case 'passiveBoost': return 60 * 60_000;
    case 'compPassiveBoost': return 30 * 60_000;
    case 'compClickBoost': return 30 * 60_000;
    case 'compGlobalBoost': return 30 * 60_000;
    case 'warehouseExpander': return 1;
    default: return 0;
  }
}
