const fs = require('fs')
const path = require('path')
const ClientSDK = require("@telios/client-sdk")
const { randomBytes } = require('crypto')
const teliosSDK = new ClientSDK()
const Account = teliosSDK.Account

import { AccountModel } from '../models/account.model'

import { AccountOpts } from '../types'
import { StoreSchema } from '../schemas'

export default async (props: AccountOpts) => {
  const { channel, userDataPath, msg, store } = props 
  const { event, payload } = msg

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
      } = teliosSDK.Account.makeKeys();
      
      const encryptionKey = teliosSDK.Crypto.generateAEDKey();

      // Create account Nebula drive
      const drive = store.setDrive({
        name: `${acctPath}/Drive`,
        encryptionKey,
        keyPair: {
          publicKey: Buffer.from(signingKeypair.publicKey, 'hex'),
          secretKey: Buffer.from(signingKeypair.privateKey, 'hex')
        }
      })

      handleDriveNetworkEvents(drive, channel) // listen for internet or drive network events

      await drive.ready()

      const accountModel = new AccountModel(store)
      await accountModel.ready() // Initialize account db from within drive

      // Create recovery file with master pass
      await accountModel.setVault(mnemonic, 'recovery', { master_pass: payload.password })

      // Create vault file with drive enryption key
      await accountModel.setVault(payload.password, 'vault', { drive_encryption_key: encryptionKey })

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
    channel.send({ event: 'drive:networkUpdated', data: { network } })
  })
}