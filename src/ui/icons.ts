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
  weapon: svg('<path d="M14.5 3.5 20 9l-2 2-1.5-1.5-6 6L8 18l-2.5.5L6 16l1.5-3.5-2-2L4 9"/><path d="M9 12l3 3"/>'),
  companion: svg('<rect x="4" y="7" width="16" height="12" rx="3"/><path d="M12 7V4"/><circle cx="9" cy="13" r="1.2" fill="currentColor"/><circle cx="15" cy="13" r="1.2" fill="currentColor"/><path d="M9.5 16.5h5"/>'),
  crate: svg('<path d="M3 8.5 12 4l9 4.5v7L12 20l-9-4.5v-7Z"/><path d="M3 8.5 12 13l9-4.5"/><path d="M12 13v7"/>'),
  achievement: svg('<circle cx="12" cy="9" r="5"/><path d="m8.5 13.5-1.5 7 5-2.5 5 2.5-1.5-7"/>'),
  chip: svg('<rect x="7" y="7" width="10" height="10" rx="2"/><path d="M10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4"/>'),
  gear: svg('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"/>'),

  // Acciones
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  check: svg('<path d="m5 13 4 4 10-10"/>'),
  trash: svg('<path d="M4 7h16"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><path d="M6 7v13a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7"/>'),
  info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><circle cx="12" cy="8" r=".6" fill="currentColor"/>'),
  warning: svg('<path d="M12 4 2.5 20h19L12 4Z"/><path d="M12 10v4"/><circle cx="12" cy="17" r=".6" fill="currentColor"/>'),
  sparkle: svg('<path d="M12 3v5M12 16v5M3 12h5M16 12h5"/><path d="M6.5 6.5 9 9M15 15l2.5 2.5M17.5 6.5 15 9M9 15l-2.5 2.5"/>'),
  sound: svg('<path d="M4 9v6h4l5 4V5L8 9H4Z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/><path d="M19 6a8.5 8.5 0 0 1 0 12"/>'),
  mute: svg('<path d="M4 9v6h4l5 4V5L8 9H4Z"/><path d="m17 10 4 4M21 10l-4 4"/>')
} as const;

export type IconName = keyof typeof ICONS;

/** Devuelve el marcado del icono listo para insertar. */
export function icon(name: IconName, className = 'w-4 h-4'): string {
  return `<span class="inline-flex ${className}">${ICONS[name]}</span>`;
}

/** Atajo para usar dentro de plantillas: `html`${icon('bolt')}`` */
export function ic(name: IconName, className = 'w-4 h-4') {
  return icon(name, className);
}
