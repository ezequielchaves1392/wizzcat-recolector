// ==========================================================================
//  Utiles compartidos por los bancos de pruebas
//
//  Lo que hay aquí NO es lógica del juego: es el banco de pruebas. Toda
//  comprobación se hace contra `createGameLoop()` de verdad, con Firebase
//  sustituido por el store en memoria de `verify/stubs/firebase-firestore.ts`.
//  Ninguna función de este archivo reimplementa una regla del juego, porque una
//  reimplementación pasa las pruebas justo cuando el juego está roto.
//
//  Para añadir un banco: créalo en `verify/`, y añade su nombre a los dos sitios
//  de `verify/vite.config.ts` (`lib.entry`) y de `verify/run.mjs`.
// ==========================================================================

import { createGameLoop } from '../src/gameLoop';
import { countOccupiedSlots } from '../src/data/stacking';
import { CRATE_TYPES, CRATE_TIERS, type CrateType } from '../src/data/store';
// El cristal ya no tiene niveles, así que la fábrica de abajo escribe un nombre y un
// precio fijos. Se importan solo las dos cosas que un banco necesita del recurso: el
// nombre y cuánto vale una unidad para el item del nivel dado —que es lo que hace el
// banco que mide "intentos de mejora" en lugar de "unidades sueltas".
import { CRISTAL_NOMBRE } from '../src/data/items';
import { valorDeUnCristal } from '../src/data/crafting';

export type Row = { name: string; ok: boolean; detail: string };

/**
 * LA ÚLTIMA PARTIDA QUE ARRANCÓ ESTE BANCO.
 *
 * Para que `recargar()` sepa a quién hay que volcar sin que el banco tenga que
 * pasar el nombre: los bloques de los bancos de recorrido son de ámbito, así que
 * la partida del apartado anterior **no está disponible** desde el siguiente, y un
 * valor por defecto que no mire fuera del bloque es la única opción que no obliga
 * a la prueba a saber más de la que le corresponde.
 *
 * Y hay una trampa que esto **no** tapa: un banco que no sigue la cadena —que
 * sigue desde una partida más antigua— tiene que pasarle el juego a mano. Está
 * escrito en `recargar()`.
 */
let juegoVivo: { flush: () => void } | null = null;

function anotarJuego(g: any) {
  juegoVivo = g ?? null;
  return g;
}

/**
 * NOTA · POR QUÉ AQUÍ NO HAY UN "APAGA RELOJES".
 *
 * Se probó: envolver `setTimeout` y cancelar los de medio segundo o más, para
 * quitar de en medio el `setTimeout(saveToFirebase, 1200)` que `createGameLoop()`
 * programa al arrancar. Ese temporizador sí era un problema —se colaba en mitad de
 * lo que un banco estaba midiendo y hacía que `playthroughCheck` fuera intermitente—
 * pero **cancelarlo a pelo rompía `toastCheck`**, porque el desvanecido de los
 * avisos también dura segundos y se quedaba en pantalla para siempre.
 *
 * El arreglo bueno no es silenciar el reloj: es que **el temporizador no se cree**.
 * La pregunta "¿venía cola de la sesión anterior?" se hace ahora antes de cargar,
 * no después, así que sin cola heredada no hay nada que subir y el guardado
 * diferido no se programa. Arreglado en el juego y no en el banco, que es donde
 * un arreglo así tiene que estar.
 */

/**
 * Filas de las comprobaciones del banco EN CURSO.
 *
 * `kit.ts` se comparte entre bancos (Vite lo mete en un chunk comun), asi que
 * `rows` es UN array para todos. `resumen()` lo vacia al terminar cada banco: sin
 * eso, los fallos del banco anterior salen otra vez en el siguiente y parece que
 * falla lo que no ha fallado.
 */
const rows: Row[] = [];

export function check(name: string, ok: boolean, detail = '') {
  rows.push({ name, ok, detail });
}

export const USER = { uid: 'test', displayName: 'Probador' };
export const DB = 'users/test';

/** El documento tal y como está en la "base de datos", para mirar lo guardado. */
export const guardado = (): any => (globalThis as any).__MEM_DB__[DB];

/**
 * Arranca el game loop con la partida dada puesta en la base de datos.
 *
 * `extra` es el cuarto argumento de `createGameLoop` —el mismo que `main.ts` le
 * pasa a `showAchievementPopup`—, y existe porque sin él no hay forma de mirar si
 * el motor **emite** un logro. Antes solo se podía mirar si se desbloqueaba en el
 * estado, y son dos cosas distintas: el cartel depende de la primera y del cableado
 * hasta la vista, y esa segunda mitad no es comprobable desde un banco (B3).
 */
