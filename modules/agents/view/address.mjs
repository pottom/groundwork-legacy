// The page's address: the open agent or session, the one a link marked, and the branch row a link
// points to. Plain functions, no imports.
//
//   readAddress({ search, hash }) -> { open, focus, branch }
//     open: { session, agent } (agent null for a session), null when nothing is open, or undefined
//           when the address names a branch row instead (the page keeps what it has open)
//       - #agent=<session>/<agent> or #agent=<session>: what the page opened;
//       - else, with no hash, ?agent=<session>/<agent> or ?agent=<session>: Build's "being worked
//         on" link (the shell passes a deep link's query on, not its hash)
//     focus: the agent (or session) id that link marks, until the page opens another; else null
//     branch: the branch of #branch=<name>, else null
//   agentHash({ session, agent }) -> '#agent=<session>/<agent>' | '#agent=<session>'
//   branchHash(name) -> '#branch=<name>', encoded

const AGENT = /^([\w-]{1,60})(?:\/([\w-]{1,60}))?$/

const parse = (value) => {
  const m = AGENT.exec(value ?? '')
  return m ? { session: m[1], agent: m[2] ?? null } : null
}

export function readAddress({ search = '', hash = '' }) {
  if (hash.startsWith('#branch=')) {
    let branch = null
    try { branch = decodeURIComponent(hash.slice('#branch='.length)) } catch { /* a broken escape: no branch */ }
    return { open: undefined, focus: null, branch: branch || null }
  }
  if (hash.startsWith('#agent=')) return { open: parse(hash.slice('#agent='.length)), focus: null, branch: null }
  if (hash) return { open: null, focus: null, branch: null }
  let asked = null
  try { asked = new URLSearchParams(search).get('agent') } catch { /* no query */ }
  const open = parse(asked)
  return { open, focus: open ? open.agent ?? open.session : null, branch: null }
}

export const agentHash = ({ session, agent }) => `#agent=${session}${agent ? '/' + agent : ''}`

export const branchHash = (name) => '#branch=' + encodeURIComponent(name)
