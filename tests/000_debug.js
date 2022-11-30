const tape = require('tape')
const _test = require('tape-promise').default
const test = _test(tape)
const path = require('path')
const fs = require('fs')
const Channel = require('./helper')
const Drive = require('@telios/nebula')


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

    await createBlindPeer('91cc1132b2cc523bc9691167d2920324f236e2542c820bedb77c0f56a0e58247')

    // console.log('SUCCESS :: ', data)

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

    // const contact = await getContactById(_channel, contacts[0]._id)
    // console.log(contact)

    const contacts = await getAllContacts(_channel)
    console.log(contacts)

    
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

async function createBlindPeer(driveKey) {

  const keyPair = {
    publicKey: Buffer.from('39c2a523da4f4e507263863dd6944be7038b6bf8799d0c64dfc0b2828a1e5030', 'hex'),
    secretKey: Buffer.from('839b8c41ec97e01e568dada12da760171752edf95e74530e0851f13e40a23c1a39c2a523da4f4e507263863dd6944be7038b6bf8799d0c64dfc0b2828a1e5030', 'hex')
  }

  const drive = new Drive( './BlindPeer', driveKey, {
    keyPair,
    syncFiles: false,
    blind: true,
    broadcast: true,
    swarmOpts: {
      server: true,
      client: true
    }
  })

  await drive.ready()

  console.log({ keyPair: {
    publicKey: drive.keyPair.publicKey.toString('hex'),
    secretKey: drive.keyPair.secretKey.toString('hex')
  }})
}
