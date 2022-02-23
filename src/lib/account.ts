const fs = require('fs')
const path = require('path')
const { randomBytes } = require('crypto')

import { AccountOpts } from '../types'
import { StoreSchema } from '../schemas'

const BSON = require('bson')
const { ObjectID } = BSON

export default async (props: AccountOpts) => {
  const { channel, userDataPath, msg, store } = props
  const { event, payload } = msg
  const Account = store.sdk.account
  const Crypto = store.sdk.crypto
  /**
   * CREATE ACCOUNT
   */
  if (event === 'account:create') {
    try {
      const accountUID = randomBytes(8).toString('hex') // This is used as an anonymous ID that is sent to Matomo
      const parentAccountsDir = path.join(userDataPath)
      if (!fs.existsSync(parentAccountsDir)) {
        fs.mkdirSync(parentAccountsDir)
      }
      const acctPath = path.join(userDataPath, `/${payload.email}`)
      store.acctPath = acctPath

      fs.mkdirSync(acctPath)

      // Generate account key bundle
      const { secretBoxKeypair, signingKeypair, mnemonic } = Account.makeKeys()

      const encryptionKey = Crypto.generateAEDKey()
      const driveKeyPair = {
        publicKey: Buffer.from(signingKeypair.publicKey, 'hex'),
        secretKey: Buffer.from(signingKeypair.privateKey, 'hex')
      }

      // Create account Nebula drive
      const drive = store.setDrive({
        name: `${acctPath}/Drive`,
        encryptionKey,
        keyPair: driveKeyPair
      })

      handleDriveNetworkEvents(drive, channel) // listen for internet or drive network events

      await drive.ready()

      // Initialize models
      await store.initModels()

      const accountModel = store.models.Account

      // Create recovery file with master pass
      await accountModel.setVault(mnemonic, 'recovery', {
        master_pass: payload.password,
      })

      // Create vault file with drive enryption key
      await accountModel.setVault(payload.password, 'vault', {
        drive_encryption_key: encryptionKey,
        keyPair: driveKeyPair,
      })

      const opts = {
        account: {
          account_key: secretBoxKeypair.publicKey,
          recovery_email: payload.recoveryEmail,
          device_drive_key: drive.publicKey,
          device_signing_key: signingKeypair.publicKey,
        },
      }

      // Prepare registration payload
      const { account, sig: accountSig } = await Account.init(
        opts,
        signingKeypair.privateKey,
      )

      const registerPayload = {
        account,
        sig: accountSig,
        vcode: payload.vcode,
      }

      const { _sig: serverSig } = await Account.register(registerPayload) // Register account with API server

      const _id = new ObjectID()

      // Save account to drive's Account collection
      const acctDoc = await accountModel.insert({
        _id,
        accountId: _id.toString('hex'),
        uid: accountUID,
        secretBoxPubKey: secretBoxKeypair.publicKey,
        secretBoxPrivKey: secretBoxKeypair.privateKey,
        driveEncryptionKey: encryptionKey,
        deviceSigningPubKey: signingKeypair.publicKey,
        deviceSigningPrivKey: signingKeypair.privateKey,
        serverSig: serverSig,
        deviceId: account.device_id,
        createdAt: new Date().toUTCString(),
        updatedAt: new Date().toUTCString(),
      })

      await runMigrate(acctPath, '/Drive', null, store)

      handleDriveMessages(drive, acctDoc, channel, store) // listen for async messages/emails coming from p2p network

      store.setAccount(acctDoc)

      const auth = {
        claims: {
          account_key: secretBoxKeypair.publicKey,
          device_signing_key: signingKeypair.publicKey,
          device_id: account.device_id,
        },
        device_signing_priv_key: signingKeypair.privateKey,
        sig: serverSig,
      }

      store.setAuthPayload(auth)

      channel.send({
        event: 'account:create:callback',
        data: {
          uid: accountUID,
          deviceId: account.device_id,
          signedAcct: account,
          secretBoxKeypair,
          signingKeypair,
          mnemonic,
          sig: serverSig,
        }
      })
    } catch (err: any) {
      channel.send({
        event: 'account:create:callback',
        error: {
          name: err.name,
          message: err.message,
          stacktrace: err.stack,
        },
        data: null
      })
    }
  }

  /**
   * GET ACCOUNT / LOGIN
   */
  if (event === 'account:login') {
    const acctPath = `${userDataPath}/${payload.email}`

    store.acctPath = acctPath
    
    let mnemonic
    let encryptionKey
    let keyPair
    let drive

    try {
      // Initialize account collection
      const accountModel = store.models.Account

      try {
        // Retrieve drive encryption key and keyPair from vault using master password
        const { drive_encryption_key: encryptionKey, keyPair } = accountModel.getVault(payload.password, 'vault')

        channel.send({
          event: 'debug:info',
          data: {
            message: 'GET VAULT',
            encryptionKey,
            keyPair
          }
        })

        if(encryptionKey && keyPair) {
          // Notify the receiver the master password has been authenticated
          channel.send({ event: 'account:authorized' })
        }

        // Initialize drive
        drive = store.setDrive({
          name: `${acctPath}/Drive`,
          encryptionKey,
          keyPair: {
            publicKey: Buffer.from(keyPair.publicKey, 'hex'),
            secretKey: Buffer.from(keyPair.secretKey, 'hex'),
          },
        })

        handleDriveNetworkEvents(drive, channel) // listen for internet or drive network events

        await drive.ready()

      } catch(err: any) {

        channel.send({
          event: 'debug:info',
          error: { 
            name: 'VAULTERROR', 
            message: err.message, 
            stack: err.stack 
          }
        })
        
        if(err?.type !== 'VAULTERROR') {
          return channel.send({
            event: 'account:login:callback',
            error: { 
              name: err.name, 
              message: err.message, 
              stack: err.stack 
            }
          })
        }

        try {
          const data = await runMigrate(acctPath, '/Drive', payload.password, store)
    
          mnemonic = data?.mnemonic
          encryptionKey = data?.encryptionKey
          keyPair = data?.keyPair
          drive = data?.drive
    
        } catch(err:any) {
          return channel.send({
            event: 'account:login:callback',
            error: { 
              name: err.name, 
              message: err.message, 
              stack: err.stack 
            }
          })
        }
      }

      // Initialize models
      await store.initModels()

      // Get account
      const fullAcct = await accountModel.findOne()

      channel.send({
        event: 'debug:info',
        data: { fullAcct }
      })

      handleDriveMessages(drive, fullAcct, channel, store) // listen for async messages/emails coming from p2p network

      store.setAccount(fullAcct)

      const auth = {
        claims: {
          account_key: fullAcct.secretBoxPubKey,
          device_signing_key: fullAcct.deviceSigningPubKey,
          device_id: fullAcct.deviceId,
        },
        device_signing_priv_key: fullAcct.deviceSigningPrivKey,
        sig: fullAcct.serverSig,
      }

      store.setAuthPayload(auth)

      channel.send({ event: 'account:login:callback', error: null, data: { ...fullAcct, mnemonic }})
    } catch (err: any) {
      channel.send({
        event: 'account:login:callback',
        error: { 
          name: err.name, 
          message: err.message, 
          stack: err.stack 
        },
        data: null,
      })
    }
  }

  /**
   * UPDATE ACCOUNT
   */
  if (event === 'account:update') {
    const { accountId, displayName, avatar } = payload

    try {
      const Account = store.models.Account

      const account = await Account.update({ accountId }, { displayName, avatar })
      channel.send({ event: 'account:update:callback', data: account })
    } catch (err: any) {
      channel.send({
        event: 'account:update:callback',
        error: { 
          name: err.name, 
          message: err.message, 
          stack: err.stack 
        },
        data: null
      })
    }
  }

  /**
   * GET ACCOUNT STATS
   */
  if (event === 'account:retrieveStats') {
    try {
      const account = store.sdk.account

      const stats = await account.retrieveStats()

      const finalPayload = {
        plan: stats.plan,
        dailyEmailUsed: stats.daily_email_used,
        dailyEmailResetDate: stats.daily_email_reset_date,
        namespaceUsed: stats.namespace_used,
        aliasesUsed: stats.aliases_used,
        storageSpaceUsed: stats.storage_space_used,
        lastUpdated: stats.last_updated,
        maxOutgoingEmails: stats.maxOutgoingEmails,
        maxAliasNames: stats.maxAliasNames,
        maxAliasAddresses: stats.maxAliasAddresses,
        maxGBCloudStorage: stats.maxGBCloudStorage,
        maxGBBandwidth: stats.maxGBBandwidth
      }

      channel.send({ event: 'account:retrieveStats:callback', error: null, data: finalPayload })
    } catch (err: any) {
      channel.send({
        event: 'account:retrieveStats:callback',
        error: { 
          name: err.name, 
          message: err.message, 
          stack: err.stack 
        },
        data: null
      })
    }
  }

  /**
   * REMOVE ACCOUNT
   */
  if (event === 'account:remove') {
    const acctPath = path.join(userDataPath, `/${payload.email}`)
    fs.rmSync(acctPath, { force: true, recursive: true })
  }

  /**
   * LOGOUT
   */
  if (event === 'account:logout') {
    try {
      store.setAccountSecrets({ email: undefined, password: undefined })
      store.setAccount(null)

      channel.send({ event: 'account:logout:callback', error: null, data: null })

      if (channel.pid) {
        channel.kill(channel.pid)
      }
    } catch (err: any) {
      channel.send({ 
        event: 'account:logout:callback', 
        error: {
          name: err.name,
          message: err.message,
          stacktrace: err.stack,
        }, 
        data: null 
      })
    }

    return 'loggedOut'
  }

  if (event === 'account:refreshToken') {
    try {
      const token = store.refreshToken()

      channel.send({ event: 'account:refreshToken:callback', error: null, data: token })
    } catch (err: any) {
      channel.send({ 
        event: 'account:refreshToken:callback', 
        error: {
          name: err.name,
          message: err.message,
          stacktrace: err.stack,
        }, 
        data: null 
      })
    }

    return 'loggedOut'
  }

  /**
   * EXIT
   */
  if (event === 'account:exit') {
    channel.kill(0)
  }
}

