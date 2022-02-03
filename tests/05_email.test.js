const tape = require('tape')
const _test = require('tape-promise').default
const test = _test(tape)
const { OpenChannel } = require('./helper')
const { MockEmail } = require('./helper')
const path = require('path')
const fs = require('fs')

let channel
let __email
let __emailArr

test('send email', async t => {
  t.plan(1)

  channel = await OpenChannel()

  const payload = {
    email: MockEmail({ emailId: null, folderId: 1, aliasId: null, unread: 0 })
  }

  channel.send({ event: 'email:sendEmail', payload })

  channel.once('email:sendEmail:callback', cb => {
    const { error, data } = cb

    if(error) t.fail(error.message)

    console.log('SUCCESS :: ', data)
    
    t.ok(data.emailId)
  })
})

test('save sent email to database', async t => {
  t.plan(1)

  const mockEmail = MockEmail({ subject: 'New Incoming Message', emailId: null, folderId: 1, aliasId: null, unread: 0 })

  const payload = {
    type: 'Incoming',
    messages: [mockEmail],
  }

  channel.send({ event: 'email:saveMessageToDB', payload })

  channel.once('email:saveMessageToDB:callback', cb => {
    const { error, data } = cb

    if(error) t.fail(error.message)

    console.log('SUCCESS :: ', data)
    
    t.equals(data.msgArr.length, 1)
  })
})

test('save incoming alias email', async t => {
  t.plan(2)

  const payload = {
    namespaceName: 'alice2022',
    domain: 'telios.io',
    address: 'existing',
    description: '',
    fwdAddresses: '',
    disabled: false,
    count: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  channel.send({ event: 'alias:registerAliasAddress', payload })

  channel.once('alias:registerAliasAddress:callback', cb => {

    const { error, data: alias } = cb

    if(error) t.fail(error.message)

    const mockEmail = MockEmail({ to: { address: 'alice2022#existing@telios.io' }, unread: 0 })

    const payload = {
      type: 'Incoming',
      messages: [mockEmail],
    }

    channel.send({ event: 'email:saveMessageToDB', payload })

    channel.once('email:saveMessageToDB:callback', cb => {
      const { error, data } = cb

      if(error) t.fail(error.message)

      console.log('SUCCESS :: ', data)
      
      __email = data.msgArr[0]
      t.equals(data.msgArr.length, 1)
      t.equals(data.msgArr[0].aliasId, alias.aliasId)
    })
  })
})

test('save email attachments', async t => {
  t.plan(1)

  const payload = {
    filepath: __dirname + '\\newDir\\test.png',
    attachments: JSON.parse(__email.attachments)
  }

  channel.send({ event: 'email:saveFiles', payload })

  channel.once('email:saveFiles:callback', cb => {
    const { error, data } = cb

    if(error) t.fail(error.message)

    t.ok(true)
  })

  t.teardown(() => {
    fs.rmSync(__dirname + '/newDir', { recursive: true })
  })
})

test('generate new aliases for on-the-fly email', async t => {
  t.plan(3)
    const mockEmail = MockEmail({ to: { address: 'alice2022#onthefly@telios.io' }, unread: 0 })

    const payload = {
      type: 'Incoming',
      messages: [mockEmail],
    }
    
    channel.send({ event: 'email:saveMessageToDB', payload })

    channel.once('email:saveMessageToDB:callback', cb => {
      const { error, data } = cb

      if(error) t.fail(error.message)

      console.log('SUCCESS :: ', data)
      
      __emailArr = data.msgArr
      t.equals(data.msgArr.length, 1)
      t.equals(data.newAliases.length, 1)

      channel.send({ event: 'alias:getMailboxAliases', payload: { namespaceKeys: ['alice2022'] }})

      channel.on('alias:getMailboxAliases:callback', cb => {
        const { error, data } = cb
        if(error) t.fail(error.message)
        
        for(const alias of data) {
          if(alias.aliasId === 'alice2022#onthefly') {
            t.ok(true)
          }
        }
      })
    })
})

test('save email as draft', async t => {
  t.plan(2)

  const mockEmail = MockEmail({ unread: 0 })

  const payload = {
    type: 'Draft',
    messages: [mockEmail],
  }

  channel.send({ event: 'email:saveMessageToDB', payload })

  channel.once('email:saveMessageToDB:callback', cb => {
    const { error, data } = cb

    if(error) t.fail(error.message)

    console.log('SUCCESS :: ', data)
    
    t.equals(data.msgArr.length, 1)
    t.equals(data.msgArr[0].folderId, 2)
  })
})

test('get emails by folder ID', async t => {
  t.plan(1)

  const payload = {
    id: 5
  }

  channel.send({ event: 'email:getMessagesByFolderId', payload })

  channel.once('email:getMessagesByFolderId:callback', cb => {
    const { error, data } = cb

    if(error) t.fail(error.message)

    t.equals(data.length, 2)
  })
})

test('get messages by alias ID', async t => {
  t.plan(1)

  const payload = {
    id: 'alice2022#existing'
  }

  channel.send({ event: 'email:getMessagesByAliasId', payload })

  channel.once('email:getMessagesByAliasId:callback', cb => {
    const { error, data } = cb

    if(error) t.fail(error.message)

    t.equals(data.length, 1)
  })
})

test('move emails to another folder', async t => {
  t.plan(2)

  const emails = __emailArr.map(msg => {
    return {
      ...msg,
      folder: {
        toId: 1
      }
    }
  })

  const payload = {
    messages: emails
  }

  channel.send({ event: 'email:moveMessages', payload })

  channel.once('email:moveMessages:callback', cb => {
    const { error, data } = cb

    if(error) t.fail(error.message)

    // Verify emails correctly moved
    const payload = {
      id: 1
    }
  
    channel.send({ event: 'email:getMessagesByFolderId', payload })

    channel.once('email:getMessagesByFolderId:callback', cb => {
      const { error, data: emails } = cb

      if(error) t.fail(error.message)

      for(const email of emails) {
        t.equals(email.folderId, 1)
      }
    })
  })
})

test('get email by ID', async t => {
  t.plan(2)

  const payload = {
    id: __email.emailId
  }

  channel.send({ event: 'email:getMessageById', payload })

  channel.once('email:getMessageById:callback', cb => {
    const { error, data } = cb

    if(error) t.fail(error.message)

    t.equals(data.emailId, __email.emailId)
    t.ok(data.bodyAsHtml)
  })
})

test('mark email as unread', async t => {
  t.plan(1)

  const payload = {
    id: __email.emailId
  }

  channel.send({ event: 'email:markAsUnread', payload })

  channel.once('email:markAsUnread:callback', cb => {
    const { error, data } = cb

    if(error) t.fail(error.message)

    t.ok(true)
  })
})

test('remove emails from DB and file system', async t => {
  t.plan(1)

  const payload = {
    messageIds: [__email.emailId]
  }

  channel.send({ event: 'email:removeMessages', payload })

  channel.once('email:removeMessages:callback', cb => {
    const { error, data } = cb

    if(error) t.fail(error.message)

    t.ok(true)
  })
})

test('email full text search', async t => {
  t.plan(1)

  const payload = {
    searchQuery: 'Subject-'
  }

  channel.send({ event: 'email:searchMailbox', payload })

  channel.once('email:searchMailbox:callback', cb => {
    const { error, data } = cb

    if(error) t.fail(error.message)

    t.ok(data.length > 0)
  })

  t.teardown(() => {
    channel.kill()
  })
})