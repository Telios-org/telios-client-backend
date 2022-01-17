const tape = require('tape')
const _test = require('tape-promise').default
const test = _test(tape)
const { OpenChannel } = require('./helper')

let channel


test('register new alias namespace', async t => {
  t.plan(1)
  
  channel = await OpenChannel()

  channel.send({ event: 'mailbox:getMailboxes' })


  channel.on('mailbox:getMailboxes:success', data => {
    console.log('GOT MAILBOX', data)
    
    channel.send({
      event: 'mailbox:registerAliasNamespace',
      payload: {
        mailboxId: data.mailboxId,
        namespace: 'alice2022'
      }
    })
  
    channel.on('mailbox:registerAliasNamespace:success', data => {
      t.ok(data, 'Registered new alias namespace')
    })
  
    channel.on('mailbox:registerAliasNamespace:error', error => {
      t.fail(error.stack)
    })
  })

  channel.on('mailbox:getMailboxes:error', error => {
    t.fail(error.stack)
    channel.kill()
  })
})

// test('get alias namespaces', async t => {
  
//   t.plan(1)

//   channel.send({ event: 'mailbox:getMailboxNamespaces', payload: ''  })

//   channel.on('mailbox:getMailboxNamespaces:success', data => {
//     t.ok(data.length > 0, 'Mark message array as synced')
//   })

//   channel.on('mailbox:getMailboxNamespaces:error', error => {
//     t.fail(error.stack)
//     channel.kill()
//   })
// })

// test('register new alias address', async t => {
//   t.plan(1)

//   channel.send({ event: 'mailbox:registerAliasAddress', payload: { address: 'bob@telios.io' } })

  
//   channel.on('mailbox:registerAliasAddress:success', data => {
//     t.ok(data, 'Got new mail metadata')
//   })

//   channel.on('mailbox:registerAliasAddress:error', error => {
//     t.fail(error.stack)
//     channel.kill()
//   })
// })

// test('get alias addresses', async t => {
//   t.plan(1)

//   channel.send({ event: 'mailbox:getMailboxAliases' })


//   channel.on('mailbox:getMailboxAliases:success', data => {
//     t.ok(data, 'Got mailboxes')
//   })

//   channel.on('mailbox:getMailboxAliases:error', error => {
//     t.fail(error.stack)
//     channel.kill()
//   })
  
//   t.teardown(async () => {
//     channel.kill()
//   })
// })

test.onFinish(async () => {
  channel.kill()
})