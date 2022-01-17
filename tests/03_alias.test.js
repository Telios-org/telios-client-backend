const tape = require('tape')
const _test = require('tape-promise').default
const test = _test(tape)
const { OpenChannel } = require('./helper')

let channel
let mailboxId


test('register new alias namespace', async t => {
  t.plan(1)
  
  channel = await OpenChannel()

  channel.send({ event: 'mailbox:getMailboxes' })

  channel.on('mailbox:getMailboxes:success', data => {
    
    mailboxId = data.mailboxId

    channel.send({
      event: 'alias:registerAliasNamespace',
      payload: {
        mailboxId: mailboxId,
        namespace: 'alice2022'
      }
    })
  
    channel.on('alias:registerAliasNamespace:success', data => {
      console.log('SUCCESS :: ', data)
      t.ok(data, 'Registered new alias namespace')
    })
  
    channel.on('alias:registerAliasNamespace:error', error => {
      console.log('ERROR', error.stack)
      t.fail(error.stack)
    })
  })

  channel.on('alias:getMailboxes:error', error => {
    console.log(error.stack)
    t.fail(error.stack)
    channel.kill()
  })
})

test('get alias namespaces', async t => {
  t.plan(1)

  channel.send({ event: 'alias:getMailboxNamespaces', payload: { id: mailboxId }  })

  channel.once('alias:getMailboxNamespaces:success', data => {
    console.log('SUCCESS :: ', data)
    t.equals(data[0].mailboxId, mailboxId)
  })

  channel.once('alias:getMailboxNamespaces:error', error => {
    t.fail(error.stack)
    channel.kill()
  })
})

test('register new alias address', async t => {
  t.plan(1)

  const payload = {
    namespaceName: 'alice2022',
    domain: 'dev,telios.io',
    address: 'netflix',
    description: '',
    fwdAddresses: '',
    disabled: false,
    count: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  channel.send({ event: 'alias:registerAliasAddress', payload })

  
  channel.once('alias:registerAliasAddress:success', data => {
    console.log('SUCCESS :: ', data)
    t.equals(data.aliasId, 'alice2022#netflix')
  })

  channel.once('alias:registerAliasAddress:error', error => {
    t.fail(error.stack)
    channel.kill()
  })
})

test('get alias addresses', async t => {
  t.plan(1)

  const payload = {
    namespaceKeys: ['alice2022']
  }

  channel.send({ event: 'alias:getMailboxAliases', payload })


  channel.once('alias:getMailboxAliases:success', data => {
    console.log('SUCCESS :: ', data)
    t.equals(data[0].aliasId, 'alice2022#netflix')
  })

  channel.once('alias:getMailboxAliases:error', error => {
    t.fail(error.stack)
    channel.kill()
  })
})

test('update alias address', async t => {
  t.plan(1)

  const payload = {
    namespaceName: 'alice2022',
    domain: 'dev,telios.io',
    address: 'netflix',
    description: 'Updated description',
    fwdAddresses: ['alice@mail.com', 'alice@somemail.com'],
    disabled: true,
    updatedAt: new Date().toISOString()
  }

  channel.send({ event: 'alias:updateAliasAddress', payload })


  channel.once('alias:updateAliasAddress:success', data => {
    console.log('SUCCESS :: ', data)
    t.equals(data.nModified, 1)
  })

  channel.once('alias:updateAliasAddress:error', error => {
    t.fail(error.stack)
    channel.kill()
  })
})

test('increment alias message count', async t => {
  t.plan(1)

  const payload = { id: 'alice2022#netflix' , amount: 1 }

  channel.send({ event: 'alias:updateAliasCount', payload })

  channel.once('alias:updateAliasCount:success', data => {

    channel.send({ event: 'alias:getMailboxAliases', payload: {
      namespaceKeys: ['alice2022']
    } })
  
    channel.once('alias:getMailboxAliases:success', data => {
      console.log('SUCCESS :: ', data[0])
      t.equals(data[0].count, 1)
    })
  })

  channel.once('alias:updateAliasCount:error', error => {
    console.log(JSON.stringify(error))
    channel.kill()
  })
})

test('decrement alias message count', async t => {
  t.plan(1)

  const payload = { id: 'alice2022#netflix' , amount: -1 }

  channel.send({ event: 'alias:updateAliasCount', payload })

  channel.once('alias:updateAliasCount:success', data => {

    channel.send({ event: 'alias:getMailboxAliases', payload: {
      namespaceKeys: ['alice2022']
    } })
  
    channel.once('alias:getMailboxAliases:success', data => {
      console.log('SUCCESS :: ', data[0])
      t.equals(data[0].count, 0)
    })
  })

  channel.once('alias:updateAliasCount:error', error => {
    t.fail(error.stack)
    channel.kill()
  })
})

test('remove alias address', async t => {
  t.plan(1)

  const payload = {
    namespaceName: 'alice2022',
    domain: 'dev,telios.io',
    address: 'netflix'
  }

  channel.send({ event: 'alias:removeAliasAddress', payload })

  channel.once('alias:removeAliasAddress:success', data => {
    const payload = {
      namespaceName: 'alice2022'
    }
  
    channel.send({ event: 'alias:getMailboxAliases', payload })
  
    channel.once('alias:getMailboxAliases:success', data => {
      t.equals(data.length, 0)
    })
  })

  channel.once('alias:removeAliasAddress:error', error => {
    t.fail(error.stack)
    channel.kill()
  })
})

test.onFinish(async () => {
  channel.kill()
})