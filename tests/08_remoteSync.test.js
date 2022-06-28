const tape = require('tape')
const _test = require('tape-promise').default
const test = _test(tape)
const path = require('path')
const fs = require('fs')
const Channel = require('./helper')
const { account } = require('@telios/client-sdk/lib/routes')

test('sync account with another device/peer', async t => {
  t.plan(5)

  await cleanup()

  const channel1 = new Channel(path.join(__dirname, 'Accounts'))

  // 1. Device A - Login
  channel1.send({
    event: 'account:login',
    payload: {
      email: 'bob@telios.io',
      password: 'letmein123'
    }
  })

  // 2. Device A - Generate Sync code
  channel1.once('account:login:callback', cb => {
    const { error, data } = cb
    
    if(error) {
      t.fail(error.message)
      channel1.kill()
    }

    channel1.send({ event: 'account:createSyncCode'})
  })

  channel1.once('account:createSyncCode:callback', cb => {
    const { error, data } = cb
    
    if(error) {
      t.fail(error.message)
      channel1.kill()
    }

    console.log('SYNC CODE', data)

    // 3. Device B - Init
    const channel2 = new Channel(path.join(__dirname, 'Accounts2'))

    channel2.on('debug', data => {
      console.log('DEBUG', data)
    })

    // 4. Device B - Start sync with Device A sync data
    channel2.send({
      event: 'account:sync',
      payload: {
        deviceType: 'MOBILE', // MOBILE | DESKTOP
        driveKey: data.drive_key,
        email: data.email,
        password: 'letmein123'
      }
    })

    // channel2.send({
    //   event: 'account:sync',
    //   payload: {
    //     deviceType: 'MOBILE', // MOBILE | DESKTOP
    //     driveKey: data.drive_key,
    //     email: data.email,
    //     password: 'letmein123'
    //   }
    // })

    // 5. Device B - Listen for sync events. This will fire every time a new file has synced and when search indexes have been created
    channel2.on('account:sync:callback', cb => {
      const { error, data } = cb
      
      if(error) t.fail(error.message)

      if(data?.files?.done) {
        t.ok(1, 'Drive finished syncing all files')
      }

      if(data?.searchIndex?.emails && data?.searchIndex?.contacts) {
        t.ok(1, 'Drive finished creating new search indexes')
      }
    })

    // 6. Device B - Listen for successful login. Once we're here the user can go to the main mailbox view
    channel2.on('account:login:callback', cb => {
      const { error, data } = cb


      
      if(error) t.fail(error.stack)

      if(data) {
        console.log('DATA', data)
        t.ok(data.deviceInfo.serverSig, 'New device has been registered and recieved a certificate from the API server')
        t.ok(data.signingPubKey, 'New device has an account signing public key')
        t.ok(data.signingPrivKey, 'New device has an account private key')
      }

      t.teardown(() => {
        channel1.kill()
        channel2.kill()
      })
    })
  })
})

async function cleanup() {
  if (fs.existsSync(path.join(__dirname, '/Accounts2'))) {
    fs.rmSync(path.join(__dirname, 'Accounts2'), { recursive: true })
  }
}
