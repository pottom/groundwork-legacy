// The map's Mind Elixir theme, light or dark, following the operating system.
// The colours come from the shell (/shell/theme.css, --gw-*); `css(name)` reads one
// of them as it is now, so a theme built after a switch picks up the new values.

const PALETTES = {
  light: ['#3b82f6', '#10b981', '#ec4899', '#f59e0b', '#8b5cf6', '#06b6d4', '#f97316', '#ef4444'],
  dark:  ['#60a5fa', '#34d399', '#f472b6', '#fbbf24', '#a78bfa', '#22d3ee', '#fb923c', '#f87171'],
}

export function mapTheme({ dark, css, generateSubBranch }) {
  const type = dark ? 'dark' : 'light'
  return {
    name: `grill-${type}`,
    type,
    palette: PALETTES[type],
    generateSubBranch,
    cssVar: {
      '--bgcolor': 'transparent',
      '--color': css('--gw-fg'),
      '--main-color': css('--gw-fg'),
      '--main-bgcolor': css('--gw-surface'),
      '--main-bgcolor-transparent': 'transparent',
      '--root-color': css('--gw-accent-fg'),
      '--root-bgcolor': css('--gw-accent'),
      '--root-border-color': 'transparent',
      '--root-radius': '999px',
      '--main-radius': '999px',
      '--topic-padding': '6px 12px',
      '--node-gap-x': '56px',
      '--node-gap-y': '9px',
      '--main-gap-x': '70px',
      '--main-gap-y': '22px',
      '--selected': css('--gw-accent'),
      '--accent-color': css('--gw-accent'),
      '--panel-color': css('--gw-fg'),
      '--panel-bgcolor': css('--gw-surface'),
      '--panel-border-color': css('--gw-line'),
      '--map-padding': '60px 80px',
    },
  }
}

// Calls apply(dark) now and on every light/dark switch of `scheme`
// (matchMedia('(prefers-color-scheme: dark)')), without a reload.
export function followColorScheme(scheme, apply) {
  apply(scheme.matches)
  scheme.addEventListener('change', (e) => apply(e.matches))
}
