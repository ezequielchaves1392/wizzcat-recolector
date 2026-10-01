const THEME_KEY = 'cyberforge_theme';
const DEFAULT_THEME = 'cyber-dark';

export type ThemeName = 'cyber-dark' | 'synthwave' | 'matrix' | 'nature' | 'neon-purple' | 'sunset';

/**
 * Los temas que se ofrecen en cualquier selector.
 *
 * Vivían solo dentro de `ui/layout.ts`, y el selector del login tenía su propia
 * copia con emojis. Dos listas que se desincronizan: al añadir un tema, la
 * cabecera lo ofrecía y el acceso no. Ahora las dos leen de aquí.
 *
 * `tone` es el color con el que el tema se presenta en los selectores. No se
 * puede deducir de `--accent` porque el accent se reescribe en vivo al cambiar
 * de tema, y un `<option>` necesita un color literal: no hay forma de leer una
 * variable de CSS desde el atributo `style` de una opción nativa.
 */
export const THEMES: Array<{ value: ThemeName; label: string; tone: string }> = [
  { value: 'cyber-dark', label: 'Cyber Dark', tone: '#38bdf8' },
  { value: 'synthwave', label: 'Synthwave', tone: '#ff5ea8' },
  { value: 'matrix', label: 'Matrix', tone: '#34d399' },
  { value: 'neon-purple', label: 'Neón Púrpura', tone: '#c084fc' },
  { value: 'sunset', label: 'Sunset', tone: '#fb923c' },
  { value: 'nature', label: 'Naturaleza', tone: '#16a34a' }
];

export function getSavedTheme(): ThemeName {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === 'cyber-dark' || saved === 'synthwave' || saved === 'matrix' || saved === 'nature' || saved === 'neon-purple' || saved === 'sunset') {
    return saved;
  }
  return DEFAULT_THEME;
}

export function setTheme(themeName: ThemeName): void {
  localStorage.setItem(THEME_KEY, themeName);
  document.body.setAttribute('data-theme', themeName);
}

export function applyTheme(themeName: ThemeName): void {
  document.body.setAttribute('data-theme', themeName);
}