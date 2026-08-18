export const THEMES = [
  { id: 'lavender', name: 'Lavender', accent: '#9d7bd8', accentDark: '#7c5cb8', accentLight: '#f3ecff', gradStart: '#a18cd1', gradEnd: '#fbc2eb' },
  { id: 'rose',     name: 'Rose',     accent: '#e0699a', accentDark: '#c14c7c', accentLight: '#fdf0f5', gradStart: '#f4a5c6', gradEnd: '#fdd9e3' },
  { id: 'ocean',    name: 'Ocean',    accent: '#4f93cf', accentDark: '#3672a8', accentLight: '#eaf3fb', gradStart: '#7fb4e8', gradEnd: '#cfe8f7' },
  { id: 'forest',   name: 'Forest',   accent: '#5da357', accentDark: '#437c3d', accentLight: '#eef7ec', gradStart: '#8ecb84', gradEnd: '#d9f0d4' },
  { id: 'sunset',   name: 'Sunset',   accent: '#d97e33', accentDark: '#b3631f', accentLight: '#fdf1e5', gradStart: '#f4b26b', gradEnd: '#ffe0b8' },
];

const STORAGE_KEY = 'lavender-theme';

export function getStoredThemeId() {
  try {
    return localStorage.getItem(STORAGE_KEY) || THEMES[0].id;
  } catch {
    return THEMES[0].id;
  }
}

const DARK_STORAGE_KEY = 'lavender-dark-mode';

export function getStoredDarkMode() {
  try {
    return localStorage.getItem(DARK_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function applyDarkMode(enabled) {
  document.documentElement.classList.toggle('dark', enabled);
  try {
    localStorage.setItem(DARK_STORAGE_KEY, enabled ? 'true' : 'false');
  } catch {}
  return enabled;
}

export function applyTheme(id) {
  const theme = THEMES.find((t) => t.id === id) || THEMES[0];
  const root = document.documentElement;
  root.style.setProperty('--accent', theme.accent);
  root.style.setProperty('--accent-dark', theme.accentDark);
  root.style.setProperty('--accent-light', theme.accentLight);
  root.style.setProperty('--grad-start', theme.gradStart);
  root.style.setProperty('--grad-end', theme.gradEnd);
  try {
    localStorage.setItem(STORAGE_KEY, theme.id);
  } catch {}
  return theme.id;
}
