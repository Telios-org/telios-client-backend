const tape = require('tape')
const _test = require('tape-promise').default
const test = _test(tape)
const { OpenChannel } = require('./helper')

let channel
let mailboxId

test('create folder', async t => {
  t.plan(1)

  channel = await OpenChannel()

  channel.send({ event: 'mailbox:getMailboxes' })

  channel.once('mailbox:getMailboxes:callback', cb => {
    const { error, data } = cb

    if(error) t.fail(error.message)

    const payload = {
      mailboxId: data[0].mailboxId,
      folderId: 6,
      name: 'Test',
      type: 'default',
      icon: 'trash-o',
      seq: 6,
      createdAt: new Date().toUTCString(),
      updatedAt: new Date().toUTCString()
    }

    channel.send({ event: 'folder:createFolder', payload })

    channel.once('folder:createFolder:callback', cb => {
      const { error, data } = cb

      if(error) t.fail(error.message)

      console.log('SUCCESS :: ', data)
      
      t.ok(data)
    })
  })
})

test('update folder', async t => {
  t.plan(1)

  const payload = {
    folderId: 6,
    name: 'Foo Folder'
  }

  channel.send({ event: 'folder:updateFolder', payload })

  channel.once('folder:updateFolder:callback', cb => {
    const { error, data } = cb

    if(error) t.fail(error.message)

    console.log('SUCCESS :: ', data)
    
    t.ok(data.nModified)
  })
})

test('increment folder count', async t => {
  t.plan(1)

  const payload = {
    id: 6,
    amount: 3
  }

  channel.send({ event: 'folder:updateFolderCount', payload })

  channel.once('folder:updateFolderCount:callback', cb => {
    const { error, data } = cb

    if(error) t.fail(error.message)

    t.ok(true)
  })
})

test('decrement folder count', async t => {
  t.plan(1)

  const payload = {
    id: 6,
    amount: -2
  }

  channel.send({ event: 'folder:updateFolderCount', payload })

  channel.once('folder:updateFolderCount:callback', cb => {
    const { error, data } = cb

    if(error) t.fail(error.message)

    t.ok(true)
  })
})

test('get mailbox folders', async t => {
  t.plan(1)

  channel.send({ event: 'mailbox:getMailboxes' })

  channel.once('mailbox:getMailboxes:callback', cb => {
    const { error, data } = cb

    if(error) t.fail(error.message)

    mailboxId = data[0].mailboxId
    
    const payload = { id: mailboxId }

    channel.send({ event: 'folder:getMailboxFolders', payload })

    channel.once('folder:getMailboxFolders:callback', cb => {
      const { error, data } = cb

      if(error) t.fail(error.message)

      console.log('SUCCESS :: ', data)
      
      t.ok(data)
    })
  })
})

test('remove folder', async t => {
  t.plan(1)

  const payload = {
    id: 6 
  }

  channel.send({ event: 'folder:deleteFolder', payload })

  channel.once('folder:deleteFolder:callback', cb => {
    const { error, data } = cb

    if(error) t.fail(error.message)

    const payload = { id: mailboxId }

    channel.send({ event: 'folder:getMailboxFolders', payload })

    channel.once('folder:getMailboxFolders:callback', cb => {
      const { error, data } = cb

      if(error) t.fail(error.message)

      console.log('SUCCESS :: ', data)
      
      t.equals(data.length, 5)
    })
  })

  t.teardown(() => {
    channel.kill()
  })
})