export async function boot(save?: any, extra?: {
  onAchievement?: (a: any) => void;
  /**
   * B30 · El latido de viaje, conectado al banco **como en el juego**.
   *
   * `main.ts` le pasa a `createGameLoop` las dos funciones de `sessionService`: la que
   * pregunta y la que confirma. Si el banco no se las pasa, el motor arranca **sin
   * latido**, y cualquier cuenta de escrituras que mida el gasto del cerrojo mediría un
   * juego que no existe. Por eso están aquí y no en un banco suelto: conectarlas en un
   * solo sitio haría que los demás bancos midieran un motor distinto del de producción.
   */
  campoDeLatido?: () => Record<string, unknown> | null;
  confirmarLatido?: () => void;
}) {
  // Dos turnos de espera, y el motivo es de orden.
  //
  // `createGameLoop` arranca con un `saveToFirebase()` en vuelo. Un turno deja
  // que ese guardado termine; el segundo deja que termine el que hubiera
  // arrancado DENTRO de él. Limpiar la cola sin los dos turnos la deja
  // escribiéndose después, y el banco siguiente arranca con saldos fantasma.
  //
  // Y elDocumento se monta DESPUÉS de esperar, no antes: los bucles de pruebas
  // anteriores siguen vivos y guardan al recibir su propio evento. Si el
  // documento se preparara primero, su `saveToFirebase` escribiría encima del
  // nuevo y `stateCheck` leería `cores=0` de un documento que el test anterior
  // había puesto en 33.
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));
  limpiarCola();
  // **EL FALLO PROGRAMADO SOBREVIVE AL REINICIO, Y TIENE QUE SOBREVIVIR.**
  // `boot()` borra la base de datos entera para que cada banco empiece limpio, y con
  // ella se iba el conmutador `fallarLectura` que el banco había puesto justo antes: la
  // lectura no fallaba nunca y la prueba pasaba sin comprobar nada. Es el mismo motivo
  // por el que `fallar` se pone DESPUÉS de esta línea en los bancos que lo usan.
  //
  // Es el único campo que se arrastra, y solo porque es lo que se pide a la base de
  // datos y no un dato guardado.
  const fallaLectura = (globalThis as any).__MEM_DB__?.fallarLectura === true;
  globalThis.__MEM_DB__ = {};
  if (fallaLectura) (globalThis as any).__MEM_DB__.fallarLectura = true;
  if (save) globalThis.__MEM_DB__[DB] = JSON.parse(JSON.stringify(save));
  return anotarJuego(await createGameLoop(
    USER, () => {}, undefined, extra?.onAchievement,
    extra?.campoDeLatido, extra?.confirmarLatido
  ));
}

/**
 * Vuelve a cargar desde lo último guardado, como si el jugador refrescara la
 * página. Es la mitad de casi todas las comprobaciones: un cambio puede verse
 * bien en memoria y no haber llegado al documento.
 *
 * NO limpia la cola a propósito: recargar es justo el caso para el que existe,
 * y `queueCheck` lo usa para comprobar que lo pendiente se recupera. Quien
 * quiera una recarga sin cola llama a `boot()`.
 */
export async function reload() {
  return anotarJuego(await createGameLoop(USER, () => {}));
}

