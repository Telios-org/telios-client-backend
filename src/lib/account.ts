const fs = require('fs')
const path = require('path')
import { UTCtimestamp } from '../util/date.util'
const { randomBytes } = require('crypto')
const { v4: uuidv4 } = require('uuid')

import { AccountOpts, DriveStatuses } from '../types'
import { StoreSchema } from '../schemas'
import { Store } from '../Store'
import { resolve } from 'path'
import { sign } from 'crypto'

const BSON = require('bson')
const { ObjectID } = BSON

export default async (props: AccountOpts) => {
  const { channel, userDataPath, msg, store } = props
  const { event, payload } = msg
  const Account = store.sdk.account
  const Crypto = store.sdk.crypto
  
  /*************************************************
   *  CREATE ACCOUNT
   ************************************************/
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

      // Create account Nebula drive
      const drive = store.setDrive({
        name: `${acctPath}/Drive`,
        encryptionKey,
        keyPair: {
          publicKey: signingKeypair.publicKey,
          secretKey: signingKeypair.privateKey
        }
      })

      handleDriveNetworkEvents(drive, channel) // listen for internet or drive network events

      await drive.ready()

      store.setDriveStatus('ONLINE')

      // Join Telios as a peer
      joinPeer(store, store.teliosPubKey, channel)

      // Initialize models
      await store.initModels()

      const accountModel = store.models.Account

      // Create recovery file with master pass
      await accountModel.setVault(mnemonic, 'recovery', {
        master_pass: payload.password,
      })

      // Create vault file with drive enryption key
      await accountModel.setVault(payload.password, 'vault', {
        drive_encryption_key: encryptionKey
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
        driveSyncingPublicKey: drive.publicKey,
        secretBoxPubKey: secretBoxKeypair.publicKey,
        secretBoxPrivKey: secretBoxKeypair.privateKey,
        driveEncryptionKey: encryptionKey,
        createdAt: UTCtimestamp(),
        updatedAt: UTCtimestamp()
      })

      // Save and encrypt device info. Needed for bootstrapping drive.
      accountModel.setDeviceInfo({
        keyPair: {
          publicKey: signingKeypair.publicKey,
          secretKey: signingKeypair.privateKey
        },
        deviceId: account.device_id,
        deviceType: payload.deviceType || 'DESKTOP',
        serverSig: serverSig
      }, payload.password)

      handleDriveMessages(drive, acctDoc, channel, store) // listen for async messages/emails coming from p2p network

      store.setAccount(acctDoc)

      store.setAccountSecrets({ email: payload.email, password: payload.password })

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
          accountId: _id.toString('hex'),
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

  /*************************************************
   *  GET ACCOUNT/LOGIN
   ************************************************/
  if (event === 'account:login') {
    login()
  }

  /*************************************************
   *  FORGOT PASSWORD
   ************************************************/
  if(event === 'account:resetPassword') {
    const { passphrase, newPass } = payload

    const acctPath = `${userDataPath}/${payload.email}`

    store.acctPath = acctPath

    try {
      const accountModel = store.models.Account

      // Get old password
      const { master_pass } = accountModel.getVault(passphrase, 'recovery')
      
      // Retrieve drive encryption key and keyPair from vault using old master password
      const { drive_encryption_key: encryptionKey } = accountModel.getVault(master_pass, 'vault')

      // Get device keypair
      const deviceInfo = accountModel.getDeviceInfo(master_pass)

      // Initialize drive
      const drive = store.setDrive({
        name: `${acctPath}/Drive`,
        encryptionKey,
        keyPair: {
          publicKey: deviceInfo.keyPair.publicKey,
          secretKey: deviceInfo.keyPair.secretKey
        }
      })

      handleDriveNetworkEvents(drive, channel) // listen for internet or drive network events

      await drive.ready()

      // Initialize models
      await store.initModels()

      // Update recovery file with new password
      await accountModel.setVault(passphrase, 'recovery', { master_pass: newPass })

      // Update vault file with new password
      await accountModel.setVault(newPass, 'vault', { drive_encryption_key: encryptionKey })

      // Re-encrypt device info file with new pass
      await accountModel.setDeviceInfo(deviceInfo, newPass)

      channel.send({
        event: 'account:resetPassword:callback',
        data: {
          reset: true
        },
      })
    } catch(err: any) {
      channel.send({
        event: 'account:resetPassword:callback',
        error: { 
          name: err.name, 
          message: err.message, 
          stack: err.stack 
        },
        data: null,
      })
    }
  }

  /*************************************************
   *  RECOVER ACCOUNT / Sync devices
   ************************************************/
  // Step 0 - Initiate account recovery by having a code emailed to the User's recovery email
  if (event === 'account:recover') {
    const { email, recoveryEmail } = payload
    const Account = store.sdk.account

    try {
      await Account.recover({ email, recovery_email: recoveryEmail })
      channel.send({ event: 'account:recover:callback', data: null })
    } catch(err:any) {
      channel.send({
        event: 'account:recover:callback',
        error: { 
          name: err.name, 
          message: err.message, 
          stack: err.stack 
        },
        data: null
      })
    }
  }

  // Step 1 - Initiate sync
  if (event === 'account:createSyncCode') {
    const Account = store.sdk.account

    const acctSecrets = store.getAccountSecrets()
    const driveSyncingPublicKey = store.getAccount().driveSyncingPublicKey
    try {
      const { code } = await Account.createSyncCode()
      channel.send({ event: 'account:createSyncCode:callback', data: { 
        code,
        drive_key: driveSyncingPublicKey,
        email: acctSecrets.email
      } })
    } catch(err:any) {
      channel.send({
        event: 'account:createSyncCode:callback',
        error: { 
          name: err.name, 
          message: err.message, 
          stack: err.stack 
        },
        data: null
      })
    }
  }

  // Step 2 - Retrieve keys needed for syncing/replicating
  if (event === 'account:getSyncInfo') {
    const { code } = payload
    const Account = store.sdk.account

    try {
      const { drive_key, peer_pub_key, email } = await Account.getSyncInfo({ code })
      channel.send({ event: 'account:getSyncInfo:callback', data: { drive_key, peer_pub_key, email } })
    } catch(err:any) {
      channel.send({
        event: 'account:getSyncInfo:callback',
        error: { 
          name: err.name, 
          message: err.message, 
          stack: err.stack 
        },
        data: null
      })
    }
  }
  
  // Step 3 - Start sync
  if (event === 'account:sync') {
    const { driveKey, email, password } = payload

    const Account = store.sdk.account
    
    const accountUID = randomBytes(8).toString('hex') // This is used as an anonymous ID that is sent to Matomo
    const parentAccountsDir = path.join(userDataPath)
    if (!fs.existsSync(parentAccountsDir)) {
      fs.mkdirSync(parentAccountsDir)
    }
    const acctPath = path.join(userDataPath, `/${email}`)
    store.acctPath = acctPath

    fs.mkdirSync(acctPath)

    // Generate account key bundle
    const { signingKeypair } = Account.makeKeys()

    const keyPair = {
      publicKey: signingKeypair.publicKey,
      secretKey: signingKeypair.privateKey
    }

    // Create device drive
    let drive = store.setDrive({
      name: `${acctPath}/Drive`,
      driveKey: driveKey,
      keyPair,
      blind: true
    })

    // Step 4. Begin replication
    await drive.ready()

    const accountModel = store.models.Account

    let encryptionKey

    let hasVault = false

    // Once we sync the vault file we can use the master password to gain access to the drive
    drive.on('file-sync', async (file:any) => {
      if(file.path.indexOf('vault') > -1 && !hasVault) {
        hasVault = true

        const vault = accountModel.getVault(payload.password, 'vault')
        encryptionKey = vault.drive_encryption_key

        try {
          // Close the drive so we can restart it with the encryption key
          await drive.close()

          const _drive = store.setDrive({
            name: `${acctPath}/Drive`,
            encryptionKey,
            driveKey: driveKey,
            keyPair
          })

          // Step 5. Listen for when core sync is complete
          _drive.once('remote-cores-downloaded', () => {
            let ready = false

            const coreInt = setInterval(async () => {
              if(!ready) {
                await store.initModels()
                const accountModel = store.models.Account
                const acct = await accountModel.find()

                // Wait for when account collection is ready since every peer will have this
                if(acct.length > 0) {
                  ready = true
                  clearInterval(coreInt)

                  // Start syncing messages from other peers via IPFS
                  const filesCollection = await _drive.database.collection('file')

                  let files = await filesCollection.find()

                  let filesToSync = []

                  // Get all of the file metadata to build a list for fetching the file contents from IFPS and saving to local disk
                  if(files.length) {
                    // Initialize models
                    const Email = store.models.Email.collection
                    const File = store.models.File.collection

                    for(const file of files) {
                      let filePath = `${acctPath}/Drive/Files/`
                      
                      if(!file.deleted) {

                        if(file.encrypted) {
                          filePath = path.join(filePath, file.uuid)
                        } else {
                          filePath = path.join(filePath, file.path)
                        }
                        
                        if (file.path.indexOf('email') > -1) {
                          try {
                            const email = await Email.findOne({ path: file.path })
                            await Email.ftsIndex(['subject', 'toJSON', 'fromJSON', 'ccJSON', 'bccJSON', 'bodyAsText', 'attachments'], [email])
                            if(email.cid) filesToSync.push({ cid: email.cid, key: email.key, header: email.header, path: filePath })
                          } catch(err: any) {
                            // file not found
                          }
                        }

                        if (file.path.indexOf('file') > -1) {
                          try {
                            const f = await File.findOne({ hash: file.hash })
                            if(f.cid) filesToSync.push({ cid: f.cid, key: f.key, header: f.header, path: filePath })
                          } catch(err: any) {
                            // file not found
                          }
                        }
                      }
                    }

                    // Step 6. Start the sync status callbacks
                    channel.send({ 
                      event: 'account:sync:callback', 
                      data: {
                        files: {
                          index: 0, 
                          total: filesToSync.length, 
                          done: filesToSync.length ? false : true 
                        }
                      } 
                    })

                    // Fetch the files from IPFS and save locally
                    for(let i = 0; i < filesToSync.length; i++) {
                      const file = filesToSync[i]
                      const idx = i + 1

                      // Batch requests and notify client when finished
                      channel.send({ event: 'debug', data: file })

                      // Notify client of the sync status
                      channel.send({ 
                        event: 'account:sync:callback', 
                        data: {
                          files: {
                            index: idx, 
                            total: filesToSync.length, 
                            done: idx ===  filesToSync.length
                          }
                        } 
                      })  
                    }

                    // Step 7. Rebuild search indexes
                    const Contact = store.models.Contact

                    try {
                    
                      const contacts = await Contact.find()

                      if(contacts.length) {
                        for(const contact of contacts) {
                          await Contact.collection.ftsIndex(['name', 'email', 'nickname'], [contact])
                        }
                      }

                      channel.send({ 
                        event: 'account:sync:callback', 
                        data: {
                          searchIndex: {
                            emails: true,
                            contacts: true
                          }
                        } 
                      })
                    } catch(err: any) {
                      channel.send({ 
                        event: 'debug', 
                        data: err.stack
                      })
                    }

                    // Step 8. Register new device with backend server
                    try {
                      const deviceId = uuidv4()

                      accountModel.setDeviceInfo({
                        keyPair,
                        deviceId: deviceId,
                        deviceType: payload.deviceType,
                        driveSyncingPublicKey: driveKey,
                      }, payload.password)

                      await _drive.close()

                      login(keyPair)
                    } catch(err: any) {
                      channel.send({ 
                        event: 'debug', 
                        data: err.stack
                      })
                    }

                  }
                }
              }
            }, 500)
          })

          await _drive.ready()

        } catch(err: any) {
          channel.send({
            event: 'account:sync:callback',
            error: { 
              name: err.name, 
              message: err.message, 
              stack: err.stack 
            },
            data: null
          })
        }
      }
    })
  }

  /*************************************************
   *  UPDATE ACCOUNT
   ************************************************/
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

  /*************************************************
   *  GET ACCOUNT STATS
   ************************************************/
  if (event === 'account:retrieveStats') {
    try {
      const Account = store.sdk.account

      const stats = await Account.retrieveStats()

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

  /*************************************************
   *  REMOVE ACCOUNT
   ************************************************/
  if (event === 'account:remove') {
    const acctPath = path.join(userDataPath, `/${payload.email}`)
    fs.rmSync(acctPath, { force: true, recursive: true })
  }

  /*************************************************
   *  LOGOUT
   ************************************************/
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

  /*************************************************
   *  EXIT
   ************************************************/
  if (event === 'account:exit') {
    const drive = store.drive
    await drive.close()
  }

  async function login(kp?: { publicKey: string, secretKey: string}) {
    const acctPath = `${userDataPath}/${payload.email}`

    store.acctPath = acctPath
    
    let mnemonic
    let encryptionKey
    let drive
    let keyPair

    try {
      // Initialize account collection
      const accountModel = store.models.Account

      let deviceInfo = accountModel.getDeviceInfo(payload.password)

      channel.send({ event: 'debug', data: deviceInfo })

      try {
        // Retrieve drive encryption key from vault using master password
        let { drive_encryption_key: encryptionKey, keyPair: _keyPair } = accountModel.getVault(payload.password, 'vault')

        // Existing account that already has a keyPair but has not created a deviceInfo file
        if(!kp && !deviceInfo) {
          keyPair = _keyPair
        }

        if(deviceInfo?.keyPair) {
          keyPair = deviceInfo.keyPair
        }

        if(encryptionKey && keyPair) {
          // Notify the receiver the master password has been authenticated
          channel.send({ event: 'account:authorized' })
        }

        // Initialize drive
        drive = store.setDrive({
          name: `${acctPath}/Drive`,
          driveKey: deviceInfo?.driveSyncingPublicKey,
          encryptionKey,
          keyPair
        })

        handleDriveNetworkEvents(drive, channel) // listen for internet or drive network events
        
        await drive.ready()

        store.setDriveStatus('ONLINE')

        store.setAccountSecrets({ email: payload.email, password: payload.password })

        // Join Telios as a peer
        joinPeer(store, store.teliosPubKey, channel)
      } catch(err: any) {
        
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
      let account = await accountModel.findOne()

      // Monkey patch: Support older accounts when this info was stored in the account collection
      if(!deviceInfo && account.deviceId && account.serverSig) {
        const _deviceInfo = {
          keyPair: keyPair,
          deviceId: account.deviceId,
          serverSig: account.serverSig
        }

        accountModel.setDeviceInfo({ ..._deviceInfo }, payload.password)
      }

      // This is a new device trying to login so we need to register the device with the API server
      if(deviceInfo && !deviceInfo.serverSig) {
        const { sig } = await Account.registerNewDevice({
          device: {
            type: payload.deviceType,
            account_key: account.secretBoxPubKey,
            device_id: deviceInfo.deviceId,
            device_signing_key: keyPair.publicKey.toString('hex')
          }
        }, account.signingPrivKey)

        deviceInfo = { serverSig: sig, ...deviceInfo }
        accountModel.setDeviceInfo(deviceInfo, payload.password)
      }

      handleDriveMessages(drive, {...account, ...deviceInfo }, channel, store) // listen for async messages/emails coming from p2p network

      store.setAccount({...account, deviceInfo })

      let auth = {
        claims: {
          account_key: account.secretBoxPubKey,
          device_signing_key: deviceInfo?.keyPair?.publicKey,
          device_id: deviceInfo?.deviceId,
        },
        device_signing_priv_key: deviceInfo?.keyPair?.secretKey,
        sig: deviceInfo?.serverSig
      }

      store.setAuthPayload(auth)

      if(!account.signingPubKey && !account.signingPrivKey) {
        const keys = Account.makeKeys()

        await Account.registerSigningKey({ signing_key: keys.signingKeypair.publicKey })

        // Save account to drive's Account collection
        await accountModel.update(
          { 
            accountId: account.accountId 
          }, 
          { 
            driveSyncingPublicKey: drive.publicKey,
            signingPubKey: keys.signingKeypair.publicKey,
            signingPrivKey: keys.signingKeypair.privateKey,
            updatedAt: UTCtimestamp()
          }
        )
      }

      channel.send({ event: 'account:login:callback', error: null, data: { ...account, deviceInfo: deviceInfo, mnemonic }})
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
}

async function handleDriveMessages(
  drive: any,
  account: any,
  channel: any,
  store: StoreSchema,
) {
  drive.on('message', (peerKey: string, data: any) => {
    try {
      const msg = JSON.parse(data.toString())
      
      // Service is telling client it has a new email to sync
      if (msg.type === 'newMail') {
        channel.send({
          event: 'account:newMessage',
          data: { meta: msg.meta, account, async: true },
        })
      }
    } catch(err) {
      // Could not parse message as JSON
    }
  })
}

function joinPeer(store: StoreSchema, peerPubKey: string, channel: any) {
  store.joinPeer(peerPubKey)

  store.on('peer-updated', (data: { peerKey: string, status: DriveStatuses, server: boolean  } ) => {
    channel.send({ event: 'drive:peer:updated', data: { peerKey: data.peerKey, status: data.status, server: data.server }})
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
      if(driveFiles.indexOf('app.db') > -1) {
        const filePath = `${path.join(__dirname, '../../', 'migrations')}/00_initial.js`
        const Script = require(filePath)

        const { account, mnemonic, encryptionKey, keyPair } = await Script.up({ rootdir, drivePath, password })

        const drive = store.setDrive({
          name: `${rootdir}/${drivePath}`,
          encryptionKey,
          keyPair
        })

        await drive.ready()

        store.setDriveStatus('ONLINE')

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
          driveSyncingPublicKey: drive.publicKey,
          driveEncryptionKey: encryptionKey,
          createdAt: UTCtimestamp(),
          updatedAt: UTCtimestamp(),
        })

        // Create recovery file with master pass
        await accountModel.setVault(mnemonic, 'recovery', {
          master_pass: password,
        })

        // Create vault file with drive enryption key
        await accountModel.setVault(password, 'vault', { drive_encryption_key: encryptionKey })

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
