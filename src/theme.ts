const THEME_KEY = 'cyberforge_theme';
const DEFAULT_THEME = 'cyber-dark';

export type ThemeName = 'cyber-dark' | 'synthwave' | 'matrix' | 'nature' | 'neon-purple' | 'sunset';

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