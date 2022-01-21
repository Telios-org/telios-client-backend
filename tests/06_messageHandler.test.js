const tape = require('tape')
const _test = require('tape-promise').default
const test = _test(tape)
const { OpenChannel } = require('./helper')

let channel


test('initialize listener', async t => {
  t.plan(1)
  
  t.ok(true)
})