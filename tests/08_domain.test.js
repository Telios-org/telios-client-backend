const tape = require('tape')
const _test = require('tape-promise').default
const test = _test(tape)
const { OpenChannel } = require('./helper')

let channel


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
  t.plan(2)

  channel.send({
    event: 'domain:register',
    payload: {
      domain: 'telios.app'
    }
  })

  channel.once('domain:register:callback', cb => {
    const { error, data } = cb

    if(error) t.fail(error.message)

    t.equals(data.domain, 'telios.app');
    t.ok(data.verification);
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

    for(const record of data) {
      if(record.type === 'MX' && record.verified) {
        t.ok(record.value, 'MX Record verified');
      }

      if(record.type === 'TXT' && record.value.indexOf('spf') > -1 && record.verified) {
        t.ok(record.value, 'SPF Record verified');
      }

      if(record.type === 'TXT' && record.name.indexOf('dkim') > -1 && record.verified) {
        t.ok(record.name, 'DKIM Record verified');
      }

      if(record.type === 'TXT' && record.name.indexOf('_dmarc') > -1 && record.verified) {
        t.ok(record.name, 'DMARC Record verified');
      }
    }
  })
})

test('get domain by name', async t => {
  t.plan(4)

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
    t.equals(data.verified, true)
    t.equals(data.active, true)
    t.equals(data.dkim, '')
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

// test('register domain mailbox', async t => {
// })

// test('update domain mailbox', async t => {
// })

// test('delete domain mailbox', async t => {
// })