// Set de iconos en SVG inline.
//
// Se generan en código en lugar de descargar un set externo: sin peticiones de
// red, sin dependencia de terceros, herenan `currentColor` y pesan nada.
// Todos comparten `stroke-width: 1.75` y el trait `currentColor` para que el
// estilo se controle desde el color del texto.

const svg = (paths: string, viewBox = '0 0 24 24') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="shrink-0">${paths}</svg>`;

export const ICONS = {
  // Navegación
  warehouse: svg('<path d="M3 9.5 12 4l9 5.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5Z"/><path d="M9 21v-7h6v7"/>'),
  store: svg('<path d="M4 8h16l-1 3a3 3 0 0 1-5.5 1.6A3 3 0 0 1 12 13a3 3 0 0 1-1.5-.4A3 3 0 0 1 5 11L4 8Z"/><path d="M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7"/><path d="M10 20v-5h4v5"/>'),
  // Trofeo / posicion en el ranking
  podium: svg('<path d="M7 4h10v5a5 5 0 0 1-10 0V4Z"/><path d="M7 6H4v1a3 3 0 0 0 3 3"/><path d="M17 6h3v1a3 3 0 0 1-3 3"/>'),
  trophy: svg('<path d="M7 4h10v5a5 5 0 0 1-10 0V4Z"/><path d="M7 6H4v1a3 3 0 0 0 3 3"/><path d="M17 6h3v1a3 3 0 0 1-3 3"/><path d="M12 14v3"/><path d="M9 20h6"/><path d="M10 17h4l.5 3h-5l.5-3Z"/>'),
  power: svg('<path d="M12 3v9"/><path d="M6.6 6.6a8 8 0 1 0 10.8 0"/>'),
  menu: svg('<path d="M4 7h16M4 12h16M4 17h16"/>'),
  close: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
  back: svg('<path d="M15 5l-7 7 7 7"/>'),
  chevronDown: svg('<path d="M6 9l6 6 6-6"/>'),

  // Estado y recursos
  nanite: svg('<path d="M13 3 4 14h7v7l9-11h-7V3Z"/>'),
  bolt: svg('<path d="M11 3 5 13h5v8l7-10h-5l-1-8Z" fill="currentColor" stroke="none"/>'),
  crystal: svg('<path d="M12 2 6 9l6 13 6-13-6-7Z"/><path d="M6 9h12"/><path d="M12 2v20"/>'),
  key: svg('<circle cx="8" cy="14" r="4"/><path d="M11 11l8-8"/><path d="M17 5l2 2"/><path d="M15 7l2 2"/>'),
  clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>'),
  shield: svg('<path d="M12 3 5 6v6c0 4.5 3 7.7 7 9 4-1.3 7-4.5 7-9V6l-7-3Z"/>'),
  card: svg('<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18"/>'),
  globe: svg('<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18Z"/>'),

  // Colección
  collector: svg('<path d="M14.5 3.5 20 9l-2 2-1.5-1.5-6 6L8 18l-2.5.5L6 16l1.5-3.5-2-2L4 9"/><path d="M9 12l3 3"/>'),
  companion: svg('<rect x="4" y="7" width="16" height="12" rx="3"/><path d="M12 7V4"/><circle cx="9" cy="13" r="1.2" fill="currentColor"/><circle cx="15" cy="13" r="1.2" fill="currentColor"/><path d="M9.5 16.5h5"/>'),
  crate: svg('<path d="M3 8.5 12 4l9 4.5v7L12 20l-9-4.5v-7Z"/><path d="M3 8.5 12 13l9-4.5"/><path d="M12 13v7"/>'),
  achievement: svg('<circle cx="12" cy="9" r="5"/><path d="m8.5 13.5-1.5 7 5-2.5 5 2.5-1.5-7"/>'),
  chip: svg('<rect x="7" y="7" width="10" height="10" rx="2"/><path d="M10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4"/>'),
  wrench: svg('<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-8 8l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 8-8l-3.8 3.8Z"/>'),

  // LA TUERCA DE AJUSTES, Y POR QUÉ NO EL ENGRANAJE.
  //
  // `gear` es un círculo con ocho radios, y a 18 px eso no se lee como un engranaje: se
  // lee como un sol o como una estrella. La tuerquita sí se lee, porque tiene la silueta
  // asimétrica que el ojo ya reconoce —una boca abierta arriba y un mango que baja en
  // diagonal— y esa asimetría es justo lo que la hace legible a ese tamaño, donde un
  // engranaje simétrico se convierte en una mancha.
  //
  // Y además dice lo que hace: un engranaje sugiere una máquina con muchas piezas que se
  // ajustan entre sí, que es la lectura de un panel interno. Una tuerquita es lo que
  // coges para apretar un tornillo.
  //
  // Se deja `gear` en la tabla: hay cosas que sí son engranaje.
  gear: svg('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"/>'),

  // Destino, identidad y progresión
  user: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
  anvil: svg('<path d="M3 9h7l3 3h8"/><path d="M3 9v3h6"/><path d="M6 12v3a3 3 0 0 0 3 3h6l2-6"/><path d="M8 21h8"/>'),
  tree: svg('<circle cx="12" cy="5" r="2.5"/><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M12 7.5 6 15.5M12 7.5l6 8M8.5 18h7"/>'),
  layers: svg('<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5"/><path d="m3 17.5 9 5 9-5"/>'),
  crown: svg('<path d="M4 8l3.5 3L12 5l4.5 6L20 8l-1.5 10h-13L4 8Z"/><path d="M5.5 21h13"/>'),
  medal: svg('<circle cx="12" cy="15" r="5"/><path d="m8.5 10.5-3-7.5h4l2 5M15.5 10.5l3-7.5h-4l-2 5"/><path d="m12 13 .9 1.8 2 .3-1.4 1.4.3 2-1.8-1-1.8 1 .3-2L9.1 15l2-.3L12 13Z"/>'),
  recycle: svg('<path d="M7 7h3l-2.5-2.5"/><path d="M4 9a8 8 0 0 1 13.5-3"/><path d="M17 17h-3l2.5 2.5"/><path d="M20 15a8 8 0 0 1-13.5 3"/>'),
  core: svg('<circle cx="12" cy="12" r="3.2"/><circle cx="12" cy="12" r="8"/><path d="M12 1.5v2.5M12 20v2.5M1.5 12H4M20 12h2.5"/>'),
  graph: svg('<path d="M4 19V5"/><path d="M4 19h16"/><path d="m7 15 3.5-4 3 2.5L20 7"/>'),
  // La balanza de la valoracion: un poste, el fiel y dos platos. Se eligio esta y no
  // un grafico porque el bloque explica **cuanto vale** el item, no como sube su valor.
  scale: svg('<path d="M12 4v16"/><path d="M5 7h14"/><path d="M7 20h10"/><path d="M5 7 2 14h6L5 7Z"/><path d="M19 7l-3 7h6l-3-7Z"/>'),
  flask: svg('<path d="M10 3h4"/><path d="M10.5 3v6L5 19a1.5 1.5 0 0 0 1.3 2.2h11.4A1.5 1.5 0 0 0 19 19l-5.5-10V3"/><path d="M8 15h8"/>'),
  hammer: svg('<path d="m14 5 5 5"/><path d="m12.5 6.5 5 5"/><path d="M17.5 3.5 21 7l-2 2-3.5-3.5 2-2Z"/><path d="m11 8-8 8 4 4 8-8"/>'),
  scroll: svg('<path d="M6 4h11a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M5 6a2 2 0 0 0-2 2v1h4"/><path d="M9 9h7M9 13h7M9 17h4"/>'),
  lock: svg('<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>'),
  unlock: svg('<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 7.5-2"/>'),
  drag: svg('<circle cx="9" cy="6" r="1.4" fill="currentColor" stroke="none"/><circle cx="15" cy="6" r="1.4" fill="currentColor" stroke="none"/><circle cx="9" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="9" cy="18" r="1.4" fill="currentColor" stroke="none"/><circle cx="15" cy="18" r="1.4" fill="currentColor" stroke="none"/>'),
  arrowUp: svg('<path d="M12 19V5"/><path d="m5 12 7-7 7 7"/>'),
  eye: svg('<path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z"/><circle cx="12" cy="12" r="2.8"/>'),
  flame: svg('<path d="M12 3s5 4 5 9a5 5 0 0 1-10 0c0-2 1-3 1-3s1 2 2 2c1.5 0 1-4 2-8Z"/>'),
  snow: svg('<path d="M12 2v20M2 12h20"/><path d="m5 5 14 14M19 5 5 19"/>'),

  // Acciones
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  check: svg('<path d="m5 13 4 4 10-10"/>'),
  trash: svg('<path d="M4 7h16"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><path d="M6 7v13a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7"/>'),
  info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><circle cx="12" cy="8" r=".6" fill="currentColor"/>'),
  warning: svg('<path d="M12 4 2.5 20h19L12 4Z"/><path d="M12 10v4"/><circle cx="12" cy="17" r=".6" fill="currentColor"/>'),
  sparkle: svg('<path d="M12 3v5M12 16v5M3 12h5M16 12h5"/><path d="M6.5 6.5 9 9M15 15l2.5 2.5M17.5 6.5 15 9M9 15l-2.5 2.5"/>'),
  grid: svg('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>'),
  monitor: svg('<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>'),
  star: svg('<path d="m12 2 3 6.5 7 .8-5.2 4.7 1.5 6.9L12 17.3 5.7 21l1.5-7L2 9.3l7-.8L12 2Z"/>'),
  // Iconos de los marcos ("iconos de perfil"). Uno por nombre del catálogo, con
  // la forma que el ojo reconoce antes que el color: átomo, gema, prisma...
  atom: svg('<circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><ellipse cx="12" cy="12" rx="9.5" ry="4" transform="rotate(0 12 12)"/><ellipse cx="12" cy="12" rx="9.5" ry="4" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="9.5" ry="4" transform="rotate(120 12 12)"/>'),
  gem: svg('<path d="M5 4h14l3 5-10 11L2 9l3-5Z"/><path d="M2 9h20"/><path d="M12 20 8 9l4-5 4 5-4 11"/>'),
  prism: svg('<path d="M12 4 4 20h16L12 4Z"/><path d="M2 11h7"/><path d="M15.5 9.5 22 7M16 12h6M15.5 14.5 22 17"/>'),
  rain: svg('<path d="M7 3v5M7 11v4M7 18v3M12 4v6M12 13v3M12 19v2M17 3v4M17 10v5M17 18v3"/>'),
  spectrum: svg('<path d="M2 19a10 10 0 0 1 20 0"/><path d="M6 19a6 6 0 0 1 12 0"/><path d="M10 19a2 2 0 0 1 4 0"/>'),
  hexagon: svg('<path d="M12 2 4 6.6v10.8L12 22l8-4.6V6.6L12 2Z"/><path d="M12 2v20M4 6.6l16 10.8M20 6.6 4 17.4"/>'),
  // Audio. `sound` es el altavoz (efectos) y `music` la nota (pista): los
  // dos interruptores de la cabecera necesitan icons que se distingan de un
  // vistazo en movil, donde no cabe la etiqueta de texto.
  sound: svg('<path d="M4 9v6h4l5 4V5L8 9H4Z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/><path d="M19 6a8.5 8.5 0 0 1 0 12"/>'),
  // Nota musical doble: dos corcheas, la forma que todo el mundo asocia con
  // "esto es musica" y no con "esto suena".
  music: svg('<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>'),
  // Salir de la sesion
  logout: svg('<path d="M14 4H7a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h7"/><path d="M17 8l4 4-4 4"/><path d="M21 12H10"/>'),
  mute: svg('<path d="M4 9v6h4l5 4V5L8 9H4Z"/><path d="m17 10 4 4M21 10l-4 4"/>')
} as const;



export type IconName = keyof typeof ICONS;

/**
 * Resuelve un nombre que puede venir de datos guardados, no del código.
 *
 * El caso real: los logros traían un emoji en el campo `icon` (`'⚡'`) y se
 * pintaban con `ic(ach.icon)`. Como un emoji no es una clave del set, la
 * búsqueda devolvía `undefined` y el HTML resultante llevaba literalmente la
 * palabra "undefined" dentro del `<span>`, en mitad de la tarjeta.
 *
 * Por eso esta función NO falla nunca: si el nombre no existe devuelve el
 * icono de interrogación. Un dato raro se ve raro; nunca rompe la pantalla.
 */
export function resolveIcon(name: unknown): IconName {
  if (typeof name !== 'string') return 'sparkle';
  const limpio = name.trim() as IconName;
  return limpio in ICONS ? limpio : 'sparkle';
}

/** Igual que `icon()`, pero acepta nombres venidos de datos y nunca falla. */
export function icon(name: IconName, className = 'w-4 h-4'): string {
  return `<span class="inline-flex ${className}">${ICONS[name]}</span>`;
}

/** Atajo para usar dentro de plantillas: `html`${ic('bolt')}`` */
export function ic(name: IconName, className = 'w-4 h-4') {
  return icon(name, className);
}

/** Versión tolerante a datos externos. Es la que debe usarse con `icon:` de logros. */
export function icSafe(name: unknown, className = 'w-4 h-4') {
  return icon(resolveIcon(name), className);
}
