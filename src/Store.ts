const ClientSDK = require('@telios/client-sdk')
const Drive = require('@telios/nebula')
import envAPI from './env_api'
import { setDriveOpts, AuthPayload, AccountSecrets, ModelType } from './types'
import { AccountSchema } from './schemas'
import { AccountModel } from './models/account.model'
import { AliasModel } from './models/alias.model'
import { AliasNamespaceModel } from './models/aliasNamespace.model'
import { ContactModel } from './models/contact.model'
import { EmailModel } from './models/email.model'
import { FileModel } from './models/file.model'
import { FolderModel } from './models/folder.model'
import { MailboxModel } from './models/mailbox.model'
import { MigrateModel } from './models/migrate.model'

export class Store {
  public sdk
  public drive: any
  public encryptionKey: any
  public teliosPubKey: string
  public acctPath: string
  public domain: {
    api: string
    mail: string
  }
  public models: ModelType

  private _teliosSDK: any
  private _account: AccountSchema
  private _authPayload: AuthPayload
  private _accountSecrets: AccountSecrets
  private _keyPairs: any

  constructor(env: 'development' | 'production' | 'test') {
    this._teliosSDK = new ClientSDK({ 
      provider: env === 'production' || !env ? envAPI.prod : envAPI.dev 
    })

    this.sdk = {
      account: this._teliosSDK.Account,
      mailbox: this._teliosSDK.Mailbox,
      crypto: this._teliosSDK.Crypto
    }

    this.domain = {
      api: env === 'production' || !env ? envAPI.prod : envAPI.dev,
      mail: env === 'production' || !env ? envAPI.prodMail : envAPI.devMail,
    }

    this.models = {
      Account: new AccountModel(this),
      Alias: new AliasModel(this),
      AliasNamespace: new AliasNamespaceModel(this),
      Contact: new ContactModel(this),
      Email: new EmailModel(this),
      File: new FileModel(this),
      Folder: new FolderModel(this),
      Mailbox: new MailboxModel(this),
      Migrate: new MigrateModel(this)
    }

    this.drive = null
    this.encryptionKey = ''
    this.acctPath = ''
    
    this._account = {

      uid: '',
      driveEncryptionKey:  '',
      secretBoxPubKey:  '',
      secretBoxPrivKey:  '',
      deviceSigningPubKey:  '',
      deviceSigningPrivKey:  '',
      serverSig:  '',
      deviceId:  ''
    }

    this._authPayload = {
      claims: {
        account_key: '',
        device_signing_key: '',
        device_id: ''
      },
      device_signing_priv_key: '',
      sig: ''
    }

    this._accountSecrets = {
      password: '',
      email: ''
    }
    
    this._keyPairs = new Map()

    // TODO: Retrieve this remotely from server
    this.teliosPubKey = 'fa8932f0256a4233dde93195d24a6ae4d93cc133d966f3c9f223e555953c70c1';
  }

  public setDrive(props: setDriveOpts) {
    const { name, keyPair, encryptionKey, acl = [] } = props
    
    this.encryptionKey = encryptionKey
    
    if(!Buffer.isBuffer(encryptionKey)) this.encryptionKey = Buffer.from(encryptionKey, 'hex')
    
    this.drive = new Drive(name, null, {
      keyPair,
      encryptionKey: this.encryptionKey,
      checkNetworkStatus: true,
      swarmOpts: {
        server: true,
        client: true,
        acl: [this.teliosPubKey, ...acl]
      },
      fullTextSearch: true
    })
    
    return this.drive;
  }

  public getDrive() {
    return this.drive
  }

  public async initModels() {
    const asyncModels = []

    for(const model in this.models) {
      asyncModels.push(new Promise((resolve, reject) => {
        setTimeout(async () => {
          try {
            const m = await this.models[model as keyof typeof this.models].ready()
            return resolve(m)
          } catch(err: any) {
            return reject(err)
          }
        })
      }))
    }

    try {
      await Promise.all(asyncModels)
    } catch(err:any) {
      throw err
    }
  }

  public setAccount(account: AccountSchema) {
    this._account = account
  }
  
  public getAccount() : AccountSchema {
    return this._account
  }

  public setAccountSecrets(secrets: AccountSecrets): void {
    this._accountSecrets = secrets
  }

  public getAccountSecrets(): AccountSecrets {
    return this._accountSecrets
  }

  public setAuthPayload(payload: AuthPayload): void {
    this._authPayload = payload
    this._teliosSDK.setAuthPayload(payload)
  }

  public getAuthPayload(): AuthPayload {
    return this._authPayload
  }

  public setKeypair(keypair: { publicKey: string, privateKey: string }): void {
    this._keyPairs.set(keypair.publicKey, keypair)
  }

  public getKeypairs() {
    let keyPairs:any = {}

    for(let entry of this._keyPairs) {
      keyPairs[entry[0]] = entry[1]
    }
    return keyPairs;
  }

  public refreshToken() {
    const payload = {
      account_key: this._account.secretBoxPubKey,
      device_signing_key: this._account.deviceSigningPubKey,
      device_id: this._account.deviceId,
      sig: this._account.serverSig
    }

    return this.sdk.account.createAuthToken(payload, this._account.deviceSigningPrivKey);
  }
}
