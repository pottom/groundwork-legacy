// Where a record chip leads, without the browser: shared by the chip (record-chip.mjs) and its test.
// Served at /shell/record-link.mjs.
//
//   recordHref(link)   the shell's deep link of a record: '/?module=<module>&<name>=<id>' (the Ideas
//                      page opens ?idea=I-5), from a resolved link of the record store ({ id, name,
//                      module }, core/records/types.mjs: ResolvedLink); null for the core's own types
//                      (a milestone has no page yet) and for an id no module declares (a plain id)
//   chipTitle(link)    'I-5 · Redesign', or the id alone

/** @param {{ id: string, name?: string, module?: string }} link */
export function recordHref({ id, name, module }) {
  if (!name || !module || module === 'core') return null
  return `/?module=${encodeURIComponent(module)}&${encodeURIComponent(name)}=${encodeURIComponent(id)}`
}

/** @param {{ id: string, title?: string }} link */
export const chipTitle = ({ id, title }) => (title ? `${id} · ${title}` : id)