/**
 * Recargar **con lo que tiene el juego guardado de verdad**, no con lo que se
 * alcance a escribir.
 *
 * `reload()` a secas lee el documento tal y como esté, y `flush()` es una promesa
 * suelta: cuando ha vuelto, la escritura puede no haber llegado. Quien muta el
 * estado y recarga tiene ese hueco, y lo que lee no es la partida que dejó sino
 * la anterior.
 *
 * **ESTO NO ERA COSA TEÓRICA.** El juego programaba un `setTimeout(saveToFirebase,
 * 1200)` al arrancar que —por un error que G6 arregló— se disparaba SIEMPRE, y
 * varios bancos se apoyaban en él sin saberlo: mutaban, recargaban, y el
 * temporizador volcaba por ellos. Al quitarlo, empezaron a fallar **solo y de vez
 * en cuando**, que es la peor forma de fallar: entrena a ignorar el banco entero.
 *
 * **EL ARGUMENTO ES OPCIONAL, Y CUANDO HACE FALTA ES PORQUE EL BANCO NO SIGUE LA
 * CADENA.**
 *
 * Por defecto vuelca "la última partida que arrancó", que es lo correcto en un
 * banco de recorrido: cada apartado **empieza** recargando, así que la última
 * partida es justo la que va a modificar. Y como los bloques son de ámbito, el
 * nombre de la partida anterior ni siquiera está disponible: eso es lo que hace
 * que el valor por defecto sea la única opción que no mira fuera del bloque.
 *
 * Pero hay bancos que **no** siguen la cadena: `playthroughCheck` continúa el
 * apartado 2 desde la partida del minuto cero, no desde la recarga del apartado 1,
 * porque el minuto cero es el objeto del banco entero. Ahí el valor por defecto
 * volcaría una partida intacta y **pisaría con ella todo lo que el apartado ha
 * hecho**. Ahí se pasa el juego a mano, y por eso el parámetro existe.
 *
 * Con eso el fallo es explícito —si te olvidas del argumento en un banco que no
 * sigue la cadena, las comprobaciones fallan— en vez de silencioso.
 */
export async function recargar(g?: { flush: () => void }): Promise<any> {
  const juego = g ?? juegoVivo;
  if (juego) {
    juego.flush();
    await new Promise((r) => setTimeout(r, 30));
  }
  return await reload();
}

/**
 * Borra la cola de nanitas pendientes.
 *
 * Vive aquí y no en el runner porque el problema no era solo entre bancos: cada
 * `boot()` dentro de un mismo banco parte de un documento nuevo, y si la cola
 * de una partida anterior siguiera ahí, `createGameLoop` la adoptaría por ser
 * más reciente y arrancaría con un saldo que el test no ha puesto nunca.
 */
function limpiarCola() {
  try {
    (globalThis as any).localStorage?.clear?.();
  } catch {
    // Sin almacenamiento no hay cola que limpiar.
  }
}

/**
 * Arranca una partida nueva: el documento de `users/test` no existe.
 *
 * **ESTA FUNCIÓN HACIA MENOS QUE `boot()`, Y POR ESO ESTABA ROTA.**
 *
 * `boot()` limpia la cola y **espera dos turnos antes de montar el documento**, por un
 * motivo escrito allí: los bucles de pruebas anteriores siguen vivos, y sin esa espera un
 * guardado en vuelo de una partida que ya no existe escribe encima del documento nuevo.
 * Aquí no se hacía ninguna de las dos cosas.
 *
 * **LO QUE PASÓ, Y POR QUÉ SALIÓ EN OTRO BANCO.** `perfilCheck` añadió una partida montada
 * a mano para probar el recorte de la tarjeta pública, y su bucle se quedó vivo.
 * `playthroughCheck`, que va justo detrás y mide la partida entera de un jugador nuevo,
 * empezó a narrar sin recolector equipado y con el ingreso pasivo a cero: tres pruebas de
 * "nacimiento" que no tienen nada que ver con la tarjeta de perfil. La regla de nacimiento
 * parecía rota y lo único roto era el banco de al lado.
 *
 * **Y ESPERAR EN EL BANCO QUE ENSUCIA NO SIRVE.** El banco que lo deja sucio es este y el
 * que lo sufre es el siguiente, así que la espera tiene que estar aquí, donde se monta el
 * documento.
 */
export async function bootNew() {
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));
  limpiarCola();
  globalThis.__MEM_DB__ = {};
  return anotarJuego(await createGameLoop(USER, () => {}));
}

// --------------------------------------------------------------------------
//  Lecturas del estado
// --------------------------------------------------------------------------

export const s = (g: any) => g.getState();
export const wh = (g: any): any[] => g.getState().warehouse ?? [];
export const ids = (g: any): string[] => wh(g).map((w: any) => w.id);
export const nanites = (g: any): number => g.getState().nanites;
export const deType = (g: any, type: string): number => wh(g).filter((w: any) => w.type === type).length;
export const find = (g: any, id: string): any => wh(g).find((w: any) => w.id === id);

