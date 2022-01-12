const fs = require('fs')
const path = require('path')
const { randomBytes } = require('crypto')
const del = require('del')

import { AccountModel } from '../models/account.model'

import { AccountOpts } from '../types'
import { StoreSchema } from '../schemas'

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
      const acctPath = path.join(userDataPath, `/Accounts/${payload.email}`)
      store.acctPath = acctPath

      fs.mkdirSync(acctPath)

      // Generate account key bundle
      const {
        secretBoxKeypair,
        signingKeypair,
        mnemonic
      } = Account.makeKeys();
      
      const encryptionKey = Crypto.generateAEDKey();
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

      const accountModel = new AccountModel(store)
      await accountModel.ready() // Initialize account db from within drive

      // Create recovery file with master pass
      await accountModel.setVault(mnemonic, 'recovery', { master_pass: payload.password })

      // Create vault file with drive enryption key
      await accountModel.setVault(payload.password, 'vault', { drive_encryption_key: encryptionKey, keyPair: driveKeyPair })

      const opts = {
        account: {
          account_key: secretBoxKeypair.publicKey,
          recovery_email: payload.recoveryEmail,
          device_drive_key: drive.publicKey,
          device_signing_key: signingKeypair.publicKey
        }
      }

      // Prepare registration payload
      const { account, sig: accountSig } = await Account.init(
        opts,
        signingKeypair.privateKey
      )

      const registerPayload = {
        account,
        sig: accountSig,
        vcode: payload.vcode
      }

      const { _sig: serverSig } = await Account.register(registerPayload) // Register account with API server

      
      // Save account to drive's Account collection
      const acctDoc = await accountModel.insert({
        uid: accountUID,
        secretBoxPubKey: secretBoxKeypair.publicKey,
        secretBoxPrivKey: secretBoxKeypair.privateKey,
        driveEncryptionKey: encryptionKey,
        deviceSigningPubKey: signingKeypair.publicKey,
        deviceSigningPrivKey: signingKeypair.privateKey,
        serverSig: serverSig,
        deviceId: account.device_id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })

      handleDriveMessages(drive, acctDoc, channel, store) // listen for async messages/emails coming from p2p network

      store.setAccount(acctDoc);

      const auth = {
        claims: {
          account_key: secretBoxKeypair.publicKey,
          device_signing_key: signingKeypair.publicKey,
          device_id: account.device_id
        },
        device_signing_priv_key: signingKeypair.privateKey,
        sig: serverSig
      };

      store.setAuthPayload(auth);

      channel.send({
        event: 'account:create:success',
        data: {
          uid: accountUID,
          deviceId: account.device_id,
          signedAcct: account,
          secretBoxKeypair,
          signingKeypair,
          mnemonic,
          sig: serverSig
        }
      });
    } catch (e: any) {
      channel.send({
        event: 'account:create:error',
        error: {
          name: e.name,
          message: e.message,
          stacktrace: e.stack
        }
      })
    }
  }



  /**
   * GET ACCOUNT / LOGIN
   */
   if (event === 'account:login') {
    const acctPath = `${userDataPath}/Accounts/${payload.email}`
    store.acctPath = acctPath

    // Initialize account collection
    const accountModel = new AccountModel(store)

    try {
      // Retrieve drive encryption key and keyPair from vault using master password
      const { drive_encryption_key: encryptionKey, keyPair } = accountModel.getVault(payload.password, 'vault')

      channel.send({ event: 'account:log:info', data: { encryptionKey, keyPair } })

      // Initialize drive
      const drive = store.setDrive({
        name: `${acctPath}/Drive`,
        encryptionKey,
        keyPair: {
          publicKey: Buffer.from(keyPair.publicKey, 'hex'),
          secretKey: Buffer.from(keyPair.secretKey, 'hex')
        }
      });

      handleDriveNetworkEvents(drive, channel) // listen for internet or drive network events

      await drive.ready()
      await accountModel.ready() // Initialize account db from within drive

      // Get account
      const fullAcct = await accountModel.findOne({ driveEncryptionKey: encryptionKey })

      handleDriveMessages(drive, fullAcct, channel, store) // listen for async messages/emails coming from p2p network

      store.setAccount(fullAcct)

      const auth = {
        claims: {
          account_key: fullAcct.secretBoxPubKey,
          device_signing_key: fullAcct.deviceSigningPubKey,
          device_id: fullAcct.deviceId
        },
        device_signing_priv_key: fullAcct.deviceSigningPrivKey,
        sig: fullAcct.serverSig
      }

      store.setAuthPayload(auth)

      channel.send({ event: 'account:login:success', data: fullAcct })
    } catch(err: any) {
      channel.send({ event: 'account:login:error', error: { name: err.name, message: err.message, stack: err.stack} })
    }
  }



  /**
   * REMOVE ACCOUNT
   */
   if (event === 'account:remove') {
    const acctPath = path.join(userDataPath, `/Accounts/${payload.email}`)
    await del(acctPath, { force: true })
   }



  /**
   * LOGOUT
   */
   if (event === 'account:logout') {
    try {
      store.setAccountSecrets({ email: undefined, password: undefined })
      store.setAccount(null)

      channel.send({ event: 'account:logout:success', data: null })

      if(channel.pid) {
        channel.kill(channel.pid)
      }
    } catch (e: any) {
      channel.send({ event: 'account:logout:error', error: e.message })
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



async function handleDriveMessages(drive: any, account: any, channel: any, store: StoreSchema) {
  drive.on('message', (peerPubKey: string, data: any) => {
    const msg = JSON.parse(data.toString())

    // Only connect to peers with the SDK priv/pub keypair
    if (msg.type && peerPubKey === store.teliosPubKey) {
      // Service is telling client it has a new email to sync
      if (msg.type === 'newMail') {
        channel.send({
          event: 'newMessage',
          data: { meta: msg.meta, account, async: true }
        });
      }
    } else {
      channel.send({
        event: 'socketMessageErr',
        error: {
          name: 'socketMessageErr',
          message: 'Could not connect to peer',
          stacktrace: ''
        }
      })
    }
  })
}

function handleDriveNetworkEvents(drive: any, channel: any) {
  drive.on('network-updated', (network: { internet: boolean, drive: boolean }) => {
    channel.send({ event: 'drive:network:updated', data: { network } })
  })
}