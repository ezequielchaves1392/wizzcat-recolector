// ==========================================================================
//  Tipos compartidos de los logros, para no arrastrar el array completo al
//  guardado del jugador.
//
//  **EL `AchievementId` ES LA FUENTE Y `ACHIEVEMENTS` LA USA.** Antes el union type
//  listaba los ids a mano y `ACHIEVEMENTS` los repetía: añadir un logro era tocar dos
//  sitios y no hacerlo en los dos no daba error, daba un logro sin bonificación que
//  `ACHIEVEMENT_REWARDS` no paga. Por eso `ACHIEVEMENT_REWARDS` es un `Record` de este
//  mismo union: **un id nuevo sin bonificación no compila.**
// ==========================================================================

/**
 * **LOS LOGROS DIFÍCILES.** Van aparte del union de a propósito, porque son otra cosa:
 * los de abajo son cortos (un logro por sistema) y estos son **lotes**: hay que llegar
 * muy lejos o tener muchos a la vez.
 *
 * Separarlos también evita la trampa de meterlos en el union principal "porque están
 * ahí": el union principal son las tres docenas, y esta lista son las doce que exigen
 * una partida entera.
 *
 * **SUS PREMIOS SON COSMÉTICOS Y NADA MÁS.** Todos dan `0, 0`: su recompensa es el marco
 * o el título, que es lo que escribe el `rewardText`. Añadir un +5 % a cada uno sería tocar
 * la economía en un commit de contenido, y el equilibrio es tuyo.
 */
export type AchievementId =
  | 'first_click'
  | 'collector_10'
  | 'swarm'
  | 'overclocked'
  | 'crate_opener'
  | 'jackpot'
  | 'rich'
  | 'full_squad'
  | 'deep_pockets'
  | 'tycoon'
  // Achievement ids nuevos: crafteo y prestigio
  | 'first_forge'
  | 'smith_25'
  | 'ascendant'
  // Logros secretos
  | 'ghost'
  | 'hidden'
  // Logros difíciles (contenido)
  | 'vault_115'
  | 'perfect_10'
  | 'relicario'
  | 'squad_12'
  | 'cores_10k'
  | 'eternidad'
  | 'mil_millones'
  | 'incesante'
  | 'cantera'
  | 'ninguna_bala'
  | 'doblaje'
  | 'custodio';

/**
 * Los doce difíciles, por id.
 *
 * **POR QUÉ UNA TABLA Y NO SOLO EL union.** El union type no puede llevar comentario de
 * una línea por id sin que sea ilegible, y estas condiciones son las que hay que leer
 * cuando alguien pregunta "por qué este logro es tan difícil". Aquí cabe la explicación
 * entera, y `ACHIEVEMENTS` las consume para no repetirlas.
 */
export const LOGROS_DIFICILES: { id: AchievementId; porQue: string }[] = [
  { id: 'vault_115', porQue: 'La cima de la escalera de expansores: 115 ranuras. Pedir diez expansores seguidos.' },
  { id: 'perfect_10', porQue: '★5 es el 100 % de un item, y tener diez a la vez es una decisión de a qué forjar.' },
  { id: 'relicario', porQue: 'Divino es el tope de rareza y sale de fundir dos ★5.' },
  { id: 'squad_12', porQue: 'Hay 17 ranuras de compañero en el juego y 12 son activas a la vez.' },
  { id: 'cores_10k', porQue: 'Los núcleos son el residuo de la Ascensión: 10.000 son muchas vueltas.' },
  { id: 'eternidad', porQue: 'Veinte ascensiones es reiniciar veinte veces, cada una más cara que la anterior.' },
  { id: 'mil_millones', porQue: 'Un billón de nanitas producidas en total, contando todo el juego.' },
  { id: 'incesante', porQue: 'Cien mil por segundo es ingreso pasivo con la partida madura.' },
  { id: 'cantera', porQue: 'Quinientas cajas, contando las que no sale nada.' },
  { id: 'ninguna_bala', porQue: 'Cien mil clics son días de juego; el juego no regala nada por clic.' },
  { id: 'doblaje', porQue: 'Cinco compañeros multiplicadores a la vez: el pasivo por el doble.' },
  { id: 'custodio', porQue: 'Veinte nodos del árbol comprados entre las cinco ramas.' }
];

