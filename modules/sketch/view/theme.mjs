// Light or dark for the board, as the shell shows it. The one place that knows where that comes
// from: the shell's switch, /shell/theme.js (index.html loads it first), which keeps the user's
// System · Light · Dark choice and exposes the effective theme as window.groundworkTheme.
//
//   followTheme((dark) => ...)   calls back now and on every switch, without a reload

export function followTheme(apply) {
  apply(groundworkTheme.theme === 'dark')
  groundworkTheme.onChange((now) => apply(now === 'dark'))
}
