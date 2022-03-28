const tape = require('tape')
const _test = require('tape-promise').default
const test = _test(tape)
const path = require('path')
const fs = require('fs')
const Channel = require('./helper')
const { account } = require('@telios/client-sdk/lib/routes')

let _channel
let _account

test('create account', async t => {
  t.plan(5)
  let connectedCount = 0
  await cleanup()

  const channel = new Channel(path.join(__dirname, 'Accounts'))

  channel.on('drive:network:updated', cb => {
    const { data } = cb
    const { network } = data

    connectedCount += 1

    if (network && network.drive) t.equals(network.drive, true) // Drive is connected to p2p network

    if (network && network.internet) t.equals(network.internet, true) // Drive is connected to the global internet

    if(connectedCount === 2) channel.send({ event: 'account:logout' })
  })

  channel.send({
    event: 'account:create',
    payload: {
      email: 'bob@telios.io',
      password: 'letmein321',
      vcode: 'testcode123',
      recoveryEmail: 'bob@mail.com'
    }
  })

  channel.once('account:create:callback', cb => {
    const { error, data } = cb
    
    if(error) t.fail(error.message)

    console.log('SUCCESS :: ', data)

    _account = data

    t.ok(data.mnemonic)
    t.ok(data.uid)
  })

  channel.once('account:logout:callback', () => {
    channel.send({ event: 'account:exit' }) // for good measure
    t.ok(1, 'Logged out of account.')
  })

  t.teardown(async () => {
    channel.kill()
  })
})

test('Reset password with passphrase', async t => {
  t.plan(1)
  const channel = new Channel(path.join(__dirname, 'Accounts'))

  channel.send({
    event: 'account:resetPassword',
    payload: {
      passphrase: _account.mnemonic,
      email: 'bob@telios.io',
      newPass: 'letmein123',
    }
  })

  channel.on('debug', data => {
    console.log(data)
  })

  channel.on('account:resetPassword:callback', cb => {
    const { error, data } = cb
    
    if(error) t.fail(error.message)
   
    t.ok(data.reset)
  })

  t.teardown(async () => {
    channel.kill()
  })
})

test('account login', async t => {
  t.plan(1)

  _channel = new Channel(path.join(__dirname, 'Accounts'))

  _channel.send({
    event: 'account:login',
    payload: {
      email: 'bob@telios.io',
      password: 'letmein123'
    }
  })

  _channel.once('account:login:callback', cb => {
    const { error, data } = cb
    
    if(error) {
      t.fail(error.message)
      _channel.kill()
    }

    console.log('SUCCESS :: ', data)

    _account = data

    t.ok(data.uid)
  })
})

test('update account', async t => {
  t.plan(1)

  _channel.send({
    event: 'account:update',
    payload: {
      avatar: 'somebase64encodedtext'
    }
  })

  _channel.on('account:update:callback', cb => {
    const { error, data } = cb
    
    if(error) t.fail(error.message)

    t.ok(data)
  })
})

test('retrieve account stats', async t => {
  t.plan(1)

  _channel.send({ event: 'account:retrieveStats'})

  _channel.on('account:retrieveStats:callback', cb => {
    const { error, data } = cb
    
    if(error) t.fail(error.message)

    console.log('SUCESS ::', data)
    t.ok(data)
  })

  t.teardown(async () => {
    _channel.kill()
  })
})

test('Recover account', async t => {
  t.plan(1)

  const channel = new Channel(path.join(__dirname, 'Accounts'))

  
})

test('account login error', async t => {
  t.plan(1)

  const channel = new Channel(path.join(__dirname, 'Accounts'))
  
  channel.send({
    event: 'account:login',
    payload: {
      email: 'bob@telios.io',
      password: 'wrongpassword'
    }
  })

  channel.once('account:login:callback', cb => {
    const { error, data } = cb
    if (
      error &&
      error.message &&
      error.message === 'Unable to decrypt message.'
    ) {
      t.ok(1, 'Return error with incorrect password.')
    }
  })

  t.teardown(async () => {
    channel.kill()
  })
})

test('get account refresh token', async t => {
  t.plan(1)

  const channel = new Channel(path.join(__dirname, 'Accounts'))

  channel.send({
    event: 'account:login',
    payload: {
      email: 'bob@telios.io',
      password: 'letmein123'
    }
  })

  channel.on('account:login:callback', cb => {
    const { error } = cb
    
    if(error) t.fail(error.message)

    channel.send({ event: 'account:refreshToken' })

    channel.on('account:refreshToken:callback', cb => {
      const { error, data } = cb
    
      if(error) t.fail(error.message)

      t.ok(data)
    })

    t.teardown(async () => {
      channel.kill()
    })
  })
})

async function cleanup() {
  if (fs.existsSync(path.join(__dirname, '/Accounts'))) {
    fs.rmSync(path.join(__dirname, 'Accounts'), { recursive: true })
  }
}
