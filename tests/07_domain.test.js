const tape = require('tape')
const _test = require('tape-promise').default
const test = _test(tape)
const { OpenChannel } = require('./helper')

let channel
let subAcct

test('check if custom domain name is available', async t => {
  t.plan(1)
  
  channel = await OpenChannel()

  channel.send({
    event: 'domain:isAvailable',
    payload: {
      domain: 'telios.app'
    }
  })

  channel.once('domain:isAvailable:callback', cb => {
    const { error, data } = cb

    if(error) t.fail(error.message)

    t.ok(data, 'Domain is available')
  })
})

test('register new custom domain', async t => {
  t.plan(4)

  channel.send({
    event: 'domain:register',
    payload: {
      domain: 'telios.app'
    }
  })

  channel.once('domain:register:callback', cb => {
    const { error, data } = cb

    if(error) t.fail(error.message)

    t.equals(data.name, 'telios.app');
    t.ok(data.dns.vcode.name)
    t.ok(data.dns.vcode.type)
    t.ok(data.dns.vcode.value)
  })
})

test('verify domain ownership', async t => {
  t.plan(1)

  channel.send({
    event: 'domain:verifyOwnership',
    payload: {
      domain: 'telios.app'
    }
  })

  channel.once('domain:verifyOwnership:callback', cb => {
    const { error, data } = cb

    if(error) t.fail(error.message)

    t.ok(data.verified);
  })
})

test('verify domain DNS settings are properly set', async t => {
  t.plan(4)

  channel.send({
    event: 'domain:verifyDNS',
    payload: {
      domain: 'telios.app'
    }
  })

  channel.once('domain:verifyDNS:callback', cb => {
    const { error, data } = cb

    if(error) t.fail(error.message)

    console.log('SUCCESS :: ', data)

    for(const key in data) {
      if(data[key].type === 'MX' && data[key].verified) {
        t.ok(data[key].value, 'MX Record verified');
      }

      if(data[key].type === 'TXT' && data[key].value.indexOf('spf') > -1 && data[key].verified) {
        t.ok(data[key].value, 'SPF Record verified');
      }

      if(data[key].type === 'TXT' && data[key].name.indexOf('dkim') > -1 && data[key].verified) {
        t.ok(data[key].name, 'DKIM Record verified');
      }

      if(data[key].type === 'TXT' && data[key].name.indexOf('_dmarc') > -1 && data[key].verified) {
        t.ok(data[key].name, 'DMARC Record verified');
      }
    }
  })
})

test('get domain by name', async t => {
  t.plan(7)

  channel.send({
    event: 'domain:getDomainByName',
    payload: {
      name: 'telios.app'
    }
  })

  channel.once('domain:getDomainByName:callback', cb => {
    const { error, data } = cb

    if(error) t.fail(error.message)

    console.log('SUCCESS :: ', data)

    t.equals(data.name, 'telios.app')
    t.equals(data.active, true)
    t.ok(data.dns.vcode)
    t.ok(data.dns.mx)
    t.ok(data.dns.spf)
    t.ok(data.dns.dkim)
    t.ok(data.dns.dmarc)
  })
})

test('get all domains', async t => {
  t.plan(1)

  channel.send({ event: 'domain:getDomains' })

  channel.once('domain:getDomains:callback', cb => {
    const { error, data } = cb

    if(error) t.fail(error.message)

    t.equals(data.length, 1)
  })
})

test('register domain mailbox', async t => {
  t.plan(6)

  const payload = { 
    type: 'SUB', 
    email: 'bob@telios.app',
    displayName: 'John Doe',
    domain: 'telios.app', 
    recoveryEmail: 'bob_recovery@mail.com',
    deviceType: 'DESKTOP'
  }

  channel.send({ event: 'domain:registerMailbox',  payload })

  channel.once('domain:registerMailbox:callback', cb => {
    const { error, data } = cb

    if(error) t.fail(error.message)

    subAcct = data

    t.ok(data.account.password)
    t.equals(data.account.type, 'SUB')
    t.equals(data.mailbox.type, 'SUB')
    t.equals(data.mailbox.displayName, 'John Doe')
    t.equals(data.mailbox.domainKey, 'telios.app')
    t.ok(data.mailbox.password)
  })

  t.teardown(async () => {
    channel.kill()
  })
})

test('log in to sub mailbox', async t => {
  t.plan(1)
  channel = await OpenChannel()

  channel.send({ event: 'account:logout', payload: { kill: false } })

  channel.once('account:logout:callback', () => {

    channel.send({
      event: 'account:login',
      payload: {
        email: 'bob@telios.app',
        password: subAcct.mailbox.password
      }
    })

    channel.once('account:login:callback', cb => {
      const { error, data } = cb
  
      if(error) {
        t.fail(error.message)
        channel.kill()
      }

      t.equals('SUB', data.type)
    })
  })

  t.teardown(async () => {
    channel.kill()
  })
})

// test('update domain mailbox', async t => {
// })

test('delete domain mailbox', async t => {
  t.plan(1)
  
  channel = await OpenChannel()

  const payload = {
    address: subAcct.mailbox.address
  }

  channel.send({ event: 'domain:deleteMailbox', payload })

  channel.on('domain:deleteMailbox:callback', cb => {
    const { error, data } = cb
  
    if(error) {
      t.fail(error.message)
    }

    t.ok(data)
  })
})

test('delete custom domain', async t => {
  t.plan(1)

  channel.send({
    event: 'domain:delete',
    payload: {
      domain: 'telios.app'
    }
  })

  channel.once('domain:delete:callback', cb => {
    const { error, data } = cb

    if(error) t.fail(error.message)

    t.ok(data, 'Deleted custom domain')
  })

  t.teardown(async () => {
    channel.kill()
  })
})