// ==========================================================================
//  EL ICONO DEL AVATAR, Y POR QUÉ ES DATO Y NO MARCADO
// ==========================================================================
//
//  Antes el avatar llevaba **las dos primeras letras del nombre**. Se quitó por
//  tres motivos que no son de gusto:
//
//  1. **Las iniciales no son un icono.** "Cy" no significa nada, y en una tabla de
//     clasificación cuarenta filas de "Cy", "Bl", "Ma" y "Zu" son cuarenta filas
//     idénticas. Un avatar que no se diferencia no es identidad.
//  2. **Las iniciales roban el ancho.** En el ranking la columna del identificador
//     compite con las medallas por el espacio, y las iniciales es lo que empuja el
//     nombre a recortarse.
//  3. **Con veinte cosméticos ya escritos, ninguno se veía.** Hay catorce banners,
//     dieciséis marcos y veintitantos títulos, y el único que se veia era un color
//     de fondo detrás de unas letras.
//
//  Así que el icono sale del cosmético: cada uno dice lo que es con su forma. Y hay
//  uno de base para todo el mundo, porque un espacio vacío al empezar se lee como
//  "no tienes nada" cuando en realidad lo que no tienes es un cosmético.
//
//  ESTE MÓDULO ES DATO PURO (R2). Un `switch` en la vista que dibuja el avatar
//  tendría los mismos tres problemas que acabamos de quitar: las iniciales a mano,
//  un color por lado y ninguna forma de comprobarlos.
// ==========================================================================

import type { IconName } from '../ui/icons';

/**
 * Qué icono lleva cada cosmético, y con qué efecto.
 *
 * **EL ICONO SE ESCOGE POR SU FORMA, NO POR SU COLOR.** "Rejilla" es una rejilla
 * porque una rejilla es lo que significa; "Atardecer" es el sol bajo porque es lo que
 * se ve al atardecer. Un icono elegido por parecido de color con el fondo del
 * cosmético —que es lo fácil— no dice nada: se ve el mismo cuadrado de siempre con
 * otro tinte detrás.
 *
 * **Y EL TIPO ES EL DEL ICONARIO, NO UN `string`.** Por una razón práctica: si esto
 * dijera `string`, un icono escrito mal se colaría sin quejarse hasta que se pintara un
 * cuadrado vacío en la cabecera. Con el tipo del iconario, TypeScript avisa **al
 * compilar**, y la fila que hay que añadir es una fila del catálogo de iconos.
 *
 * Y el efecto va por el cosmético, no por su rareza: tres escalones escritos aquí y no
 * en el CSS para que añadir un cosmético sea añadir una fila.
 */
export interface IconoDeCosmetico {
  /** El nombre del icono de `ui/icons.ts`. */
  icono: IconName;
  /** 0 quieto, 1 respira, 2 late y brilla. */
  efecto: 0 | 1 | 2;
}

/**
 * EL ICONO DE BASE.
 *
 * **EXISTE PORQUE "SIN NADA" NO ES UN ESTADO, ES UN HUECO.** Todo el mundo entra
 * con este icono; los cosméticos lo sustituyen. Si el que no tiene nada es una
 * casilla vacía, el jugador nuevo ve un hueco donde debería ver su cara, y el
 * cosmético deja de ser algo que se gana y pasa a ser algo que se rellena.
 *
 * Es un chip: es el componente más pequeño del inventario del juego, y es lo único
 * que todos los jugadores tienen desde el primer segundo.
 */
export const ICONO_BASE: IconoDeCosmetico = { icono: 'chip', efecto: 0 };

