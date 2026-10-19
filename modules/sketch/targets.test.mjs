// What a sketch or a shape links to (view/targets.mjs): an idea, a map node, a ticket or another
// sketch, written groundwork://<kind>/<ref>, and the shell's address that opens it.
// Run: node --test "modules/**/*.test.mjs"

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { target, parseTarget, shellLink } from './view/targets.mjs'

test('a link names an idea, a map node, a ticket or a sketch, in one plain form', () => {
  assert.equal(target('idea', 'I-12'), 'groundwork://idea/I-12')
  assert.equal(target('idea', ' i-012 '), 'groundwork://idea/I-12', 'people say I-12; the file says I-012')
  assert.equal(target('idea', '7'), 'groundwork://idea/I-7')
  assert.equal(target('node', 'f-board-links'), 'groundwork://node/f-board-links')
  assert.equal(target('ticket', '#34'), 'groundwork://ticket/%2334')
  assert.equal(target('ticket', 'core  3'), 'groundwork://ticket/core%203')
  assert.equal(target('sketch', 'flow_2'), 'groundwork://sketch/flow_2')
})

test('what is not one of them is no link', () => {
  for (const [kind, ref] of [['idea', 'twelve'], ['node', 'a b'], ['node', ''], ['ticket', '  '], ['sketch', '../x'], ['user', 'x']]) {
    assert.equal(target(kind, ref), null, `${kind} ${ref}`)
  }
  for (const uri of ['https://example.com', 'groundwork://user/x', 'groundwork://idea/x', 'groundwork://sketch/a%2Fb', '', null]) {
    assert.equal(parseTarget(uri), null, String(uri))
  }
})

test('a link reads back as its kind and reference', () => {
  assert.deepEqual(parseTarget('groundwork://ticket/%2334'), { kind: 'ticket', ref: '#34' })
  assert.deepEqual(parseTarget('groundwork://idea/I-012'), { kind: 'idea', ref: 'I-12' })
  assert.deepEqual(parseTarget('groundwork://node/f-board-links'), { kind: 'node', ref: 'f-board-links' })
})

test('each opens in the shell on its module, a renamed sketch under its new name', () => {
  assert.equal(shellLink('groundwork://idea/I-12'), '/?module=ideas&idea=I-12')
  assert.equal(shellLink('groundwork://node/f-x'), '/?module=plan&node=f-x')
  assert.equal(shellLink('groundwork://ticket/%2334'), '/?module=build&ticket=%2334')
  assert.equal(shellLink('groundwork://sketch/flow'), '/?module=sketch&sketch=flow')
  assert.equal(shellLink('groundwork://sketch/old', { old: 'flow' }), '/?module=sketch&sketch=flow')
  assert.equal(shellLink('/?module=plan&node=f-x'), '/?module=plan&node=f-x', 'an address of the shell itself opens as it is')
  assert.equal(shellLink('https://example.com'), null, 'any other link is Excalidraw\'s to open')
})
