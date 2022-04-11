const tape = require('tape')
const _test = require('tape-promise').default
const test = _test(tape)
const { OpenChannel } = require('./helper')
const { MockEmail } = require('./helper')


let channel
let mailboxId


test('register new alias namespace', async t => {
  t.plan(1)
  
  channel = await OpenChannel()

  channel.send({ event: 'mailbox:getMailboxes' })

  channel.once('mailbox:getMailboxes:callback', cb => {
    const { error, data } = cb

    if(error) t.fail(error.message)

    mailboxId = data[0].mailboxId

    channel.send({
      event: 'alias:registerAliasNamespace',
      payload: {
        mailboxId: mailboxId,
        namespace: 'alice2022'
      }
    })
  
    channel.on('alias:registerAliasNamespace:callback', cb => {
      const { error, data } = cb

      if(error) t.fail(error.message)

      console.log('SUCCESS :: ', data)
      
      t.ok(data, 'Registered new alias namespace')
    })
  })
})

test('get alias namespaces', async t => {
  t.plan(1)

  channel.send({ event: 'alias:getMailboxNamespaces', payload: { id: mailboxId }  })

  channel.once('alias:getMailboxNamespaces:callback', cb => {
    const { error, data } = cb

    if(error) t.fail(error.message)

    console.log('SUCCESS :: ', data)
    
    t.equals(data[0].mailboxId, mailboxId)
  })
})

test('register new alias address', async t => {
  t.plan(1)

  const payload = {
    namespaceName: 'alice2022',
    domain: 'dev.telios.io',
    address: 'netflix',
    description: '',
    fwdAddresses: '',
    disabled: false,
    count: 0,
    createdAt: new Date().toUTCString(),
    updatedAt: new Date().toUTCString()
  }

  channel.send({ event: 'alias:registerAliasAddress', payload })

  
  channel.once('alias:registerAliasAddress:callback', cb => {
    const { error, data } = cb

    if(error) t.fail(error.message)

    console.log('SUCCESS :: ', data)
    
    t.equals(data.aliasId, 'alice2022#netflix')
  })
})

test('get alias addresses', async t => {
  t.plan(1)

  const payload = {
    namespaceKeys: ['alice2022']
  }

  channel.send({ event: 'alias:getMailboxAliases', payload })


  channel.once('alias:getMailboxAliases:callback', cb => {
    const { error, data } = cb

    if(error) t.fail(error.message)

    console.log('SUCCESS :: ', data)
    
    t.equals(data[0].aliasId, 'alice2022#netflix')
  })
})

test('update alias address', async t => {
  t.plan(1)

  const payload = {
    namespaceName: 'alice2022',
    domain: 'dev.telios.io',
    address: 'netflix',
    description: 'Updated description',
    fwdAddresses: ['alice@mail.com', 'alice@somemail.com'],
    disabled: true,
    updatedAt: new Date().toUTCString()
  }

  channel.send({ event: 'alias:updateAliasAddress', payload })


  channel.once('alias:updateAliasAddress:callback', cb => {
    const { error, data } = cb

    if(error) t.fail(error.message)

    console.log('SUCCESS :: ', data)
    
    t.equals(data.nModified, 1)
  })
})

test('increment alias message count', async t => {
  t.plan(2)

  const mockEmail = MockEmail({ to: { address: 'alice2022#netflix@dev.telios.io' }, unread: false, attachments: [] })

  const payloadEML = {
    type: 'Incoming',
    messages: [mockEmail],
  }

  let eml;
  channel.send({ event: 'email:saveMessageToDB', payload: payloadEML })

  channel.once('email:saveMessageToDB:callback', cb => {
    const { error, data } = cb

    if(error) t.fail(error.message)
    eml = data.msgArr[0]
    const payload = { id: 'alice2022#netflix' , amount: 1 }

    channel.send({ event: 'alias:updateAliasCount', payload })

    channel.once('alias:updateAliasCount:callback', cb => {
      const { error, data } = cb

      if(error) t.fail(error.message)

      channel.send({ event: 'alias:getMailboxAliases', payload: {
        namespaceKeys: ['alice2022']
      } })
    
      channel.once('alias:getMailboxAliases:callback', cb => {
        const { error, data } = cb

        if(error) t.fail(error.message)

        console.log('SUCCESS :: ', data[0])
        
        t.equals(data[0].count, 1)

        const payloadRM = {
          messageIds: [eml.emailId]
        }
      
        channel.send({ event: 'email:removeMessages', payload: payloadRM })
        channel.once('email:removeMessages:callback', cb => {
          const { error, data } = cb
      
          if(error) t.fail(error.message)
      
          t.ok(true)
        })
      })
    })
  })
})

test('decrement alias message count', async t => {
  t.plan(1)


  const payload = { id: 'alice2022#netflix' , amount: -1 }

  channel.send({ event: 'alias:updateAliasCount', payload })

  channel.once('alias:updateAliasCount:callback', cb => {
    const { error, data } = cb

    if(error) t.fail(error.message)

    channel.send({ event: 'alias:getMailboxAliases', payload: {
      namespaceKeys: ['alice2022']
    } })
  
    channel.once('alias:getMailboxAliases:callback', cb => {
      const { error, data } = cb

      if(error) t.fail(error.message)

      console.log('SUCCESS :: ', data[0])
      
      t.equals(data[0].count, 0)
    })
  })
})

test('remove alias address', async t => {
  t.plan(1)

  const payload = {
    namespaceName: 'alice2022',
    domain: 'dev.telios.io',
    address: 'netflix'
  }

  channel.send({ event: 'alias:removeAliasAddress', payload })

  channel.once('alias:removeAliasAddress:callback', cb => {
    const { error, data } = cb

    if(error) t.fail(error.message)

    const payload = {
      namespaceKeys: ['alice2022']
    }
  
    channel.send({ event: 'alias:getMailboxAliases', payload })
  
    channel.once('alias:getMailboxAliases:callback', cb => {
      const { error, data } = cb

      if(error) t.fail(error.message)

      t.equals(data.length, 0)
    })
  })

  t.teardown(() => {
    channel.kill()
  })
})