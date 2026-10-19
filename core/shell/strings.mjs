// The shell's UI strings, one set per UI language (see i18n.mjs). English is the default and
// the text the server renders; the page switches to the chosen language in the browser.
// Served at /shell/strings.mjs.

export const SHELL_STRINGS = {
  en: {
    nav: 'Modules',
    noView: 'No module has a view.',
    language: 'Language',
  },
  hu: {
    nav: 'Modulok',
    noView: 'Egyik modulnak sincs nézete.',
    language: 'Nyelv',
  },
}
