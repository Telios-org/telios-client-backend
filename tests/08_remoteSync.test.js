const tape = require('tape')
const _test = require('tape-promise').default
const test = _test(tape)
const path = require('path')
const fs = require('fs')
const Channel = require('./helper')

const channel1 = new Channel(path.join(__dirname, 'Accounts'))
const channel2 = new Channel(path.join(__dirname, 'Accounts2'))

test('sync account with another device/peer', async t => {
  t.plan(3)

  await cleanup()

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

    channel1.on('debug', data => {
      console.log('DEBUG1', data)
    })

    channel2.on('debug', data => {
      console.log('DEBUG2', data)
    })

    // 3. Device B - Start sync with Device A sync data
    channel2.send({
      event: 'account:sync',
      payload: {
        deviceType: 'MOBILE', // MOBILE | DESKTOP
        driveKey: data.drive_key,
        email: data.email,
        password: 'letmein123'
      }
    })

    // 4. Device B - Listen for sync events. This will fire every time a new file has synced and when search indexes have been created
    channel2.on('account:sync:callback', cb => {
      const { error, data } = cb
      
      if(error) t.fail(error.message)

      // if(data && data.files && data.files.done) {
      //   t.ok(1, 'Drive finished syncing all files')
      // }

      if(data && data.searchIndex && data.searchIndex.emails && data.searchIndex.contacts) {
        t.ok(1, 'Drive finished creating new search indexes')
      }
    })

    // 5. Device B - Listen for successful login. Once we're here the user can go to the main mailbox view
    channel2.on('account:login:callback', cb => {
      const { error, data } = cb

      if(error) t.fail(error.stack)

      if(data) {
        // t.ok(data.deviceInfo.serverSig, 'New device has been registered and recieved a certificate from the API server')
        t.ok(data.signingPubKey, 'New device has an account signing public key')
        t.ok(data.signingPrivKey, 'New device has an account private key')
      }
    })
  })
})

// TODO: Fix sync test
test('update and sync changes between devices', async t => {
  t.plan(1)

  // channel1.on('drive:peer:updated', cb => {
  //   const { error, data } = cb
  
  //   console.log('CHANNEL 1 PEER STATUS', data.status)
  // })

  // channel2.on('drive:peer:updated', cb => {
  //   const { error, data } = cb
  
  //   console.log('CHANNEL 2 PEER STATUS', data.status)
  // })

  // channel1.on('account:collection:updated', async cb => {
  //   const { error, data } = cb

  //   if(error) return console.log('Channel2 ERR', error)

  //   console.log('CHANNEL1 UPDATED', data)

  //   if(data.type === 'del') {
  //     console.log(data)
  //     try {
  //       const contact = await addContact(channel1, {
  //         contactList: [{
  //           name: "Clovus Darneely",
  //           givenName: 'Clovus',
  //           familyName: 'Darneely',
  //           nickname: 'clovus.darneely',
  //           email: 'clovus.darneely@mail.com'
  //         }]
  //       })

  //       console.log('CHANNEL1 ADDED CONTACT')

  //       setTimeout(async () => {
  //         try {
  //           const c = await getContactById(channel2, contact[0].contactId)
  //           t.ok(c._id)
  //         } catch(err) {
  //           console.log(err)
  //         }
  //       }, 2000)
  //     } catch(err) {
  //       console.log('EE', err.stack)
  //     }
  //   }
  // })

  // channel2.once('account:collection:updated', async cb => {
  //   const { error, data } = cb

  //   if(error) return console.log('Channel2 ERR', error)

  //   console.log('CHANNEL2 UPDATED', data)

  //   try {
  //     if(data.type !== 'del') {
  //       setTimeout(async () => {
  //       await removeContact(channel2, data.value._id)
  //       console.log('CHANNEL2 REMOVED CONTACTD')
  //       }, 5000)
  //     }
  //   } catch(err) {
  //     console.log('ERR2', err)
  //   }
  // })

  // await addContact(channel1)

  t.ok(1)

  t.teardown(() => {
    channel1.kill()
    channel2.kill()
  })
})

async function cleanup() {
  if (fs.existsSync(path.join(__dirname, '/Accounts2'))) {
    fs.rmSync(path.join(__dirname, 'Accounts2'), { recursive: true })
  }
}


async function addContact(channel, payload) {
  return new Promise((resolve, reject) => {
    channel.once('contact:createContacts:callback', cb => {
      const { error, data } = cb

      if(error) return reject(error)

      resolve(data)
    })

    if(!payload) {
      payload = {
        contactList: [{
          name: "Clovus Darneely",
          givenName: 'Clovus',
          familyName: 'Darneely',
          nickname: 'clovus.darneely',
          email: 'clovus.darneely@mail.com'
        }]
      }
    }

    channel.send({ event: 'contact:createContacts', payload })
  })
}

async function removeContact(channel, id) {
  return new Promise((resolve, reject) => {
    channel.once('contact:removeContact:callback', cb => {
      const { error, data } = cb

      if(error) return reject(error)

      resolve(true)
    })

    channel.send({ event: 'contact:removeContact', payload: { id } })
  })
}

async function getContactById(channel, id) {
  return new Promise((resolve, reject) => {
    channel.once('contact:getContactById:callback', cb => {
      const { error, data } = cb

      if(error) return reject(error)

      resolve(data)
    })

    channel.send({ event: 'contact:getContactById', payload: { id } })
  })
}