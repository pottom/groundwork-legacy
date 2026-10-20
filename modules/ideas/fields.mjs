// What an idea is made of, shared by the server, the command and the page: the values its
// fields may take and how its number is written.
//
//   STATUSES        the kanban's columns, in order: new, considering, accepted, rejected, snoozed, duplicate
//   AUTHORS, KINDS  who wrote it (claude | human) and what it is about (product | engineering)
//   LEVELS          an impact or effort estimate: low, medium, high (or none yet)
//   CLI_STATUSES    the columns Claude (the command line) may move an idea between: new, considering;
//                   the record store enforces it on every write
//   STATE_FIELDS    the field a status needs: rejected a reason, snoozed until (a date), duplicate the
//                   idea it duplicates (I-n)
//   ROUTES          the ways an accepted idea goes on (d-route-choice): grilling (a change, interviewed
//                   first) or ticket (straight to a ticket); the core's record store takes them
//                   (core/records/accept.mjs)
//   routeFor(idea)  the route the board offers first, by the idea's kind: product -> grilling,
//                   engineering -> ticket; the human chooses
//   ideaId(n)       12 -> 'I-12', the number as people say it
//   fileName(n, slug)  12 -> 'I-012-<slug>.md', the file under docs/product/ideas/

export const STATUSES = ['new', 'considering', 'accepted', 'rejected', 'snoozed', 'duplicate']
export const AUTHORS = ['claude', 'human']
export const KINDS = ['product', 'engineering']
// An estimate of impact and of effort: one of these, or none yet.
export const LEVELS = ['low', 'medium', 'high']
// The columns the command line (so Claude) may move an idea between; the others are the human's
// decision, made in the browser (d-ideas-ai-limits).
export const CLI_STATUSES = ['new', 'considering']
export const STATE_FIELDS = { rejected: 'reason', snoozed: 'until', duplicate: 'duplicate' }

export const ROUTES = ['grilling', 'ticket']
export const routeFor = (idea) => (idea?.kind === 'engineering' ? 'ticket' : 'grilling')

export const ideaId = (n) => `I-${n}`
export const fileName = (n, slug) => `I-${String(n).padStart(3, '0')}-${slug}.md`
