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
      birthday: new Date().toUTCString(),
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

  channel.once('contact:createContacts:callback', cb => {
    const { error, data } = cb

    if(error) t.fail(error.message)

    console.log('SUCCESS :: ', data)
    
    contact = data[0]
    t.ok(data.length > 0)
  })
})


test('get contact by ID', async t => {
  t.plan(1)

  const payload = {
    id: contact.contactId
  }

  channel.send({ event: 'contact:getContactById', payload })

  channel.once('contact:getContactById:callback', cb => {
    const { error, data } = cb

    if(error) t.fail(error.message)

    console.log('SUCCESS :: ', data)
    
    t.ok(data.contactId)
  })
})

test('update contact', async t => {
  t.plan(1)

  const payload = {
    ...contact,
    givenName: 'Snape'
  }

  channel.send({ event: 'contact:updateContact', payload })

  channel.once('contact:updateContact:callback', cb => {
    const { error, data } = cb

    if(error) t.fail(error.message)

    channel.send({ event: 'contact:getContactById', payload: { id: contact.contactId} })

    channel.once('contact:getContactById:callback', cb => {
      const { error, data } = cb

      if(error) t.fail(error.message)

      t.equals(data.givenName, 'Snape')
    })
  })
})

test('search contact', async t => {
  t.plan(1)

  const payload = {
    searchQuery: 'albus'
  }
  
  channel.send({ event: 'contact:searchContact', payload })

  channel.once('contact:searchContact:callback', cb => {
    const { error, data } = cb

    if(error) t.fail(error.message)

    console.log('SUCCESS :: ', data)
    
    t.ok(data.length > 0)
  })
})

test('get all contacts', async t => {
  t.plan(1)

  channel.send({ event: 'contact:getAllContacts' })

  channel.once('contact:getAllContacts:callback', cb => {
    const { error, data } = cb

    if(error) t.fail(error.message)

    console.log('SUCCESS :: ', data)
    
    t.ok(data.length > 0)
  })
})

test('remove contact', async t => {
  t.plan(1)

  const payload = {
    id: contact.contactId
  }

  channel.send({ event: 'contact:removeContact', payload })

  channel.once('contact:removeContact:callback', cb => {
    const { error, data } = cb

    if(error) t.fail(error.message)

    t.ok(true)
  })

  t.teardown(() => {
    channel.kill()
  })
})