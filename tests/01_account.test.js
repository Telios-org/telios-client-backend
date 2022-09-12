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
  t.plan(3)
  await cleanup()

  const channel = new Channel(path.join(__dirname, 'Accounts'))

  channel.send({
    event: 'account:create',
    payload: {
      email: 'bob@telios.io',
      password: 'letmein321',
      vcode: 'testcode123',
      recoveryEmail: 'bob@mail.com',
      encryptionKey: 'c3eeb95e5ecb007d74053278574a47b0502c04973b62e60c2e9f4abafeecb8d2', // Only pass these in to initialize with existing key
      mnemonic: 'forward neck limb trim bottom teach theme miracle warrior beef steel jazz bulb job host silver anxiety ring old always polar option stereo pride' // Only pass these in to initialize with existing mnemonic
    }
  })

  channel.once('account:create:callback', cb => {
    const { error, data } = cb
    
    if(error) t.fail(error.message)

    console.log('SUCCESS :: ', data)

    _account = data

    t.ok(data.mnemonic)
    t.ok(data.uid)

    channel.send({ event: 'account:logout' })
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

  channel.on('account:resetPassword:callback', cb => {
    const { error, data } = cb
    
    if(error) t.fail(error.stack)
   
    t.ok(data.reset)
  })

  t.teardown(async () => {
    channel.kill()
  })
})

test('account login success', async t => {
  t.plan(1)

  _channel = new Channel(path.join(__dirname, 'Accounts'))

  _channel.send({
    event: 'account:login',
    payload: {
      email: 'bob@telios.io',
      password: 'letmein123'
    }
  })

  _channel.on('debug', data => {
    console.log('DEBUG', data)
  })

  // _channel.on('drive:peer:updated', cb => {
  //   const { error, data } = cb
  
  //   if(error) t.fail(error.message)

  //   if(data && data.status === 'ONLINE') {
  //     t.ok(data.peerKey)
  //     t.equals(true, data.server)
  //   }
  // })

  _channel.once('account:login:callback', cb => {
    const { error, data } = cb
    
    if(error) {
      t.fail(error.message)
      _channel.kill()
    }

    console.log('SUCCESS :: ', data)

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

    console.log('SUCCESS ::', data)
    t.ok(data)
  })

  t.teardown(async () => {
    _channel.kill()
  })
})

test('recover account with backup code', async t => {
  t.plan(1)

  const channel = new Channel(path.join(__dirname, 'Accounts'))

  channel.send({
    event: 'account:recover',
    payload: {
      email: 'bob@telios.io',
      recoveryEmail: 'bob@mail.com'
    }
  })

  channel.on('account:recover:callback', cb => {
    const { error, data } = cb
    
    if(error) t.fail(error.message)

    t.ok(true)

    t.teardown(async () => {
      channel.kill()
    })
  })
})

test('get sync info', async t => {
  t.plan(2)

  const channel = new Channel(path.join(__dirname, 'Accounts'))

  channel.send({
    event: 'account:getSyncInfo',
    payload: {
      code: 'AbC123'
    }
  })

  channel.on('account:getSyncInfo:callback', cb => {
    const { error, data } = cb
    
    if(error) t.fail(error.message)

    console.log('SUCCESS ::', data)

    t.ok(data.drive_key)
    t.ok(data.email)

    t.teardown(async () => {
      channel.kill()
    })
  })
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
