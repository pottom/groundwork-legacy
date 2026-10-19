// Light or dark for the board, as the shell shows it. The one place that knows where that comes
// from: today the OS (prefers-color-scheme), the same as the shell's theme.css.
//
//   followTheme((dark) => ...)   calls back now and on every switch, without a reload

export function followTheme(apply) {
  const scheme = matchMedia('(prefers-color-scheme: dark)')
  apply(scheme.matches)
  scheme.addEventListener('change', (e) => apply(e.matches))
}
