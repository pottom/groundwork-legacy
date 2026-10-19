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
  kind: 'engineering', status: 'to-develop', impact: 'medium', effort: 'low', rationale: 'fewer requests, small change', source: 'review of #24',
}

test('only an engineering idea moved to To develop offers "Make a ticket"', () => {
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

test('the prompt works for an idea with no description yet', () => {
  const prompt = ticketPrompt({ id: 'I-3', title: 'Lint the CSS', kind: 'engineering', status: 'to-develop' })
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
  assert.match(skill, /To develop/)
})
