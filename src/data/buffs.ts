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
  passiveBoost: 'passiveBoostExpiresAt'
} as const;

export type BuffKey = keyof typeof BUFF_FIELDS | 'afk';