/**
 * LA RAREZA DEL COMPAÑERO DE EJEMPLO, Y POR QUÉ ES COMÚN Y NO ÉPICO.
 *
 * El multiplicador de rareza del compañero se aplica sobre `power`, así que **un
 * compañero Épico de potencia 10 rinde 12**. Con la rareza por defecto en Épico, los
 * bancos de ingreso pasivo dejaron de medir el ingreso: medían el multiplicador.
 * Catorce pruebas se rompieron a la vez por lo mismo, y todas con un número mayor del
 * esperado, que es la firma de un multiplicador nuevo y no de un bug.
 *
 * Un alzamiento de prueba tiene que ser **neutro**: que lo que se mide sea lo que el
 * banco dice medir. Los que si miran la rareza la ponen explicita.
 */
export const RAREZA_NEUTRA = 'Común';

export const ficha = (id: string, tier = 3, over: any = {}) => ({
  id,
  name: `Compañero T${tier}`,
  type: 'passive',
  power: 10,
  rarity: RAREZA_NEUTRA,
  tier,
  ...over
});


/**
 * Cuántas ranuras ocupa el almacén.
 *
 * No es `wh(g).length`: desde `data/stacking` la capacidad se cuenta por GRUPOS,
 * y una pila de 20 llaves ocupa una. Comparar con el largo del array mide una
 * cosa distinta de la que mide la pantalla.
 */
export const ranuras = (g: any): number => countOccupiedSlots(wh(g));

// --------------------------------------------------------------------------
//  Fábricas de items
//
//  Los items se construyen a mano y no con los generadores del juego, porque una
//  prueba tiene que poder afirmar sobre un item exacto: si el generador cambia el
//  daño o el nombre, la prueba mide otra cosa sin avisar.
// --------------------------------------------------------------------------

export const collector = (id: string, tier = 3, over: any = {}) => ({
  id,
  name: `Recolector T${tier}`,
  type: 'collector',
  details: `Recolección por click: +${20 * tier}`,
  rarity: 'Épico',
  tier,
  level: 0,
  damage: 20 * tier,
  sellPrice: 500,
  ...over
});

export const companion = (id: string, tier = 3, over: any = {}) => ({
  id,
  name: `Compañero T${tier}`,
  type: 'companion',
  details: 'Recolección por segundo: +10/s',
  rarity: RAREZA_NEUTRA,
  tier,
  sellPrice: 2000,
  ...over
});

/** El companion de `state.companions` (la ficha que paga pasivo), no el item. */
/**
 * F31 · LAS FÁBRICAS DE ITEMS TOMAN EL NIVEL, NO UN NOMBRE.
 *
 * Antes `crate()` recibía `'common' | 'rare' | 'epic' | 'legendary'` y escribía
 * el nombre con una tabla de cuatro; `key()` y `crystal()` tenían listas de
 * nombres escritas aquí que **no eran las del juego**. Eso son tres copias de
 * datos que el juego ya tiene en `data/items.ts`, y ya se habían separado: el
 * nombre de un cristal en un banco no era el nombre de un cristal en el juego, y
 * con la regla de F26 eso importa —porque un banco que fabrica un cristal que el
 * juego no reconoce mide el fallo equivocado.
 *
 * Ahora las dos que fabrican algo que el juego fabrica leen `CRATE_TYPES` y
 * `CRYSTAL_DEFS`, y la caja escribe el mismo `Caja T{n}` que escribe el juego. Una
 * fábrica que fabrica algo que el juego no fabrica produce bancos que pasan
 * probando un objeto equivocado, y eso es peor que un banco que falla.
 */
export const crate = (id: string, tier = 1, stack = 1, over: any = {}) => ({
  id, name: CRATE_TYPES[tier as CrateType].name, type: 'crate', details: 'x',
  rarity: CRATE_TYPES[tier as CrateType].rarity,
  tier: 0, sellPrice: 125, stackable: true, stackCount: stack, ...over
});

/**
 * Un item apilable que NO se fusiona con el de al lado.
 *
 * Desde `data/stacking` la capacidad se cuenta en RANURAS OCUPADAS, y dos items
 * apilables del mismo tipo y nombre se funden en una sola ranura al cargar
 * (`mergeStacks`). Una prueba que pone tres cajas iguales esperando tres ranuras
 * distintas mide la fusión, no lo que quería. Para "N cosas que ocupan N ranuras"
 * hay que usar items de nombres distintos: es lo que hace `distintos()`.
 */
export const distintos = (n: number, tipo = 'collector') =>
  Array.from({ length: n }, (_, i) =>
    tipo === 'collector'
      ? collector(`r${i}`, 1, { name: `Recolector ${i}` })
      : collector(`r${i}`, 1, { name: `Cosa ${i}` }));

