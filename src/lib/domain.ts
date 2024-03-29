import { Store } from '../Store'
import { DomainOpts } from '../types'
import { DomainSchema, MailboxSchema } from '../schemas'
import { DefaultFolders } from '../models/folder.model'
import { UTCtimestamp } from '../util/date.util'
import { rmdir, getAcctPath } from '../util/base.util'

const generator = require('generate-password')
const { randomBytes } = require('crypto')
const fs = require('fs')
const path = require('path')
const BSON = require('bson')
const { ObjectID } = BSON
const Crypto = require('@telios/nebula/lib/crypto')

export default async (props: DomainOpts) => {
  const { channel, userDataPath, msg, store } = props
  const { event, payload } = msg

  const Domain = store.sdk.domain
  const Account = store.sdk.account

  /***************************************
   *  CHECK IF DOMAIN IS AVAILABLE
   **************************************/
   if (event === 'domain:isAvailable') {
    try {
      const bool = await Domain.isAvailable(payload.domain)
      channel.send({ event: 'domain:isAvailable:callback', data: bool })
    } catch(err: any) {
      channel.send({
        event: 'domain:isAvailable:callback',
        error: {
          name: err.name,
          message: err.message,
          stacktrace: err.stack
        }
      })
    }
  }
  
  /***************************************
   *  REGISTER CUSTOM DOMAIN
   **************************************/
  if (event === 'domain:register') {
    try {
      const domainModel = store.models.Domain
      
      const res = await Domain.register(payload)

      const doc = { 
        name: payload.domain,
        active: false,
        dns: {
          vcode: {
            type: res.verification.type,
            name: res.verification.name,
            value: res.verification.value,
            verified: false
          }
        },
        createdAt: UTCtimestamp(),
        updatedAt: UTCtimestamp()
      }

      const domain: DomainSchema = await domainModel.insert(doc)
      
      channel.send({ event: 'domain:register:callback', data: domain })
    } catch(err: any) {
      channel.send({
        event: 'domain:register:callback',
        error: {
          name: err.name,
          message: err.message,
          stacktrace: err.stack
        }
      })
    }
  }

  /***************************************
   *  DELETE CUSTOM DOMAIN
   **************************************/
  if (event === 'domain:delete') {
    try {
      const DomainSDK = store.sdk.domain
      const domainModel = store.models.Domain
      const mailboxModel = store.models.Mailbox

      const mailboxes = await mailboxModel.find({ domainKey: payload.domain })

      // Delete all domain sub mailboxes
      for(const mailbox of mailboxes) {
          // Delete from API
        await DomainSDK.deleteMailbox({ addr: mailbox.address })

        // Remove from local DB
        await mailboxModel.remove({ address: mailbox.address })

        // Remove from disk
        const acctPath = getAcctPath(userDataPath, mailbox.address)
        rmdir(acctPath)
      }

      const res = await Domain.delete(payload)
      await domainModel.remove({ name: payload.domain })
      channel.send({ event: 'domain:delete:callback', data: res })
    } catch(err: any) {
      channel.send({
        event: 'domain:delete:callback',
        error: {
          name: err.name,
          message: err.message,
          stacktrace: err.stack
        }
      })
    }
  }

  /***************************************
   *  GET DOMAIN BY NAME
   **************************************/
  if (event === 'domain:getDomainByName') {
    try {
      const domainModel = store.models.Domain
      const domain = await domainModel.findOne({ name: payload.name })
      channel.send({ event: 'domain:getDomainByName:callback', data: domain })
    } catch(err: any) {
      channel.send({
        event: 'domain:getDomainByName:callback',
        error: {
          name: err.name,
          message: err.message,
          stacktrace: err.stack
        }
      })
    }
  }

  /***************************************
   *  GET ALL DOMAINS
   **************************************/
  if (event === 'domain:getDomains') {
    try {
      const domainModel = store.models.Domain
      const domains = await domainModel.find()
      channel.send({ event: 'domain:getDomains:callback', data: domains })
    } catch(err: any) {
      channel.send({
        event: 'domain:getDomains:callback',
        error: {
          name: err.name,
          message: err.message,
          stacktrace: err.stack
        }
      })
    }
  }

  /***************************************
   *  VERIFY DOMAIN OWNERSHIP
   **************************************/
  if (event === 'domain:verifyOwnership') {
    try {
      const domainModel = store.models.Domain
      const res = await Domain.verifyOwnership(payload.domain)
      const domain: DomainSchema = await domainModel.findOne({ name: payload.domain})

      // If verified, then update domain record
      if(res.verified) {

        if(domain.dns.vcode)
          domain.dns.vcode.verified = true

        await domainModel.update({ 
          name: payload.domain 
        }, 
        { 
          dns: domain.dns,
          updatedAt: UTCtimestamp() 
        })
      }

      channel.send({ event: 'domain:verifyOwnership:callback', data: res })
    } catch(err: any) {
      channel.send({
        event: 'domain:verifyOwnership:callback',
        error: {
          name: err.name,
          message: err.message,
          stacktrace: err.stack
        }
      })
    }
  }

  /***************************************
   *  VERIFY DOMAIN DNS SETTINGS
   **************************************/
  if (event === 'domain:verifyDNS') {
    const domainModel = store.models.Domain

    try {
      const domain: DomainSchema = await domainModel.findOne({ name: payload.domain }) 
      const dns = await Domain.verifyDNS(payload.domain)

      if(!domain.active) {
        if(domain.dns.vcode)
          domain.dns.vcode.verified = true
        
        await domainModel.update({ 
          name: payload.domain 
        }, 
        { 
          dns: {
            vcode: domain.dns.vcode,
            mx: dns.mx,
            spf: dns.spf,
            dkim: dns.dkim,
            dmarc: dns.dmarc
          },
          active: dns.mx.verified && dns.spf.verified && dns.dkim.verified && dns.dmarc.verified,
          updatedAt: UTCtimestamp() 
        })
      }

      channel.send({ event: 'domain:verifyDNS:callback', data: dns })
    } catch(err: any) {
      channel.send({
        event: 'domain:verifyDNS:callback',
        error: {
          name: err.name,
          message: err.message,
          stacktrace: err.stack
        }
      })
    }
  }

  /***************************************
   *  REGISTER NEW DOMAIN MAILBOX
   **************************************/
  if (event === 'domain:registerMailbox') {
    try {  
      const mailboxModel = store.models.Mailbox
      const DomainSDK = store.sdk.domain
      let syncCode;
      
      // Create the new sub account
      const { account, store: _store, password } = await createDomainAccount(payload)

      // Register mailbox with backend api
      await DomainSDK.registerMailbox({ 
        name: payload.displayName, 
        account_key: account.secretBoxPubKey,
        type: payload.type,
        addr: payload.email
      })

      // Create mailbox doc for sub account
      const _id = new ObjectID()
      const mailboxId = _id.toString('hex')

      const mPayload = { 
        _id,
        mailboxId,
        domainKey: payload.domain,
        type: payload.type,
        address: payload.email,
        displayName: payload.displayName,
        password: password,
        recoveryEmail: payload.recoveryEmail,
        driveSyncingPublicKey: account.driveSyncingPublicKey,
        driveEncryptionKey: account.driveEncryptionKey,
        mnemonic: account.mnemonic,
        createdAt: UTCtimestamp(),
        updatedAt: UTCtimestamp()
      }

      // TODO: Create a sync code for claimable mailboxes
      const mailbox: MailboxSchema = await mailboxModel.insert(mPayload)

      const _mailboxModel = _store.models.Mailbox
      const _folderModel = _store.models.Folder
      // Create mailbox and folders for the sub account
      const subMailbox: MailboxSchema = await _mailboxModel.insert(mPayload)

      for (const folder of DefaultFolders) {
        let _folder: any = { ...folder }
        _folder.mailboxId = subMailbox.mailboxId
        await _folderModel.insert(_folder)
      }

      // Create a sync code if this is a claimable mailbox
      if(payload.type === 'CLAIMABLE') {
        const { code } = await DomainSDK.sendMailboxInvite({ addr: payload.email, inviteEmail: payload.recoveryEmail, password })
        syncCode = code
      }

      // Close the new account
      setTimeout(async () => {
        const _drive = _store.getDrive()
        await _drive.close()
        await _store.clear()
      }, 10000)
      
      channel.send({
        event: 'domain:registerMailbox:callback',
        data: {
          account: {
            ...account,
            password
          },
          syncCode,
          mailbox
        }
      })
    } catch (err: any) {
      const acctPath = getAcctPath(userDataPath, payload.address)
      rmdir(acctPath)

      channel.send({
        event: 'domain:registerMailbox:callback',
        error: {
          name: err.name,
          message: err.message,
          stacktrace: err.stack,
        },
        data: null
      })
    }
  }

  /***************************************
   *  REGISTER NEW DOMAIN MAILBOX
   **************************************/
  if (event === 'domain:resendMailboxInvite') {
    try {
      const DomainSDK = store.sdk.domain
      const { code } = await DomainSDK.sendMailboxInvite({ 
        addr: payload.email, 
        inviteEmail: payload.recoveryEmail, 
        password: payload.password
      })

      channel.send({
        event: 'domain:resendMailboxInvite:callback',
        data: { code }
      })
    } catch(err:any) {
      channel.send({
        event: 'domain:resendMailboxInvite:callback',
        error: {
          name: err.name,
          message: err.message,
          stacktrace: err.stack,
        },
        data: null
      })
    }
  }

  /***************************************
   *  DELETE DOMAIN MAILBOX
   **************************************/
  if (event === 'domain:deleteMailbox') {
    const DomainSDK = store.sdk.domain
    const mailboxModel = store.models.Mailbox

    try { 
      // Delete from API
      await DomainSDK.deleteMailbox({ addr: payload.address })

      // Remove from local DB
      await mailboxModel.remove({ address: payload.address })

      // Remove from disk
      const acctPath = getAcctPath(userDataPath, payload.address)
      rmdir(acctPath)

      channel.send({ event: 'domain:deleteMailbox:callback', data: true })

    } catch (err: any) {
      channel.send({
        event: 'domain:deleteMailbox:callback',
        error: {
          name: err.name,
          message: err.message,
          stacktrace: err.stack,
        },
        data: null
      })
    }
  }

  async function createDomainAccount(payload: { type: 'SUB' | 'CLAIMABLE', email: string, domain: string, recoveryEmail: string, deviceType: 'DESKTOP' | 'MOBILE', password?: string }) {
    const mailboxModel = store.models.Mailbox
    
    let password = generatePassword(13)

    if(payload.password) {
      password = payload.password
    }

    // Clone a new store for domain mailbox
    const _store = new Store(store.env, store._userAgent, store.teliosPubKey, store.domain.api, store.IPFSGateway)
    
    const accountUID = randomBytes(8).toString('hex') // This is used as an anonymous ID that is sent to Matomo

    const mailbox = await mailboxModel.findOne({ type: 'PRIMARY' })

    let acctPath

    if(payload.type === 'CLAIMABLE') {
      const parentAccountsDir = path.join(userDataPath, `/${mailbox.address}`)

      const domainsDir = `${parentAccountsDir}/Domains`
      const domainDir = `${domainsDir}/${payload.domain}`

      if (!fs.existsSync(domainsDir)) {
        fs.mkdirSync(domainsDir)
      }

      if (!fs.existsSync(domainDir)) {
        fs.mkdirSync(domainDir)
      }

      acctPath = path.join(domainDir, `/${payload.email}`)
    } else {
      acctPath = path.join(userDataPath, `/${payload.email}`)
    }

    _store.acctPath = acctPath

    fs.mkdirSync(acctPath)

    // Generate account key bundle
    let { secretBoxKeypair, signingKeypair, mnemonic } = Account.makeKeys()
    
    let encryptionKey = Crypto.generateAEDKey()

    encryptionKey = Crypto.generateAEDKey()

    // Create account Nebula drive
    const drive = _store.setDrive({
      name: `${acctPath}/Drive`,
      encryptionKey,
      keyPair: {
        publicKey: signingKeypair.publicKey,
        secretKey: signingKeypair.privateKey
      }
    })

    await drive.ready()

    // Initialize models
    await _store.initModels()

    const accountModel = _store.models.Account

    const opts = {
      account: {
        account_key: secretBoxKeypair.publicKey,
        recovery_email: payload.recoveryEmail,
        device_drive_key: drive.publicKey,
        device_signing_key: signingKeypair.publicKey,
      }
    }

    // Prepare registration payload
    const { account, sig: accountSig } = await Account.init(
      opts,
      signingKeypair.privateKey,
    )

    const registerPayload = {
      account,
      sig: accountSig
    }

    const { _sig: serverSig } = await Account.register(registerPayload) // Register account with API server

    const _id = new ObjectID()

    // Save account to drive's Account collection
    const acctDoc = await accountModel.insert({
      _id,
      type: payload.type,
      plan: 'SUB',
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

    accountModel.setDeviceInfo(deviceInfo, password)

    await _store.setAccount({...acctDoc, deviceInfo }, true)

    _store.setAccountSecrets({ email: payload.email, password })

    const auth = {
      claims: {
        account_key: secretBoxKeypair.publicKey,
        device_signing_key: signingKeypair.publicKey,
        device_id: account.device_id,
      },
      device_signing_priv_key: signingKeypair.privateKey,
      sig: serverSig,
    }

    _store.setAuthPayload(auth)

    const _Account = _store.sdk.account

    let { signingKeypair: mainSigKeypair } = Account.makeKeys()

    await _Account.registerSigningKey({ signing_key: mainSigKeypair.publicKey })

    // Save account to drive's Account collection
    await accountModel.update(
      { 
        accountId: acctDoc.accountId 
      }, 
      { 
        signingPubKey: mainSigKeypair.publicKey,
        signingPrivKey: mainSigKeypair.privateKey,
        updatedAt: UTCtimestamp()
      }
    )

    // Create recovery file with master pass
    await accountModel.setVault(mnemonic, 'recovery', {
      master_pass: password,
    })

    // Create vault file with drive enryption key
    await accountModel.setVault(password, 'vault', {
      drive_encryption_key: encryptionKey
    })

    _store.setDriveStatus('ONLINE')

    _store.initSocketIO(_store.getAccount(), channel)

    return {
      account: acctDoc,
      password,
      store: _store
    }
  }
}

function generatePassword(length: number): string {
  return generator.generate({
    length,
    numbers: true,
    uppercase: true,
    symbols: true,
    exclude: `",;:'.[]{}()/\\/\`~=<>|-`
  })
}