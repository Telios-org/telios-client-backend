const tape = require('tape')
const _test = require('tape-promise').default
const test = _test(tape)
const path = require('path')
const fs = require('fs')
const Channel = require('./helper')
const { MockEmail } = require('./helper')
const { account } = require('@telios/client-sdk/lib/routes')

test('sync account with another device/peer', async t => {
  t.plan(99999)

  await cleanup()

  const channel = new Channel(path.join(__dirname, 'Accounts2'))

  channel.on('debug', data => {
    console.log('DEBUG', data)
  })

  channel.on('account:collection:updated', cb => {
    const { data } = cb

    console.log(data)

    if(data.collection === 'Contact') {
      const payload = {
        id: data.value.contactId
      }
    
      channel.send({ event: 'contact:removeContact', payload })

      channel.on('contact:removeContact:callback', cb => {
        const { error, data } = cb

        console.log('DELETED', { data, error })
       })
    }
  })

  // Start sync with Device A sync data
  channel.send({
    event: 'account:sync',
    payload: {
      deviceType: 'MOBILE', // MOBILE | DESKTOP
      driveKey: '931ec456ee0d005b8c2375b501e90bf9b8b445cab410920b244613bef2cee01d',
      email: 'newtst@telios.io',
      password: 'let me in 123'
    }
  })

  //  Listen for sync events. This will fire every time a new file has synced and when search indexes have been created
  channel.on('account:sync:callback', cb => {
    const { error, data } = cb
    
    // if(error) t.fail(error.message)

    if(data && data.files && data.files.done) {
      t.ok(1, 'Drive finished syncing all files')
    }

    if(data && data.searchIndex && data.searchIndex.emails && data.searchIndex.contacts) {
      t.ok(1, 'Drive finished creating new search indexes')
    }
  })

  channel.once('contact:createContacts:callback', cb => {
    const { error, data } = cb

    // if(error) t.fail(error.message)

    console.log('SUCCESS :: ', data)
    
    // contact = data[0]
    // t.ok(data.length > 0)
  })

  // Listen for successful login. Once we're here the user can go to the main mailbox view
  channel.on('account:login:callback', cb => {
    const { error, data } = cb

    // if(error) t.fail(error.stack)

    console.log('account', data)

    if(data) {
      // t.ok(data.deviceInfo.serverSig, 'New device has been registered and recieved a certificate from the API server')
      t.ok(data.signingPubKey, 'New device has an account signing public key')
      t.ok(data.signingPrivKey, 'New device has an account private key')

      setTimeout(() => {
        // const payload = {
        //   contactList: [{
        //     name: "gary hartey",
        //     givenName: 'gary',
        //     familyName: 'hartey',
        //     nickname: 'ghartey ',
        //     email: 'ghartey@gmail.com'
        //   }]
        // }
      
        // console.log('ADD CONTACT!')
        // channel.send({ event: 'contact:createContacts', payload })



        // const mockEmail = MockEmail({ subject: 'New Incoming Message', emailId: null, folderId: 1, aliasId: null, unread: false })

        // const payload = {
        //   type: 'Incoming',
        //   messages: [mockEmail],
        // }
      
        // channel.send({ event: 'email:saveMessageToDB', payload })
      
        // channel.once('email:saveMessageToDB:callback', cb => {
        //   console.log(cb)
        // })

      }, 10000)
    }

    t.teardown(() => {
      channel.kill()
    })
  })
  
})

async function cleanup() {
  if (fs.existsSync(path.join(__dirname, '/Accounts2'))) {
    fs.rmSync(path.join(__dirname, 'Accounts2'), { recursive: true })
  }
}
