// @ts-check
// The record store's types, for the type check only (`npm run typecheck`, tsc --noEmit on JSDoc):
// nothing here runs. Modules declare RecordType in their manifest's `records` field.

/**
 * Who makes a write. The browser is the human; the command line is Claude.
 * @typedef {'human' | 'claude'} Actor
 */

/**
 * A field value: a string, or a list for the type's list fields.
 * @typedef {string | string[]} FieldValue
 * @typedef {Record<string, FieldValue>} Fields
 */

/**
 * What the Markdown of a record holds (format.mjs).
 * @typedef {Object} RecordText
 * @property {string | null} id         'I-5'; null when the front matter has none
 * @property {Fields} fields            the front matter but the id
 * @property {string} body              free Markdown, trimmed
 * @property {string[]} history         'date · who · what', oldest first
 * @property {string[]} [stray]         front-matter lines that are not `key: value`, kept as written
 */

/**
 * How a type's fields are written.
 * @typedef {Object} RecordFormat
 * @property {string[]} fields          the front-matter order after the id
 * @property {string[]} [lists]         the fields written as a comma list
 */

/**
 * The lifecycle of a type: its states, and the ones Claude may move between.
 * @typedef {Object} Lifecycle
 * @property {string} field             the field that holds the state ('status')
 * @property {string[]} states          every state, in order
 * @property {string} initial           the state of a new record
 * @property {string[]} claude          the states Claude may move a record between
 */

/**
 * What a type's rules get besides the fields.
 * @typedef {Object} RuleContext
 * @property {Fields | null} before     the fields as they were; null for a new record
 * @property {string | null} id         the record's id; null for a new record
 * @property {Actor} by
 * @property {string} today             'YYYY-MM-DD'
 * @property {(id: string) => boolean} exists   whether a record with that id exists
 */

/**
 * A record type, as a module declares it in its manifest's `records` field.
 * @typedef {Object} RecordType
 * @property {string} prefix            'I': ids are I-<n>, files I-<nnn>-<slug>.md
 * @property {string} name              'idea'
 * @property {string} folder            where its files live, under docs/product/ ('docs/product/ideas')
 * @property {string[]} fields          the front-matter order after the id
 * @property {string[]} [lists]         the fields written as a comma list
 * @property {string[]} [links]         the fields that refer to other records (history, reverse links)
 * @property {string} [slugFrom]        the field the file name's slug comes from (default 'title')
 * @property {Lifecycle} lifecycle
 * @property {(next: Fields, ctx: RuleContext) => Fields} [rules]   checks and tidies the fields of a
 *                                      write; throws to refuse it
 * @property {(id: string) => string} [template]   the body of a new record created without one
 * @property {(body: string) => object} [outline]   what the body holds, read for show() (a change's
 *                                      sections and proposed items); never written
 */

/**
 * An item a change proposes for the Spec: `- add \`d-x\` → \`core/tech#t-arch\` — text`.
 * @typedef {Object} ProposedItem
 * @property {'add' | 'change' | 'supersede'} op
 * @property {string} id                the Spec item's id, born in the change ('d-rec-change')
 * @property {string} target            where it goes: a document, section or item ('records/tech#t-rec-data')
 * @property {string} [text]            what it says
 * @property {string} [note]            more of it: the lines under the item line, indented two
 *                                      spaces (an item's note and link, a section's prose)
 */

/**
 * A node of a change's thought map: `- ? text → \`id\`` with its note and children (changes.mjs).
 * @typedef {Object} ThoughtNode
 * @property {'thought' | 'question' | 'option' | 'decision' | 'constraint' | 'excluded'} kind
 * @property {true} [recommended]       an option Claude recommends (`~!`)
 * @property {string} text
 * @property {string} [item]            the proposed item it became (`→ \`d-x\``)
 * @property {string} [note]            the lines indented under it, before its children
 * @property {ThoughtNode[]} children
 */

/**
 * The parts of a change's body (changes.mjs).
 * @typedef {Object} ChangeParts
 * @property {string} [problem]
 * @property {string} [solution]
 * @property {string} [scope]
 * @property {string} [outOfScope]
 * @property {ThoughtNode[]} [thoughts]  the thought map (the Thoughts section), its root the title
 * @property {string} [questions]       the old Questions list, still read
 * @property {ProposedItem[]} [items]
 */

/**
 * A link a record writes, resolved by the id's shape: type and title only when a declared type has
 * that prefix (else a plain id: the declaring module is missing, or it is no record id at all).
 * @typedef {Object} ResolvedLink
 * @property {string} field             the field it stands in ('ideas')
 * @property {string} id                'I-5'
 * @property {string} [type]            the prefix of a declared type
 * @property {string} [name]            that type's name ('idea')
 * @property {string} [module]          the id of the module that declares the type ('ideas'; 'core'
 *                                      for the core's own): a page opens the record there
 * @property {string} [title]           the record's title, when it exists
 * @property {string} [file]            the record's file, when it exists
 */

/**
 * A record as the store gives it.
 * @typedef {Object} StoredRecord
 * @property {string} id                'I-5'
 * @property {string} type              its prefix
 * @property {number} n                 5
 * @property {string} file              relative to the project, '/'-separated
 * @property {string} version           a hash of the file: a write on an older one is refused
 * @property {Fields} fields
 * @property {string} body
 * @property {string[]} history
 * @property {string[]} [stray]
 */

/**
 * A record with what is computed from all records, never written to a file.
 * links: what the record's link fields name, resolved (a plain id when no declared type has its
 * prefix); linkedFrom: the records whose links name it; outline: what the type reads from the body.
 * @typedef {StoredRecord & { links: ResolvedLink[], linkedFrom: string[], html: string, outline?: object }} ShownRecord
 */

export {}
