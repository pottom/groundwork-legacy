// An engineering idea to develop becomes a ticket that links back (d-ideas-ticket-line): the card
// offers a ready prompt for Claude, the ticket carries an "**Idea:** I-12" line, Build reads it, and
// the card shows the ticket Build found.
// Run: node --test "modules/**/*.test.mjs"

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import ideas from './module.mjs'
import { canMakeTicket, ticketPrompt } from './ticket.mjs'

const read = (f) => fs.readFileSync(path.join(ideas.view.dir, f), 'utf8').replace(/\r\n/g, '\n')
const idea = {
  id: 'I-12', title: 'Cache the issue list', body: 'GitHub is asked on every page load.\nKeep the answer a minute.',
  kind: 'engineering', status: 'accepted', impact: 'medium', effort: 'low', rationale: 'fewer requests, small change', source: 'review of #24',
}

test('only an engineering idea moved to Accepted offers "Make a ticket"', () => {
  assert.equal(canMakeTicket(idea), true)
  assert.equal(canMakeTicket({ ...idea, kind: 'product' }), false, 'a product idea goes to Plan\'s map instead')
  assert.equal(canMakeTicket({ ...idea, status: 'considering' }), false)
  assert.equal(canMakeTicket({ ...idea, status: 'rejected' }), false)
})

test('the prompt asks Claude for a GitHub issue that names the idea on an "**Idea:** I-12" line, with what the idea says', () => {
  const prompt = ticketPrompt(idea)
  assert.match(prompt, /I-12/)
  assert.match(prompt, /GitHub issue/)
  assert.match(prompt, /^\*\*Idea:\*\* I-12$/m, 'the exact line Build reads')
  assert.ok(prompt.includes('Cache the issue list'))
  assert.ok(prompt.includes('GitHub is asked on every page load.\nKeep the answer a minute.'))
  assert.match(prompt, /groundwork-ideas/, 'it names the skill that documents the steps')
})

test('the prompt of an idea with a change asks for both lines, **Idea:** I-n and **Change:** C-n; without one, the idea\'s only', () => {
  const prompt = ticketPrompt({ ...idea, changes: [{ id: 'C-4', title: 'Old', status: 'done' }, { id: 'C-7', title: 'Cache the issue list', status: 'implementing' }] })
  assert.match(prompt, /^\*\*Idea:\*\* I-12$/m)
  assert.match(prompt, /^\*\*Change:\*\* C-7$/m, 'the latest change the idea opened')
  assert.doesNotMatch(prompt, /C-4/)
  assert.doesNotMatch(ticketPrompt(idea), /\*\*Change:\*\*/)
})

test('an accepted idea whose latest change is implementing offers "Make a ticket", whatever its kind (the ticket route)', () => {
  assert.equal(canMakeTicket({ ...idea, kind: 'product', changes: [{ id: 'C-7', status: 'implementing' }] }), true)
  assert.equal(canMakeTicket({ ...idea, kind: 'product', changes: [{ id: 'C-7', status: 'grilling' }] }), false)
})

test('an engineering idea sent down the Grilling route offers no ticket until its change is implementing: the interview comes first', () => {
  assert.equal(canMakeTicket({ ...idea, changes: [{ id: 'C-7', status: 'grilling' }] }), false)
  assert.equal(canMakeTicket({ ...idea, changes: [{ id: 'C-7', status: 'awaiting-approval' }] }), false)
  assert.equal(canMakeTicket({ ...idea, changes: [{ id: 'C-7', status: 'implementing' }] }), true)
  assert.equal(canMakeTicket({ ...idea, changes: [] }), true, 'an engineering idea accepted before changes, with none')
  assert.equal(canMakeTicket({ ...idea, kind: 'product', changes: [] }), false)
})

test('the prompt works for an idea with no description yet', () => {
  const prompt = ticketPrompt({ id: 'I-3', title: 'Lint the CSS', kind: 'engineering', status: 'accepted' })
  assert.match(prompt, /^\*\*Idea:\*\* I-3$/m)
  assert.doesNotMatch(prompt, /undefined|null/)
})

test('the card reads each idea\'s tickets only through Build\'s declared endpoint, and shows their number and state', () => {
  const api = read('view/api.mjs')
  assert.match(api, /'\/api\/build\/ideas'/)
  const part = read('view/tickets.mjs')
  for (const field of ['t.label', 't.status', 't.url']) assert.ok(part.includes(field), field)
  assert.match(part, /canMakeTicket\(idea\)/)
  assert.match(part, /navigator\.clipboard\.writeText/)
  assert.match(read('view/board.mjs'), /ticketPart\(/)
})

test('the skill documents making a ticket from an idea with the **Idea:** line', () => {
  const skill = read('skills/groundwork-ideas/SKILL.md')
  assert.match(skill, /## Making a ticket from an idea/)
  assert.match(skill, /\*\*Idea:\*\* I-12/)
  assert.match(skill, /\*\*Change:\*\* C-7/, 'and the change\'s line, when the idea has a change')
  assert.match(skill, /Accepted/)
})
