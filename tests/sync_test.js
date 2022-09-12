const tape = require('tape')
const _test = require('tape-promise').default
const test = _test(tape)
const path = require('path')
const fs = require('fs')
const Channel = require('./helper')

test('sync account with another device/peer', async t => {
  t.plan(5)

//  await cleanup()

  const channel = new Channel(path.join(__dirname, 'Accounts2'))

  channel.on('debug', data => {
    console.log('DEBUG', data)
  })

  channel.on('account:collection:updated', data => {
    console.log(data)
  })

  // Start sync with Device A sync data
  channel.send({
    event: 'account:sync',
    payload: {
      deviceType: 'MOBILE', // MOBILE | DESKTOP
      driveKey: '103ff673e617cdd1b3db5e990079be77f88082387cf748e42c5a5a89786b8f77',
      email: 'testerman@dev.telios.io',
      password: 'let me in 123'
    }
  })

  //  Listen for sync events. This will fire every time a new file has synced and when search indexes have been created
  channel.on('account:sync:callback', cb => {
    const { error, data } = cb
    
    if(error) t.fail(error.message)

    if(data && data.files && data.files.done) {
      t.ok(1, 'Drive finished syncing all files')
    }

    if(data && data.searchIndex && data.searchIndex.emails && data.searchIndex.contacts) {
      t.ok(1, 'Drive finished creating new search indexes')
    }
  })

  // channel.once('contact:createContacts:callback', cb => {
  //   const { error, data } = cb

  //   // if(error) t.fail(error.message)

  //   console.log('SUCCESS :: ', data)
    
  //   // contact = data[0]
  //   // t.ok(data.length > 0)
  // })


  channel.send({
    event: 'account:login',
    payload: {
      email: 'newtst@dev.telios.io',
      password: 'let me in 123'
    }
  })

     
  // channel.send({ event: 'account:getSyncInfo', payload:{ code: '995020'}})

  // channel.once('account:getSyncInfo:callback', cb => {
  //   console.log('CALLBACK', cb)
  // })

  // Listen for successful login. Once we're here the user can go to the main mailbox view
  channel.on('account:login:callback', cb => {
    const { error, data } = cb

    console.log(error)

    // if(error) t.fail(error.stack)

    console.log('account', data)

    if(data) {
      // t.ok(data.deviceInfo.serverSig, 'New device has been registered and recieved a certificate from the API server')
      t.ok(data.signingPubKey, 'New device has an account signing public key')
      t.ok(data.signingPrivKey, 'New device has an account private key')

      // setTimeout(() => {
      //   channel.send({ event: 'account:createSyncCode'})

      //   channel.on('account:createSyncCode:callback', cb => {
      //     console.log(cb)
      //   })
      // }, 5000)
        
    
      // setTimeout(() => {
      //   channel.send({ event: 'account:getSyncInfo', payload:{ code: '0ad014'}})
      // }, 5000)
      
    
      // channel.once('account:getSyncInfo:callback', cb => {
      //   console.log('CALLBACK', cb)
      // })

      // setTimeout(() => {
      //   const payload = {
      //     contactList: [{
      //       name: "Jeff Bridges",
      //       givenName: 'Jeff',
      //       familyName: 'Bridges',
      //       nickname: 'Jeff.bridges',
      //       email: 'Jeff.bridge@gmail.com'
      //     }]
      //   }
      
      //   console.log('ADD CONTACT!')
      //   channel.send({ event: 'contact:createContacts', payload })
      // }, 20000)
    }

    // t.teardown(() => {
    //   channel.kill()
    // })
  })
  
})

async function cleanup() {
  if (fs.existsSync(path.join(__dirname, '/Accounts2'))) {
    fs.rmSync(path.join(__dirname, 'Accounts2'), { recursive: true })
  }
}
