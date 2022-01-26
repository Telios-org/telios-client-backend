const tape = require('tape')
const _test = require('tape-promise').default
const test = _test(tape)
const { OpenChannel } = require('./helper')

let channel
let contact

test('create contacts', async t => {
  t.plan(1)

  channel = await OpenChannel()

  const payload = {
    contactList: [{
      givenName: 'Albus',
      familyName: 'Dumbeldore',
      nickname: 'Dumbeldorf',
      birthday: new Date().toISOString(),
      publicKey: '00000000000000000000000000000000',
      pgpPublicKey: '00000000000000000000000000000000',
      email: 'albus.dumbeldore@hogwarts.edu',
      phone: '555-555-5555',
      address: '123 Any St.',
      website: 'https://hogwarts.edu',
      notes: 'Lorem ipsum dolar sit amet...',
      organization: 'Hogwarts Inc'
    }]
  }

  channel.send({ event: 'contact:createContacts', payload })

  channel.once('contact:createContacts:success', data => {
    console.log('SUCCESS :: ', data)
    contact = data[0]
    t.ok(data.length > 0)
  })

  channel.once('contact:createContacts:error', error => {
    t.fail(error.message)
  })
})


test('get contact by ID', async t => {
  t.plan(1)

  const payload = {
    id: contact.contactId
  }

  channel.send({ event: 'contact:getContactById', payload })

  channel.once('contact:getContactById:success', data => {
    console.log('SUCCESS :: ', data)
    t.ok(data.contactId)
  })

  channel.once('contact:getContactById:error', error => {
    t.fail(error.message)
  })
})

test('update contact', async t => {
  t.plan(1)

  const payload = {
    ...contact,
    givenName: 'Snape'
  }

  channel.send({ event: 'contact:updateContact', payload })

  channel.once('contact:updateContact:success', data => {
    channel.send({ event: 'contact:getContactById', payload: { id: contact.contactId} })

    channel.once('contact:getContactById:success', data => {
      t.equals(data.givenName, 'Snape')
    })
  })

  channel.once('contact:updateContact:error', error => {
    t.fail(error.message)
  })
})

test('search contact', async t => {
  t.plan(1)

  const payload = {
    searchQuery: 'albus'
  }
  
  channel.send({ event: 'contact:searchContact', payload })

  channel.once('contact:searchContact:success', data => {
    console.log('SUCCESS :: ', data)
    t.ok(data.length > 0)
  })

  channel.once('contact:searchContact:error', error => {
    t.fail(error.message)
  })
})

test('get all contacts', async t => {
  t.plan(1)

  channel.send({ event: 'contact:getAllContacts' })

  channel.once('contact:getAllContacts:success', data => {
    console.log('SUCCESS :: ', data)
    t.ok(data.length > 0)
  })

  channel.once('contact:getAllContacts:error', error => {
    t.fail(error.message)
  })
})

test('remove contact', async t => {
  t.plan(1)

  const payload = {
    id: contact.contactId
  }

  channel.send({ event: 'contact:removeContact', payload })

  channel.once('contact:removeContact:success', data => {
    t.ok(true)
  })

  channel.once('contact:removeContact:error', error => {
    t.fail(error.message)
  })

  t.teardown(() => {
    channel.kill()
  })
})