/**
 * LA BONIFICACIÓN DE CADA LOGRO, Y POR QUÉ ES UN `Record` Y NO UNA LISTA.
 *
 * Un `Record<AchievementId, …>` obliga a que **todo** id tenga su número: un logro nuevo
 * sin bonificación no compila. Con una lista, forgetting de escribir la entrada era un
 * `undefined` que se colaba en la suma del pasivo, y el síntoma era "el bonus del árbol
 * no cuadra" tres commits más tarde.
 */
export const ACHIEVEMENT_REWARDS: Record<AchievementId, { clickBonus: number; passiveBonus: number }> = {
  first_click: { clickBonus: 0.02, passiveBonus: 0 },
  collector_10: { clickBonus: 0.05, passiveBonus: 0 },
  swarm: { clickBonus: 0, passiveBonus: 0.08 },
  overclocked: { clickBonus: 0.10, passiveBonus: 0 },
  crate_opener: { clickBonus: 0, passiveBonus: 0.12 },
  jackpot: { clickBonus: 0.15, passiveBonus: 0 },
  rich: { clickBonus: 0, passiveBonus: 0.15 },
  full_squad: { clickBonus: 0, passiveBonus: 0.20 },
  deep_pockets: { clickBonus: 0.25, passiveBonus: 0 },
  tycoon: { clickBonus: 0.30, passiveBonus: 0.30 },
  first_forge: { clickBonus: 0.05, passiveBonus: 0 },
  smith_25: { clickBonus: 0.10, passiveBonus: 0.10 },
  ascendant: { clickBonus: 0.20, passiveBonus: 0.20 },
  // Secretos: sin bonificación numérica, el premio es el cosmético
  ghost: { clickBonus: 0, passiveBonus: 0 },
  hidden: { clickBonus: 0, passiveBonus: 0 },
  // ------------------------------ Difíciles: 0, 0. Su premio es el cosmético.
  vault_115: { clickBonus: 0, passiveBonus: 0 },
  perfect_10: { clickBonus: 0, passiveBonus: 0 },
  relicario: { clickBonus: 0, passiveBonus: 0 },
  squad_12: { clickBonus: 0, passiveBonus: 0 },
  cores_10k: { clickBonus: 0, passiveBonus: 0 },
  eternidad: { clickBonus: 0, passiveBonus: 0 },
  mil_millones: { clickBonus: 0, passiveBonus: 0 },
  incesante: { clickBonus: 0, passiveBonus: 0 },
  cantera: { clickBonus: 0, passiveBonus: 0 },
  ninguna_bala: { clickBonus: 0, passiveBonus: 0 },
  doblaje: { clickBonus: 0, passiveBonus: 0 },
  custodio: { clickBonus: 0, passiveBonus: 0 }
};

/** Achievements que otorgan únicamente cosmético: no dan bonificación. */
export const SECRET_ACHIEVEMENTS: AchievementId[] = ['ghost', 'hidden'];

/**
 * Los difíciles **también** son solo cosmético, y esto lo dice el motor y no el comentario.
 *
 * Existe para que la pregunta "¿este logro da algo más que un cosmético?" tenga una
 * respuesta que se pueda comprobar: `sumaDeBonificacion()` suma los `Record` y dice cero.
 * Lo usa el banco, y lo puede usar cualquiera que quiera añadir un +1 % sin que nadie se
 * entere por el camino.
 */
export function sumaDeBonificacion(): { clickBonus: number; passiveBonus: number } {
  let clickBonus = 0;
  let passiveBonus = 0;
  for (const r of Object.values(ACHIEVEMENT_REWARDS)) {
    clickBonus += r.clickBonus;
    passiveBonus += r.passiveBonus;
  }
  return { clickBonus, passiveBonus };
}