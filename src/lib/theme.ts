export type Theme = 'dark' | 'light'

const STORAGE_KEY = 'slate-theme'

// Site default is the calm light theme; dark stays available via the toggle.
export function getTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  return localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light'
}

export function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme)
  localStorage.setItem(STORAGE_KEY, theme)
}

/** Call once on app boot (before the first paint) to avoid a flash of the wrong theme. */
export function initTheme() {
  applyTheme(getTheme())
}

export function toggleTheme(): Theme {
  const next: Theme = getTheme() === 'light' ? 'dark' : 'light'
  applyTheme(next)
  return next
}
