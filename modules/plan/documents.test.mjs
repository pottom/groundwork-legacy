// Tests of the generated documents through their interface: buildPrd and toMarkdown.
// Run: node --test modules/

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildPrd, toMarkdown, listDocs, GENERATED_MARK } from './documents.mjs'

// One map, in the shape the skill builds: a PRD and a technical design.
function shop(lang) {
  return {
    nodeData: {
      id: 'root', topic: 'Shop', ...(lang ? { metadata: { lang } } : {}), children: [
        { id: 'doc-prd', topic: 'Product', metadata: { doc: 'prd' }, children: [
          { id: 't-goal', topic: 'Goal', metadata: { status: 'topic', prose: 'Sell things.' }, children: [
            { id: 'd-cart', topic: 'Cart', metadata: { status: 'decision', impl: 'done' } },
            { id: 'd-pay', topic: 'Card payment', metadata: { status: 'inferred', impl: 'missing' } },
            { id: 'x-cash', topic: 'Cash', note: 'No shop', metadata: { status: 'excluded' } },
            { id: 'p-gift', topic: 'Gift cards', metadata: { status: 'parked' } },
          ] },
          { id: 't-users', topic: 'Users', metadata: { status: 'topic' } },
        ] },
        { id: 'doc-tech', topic: 'Design', metadata: { doc: 'tech' }, children: [
          { id: 't-stack', topic: 'Stack', metadata: { status: 'topic', progress: 'done' }, children: [
            { id: 'x-php', topic: 'PHP', metadata: { status: 'excluded' } },
            { id: 'q-db', topic: 'Which database', metadata: { status: 'todo' } },
          ] },
        ] },
      ],
    },
  }
}

// Every document of the map, as the map store writes them (with a GLOSSARY.md in the project).
function markdown(data) {
  const docs = listDocs(data)
  return Object.fromEntries(docs.map((d) => [d.file, toMarkdown(buildPrd(data, d.id), { glossary: true, siblings: docs.filter((x) => x !== d) })]))
}

const HUNGARIAN = {
  'PRD.md': `${GENERATED_MARK}

# Shop

_Termékkövetelmény-dokumentum (PRD). A grilling-interjú közben készül; a felsorolások a gondolattérképből jönnek. Kapcsolódó: [Design](TECH.md)._

> Állapot: 0 kész, 1 folyamatban, 1 érintetlen fejezet. 1 kódból kiolvasott elem megerősítésre vár. Megvalósítás: 1 kész, 0 részben, 1 hiányzik.

## 1. Goal

Sell things.

- Cart \`kész\`
- Card payment \`hiányzik\` _(kódból, megerősítésre vár)_

## 2. Users

_Még nem beszéltük át._

## Nem célok

- Cash — No shop _(Goal)_

## Későbbi verziók

- Gift cards _(Goal)_

## Nyitott kérdések

- **Users**: még nem beszéltük át

## Fogalmak

Lásd: [GLOSSARY.md](../../GLOSSARY.md)
`,
  'TECH.md': `${GENERATED_MARK}

# Shop — Design

_Műszaki terv. A grilling-interjú közben készül; a felsorolások a gondolattérképből jönnek. Kapcsolódó: [Product](PRD.md)._

> Állapot: 1 kész, 0 folyamatban, 0 érintetlen fejezet.

## 1. Stack

_Még nem beszéltük át._

## Elvetett megoldások

- PHP _(Stack)_

## Nyitott műszaki kérdések

- Which database _(Stack)_
`,
}

test('a map without a language generates Hungarian documents, as before', () => {
  assert.deepEqual(markdown(shop()), HUNGARIAN)
})

test('a map set to Hungarian generates the same documents', () => {
  assert.deepEqual(markdown(shop('hu')), HUNGARIAN)
})

test('a map set to English generates English documents', () => {
  assert.deepEqual(markdown(shop('en')), {
    'PRD.md': `${GENERATED_MARK}

# Shop

_Product requirements document (PRD). Written during the grilling interview; the lists come from the mind map. Related: [Design](TECH.md)._

> Sections: 0 done, 1 in progress, 1 untouched. 1 item read from the code awaits confirmation. Implementation: 1 done, 0 partial, 1 missing.

## 1. Goal

Sell things.

- Cart \`done\`
- Card payment \`missing\` _(from the code, awaiting confirmation)_

## 2. Users

_Not discussed yet._

## Non-goals

- Cash — No shop _(Goal)_

## Later versions

- Gift cards _(Goal)_

## Open questions

- **Users**: not discussed yet

## Glossary

See: [GLOSSARY.md](../../GLOSSARY.md)
`,
    'TECH.md': `${GENERATED_MARK}

# Shop — Design

_Technical design. Written during the grilling interview; the lists come from the mind map. Related: [Product](PRD.md)._

> Sections: 1 done, 0 in progress, 0 untouched.

## 1. Stack

_Not discussed yet._

## Rejected alternatives

- PHP _(Stack)_

## Open technical questions

- Which database _(Stack)_
`,
  })
})
