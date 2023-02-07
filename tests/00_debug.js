const tape = require('tape')
const _test = require('tape-promise').default
const test = _test(tape)
const path = require('path')
const fs = require('fs')
const Channel = require('./helper')
const Drive = require('@telios/nebula')
const { MockAliasEmail } = require('./helper')
const { initStreamPullState } = require('@telios/nebula/lib/crypto')


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

    // const bootstrap = await init(_channel)

    // let aliasFolders = await getAliasAddresses(_channel)

    // setTimeout(async() => {
    //   const emails = await getEmailsByAlias(_channel)
    //   console.log(emails.length)

    //   const eml1 = await getEmailById(_channel, emails[3].emailId)
    //   //console.log(eml1)

    //   const eml2 = await getEmailById(_channel, emails[4].emailId)
    //   const eml3 = await getEmailById(_channel, emails[5].emailId)
    //   const eml4 = await getEmailById(_channel, emails[6].emailId)
    //   //console.log(eml2)

    //   setTimeout(async () => {
        // aliasFolders = await getAliasAddresses(_channel)

        // console.log(aliasFolders)
    //   }, 2000)
    // }, 5000)

    for(let i=0; i < 150; i++) {
      saveEmailToDB(_channel, `EMAIL!!! ${i}${i}${i}${i}`, )
      // console.log(`saved ${i}...`)
    }

    setTimeout(async() => {
      const emails = await getEmailsByAlias(_channel)
      console.log('EMAILS LENGTH', emails.length)

      // const eml1 = await getEmailById(_channel, emails[11].emailId)
      // //console.log(eml1)

      // const eml2 = await getEmailById(_channel, emails[12].emailId)
      // const eml3 = await getEmailById(_channel, emails[13].emailId)
      // const eml4 = await getEmailById(_channel, emails[14].emailId)
      //console.log(eml2)

      //setTimeout(async () => {
        // aliasFolders = await getAliasAddresses(_channel)

        // console.log(aliasFolders)
      //}, 2000)
    }, 5000)

    // console.log('GET EMAIL BY _id')
    // const email = await getEmailById(_channel, 'd89637860b13bb7079deba1c88a0971dd9453e19421bb427cf4b0ec928359c8904f0640d550002c4e7649bf9f94b2deeb2200f6c6f326bfa28867182f009cdf4')
    // console.log(email)



    // const alias = await createAlias(_channel)
    // console.log(alias)
    // const aliasUpdated = await updateAlias(_channel)
    // console.log(aliasUpdated)
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

async function init(channel) {
  return new Promise((resolve, reject) => {
    channel.send({
      event: 'mailbox:register',
      payload: {
        account_key: '0000000000010000000000000001000000000000001000000000000001000000',
        addr: 'bob1@telios.io'
      }
    })

    channel.once('mailbox:register:callback', async cb => {
      const { error, data } = cb

      if(error) return reject(error.message)

      console.log('MAILBOX :: ', data)
      
      const alias = await createAlias(channel, data.mailboxId)

      console.log('ALIAS ::: ', alias)

      return resolve({ mailbox: data, alias })
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
    const mockEmail = MockAliasEmail({ subject: subject || 'New Incoming Message', aliasAddress:'alice2022#netflix@dev.telios.io', unread: false })

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

      channel.send({ event: 'email:getMessageById', payload:{ id: data[0].emailId }})

      channel.once('email:getMessageById:callback', cb => {

        if(cb.error) return reject(cb.error)

        resolve(cb.data)
      })
    })
  })
}

async function getEmailsByAlias(channel) {
  return new Promise((resolve, reject) => {
    const payload = {
      id: 'alice2022#netflix'
    }
  
    channel.send({ event: 'email:getMessagesByAliasId', payload })
  
    channel.once('email:getMessagesByAliasId:callback', cb => {
      const { error, data } = cb
  
      if(error) return reject(error.message)
  
      return resolve(data)
    })
  })
}

async function getAliasAddresses(channel) {
  return new Promise((resolve, reject) => {
    const payload = {
      namespaceKeys: ['alice2022']
    }

    channel.send({ event: 'alias:getMailboxAliases', payload })


    channel.once('alias:getMailboxAliases:callback', cb => {
      const { error, data } = cb

      if(error) return reject(error.message)

      resolve(data)
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

async function createAlias(channel, mailboxId) {
  return new Promise((resolve, reject) => {
    channel.send({
      event: 'alias:registerAliasNamespace',
      payload: {
        mailboxId,
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