async function handleDriveMessages(
  drive: any,
  account: any,
  channel: any,
  store: StoreSchema,
) {
  drive.on('message', (peerPubKey: string, data: any) => {
    const msg = JSON.parse(data.toString())

    // Only connect to peers with the SDK priv/pub keypair
    if (msg.type && peerPubKey === store.teliosPubKey) {
      // Service is telling client it has a new email to sync
      if (msg.type === 'newMail') {
        channel.send({
          event: 'account:newMessage',
          data: { meta: msg.meta, account, async: true },
        })
      }
    } else {
      channel.send({
        event: 'account:newMessage:callback',
        error: {
          name: 'account:newMessage:callback',
          message: 'Could not connect to peer',
          stacktrace: '',
        }
      })
    }
  })
}

function handleDriveNetworkEvents(drive: any, channel: any) {
  drive.on('network-updated', (network: { internet: boolean; drive: boolean }) => {
      channel.send({ event: 'drive:network:updated', data: { network } })
    }
  )
}

async function runMigrate(rootdir:string, drivePath: string, password: any, store: StoreSchema) {
  try {
    const migrateModel = store.models.Migrate
    const Migrate = await migrateModel.ready()

    let migrations: any[] = await Migrate.find()

    // Get previously ran migrations from DB
    migrations = migrations.map((item: any) => {
      return item.name
    })

    // Check migrations directory for migration files
    const files = fs.readdirSync(path.join(__dirname, '..', 'migrations'))

    // If no migrations have run add all migrations to migrate collection. 
    // This case should run when creating a fresh new account.
    if(migrations.length === 0) {
      for(const file of files) {
        await Migrate.insert({ name: file })  
      }
    } else {
      // Get an array of files that have not been ran
      const difference = files.filter((item:any) => migrations.includes(item))

      // Run migrations
      for(const file of difference) {
        const filePath = `${path.join(__dirname, '../../', 'migrations')}/${file}`
        const Script = require(filePath)
        await Script.up({ rootdir, drivePath, password })
        await Migrate.insert({ name: file }) // Save migrated file to DB
      }
    }
  } catch(err:any) {
    // Migrate from old Hypercore v10 to newer version of v10
    if(err.message.indexOf('Cannot read property') > -1) {
      const driveFiles = fs.readdirSync(rootdir)
      if(driveFiles.indexOf('app.db')) {
        const filePath = `${path.join(__dirname, '../../', 'migrations')}/00_initial.js`
        const Script = require(filePath)

        const { account, mnemonic, encryptionKey, keyPair } = await Script.up({ rootdir, drivePath, password })

        const drive = store.setDrive({
          name: `${rootdir}/${drivePath}`,
          encryptionKey,
          keyPair
        })

        await drive.ready()

        // Initialize models
        await store.initModels()

        const accountModel = store.models.Account

        const _id = new ObjectID()

        // Save account to drive's Account collection
        const acctDoc = await accountModel.insert({
          _id,
          accountId: _id.toString('hex'),
          uid: account.uid,
          secretBoxPubKey: account.secretBoxPubKey,
          secretBoxPrivKey: account.secretBoxPrivKey,
          driveEncryptionKey: encryptionKey,
          deviceSigningPubKey: account.deviceSigningPubKey,
          deviceSigningPrivKey: account.deviceSigningPrivKey,
          serverSig: account.serverSig,
          deviceId: account.deviceId,
          createdAt: new Date().toUTCString(),
          updatedAt: new Date().toUTCString(),
        })

        // Create recovery file with master pass
        await accountModel.setVault(mnemonic, 'recovery', {
          master_pass: password,
        })

        // Create vault file with drive enryption key
        await accountModel.setVault(password, 'vault', {
          drive_encryption_key: encryptionKey,
          keyPair
        })

        return { 
          mnemonic,
          encryptionKey,
          keyPair,
          account: acctDoc,
          drive
        }
      }
    }
  }
}
