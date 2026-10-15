import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'lsa.theme';
const THEMES = ['system', 'light', 'dark'];

function readStoredTheme() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return THEMES.includes(stored) ? stored : 'system';
  } catch {
    return 'system';
  }
}

/** Applies light/dark/system by setting `data-theme` on <html>. */
export function useTheme() {
  const [theme, setThemeState] = useState(readStoredTheme);

  useEffect(() => {
    const root = document.documentElement;

    if (theme === 'system') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', theme);
    }

    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Storage may be unavailable in private mode; theming still works.
    }
  }, [theme]);

  const setTheme = useCallback(next => {
    if (THEMES.includes(next)) setThemeState(next);
  }, []);

  // The concrete theme actually in effect, for labeling the active option.
  const resolved =
    theme === 'system'
      ? window.matchMedia?.('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : theme;

  return { theme, resolved, setTheme, themes: THEMES };
}
