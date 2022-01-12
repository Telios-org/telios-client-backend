const tape = require('tape')
const _test = require('tape-promise').default
const test = _test(tape)
const path = require('path')
const del = require('del')
const fs = require('fs')
const Channel = require('./helper')

test('create mailbox', async t => {
  // t.plan(4)
})