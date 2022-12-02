const tape = require('tape')
const _test = require('tape-promise').default
const test = _test(tape)
const path = require('path')
const fs = require('fs')
const Channel = require('./helper')
const Drive = require('@telios/nebula')
const { MockEmail } = require('./helper')


test('account login success', async t => {
  t.plan(1)
  try {

  // CREATE ACCOUNT
  // await createAccount()

  _channel = new Channel(path.join(__dirname, 'Accounts'))

  _channel.send({
    event: 'account:login',
    payload: {
      email: 'bob1@telios.io',
      password: 'letmein123'
    }
  })

  _channel.on('debug', data => {
    console.log('DEBUG', data)
  })

  _channel.on('account:login:status', data => {
    console.log(data)
  })


  _channel.once('account:login:callback', async cb => {
    const { error, data } = cb
    
    if(error) {
      console.log(error)
      _channel.kill()
    }

    // const payload = {
    //   contactList: [{
    //     name: "Cee ROD",
    //     givenName: 'Charles',
    //     familyName: 'Rodriguez',
    //     nickname: 'ccrr',
    //     email: 'cc.rr@mail.com'
    //   }]
    // }
    // const contacts = await addContact(_channel, payload)

    // for(let i=0; i < 15; i++) {
    //   const payload = {
    //     contactList: [{
    //       name: `MY MAN~!!! ${i}${i}${i}${i}`,
    //       givenName: 'Charles',
    //       familyName: 'Rodriguez',
    //       nickname: 'ccrr',
    //       email: 'cc.rr@mail.com'
    //     }]
    //   }
    //   addContact(_channel, payload)
    // }

    // const contact = await getContactById(_channel, contacts[0]._id)
    // console.log(contact)

    // const contacts = await getAllContacts(_channel)
    // console.log(contacts)

    

    // for(let i=0; i < 5; i++) {
    //   await saveEmailToDB(_channel, `LETS hi ${i}${i}${i}${i}`)
    //   console.log('email saved')
    // }

    // await updateFolderCount(_channel)

    // const emails = await getEmailsByFolder(_channel)
    // console.log(emails.length)

    // console.log('GET EMAIL BY _id')
    // const email = await getEmailById(_channel, 'd89637860b13bb7079deba1c88a0971dd9453e19421bb427cf4b0ec928359c8904f0640d550002c4e7649bf9f94b2deeb2200f6c6f326bfa28867182f009cdf4')
    // console.log(email)



    // const alias = await createAlias(_channel)
    // console.log(alias)
    const aliasUpdated = await updateAlias(_channel)
    console.log(aliasUpdated)
  })
} catch(err) {
  console.log(err)
}
})

// test('update account', async t => {
//   t.plan(1)

//   _channel.send({
//     event: 'account:update',
//     payload: {
//       avatar: 'somebase64encodedtext'
//     }
//   })

//   _channel.on('account:update:callback', cb => {
//     const { error, data } = cb
    
//     if(error) t.fail(error.message)

//     t.ok(data)
//   })
// })


async function createAccount() {
  return new Promise(async (resolve, reject) => {
    await cleanup()

    const channel = new Channel(path.join(__dirname, 'Accounts'))

    channel.once('account:create:callback', cb => {
      const { error, data } = cb

      if(error) return reject(error)

      setTimeout(() => {
        channel.kill()

        return resolve(data)
      }, 1000)
    })

    channel.send({
      event: 'account:create',
      payload: {
        email: 'bob1@telios.io',
        password: 'letmein123',
        recoveryEmail: 'bob@mail.com',
        encryptionKey: 'c3eeb95e5ecb007d74053278574a47b0502c04973b62e60c2e9f4abafeecb8d2', // Only pass these in to initialize with existing key
        mnemonic: 'forward neck limb trim bottom teach theme miracle warrior beef steel jazz bulb job host silver anxiety ring old always polar option stereo pride' // Only pass these in to initialize with existing mnemonic
      }
    })
  })
}


