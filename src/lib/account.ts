const fs = require('fs');
const path = require('path')
import { UTCtimestamp } from '../util/date.util'
const { randomBytes } = require('crypto')
const { v4: uuidv4 } = require('uuid')
const RequestChunker = require('@telios/nebula/util/requestChunker')
const pump = require('pump')
const Drive = require('@telios/nebula')
const Migrate = require('@telios/nebula-migrate')

import { AccountOpts } from '../types'
import { StoreSchema } from '../schemas'
import { Stream } from 'stream'
import * as FileUtil from '../util/file.util'
import { devNull } from 'os';

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
      let { secretBoxKeypair, signingKeypair, mnemonic } = Account.makeKeys()

      if(payload.mnemonic) {
        mnemonic = payload.mnemonic
      }
      
      let encryptionKey = Crypto.generateAEDKey()

      if(!payload.encryptionKey) {
        encryptionKey = Crypto.generateAEDKey()
      } else {
        encryptionKey = Buffer.from(payload.encryptionKey, 'hex')
      }

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

      // Initialize models
      await store.initModels()

      const accountModel = store.models.Account

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
        mnemonic,
        createdAt: UTCtimestamp(),
        updatedAt: UTCtimestamp()
      })

      // Save and encrypt device info. Needed for bootstrapping drive.
      const deviceInfo = {
        keyPair: {
          publicKey: signingKeypair.publicKey,
          secretKey: signingKeypair.privateKey
        },
        deviceId: account.device_id,
        deviceType: payload.deviceType || 'DESKTOP',
        serverSig: serverSig,
        driveVersion: "2.0"
      }

      accountModel.setDeviceInfo(deviceInfo, payload.password)

      //handleDriveMessages(drive, acctDoc, channel, store) // listen for async messages/emails coming from p2p network

      await store.setAccount({...acctDoc, deviceInfo })

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

      if(!account.signingPubKey && !account.signingPrivKey) {
        let { signingKeypair } = Account.makeKeys()

        await Account.registerSigningKey({ signing_key: signingKeypair.publicKey })

        // Save account to drive's Account collection
        await accountModel.update(
          { 
            accountId: acctDoc.accountId 
          }, 
          { 
            signingPubKey: signingKeypair.publicKey,
            signingPrivKey: signingKeypair.privateKey,
            updatedAt: UTCtimestamp()
          }
        )
      }

      // Create recovery file with master pass
      await accountModel.setVault(mnemonic, 'recovery', {
        master_pass: payload.password,
      })

      // Create vault file with drive enryption key
      await accountModel.setVault(payload.password, 'vault', {
        drive_encryption_key: encryptionKey
      })

      store.setDriveStatus('ONLINE')

      store.initSocketIO(store.getAccount(), channel)

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

      // Get account
      const fullAcct = await accountModel.findOne()

      // handleDriveMessages(drive, fullAcct, channel, store) // listen for async messages/emails coming from p2p network

      await store.setAccount(fullAcct)

      let auth = {
        claims: {
          account_key: fullAcct.secretBoxPubKey,
          device_signing_key: deviceInfo?.keyPair?.publicKey,
          device_id: deviceInfo?.deviceId,
        },
        device_signing_priv_key: deviceInfo?.keyPair?.secretKey,
        sig: deviceInfo?.serverSig
      }

      store.setAuthPayload(auth)

      // Update recovery file with new password
      await accountModel.setVault(passphrase, 'recovery', { master_pass: newPass })

      // Update vault file with new password
      await accountModel.setVault(newPass, 'vault', { drive_encryption_key: encryptionKey })

      // Re-encrypt device info file with new pass
      await accountModel.setDeviceInfo(deviceInfo, newPass)

      await drive.close()

      store.setAccountSecrets({ email: undefined, password: undefined })
      store.setAccount(null)

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
      const { drive_key, peer_pub_key, email } = await Account.getSyncInfo(code)
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

    // Remove account directory if it already exists
    if (fs.existsSync(acctPath)) {
      rmdir(acctPath)
    }

    fs.mkdirSync(acctPath)

    // Generate account key bundle
    const { signingKeypair } = Account.makeKeys()

    const keyPair = {
      publicKey: signingKeypair.publicKey,
      secretKey: signingKeypair.privateKey
    }

    channel.send({ event: 'account:sync:callback', data: { status: 'Initializing new account' }})

    let drive = new Drive(`${acctPath}/Drive2`, driveKey, {
      broadcast: false,
      blind: true,
      syncFiles: false,
      swarmOpts: {
        server: true,
        client: true
      },
      fullTextSearch: true
    })

    // Step 4. Begin replication
    try {
      await drive.ready()
      channel.send({ event: 'account:sync:callback', data: { status: 'Starting data migration' }})
    } catch(err:any) {
      //@ts-ignore
      await drive.close()
      throw err
    }

    const accountModel = store.models.Account

    let encryptionKey = ''

    let hasVault = false
    let hasRecovery = false
    let driveSynced = false

    // If the vault or recovery file is missing after 1 min of syncing then kill sync.
    // setTimeout(async () => {
    //   if(!hasVault || !hasRecovery || !driveSynced) {
    //     await drive.close()
    //     channel.send({
    //       event: 'account:sync:callback',
    //       error: { 
    //         name: 'Sync Failed', 
    //         message: 'Unable to sync recovery file and or vault file within the alotted time.', 
    //         stack: null
    //       },
    //       data: null
    //     })
    //     return
    //   }
    // }, 60000)

    try {
      // Sync Recovery file
      const recoveryFile = await FileUtil.syncRecoveryFiles({ 
        fileName: 'recovery', 
        dest: path.join(`${acctPath}/Drive2/Files`, '/recovery'),
        drive, 
        store 
      })

      channel.send({ event: 'account:sync:callback', data: { status: 'Synced recovery file' }})
      hasRecovery = true

      // Sync Vault file
      const vaultFile = await FileUtil.syncRecoveryFiles({ 
        fileName: 'vault', 
        dest: path.join(`${acctPath}/Drive2/Files`, '/vault'),
        drive, 
        store 
      })

      channel.send({ event: 'account:sync:callback', data: { status: 'Synced vault file' }})
      hasVault = true

      const vault = accountModel.getVault(password, 'vault', path.join(`${acctPath}/Drive2/Files/`, '/vault'))
      encryptionKey = vault.drive_encryption_key

      channel.send({ event: 'account:sync:callback', data: { status: 'Vault file deciphered' }})

      // // Close the drive so we can restart it with the encryption key
      await drive.close()
      rmdir(`${acctPath}/Drive2`)
      drive = null
      

      channel.send({ event: 'account:sync:callback', data: { status: 'Starting new account drive' }})

      const _drive = store.setDrive({
        name: `${acctPath}/Drive`,
        driveKey,
        encryptionKey,
        keyPair
      })

      await _drive.ready()

      const checkDataInt = setInterval(async () => {
        let acctDocs
        let mboxDocs
        let folderDocs

        const acctCol = await _drive.database.collection('Account')
        const mboxCol = await _drive.database.collection('Mailbox')
        const folderCol = await _drive.database.collection('Folder')

        acctDocs = await acctCol.find()
        mboxDocs = await mboxCol.find()
        folderDocs = await folderCol.find()

        channel.send({ event: 'account:sync:callback', data: { status: 'Syncing data from peer device' }})

        if(acctDocs.length && mboxDocs.length && folderDocs.length) {
          clearInterval(checkDataInt)
          channel.send({ event: 'account:sync:callback', data: { status: 'Data sync complete' }})
          try {
            // Step 5. Set Device info and login
            const deviceId = uuidv4()

            accountModel.setDeviceInfo({
              keyPair,
              deviceId: deviceId,
              deviceType: payload.deviceType,
              driveSyncingPublicKey: driveKey,
              driveVersion: "2.0"
            }, payload.password)

            await _drive._localDB.put('vault', { isSet: true })

            await _drive.close()

            channel.send({ event: 'account:sync:callback', data: { status: 'New account drive closed' }})

            driveSynced = true
            
            setTimeout(() => {
              channel.send({ event: 'account:sync:callback', data: { status: 'Logging in to synced account' }})
              login(keyPair)
            }, 2000)
          } catch(err:any) {
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
      }, 5000)

      fs.writeFileSync(path.join(`${acctPath}/Drive/Files`, '/recovery'), recoveryFile)
      fs.writeFileSync(path.join(`${acctPath}/Drive/Files`, '/vault'), vaultFile)

      channel.send({ event: 'account:sync:callback', data: { status: 'New drive ready' }})
    } catch(err:any) {
      channel.send({ event: 'debug', data: { message: err.message, stack: err.stack } })
      await drive.close()

      // Remove account directory
      const acctPath = path.join(userDataPath, `/${payload.email}`)
      rmdir(acctPath)

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
    rmdir(acctPath)
  }

  /*************************************************
   *  LOGOUT
   ************************************************/
  if (event === 'account:logout') {
    try {
      store.setAccountSecrets({ email: undefined, password: undefined })
      await store.setAccount(null)

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
    const drive = store.getDrive()
    await drive.close()
  }

  /*************************************************
   *  RECONNECT ACCOUNT DRIVE
   ************************************************/
   if (event === 'account:drive:reconnect') {
    try {
      const drive = store.getDrive()
      await drive.close()
      await drive.ready()
      
      handleDriveNetworkEvents(drive, channel) // listen for internet or drive network events

      // Initialize models
      await store.initModels()

      //joinPeer(store, store.teliosPubKey, channel)
      //store.initSocketIO()

      channel.send({ event: 'account:drive:reconnect:callback', error: null })
    } catch(err: any) {
      channel.send({ 
        event: 'account:drive:reconnect:callback', 
        error: {
          name: err.name,
          message: err.message,
          stacktrace: err.stack,
        }, 
        data: null 
      })
    }
  }

  async function login(kp?: { publicKey: string, secretKey: string}) {
    const acctPath = `${userDataPath}/${payload.email}`

    store.acctPath = acctPath
    
    let mnemonic
    let encryptionKey
    let drive
    let keyPair
    let deviceInfo

    // Initialize account collection
    const accountModel = store.models.Account

    try {
      deviceInfo = accountModel.getDeviceInfo(payload.password)
    } catch(err:any) {
      // file does not exist
    }
    
    try {
      try {
        channel.send({ event: 'account:login:status', data: 'Decrypting account data' })
        
        // Retrieve drive encryption key from vault using master password
        let { drive_encryption_key: encryptionKey, keyPair: _keyPair } = accountModel.getVault(payload.password, 'vault')

        // Existing account that already has a keyPair but has not created a deviceInfo file
        if(!kp && !deviceInfo) {
          keyPair = {
            publicKey: Buffer.from(_keyPair.publicKey, 'hex').toString('hex'),
            secretKey:  Buffer.from(_keyPair.secretKey,'hex').toString('hex')
          }
        }

        if(deviceInfo?.keyPair) {
          keyPair = deviceInfo.keyPair
        }

        if(encryptionKey && keyPair) {
          // Notify the receiver the master password has been authenticated
          channel.send({ event: 'account:login:status', data: 'Account authorized' })
        }

        if(!deviceInfo.driveVersion || deviceInfo.driveVersion !== '2.0') {
          try {
            channel.send({ event: 'account:login:status', data: 'Migrating account data' })
            await Migrate({ 
              rootdir: acctPath, 
              drivePath: '/Drive', 
              encryptionKey: Buffer.from(encryptionKey, 'hex'), 
              keyPair: {
                publicKey: Buffer.from(keyPair.publicKey, 'hex'),
                secretKey: Buffer.from(keyPair.secretKey, 'hex')
              }
            })
            channel.send({ event: 'account:login:status', data: 'Account data migrated' })

            deviceInfo = { ...deviceInfo, driveVersion: "2.0" }
            accountModel.setDeviceInfo(deviceInfo, payload.password)
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

        // Initialize drive
        drive = store.setDrive({
          name: `${acctPath}/Drive`,
          driveKey: deviceInfo?.driveSyncingPublicKey,
          encryptionKey,
          keyPair
        })

        handleDriveNetworkEvents(drive, channel) // listen for internet or drive network events

        channel.send({ event: 'account:login:status', data: 'Starting account drive' })
        await drive.ready()
        channel.send({ event: 'account:login:status', data: 'Account drive ready' })

        store.setDriveStatus('ONLINE')

        store.setAccountSecrets({ email: payload.email, password: payload.password })

      } catch(err: any) {
        if(drive) await drive.close()
        
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
      }

      // Initialize models
      await store.initModels()

      let account = await accountModel.findOne()

      channel.send({ event: 'account:login:status', data: 'Account initalized' })
      
      // Monkey patch: Support older accounts when this info was stored in the account collection
      if(!deviceInfo && account.deviceId && account.serverSig) {
        deviceInfo = {
          keyPair,
          deviceType: 'DESKTOP',
          deviceId: account.deviceId,
          serverSig: account.serverSig,
          driveVersion: "2.0"
        }

        accountModel.setDeviceInfo({ ...deviceInfo }, payload.password)
      }

      // This is a new device trying to login so we need to register the device with the API server
      if(deviceInfo && !deviceInfo.serverSig) {
        try {
          const { sig } = await Account.registerNewDevice({
            type: payload.deviceType,
            account_key: account.secretBoxPubKey,
            device_id: deviceInfo.deviceId,
            device_signing_key: keyPair.publicKey.toString('hex')
          }, account.signingPrivKey)

          channel.send({ event: 'account:login:status', data: 'Registered new device' })

          deviceInfo = { serverSig: sig, ...deviceInfo }
          accountModel.setDeviceInfo(deviceInfo, payload.password)
        } catch(err: any) {
          channel.send({ event: 'debug', data: { message: err.message, stack: err.stack } })
        }
      }

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

      // Fully sync account when registering a new device.
      // This method will fetch and sync all files from IPFS
      if(kp) {
        channel.send({ event: 'account:login:status', data: 'Syncing data from peer devices' })
        await syncNewDevice(drive)
        channel.send({ event: 'account:login:status', data: 'Data sync finished' })
      }

      // Check if Drive's Vault and Recovery files needs to be pushed out to IPFS
      // TODO: Deprecate this in the future. New accounts won't need to do this
      if(!deviceInfo.driveVersion || deviceInfo.driveVersion !== '2.0') {
        channel.send({ event: 'account:login:status', data: 'Migrating vault file to IPFS' })
        await migrateVaultToIPFS()
        channel.send({ event: 'account:login:status', data: 'Vault migrated to IPFS' })
      }

      handleDriveSyncEvents() // Listen for and sync updates from remote peers/devices

      store.initSocketIO(store.getAccount(), channel)
      
      channel.send({ event: 'account:login:callback', error: null, data: { ...account, deviceInfo: deviceInfo, mnemonic }})
    } catch (err: any) {
      if(drive) await drive.close()

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

  async function migrateVaultToIPFS() {
    const drive = store.getDrive()
    const localDB = drive._localDB
    const vault = await localDB.get('vault')

    if(!vault?.isSet) {
      const vFileStream = fs.createReadStream(path.join(store.acctPath, '/Drive/Files/vault'))
      let vFile = await FileUtil.saveFileToIPFS(store.sdk.ipfs, vFileStream)

      if(vFile.cid) {
        const file = await drive._collections.files.findOne({ path: 'vault'})
        await updateFileMeta(drive, { ...file, custom_data: { cid: vFile.cid }})
      }

      const rFileStream = fs.createReadStream(path.join(store.acctPath, '/Drive/Files/recovery'))
      let rFile = await FileUtil.saveFileToIPFS(store.sdk.ipfs, rFileStream)

      if(rFile.cid) {
        const file = await drive._collections.files.findOne({ path: 'recovery'})
        await updateFileMeta(drive, { ...file, custom_data: { cid: vFile.cid }})
      }

      await localDB.put('vault', { isSet: true })
    }

    async function updateFileMeta(drive: any, file: any) {
      await drive.metadb.put(file.hash, {
        uuid: file.uuid,
        size: file.size,
        hash: file.hash,
        path: file.path,
        peer_key: file.peer_key,
        discovery_key: file.discovery_key,
        custom_data: file.custom_data
      })

      await drive._collections.files.update(
        {_id: file._id }, 
        { 
          custom_data: file.custom_data, 
          updatedAt: new Date().toISOString() 
        }
      )
    }
  }

  async function syncNewDevice(drive: any) {
    try {
      // Start syncing messages from other peers via IPFS
      const filesCollection = await drive.database.collection('file')

      let files = await filesCollection.find()

      // let filesToSync = []

      // Get all of the file metadata to build a list for fetching the file contents from IFPS and saving to local disk
      if(files.length) {
        // Initialize models
        const Email = store.models.Email.collection
        const File = store.models.File.collection

        for(const file of files) {
          let filePath = `${store.acctPath}/Drive/Files/`
          
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
                // if(email.cid) filesToSync.push({ cid: email.cid, key: email.key, header: email.header, path: filePath })
              } catch(err: any) {
                // file not found
              }
            }

            // if (file.path.indexOf('file') > -1) {
            //   try {
            //     const f = await File.findOne({ hash: file.hash })
            //     if(f.cid) filesToSync.push({ cid: f.cid, key: f.key, header: f.header, path: filePath })
            //   } catch(err: any) {
            //     // file not found
            //   }
            // }
          }
        }

        // Step 6. Start the sync status callbacks
        // channel.send({ 
        //   event: 'account:sync:callback', 
        //   data: {
        //     files: {
        //       index: 0, 
        //       total: filesToSync.length, 
        //       done: filesToSync.length ? false : true 
        //     }
        //   } 
        // })

        // Fetch the files from IPFS and save locally
        // await syncFileBatch(filesToSync)

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
      }
    } catch(err: any) {
      channel.send({ 
        event: 'debug', 
        data: {
          error: err.message,
          stack: err.stack
        }
      })
    }
  }

  async function syncFileBatch(files: any) {
    const batches = new RequestChunker(files, 5)
    let idx = 0

    for(let i = 0; i < batches.length; i++) {
      const requests = []
      const batch = batches[i]

      for (let file of batch) {
        requests.push(new Promise((resolve: any, reject: any) => {
          store.sdk.ipfs.get(file.cid)
            .then((stream: Stream) => {

              const ws = fs.createWriteStream(file.path)
              pump(stream, ws, (err: any) => {
                idx += 1

                if(err) {
                  channel.send({ event: 'debug', data: { error: err.message, stack: err.stack } })
                  return reject(err)
                }

                // Notify client of the sync status
                channel.send({ 
                  event: 'account:sync:callback', 
                  data: {
                    files: {
                      index: idx, 
                      total: files.length,
                      done: idx ===  files.length
                    }
                  } 
                })

                resolve()
              })
            })
            .catch((err: any) => {
              idx += 1
              channel.send({ event: 'debug', data: { error: err.message, stack: err.stack } })
            })
        }))

        await Promise.all(requests)
      }
    }
  }

  function handleDriveSyncEvents() {
    const drive = store.getDrive()
    drive.on('collection-update', async (data: any) => {
      if(data?.collection) {
        if(data.collection === 'Email' && data.value && data.type !== 'del') {
          try {
            const Email = store.models.Email.collection
            if(data.value && data.value.subject) {
              await Email.ftsIndex(['subject', 'toJSON', 'fromJSON', 'ccJSON', 'bccJSON', 'bodyAsText', 'attachments'], [data.value])
            }
          } catch(err: any) {
            channel.send({ event: 'debug', data: err.stack })
          }
        }

        if(data.collection === 'Contact' && data.value && data.type !== 'del') {
          try {
            const Contact = store.models.Contact
            if(data.value && data.value.email) {
              await Contact.collection.ftsIndex(['name', 'email', 'nickname'], [data.value])
            }
          } catch(err: any) {
            channel.send({ event: 'debug', data: err.stack })
          }
        }

        if(data.collection === 'file' && data.value && data.type !== 'del') {
          let filePath = `${store.acctPath}/Drive/Files/`

          const file = data.value

          if(file.encrypted) {
            filePath = path.join(filePath, file.uuid)
          } else {
            filePath = path.join(filePath, file.path)
          }
          
          if (file.path.indexOf('email') > -1) {
            try {
              const Email = store.models.Email.collection
              const email = await Email.findOne({ path: file.path })
              if(email && email.subject) {
                await Email.ftsIndex(['subject', 'toJSON', 'fromJSON', 'ccJSON', 'bccJSON', 'bodyAsText', 'attachments'], [email])
              }
            } catch(err: any) {
              // file not found
              channel.send({ event: 'debug', data: { stck: err.stack }})
            }
          }
        }

        if(data.collection !== 'file') {
          channel.send({ event: 'account:collection:updated', data })
        }
      }
    })
  }
}

function handleDriveNetworkEvents(drive: any, channel: any) {
  drive.on('network-updated', (network: { internet: boolean; drive: boolean }) => {
      channel.send({ event: 'drive:network:updated', data: { network } })
    }
  )
}

function rmdir(dir:string) {
  const list = fs.readdirSync(dir)

  for(let i = 0; i < list.length; i++) {
    const filename = path.join(dir, list[i])
    const stat = fs.statSync(filename)

    if(filename == "." || filename == "..") {
      // pass these files
    } else if(stat.isDirectory()) {
      // rmdir recursively
      rmdir(filename)
    } else {
      // rm fiilename
      fs.unlinkSync(filename)
    }
  }
  fs.rmdirSync(dir)
}

async function reconnectDrive(channel: any, store: StoreSchema) {
  try {
    const drive = store.getDrive()
    await drive.close()
    await drive.ready()

    // Initialize models
    await store.initModels()

    //joinPeer(store, store.teliosPubKey, channel)
    store.initSocketIO(store.getAccount(), channel)

    channel.send({ event: 'account:drive:reconnect:callback', error: null })
  } catch(err: any) {
    channel.send({ 
      event: 'account:drive:reconnect:callback', 
      error: {
        name: err.name,
        message: err.message,
        stacktrace: err.stack,
      }, 
      data: null 
    })
  }
}
