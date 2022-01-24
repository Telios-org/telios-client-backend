const tape = require('tape')
const _test = require('tape-promise').default
const test = _test(tape)
const path = require('path')
const fs = require('fs')
const Channel = require('./helper')

let _channel
let _account

test('create account', async t => {
  t.plan(4)

  await cleanup()

  const channel = new Channel(path.join(__dirname, 'Drive'))

  channel.on('drive:network:updated', data => {
    const { network } = data

    if (network && network.drive) t.equals(network.drive, true) // Drive is connected to p2p network

    if (network && network.internet) t.equals(network.internet, true) // Drive is connected to the global internet
  })

  channel.send({
    event: 'account:create',
    payload: {
      email: 'bob@telios.io',
      password: 'letmein123',
      vcode: 'testcode123',
      recoveryEmail: 'bob@mail.com'
    }
  })

  channel.once('account:create:error', error => {
    t.fail(error.message)
  })

  channel.once('account:create:success', data => {
    console.log('SUCCESS :: ', data)

    t.ok(data.uid)

    channel.send({ event: 'account:logout' })
  })

  channel.once('account:logout:success', () => {
    channel.send({ event: 'account:exit' }) // for good measure
    t.ok(1, 'Logged out of account.')
  })
})

test('account login success', async t => {
  t.plan(1)

  _channel = new Channel(path.join(__dirname, 'Drive'))

  _channel.send({
    event: 'account:login',
    payload: {
      email: 'bob@telios.io',
      password: 'letmein123'
    }
  })

  _channel.once('account:login:error', error => {
    t.fail(error.message)
  })

  _channel.once('account:login:success', data => {
    console.log('SUCCESS :: ', data)
    _account = data
    t.ok(data.uid)
  })

  // t.teardown(async () => {
  //   channel.kill()
  // })
})

test('update account', async t => {
  t.plan(1)

  _channel.send({
    event: 'account:update',
    payload: {
      avatar: 'somebase64encodedtext'
    }
  })

  _channel.on('account:update:error', error => {
    t.fail(error.message)
  })

  _channel.on('account:update:success', data => {
    t.ok(data)
  })
})

test('retrieve account stats', async t => {
  t.plan(1)

  _channel.send({ event: 'account:retrieveStats'})

  _channel.on('account:retrieveStats:error', error => {
    t.fail(error.message)
  })

  _channel.on('account:retrieveStats:success', data => {
    console.log('SUCESS ::', data)
    t.ok(data)
  })

  t.teardown(async () => {
    _channel.kill()
  })
})

test('account login error', async t => {
  t.plan(1)

  const channel = new Channel(path.join(__dirname, 'Drive'))

  channel.send({
    event: 'account:login',
    payload: {
      email: 'bob@telios.io',
      password: 'wrongpassword'
    }
  })

  channel.once('account:login:error', error => {
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

  const channel = new Channel(path.join(__dirname, 'Drive'))

  channel.send({
    event: 'account:login',
    payload: {
      email: 'bob@telios.io',
      password: 'letmein123'
    }
  })

  channel.on('account:login:success', data => {
    channel.send({ event: 'account:refreshToken' })

    channel.on('account:refreshToken:success', token => {
      t.ok(token)
    })

    channel.on('account:refreshToken:error', error => {
      t.fail(error.message)
    })

    t.teardown(async () => {
      channel.kill()
    })
  })
})

async function cleanup() {
  if (fs.existsSync(path.join(__dirname, '/Drive'))) {
    fs.rmSync(path.join(__dirname, '/Drive'), { recursive: true })
  }
}
