// What an idea is made of, shared by the server, the command and the page: the values its
// fields may take and how its number is written.
//
//   STATUSES        the kanban's columns, in order: new, considering, to-develop, rejected
//   AUTHORS, KINDS  who wrote it (claude | human) and what it is about (product | engineering)
//   ideaId(n)       12 -> 'I-12', the number as people say it
//   fileName(n, slug)  12 -> 'I-012-<slug>.md', the file under docs/product/ideas/items/

export const STATUSES = ['new', 'considering', 'to-develop', 'rejected']
export const AUTHORS = ['claude', 'human']
export const KINDS = ['product', 'engineering']

export const ideaId = (n) => `I-${n}`
export const fileName = (n, slug) => `I-${String(n).padStart(3, '0')}-${slug}.md`
