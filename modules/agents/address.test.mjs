// The Agents page's address: which agent is open and which branch row a link points to.
// Run: node --test "modules/**/*.test.mjs"

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readAddress, agentHash, branchHash } from './view/address.mjs'

test('#agent=<session>/<agent> opens that agent, #agent=<session> the session', () => {
  assert.deepEqual(readAddress({ search: '', hash: '#agent=s-1/a-1' }), { open: { session: 's-1', agent: 'a-1' }, focus: null, branch: null })
  assert.deepEqual(readAddress({ search: '', hash: '#agent=s-1' }), { open: { session: 's-1', agent: null }, focus: null, branch: null })
  assert.deepEqual(readAddress({ search: '', hash: '' }), { open: null, focus: null, branch: null })
  assert.equal(readAddress({ search: '', hash: '#agent=../x' }).open, null)
})

test('Build\'s "being worked on" link (?agent=<session>/<agent>) opens that agent\'s timeline and marks it', () => {
  assert.deepEqual(readAddress({ search: '?agent=s-1%2Fa-1', hash: '' }), { open: { session: 's-1', agent: 'a-1' }, focus: 'a-1', branch: null })
  assert.deepEqual(readAddress({ search: '?agent=s-1', hash: '' }), { open: { session: 's-1', agent: null }, focus: 's-1', branch: null })
  assert.deepEqual(readAddress({ search: '?agent=s-1%2Fa-1', hash: '#agent=s-2' }).open, { session: 's-2', agent: null }, 'what the page opened since wins')
  assert.equal(agentHash({ session: 's-1', agent: 'a-1' }), '#agent=s-1/a-1')
  assert.equal(agentHash({ session: 's-1', agent: null }), '#agent=s-1')
})

test('an agent\'s branch links to its row in the worktrees; it names no agent to open (the page keeps the open one)', () => {
  const href = branchHash('feature/38-x y')
  assert.equal(href, '#branch=feature%2F38-x%20y')
  assert.deepEqual(readAddress({ search: '?agent=s-1%2Fa-1', hash: href }), { open: undefined, focus: null, branch: 'feature/38-x y' })
  assert.deepEqual(readAddress({ search: '?agent=s-1%2Fa-1', hash: '#' }), { open: null, focus: null, branch: null }, 'closed stays closed')
})
