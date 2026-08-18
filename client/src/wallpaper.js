export const WALLPAPERS = [
  { id: 'default', name: 'Default', css: null },
  { id: 'lavender-mist', name: 'Lavender Mist', css: 'linear-gradient(135deg, #a18cd1, #fbc2eb)' },
  { id: 'ocean-breeze', name: 'Ocean Breeze', css: 'linear-gradient(135deg, #7fb4e8, #cfe8f7)' },
  { id: 'sunset-glow', name: 'Sunset Glow', css: 'linear-gradient(135deg, #f4b26b, #ffe0b8)' },
  { id: 'forest-calm', name: 'Forest Calm', css: 'linear-gradient(135deg, #8ecb84, #d9f0d4)' },
  { id: 'midnight', name: 'Midnight', css: 'linear-gradient(135deg, #1a1330, #0f0c1d)' },
  { id: 'solid-cream', name: 'Solid Cream', css: 'linear-gradient(#f4f1ea, #f4f1ea)' },
];

const STORAGE_KEY = 'lavender-wallpapers';

function readAll() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

export function getWallpaper(chatId) {
  if (!chatId) return null;
  const all = readAll();
  return all[chatId] || null;
}

export function setWallpaperFor(chatId, css) {
  if (!chatId) return;
  const all = readAll();
  if (css) all[chatId] = css;
  else delete all[chatId];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {}
}
