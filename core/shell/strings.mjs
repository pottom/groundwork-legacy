// The shell's UI strings, one set per UI language (see i18n.mjs). English is the default and
// the text the server renders; the page switches to the chosen language in the browser.
// Served at /shell/strings.mjs. The modules' taglines (module.<id>.tagline) come from their
// manifests and are added in the page.

export const SHELL_STRINGS = {
  en: {
    nav: 'Modules',
    noView: 'No module has a view.',
    noViewText: 'The modules that show a page get a tab here.',
    language: 'Language',
    theme: 'Theme',
    themeSystem: 'Follow the system',
    themeLight: 'Light',
    themeDark: 'Dark',
    connecting: 'Connecting',
    connectingTitle: 'Connecting to the local server',
    live: 'Live',
    liveTitle: 'The local server sends changes as they happen',
    offline: 'Offline',
    offlineTitle: 'The local server cannot be reached; trying again',
  },
  hu: {
    nav: 'Modulok',
    noView: 'Egyik modulnak sincs nézete.',
    noViewText: 'Az oldallal rendelkező modulok itt kapnak fület.',
    language: 'Nyelv',
    theme: 'Téma',
    themeSystem: 'A rendszert követi',
    themeLight: 'Világos',
    themeDark: 'Sötét',
    connecting: 'Kapcsolódás',
    connectingTitle: 'Kapcsolódás a helyi szerverhez',
    live: 'Élő',
    liveTitle: 'A helyi szerver azonnal küldi a változásokat',
    offline: 'Nincs kapcsolat',
    offlineTitle: 'A helyi szerver nem érhető el; újrapróbálja',
  },
}