/**
 * Una llave, tal y como la dejaría una partida guardada antes de quitarlas.
 *
 * **EL NOMBRE VA ESCRITO A MANO, Y POR QUÉ ESO ES LO CORRECTO AQUÍ.** El resto de
 * las fábricas leen el nombre de `data/`, porque lo que fabrican lo fabrica el
 * juego hoy y el nombre tiene que ser el de hoy. Una llave **no la fabrica nadie**:
 * es un item de una partida vieja, y lo que hay que comprobar es que la redención
 * lo entienda. Si el nombre saliera de `KEY_DEFS`, el banco estaría probando el
 * objeto contra la definición que lo nombra, y la prueba no diría nada.
 *
 * El nombre literal es exactamente lo que se encuentra en el almacén de una
 * partida de antes, y `keyTierFromName()` —que sigue en el juego solo para esto— es
 * lo que lo resuelve.
 */
export const key = (id: string, name = 'Llave de Cifrado', stack = 1, over: any = {}) => ({
  id, name, type: 'key', details: 'x',
  rarity: 'Común' as any,
  sellPrice: 480, stackable: true, stackCount: stack, ...over
});

/**
 * Un item de cristal como lo tenía una partida guardada antes de que el cristal fuera
 * un recurso. **Solo sirve para probar la redención**: el motor convierte esas pilas en
 * unidades al cargar, así que un banco no puede usarlas para nada más.
 *
 * El precio sale de `valorDeUnCristal(tier) / 4` porque es la regla que había antes —el
 * precio de reventa de un material era un cuarto del de su carta— y para una partida
 * vieja que llegase hasta aquí da igual. La cifra que importa es el nivel, que es lo
 * que la redención lee.
 *
 * El nombre va escrito a mano por el mismo motivo que el de las llaves: lo que
 * interesa es el nombre viejo, y sacarlo de una tabla que ya no existe no probaría
 * nada.
 */
export const crystalViejo = (id: string, tier = 1, stack = 1, over: any = {}) => ({
  id, name: NOMBRES_VIEJOS[tier] ?? CRISTAL_NOMBRE, type: 'crystal', details: 'x',
  rarity: 'Común' as any, tier,
  sellPrice: Math.round(valorDeUnCristal(tier) / 4), stackable: true, stackCount: stack, ...over
});

/** Los diez nombres que tenían los cristales, del más bajo al más alto. */
const NOMBRES_VIEJOS: Record<number, string> = {
  1: 'Cristal de Afino',
  2: 'Cristal de Fase',
  3: 'Cristal de Entropía',
  4: 'Cristal Singular',
  5: 'Cristal Espectral',
  6: 'Cristal Cuántico',
  7: 'Cristal Prisma',
  8: 'Cristal del Vacío',
  9: 'Cristal de la Singularidad',
  10: 'Cristal Primordial'
};

export const consumable = (id: string, buffId: string, stack = 1, over: any = {}) => ({
  id,
  name: over.name ?? 'Consumible',
  type: 'consumable',
  details: 'x',
  rarity: 'Raro',
  tier: 0,
  sellPrice: 2500,
  stackable: true,
  stackCount: stack,
  buffId,
  ...over
});

/**
 * Partida base con los contadores ya en paz con el almacén.
 *
 * Los contadores se derivan del almacén al cargar, así que una partida de test
 * que los traiga descuadrados mide el recorte, no lo que quiere medir.
 */
