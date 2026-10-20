// @ts-check
// The record store of a project, as everything outside the tests opens it: with the record types of
// every module and the core's own (changes and milestones, changes.mjs: CORE_RECORDS). Opened with
// fewer, an id of a missing type is a plain id, so a link to C-2 would not resolve.
//
//   const store = openProjectRecords(root, { modules?, today? })   modules: the registry by default
//   store.forModule(manifest)                                       what a module gets (store.mjs)

import { MODULES } from '../modules.mjs'
import { openRecords } from './store.mjs'
import { CORE_RECORDS } from './changes.mjs'

/**
 * @param {string} root
 * @param {{ modules?: Array<{ id: string, records?: import('./types.mjs').RecordType[] }>, today?: () => string }} [options]
 */
export function openProjectRecords(root, { modules = MODULES, today } = {}) {
  return openRecords(root, [...modules, CORE_RECORDS], today ? { today } : {})
}
