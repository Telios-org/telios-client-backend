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

  channel.once('mailbox:getMailboxes:success', data => {
    const payload = {
      mailboxId: data[0].mailboxId,
      folderId: 6,
      name: 'Test',
      type: 'default',
      icon: 'trash-o',
      seq: 6,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    channel.send({ event: 'folder:createFolder', payload })

    channel.once('folder:createFolder:success', data => {
      console.log('SUCCESS :: ', data)
      t.ok(data)
    })

    channel.once('folder:createFolder:error', error => {
      t.fail(error.message)
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

  channel.once('folder:updateFolder:success', data => {
    console.log('SUCCESS :: ', data)
    t.ok(data.nModified)
  })

  channel.once('folder:updateFolder:error', error => {
    t.fail(error.message)
  })
})

test('increment folder count', async t => {
  t.plan(1)

  const payload = {
    id: 6,
    amount: 3
  }

  channel.send({ event: 'folder:updateFolderCount', payload })

  channel.once('folder:updateFolderCount:success', data => {
    t.ok(true)
  })

  channel.once('folder:updateFolderCount:error', error => {
    t.fail(error.message)
  })
})

test('decrement folder count', async t => {
  t.plan(1)

  const payload = {
    id: 6,
    amount: -2
  }

  channel.send({ event: 'folder:updateFolderCount', payload })

  channel.once('folder:updateFolderCount:success', data => {
    t.ok(true)
  })

  channel.once('folder:updateFolderCount:error', error => {
    t.fail(error.message)
  })
})

test('get mailbox folders', async t => {
  t.plan(1)

  channel.send({ event: 'mailbox:getMailboxes' })

  channel.once('mailbox:getMailboxes:success', data => {
    
    mailboxId = data[0].mailboxId
    
    const payload = { id: mailboxId }

    channel.send({ event: 'folder:getMailboxFolders', payload })

    channel.once('folder:getMailboxFolders:success', data => {
      console.log('SUCCESS :: ', data)
      t.ok(data)
    })

    channel.once('folder:getMailboxFolders:error', error => {
      t.fail(error.message)
    })
  })
})

test('remove folder', async t => {
  t.plan(1)

  const payload = {
    id: 6 
  }

  channel.send({ event: 'folder:deleteFolder', payload })

  channel.once('folder:deleteFolder:success', data => {
    const payload = { id: mailboxId }

    channel.send({ event: 'folder:getMailboxFolders', payload })

    channel.once('folder:getMailboxFolders:success', data => {
      console.log('SUCCESS :: ', data)
      t.equals(data.length, 5)
    })

    channel.once('folder:getMailboxFolders:error', error => {
      t.fail(error.message)
    })
  })

  channel.once('folder:deleteFolder:error', error => {
    console.log(JSON.stringify(error))
    t.fail(error.message)
  })

  t.teardown(() => {
    channel.kill()
  })
})