export function baseSave(items: any[], extra: any = {}) {
  // F31 · Diez niveles de caja y diez de llave. Antes eran cuatro de cada uno, y
  // la caja se adivinaba por el NOMBRE con una cadena de `includes` que era
  // otra copia de la regla del motor. Ahora sale del número, igual que en el
  // juego, así que un banco no puede probar una caja que el juego no recognises.
  const crates: Record<number, number> = {};
  for (const t of CRATE_TIERS) crates[t] = 0;
  let afkCards = 0;

  for (const w of items) {
    if (w.type === 'crate') {
      const m = /caja t(\d+)/.exec((w.name || '').toLowerCase());
      if (!m) continue;
      crates[Number(m[1])] = (crates[Number(m[1])] ?? 0) + (w.stackCount || 1);
    } else if (w.type === 'consumable' && w.buffId === 'afk') {
      afkCards += w.stackCount || 1;
    }
  }

  return {
    // 9, no 7. Con 7 no se cruzaba la redención de las llaves, así que un banco que
    // montaba llaves las tenía en el almacén; y con 9 tampoco se cruzaba la del
    // cristal. El número tiene que estar por encima de las dos migraciones para que
    // `baseSave()` simule una partida actual.
    saveVersion: 9,
    nanites: 1000,
    totalNanitesProduced: 0,
    warehouse: items,
    crates,
    // El cristal es un recurso. **El banco puede pasar la cifra que quiera por
    // `extra`**, que va al final y gana; y si la omite, el motor usa la partida
    // nueva. Lo que **no** se pone es un valor derivado del almacén, porque eso era
    // lo que hacía este sitio antes: el contador se calculaba aquí, en el banco, y el
    // juego lo recalculaba en su sitio, y los dos se separaban.
    afkCards,
    companions: [],
    activeCompanions: [],
    equippedCollectorId: null,
    warehouseCapacity: 30,
    maxCompanionSlots: 3,
    warehouseGaps: [],
    buffs: {
      clickBoostExpiresAt: 0, passiveBoostExpiresAt: 0,
      clickX2ExpiresAt: 0, clickX3ExpiresAt: 0
    },
    nodeLevels: {},
    unlockedNodes: [],
    cores: 0,
    totalCores: 0,
    forgedCount: 0,
    cosmetics: { title: 'title_default', frame: 'frame_none', banner: 'banner_none', unlocked: [] },
    unlockedAchievements: [],
    ...extra
  };
}

// --------------------------------------------------------------------------
//  Dado
// --------------------------------------------------------------------------

/**
 * Ejecuta `fn` con `Math.random` clavado en `valor`.
 *
 * POR QUÉ EXISTE. La sintonización del recolector tira un dado por cada intento
 * y hasta ahora las pruebas solo miraban los RECHAZOS, que son deterministas
 * porque no llegan al dado. La rama del ACIERTO —la que devuelve
 * `{ success: true }`— no la comprobaba ningún banco. Ese hueco es
 * precisamente lo que dejó pasar el bug más gordo que se arregla aquí:
 * `crystalPicker.ts` leía `res.ok` sobre un `{ success }`, que da `undefined`,
 * así que `!undefined` era `true` y TODA sintonización caía en la rama de
 * error. Un acierto pintaba un toast rojo de "error" con el texto "¡Mejora
 * exitosa!" dentro y sonaba el sonido de fallo. Un resultado mal leído no
 * lanza ningún aviso: por eso hacía falta una prueba que lo leyera bien.
 *
 * No es una reimplementación de ninguna regla del juego, que es lo que este kit
 * prohíbe: el umbral lo sigue poniendo `chanceDeSintonizacion()` y el dado lo
 * sigue tirando el game loop. Aquí solo se quita la varianza, que es justo lo
 * que hace que una prueba sea intermitente.
 *
 * **Y CON UN SOLO CRISTAL ESTO ES MÁS SEGURO, NO MENOS.** Antes el umbral
 * dependía del multiplicador del cristal, así que "acertar siempre" y "fallar
 * siempre" no se mortgage guarantee nada: había que mirar el `power` del cristal que
 * tuviera el banco. Ahora la probabilidad depende **solo del nivel**, y sus dos
 * extremos son 95 y 35, así que `0` acierta siempre y `0.999` falla siempre para
 * cualquier nivel. Es la misma razón por la que antes se podía afirmar sin conocer
 * la fórmula, y ahora además es la única.
 */
export function conRoll(valor: number, fn: () => any): any {
  const original = Math.random;
  Math.random = () => valor;
  try {
    return fn();
  } finally {
    Math.random = original;
  }
}

// --------------------------------------------------------------------------
//  Resumen
// --------------------------------------------------------------------------

export function resumen(titulo: string) {
  const mio = rows.splice(0, rows.length);
  const fallos = mio.filter((r) => !r.ok);
  mio.forEach((r) =>
    console.log(`${r.ok ? 'PASA' : 'FALLA'}  ${r.name}${r.detail ? '   [' + r.detail + ']' : ''}`));
  console.log(`\n${mio.length - fallos.length}/${mio.length} pruebas correctas (${titulo})`);
  if (fallos.length) {
    console.log('\nFALLOS:');
    fallos.forEach((r) => console.log('  - ' + r.name + (r.detail ? '  [' + r.detail + ']' : '')));
    process.exitCode = 1;
  }
}
