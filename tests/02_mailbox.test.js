const tape = require('tape')
const _test = require('tape-promise').default
const test = _test(tape)
const { OpenChannel } = require('./helper')

let channel


test('register new mailbox', async t => {
  t.plan(1)
  
  channel = await OpenChannel()

  channel.send({
    event: 'mailbox:register',
    payload: {
      account_key: '0000000000010000000000000001000000000000001000000000000001000000',
      addr: 'bob@telios.io'
    }
  })

  channel.on('mailbox:register:success', data => {
    console.log('SUCCESS :: ', data)
    t.ok(data, 'Created new mailbox')
  })

  channel.on('mailbox:register:error', error => {
    t.fail(error.stack)
  })
})

test('get new mail metadata from api server', async t => {
  // TODO: Need to modify clent-sdk's callout.js file to get this working in tests
  
  // t.plan(1)

  // channel.send({ event: 'mailbox:getNewMailMeta' })

  // channel.on('mailbox:info', data => {
  //   console.log('INFO::', data)
  // })

  // channel.on('mailbox:getNewMailMeta:success', data => {
  //   console.log(data)
  //   t.ok(data, 'Got new mail metadata')
  // })

  // channel.on('mailbox:getNewMailMeta:error', error => {
  //   t.fail(error)
  //   channel.kill()
  // })

  // setTimeout(() => {
  //   channel.kill()
  // }, 10000)
})

test('mark messages as synced', async t => {
  
  t.plan(1)

  channel.send({ event: 'mailbox:markArrayAsSynced', payload: { msgArray: ['abc123defffd', '0011aa00bbcc'] }})

  channel.on('mailbox:markArrayAsSynced:success', data => {
    t.ok(data.length > 0, 'Mark message array as synced')
  })

  channel.on('mailbox:markArrayAsSynced:error', error => {
    t.fail(error.stack)
    channel.kill()
  })
})

test('save mailbox', async t => {
  t.plan(1)

  channel.send({ event: 'mailbox:saveMailbox', payload: { address: 'bob@telios.io' } })

  
  channel.on('mailbox:saveMailbox:success', data => {
    console.log('SUCCESS :: ', data)
    t.ok(data, 'Got new mail metadata')
  })

  channel.on('mailbox:saveMailbox:error', error => {
    t.fail(error.stack)
    channel.kill()
  })
})

test('get mailboxes', async t => {
  t.plan(1)

  channel.send({ event: 'mailbox:getMailboxes' })

  channel.on('mailbox:getMailboxes:success', data => {
    console.log(data)
    t.ok(data, 'Got mailboxes')
  })

  channel.on('mailbox:getMailboxes:error', error => {
    t.fail(error.stack)
    channel.kill()
  })
  
  t.teardown(async () => {
    channel.kill()
  })
})