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
 * @typedef {StoredRecord & { linkedFrom: string[], html: string }} ShownRecord
 */

export {}