const POR_ID: Record<string, IconoDeCosmetico> = {
  // --- Banners ---
  banner_none: ICONO_BASE,
  banner_grid: { icono: 'layers', efecto: 0 },
  banner_sunset: { icono: 'flame', efecto: 1 },
  banner_abyss: { icono: 'core', efecto: 1 },
  banner_toxic: { icono: 'flask', efecto: 1 },
  banner_crimson: { icono: 'warning', efecto: 1 },
  banner_crown: { icono: 'crown', efecto: 2 },
  banner_hidden: { icono: 'lock', efecto: 0 },
  banner_foundry: { icono: 'anvil', efecto: 2 },
  banner_datastorm: { icono: 'bolt', efecto: 2 },
  banner_aurora: { icono: 'sparkle', efecto: 1 },
  banner_spectrum: { icono: 'crystal', efecto: 2 },

  // --- Marcos. Un marco describe el borde, así que su icono es el del material
  //     o del país, no otra vez el del banner: si los dos fueran el mismo icono se
  //     leería como un solo cosmético. ---
  frame_none: ICONO_BASE,
  frame_steel: { icono: 'shield', efecto: 0 },
  frame_neon: { icono: 'bolt', efecto: 1 },
  frame_ember: { icono: 'flame', efecto: 1 },
  frame_void: { icono: 'eye', efecto: 1 },
  frame_gold: { icono: 'medal', efecto: 1 },
  frame_matrix: { icono: 'graph', efecto: 1 },
  frame_oxy: { icono: 'anvil', efecto: 0 },
  frame_quantum: { icono: 'core', efecto: 2 },
  frame_onyx: { icono: 'shield', efecto: 0 },
  frame_legion: { icono: 'medal', efecto: 1 },
  frame_prisma: { icono: 'crystal', efecto: 2 },
  frame_spectrum: { icono: 'sparkle', efecto: 2 },

  // --- Títulos. Un título es lo que el jugador ha hecho, así que su icono es lo
  //     que hizo: forjar, ascender, competir. ---
  title_default: ICONO_BASE,
  title_recruited: { icono: 'user', efecto: 0 },
  title_smith: { icono: 'hammer', efecto: 0 },
  title_smith_master: { icono: 'anvil', efecto: 1 },
  title_ascended: { icono: 'recycle', efecto: 1 },
  title_singularity: { icono: 'core', efecto: 2 },
  title_champion: { icono: 'trophy', efecto: 1 },
  title_legend: { icono: 'crown', efecto: 2 },
  title_ghost: { icono: 'lock', efecto: 0 },
  title_architect: { icono: 'layers', efecto: 1 },
  title_scraplord: { icono: 'trash', efecto: 0 },
  title_burnout: { icono: 'flame', efecto: 1 },
  title_nightshift: { icono: 'clock', efecto: 0 },
  title_signal: { icono: 'bolt', efecto: 1 },
  title_relicario: { icono: 'key', efecto: 0 },
  title_eternidad: { icono: 'core', efecto: 2 },
  title_mil_millones: { icono: 'scale', efecto: 2 },
  title_cantera: { icono: 'anvil', efecto: 1 },
  title_ninguna_bala: { icono: 'shield', efecto: 1 },
  title_custodio: { icono: 'shield', efecto: 1 }
};

/**
 * El icono de un cosmético, y el de base si no lo hay.
 *
 * **NUNCA DEVUELVE NADA.** Es la razón de que exista: una función que devuelve el
 * icono y `undefined` para lo que no conoce obliga a cada sitio que la llama a
 * decidir qué hacer con el hueco, y hay cinco sitios. Con el base aquí dentro, los
 * cinco pintan lo mismo sin tener que saber nada.
 *
 * El orden es **banner, marco, título** y no el que sea: el título es lo más
 * reciente y lo menos informativo —dos letras de un rango—, así que no debe tapar al
 * icono que sí dice qué tienes. Un cosmético sin banner y sin marco cae al base.
 */
export function iconoDeCosmetico(
  cosmetics: { banner?: string; frame?: string; title?: string } | undefined
): IconoDeCosmetico {
  if (!cosmetics) return ICONO_BASE;
  const candidatos = [cosmetics.banner, cosmetics.frame, cosmetics.title];
  for (const id of candidatos) {
    if (!id) continue;
    const encontrado = POR_ID[id];
    if (encontrado) return encontrado;
  }
  return ICONO_BASE;
}

/** Si un id de cosmético tiene icono propio, para los bancos. */
export function tieneIconoPropio(id: string): boolean {
  return !!POR_ID[id];
}

/** El efecto de un cosmético, para los bancos. */
export function efectoDeCosmetico(id: string): 0 | 1 | 2 {
  return POR_ID[id]?.efecto ?? 0;
}