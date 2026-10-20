// The UI language of the Changes page: the core's translation (/shell/i18n.mjs) with the module's
// strings (../ui-strings.mjs), chosen in the shell.
//   ui(key, vars)   the text in the current language

import { createI18n } from '/shell/i18n.mjs'
import { UI_STRINGS } from '../ui-strings.mjs'

export const i18n = createI18n(UI_STRINGS)
export const ui = i18n.t
