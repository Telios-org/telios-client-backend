const tape = require('tape')
const _test = require('tape-promise').default
const test = _test(tape)
const path = require('path')
const fs = require('fs')
const Channel = require('./helper')

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
    t.fail(error)
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

  const channel = new Channel(path.join(__dirname, 'Drive'))

  channel.send({
    event: 'account:login',
    payload: {
      email: 'bob@telios.io',
      password: 'letmein123'
    }
  })

  channel.once('account:login:error', error => {
    console.log(error)
    t.fail(error)
  })

  channel.once('account:login:success', data => {
    console.log('SUCCESS :: ', data)

    t.ok(data.uid)
  })

  t.teardown(async () => {
    channel.kill()
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

async function cleanup() {
  if (fs.existsSync(path.join(__dirname, '/Drive'))) {
    fs.rmSync(path.join(__dirname, '/Drive'), { recursive: true })
  }
}
