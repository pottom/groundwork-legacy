// The UI language of Plan's page: the core's translation (/shell/i18n.mjs) with Plan's strings
// (../ui-strings.mjs), chosen in the shell. Not the documents' language (../doc-strings.mjs).
//   ui(key, vars)   the text in the current language
//   clock()         the time of day, for "Saved 18:49"

import { createI18n } from '/shell/i18n.mjs'
import { UI_STRINGS } from '../ui-strings.mjs'

export const i18n = createI18n(UI_STRINGS)
export const ui = i18n.t
// A key has a text of its own (a document kind the UI does not name falls back to the document's).
export const hasText = (key) => key in UI_STRINGS.en
export const clock = () => new Date().toLocaleTimeString(i18n.lang, { hour: '2-digit', minute: '2-digit' })