async function addContact(channel, payload) {
  return new Promise((resolve, reject) => {

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

    channel.once('contact:createContacts:callback', cb => {
      const { error, data } = cb

      if(error) return reject(err)
      
      return resolve(data)
    })

    channel.send({ event: 'contact:createContacts', payload })

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

async function getAllContacts(channel) {
  return new Promise((resolve, reject) => {
    channel.send({ event: 'contact:getAllContacts' })

    channel.once('contact:getAllContacts:callback', cb => {
      const { error, data } = cb

      if(error) return reject(error)

      return resolve(data)
    })
  })
}


async function cleanup() {
  if (fs.existsSync(path.join(__dirname, '/Accounts'))) {
    fs.rmSync(path.join(__dirname, 'Accounts'), { recursive: true })
  }
}

async function saveEmailToDB(channel, subject) {
  return new Promise((resolve, reject) => {
    const mockEmail = MockEmail({ subject: subject || 'New Incoming Message', emailId: null, folderId: 1, aliasId: null, unread: false })

    const payload = {
      type: 'Incoming',
      messages: [mockEmail]
    }

    channel.send({ event: 'email:saveMessageToDB', payload })

    channel.once('email:saveMessageToDB:callback', cb => {
      const { error, data } = cb

      if(error) return reject(error)

      return resolve(data)
    })
  })
}

async function getEmailsByFolder(channel) {
  return new Promise((resolve, reject) => {
    const payload = {
      id: 1
    }

    channel.send({ event: 'email:getMessagesByFolderId', payload })

    channel.once('email:getMessagesByFolderId:callback', cb => {
      const { error, data } = cb

      if(error) return reject(error)

      return resolve(data)
    })
  })
}

async function getEmailById(channel, id) {
  return new Promise((resolve, reject) => {
    const payload = {
      id
    }
  
    channel.send({ event: 'email:getMessageById', payload })
  
    channel.once('email:getMessageById:callback', cb => {
      const { error, data } = cb
  
      if(error) return reject(error)

      return resolve(data)
    })
  })
}

async function updateFolderCount(channel) {
  return new Promise((resolve, reject) => {
    const payload = {
      id: 1,
      amount: 1
    }
  
    channel.send({ event: 'folder:updateFolderCount', payload })
  
    channel.once('folder:updateFolderCount:callback', cb => {
      const { error, data } = cb
  
      if(error) return reject(error)

      return resolve()
    })
  })
}

async function createAlias(channel) {
  return new Promise((resolve, reject) => {
    channel.send({
      event: 'alias:registerAliasNamespace',
      payload: {
        mailboxId: 'test12312312',
        namespace: 'alice2022'
      }
    })
  
    channel.on('alias:registerAliasNamespace:callback', cb => {
      const { error, data } = cb
  
      if(error) return reject(error)

      const payload = {
        namespaceName: 'alice2022',
        domain: 'dev.telios.io',
        address: 'netflix',
        description: '',
        fwdAddresses: '',
        disabled: false,
        count: 0,
        createdAt: new Date().toUTCString(),
        updatedAt: new Date().toUTCString()
      }
    
      channel.send({ event: 'alias:registerAliasAddress', payload })
    
      channel.once('alias:registerAliasAddress:callback', cb => {
        const { error, data } = cb
    
        if(error) return reject(error)
    
        return resolve(data)
      })
    })
  })
}

async function updateAlias(channel) {
  return new Promise((resolve, reject) => {
    const payload = {
      address: 'netflix'
    }

    channel.send({ event: 'alias:updateAliasAddress', payload })

    channel.once('alias:updateAliasAddress:callback', cb => {
      const { error, data } = cb
    
      if(error) return reject(error)

      const payload = {
        namespaceKeys: ['alice2022']
      }
    
      channel.send({ event: 'alias:getMailboxAliases', payload })
    
    
      channel.once('alias:getMailboxAliases:callback', cb => {
        const { error, data } = cb
    
        if(error) return reject(error)
    
        return resolve(data)
      })
    })
  })
}
