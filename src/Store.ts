const EventEmitter = require('events')
const ClientSDK = require('@telios/client-sdk')
const Drive = require('@telios/nebula')
const io = require('socket.io-client')

import envAPI from './env_api'
import { setDriveOpts, AuthPayload, AccountSecrets, ModelType, DriveStatuses } from './types'
import { AccountSchema, DeviceSchema } from './schemas'
import { AccountModel } from './models/account.model'
import { AliasModel } from './models/alias.model'
import { AliasNamespaceModel } from './models/aliasNamespace.model'
import { ContactModel } from './models/contact.model'
import { EmailModel } from './models/email.model'
import { FileModel } from './models/file.model'
import { FolderModel } from './models/folder.model'
import { MailboxModel } from './models/mailbox.model'
import { MigrateModel } from './models/migrate.model'
import { Matomo } from './Matomo'

export class Store extends EventEmitter{
  public sdk
  public drive: any
  public encryptionKey: any
  public teliosPubKey: string
  public acctPath: string
  public domain: {
    api: string
    mail: string
  }
  public folderCounts: any
  public models: ModelType

  private _teliosSDK: any
  private _account: AccountSchema
  private _authPayload: AuthPayload
  private _accountSecrets: AccountSecrets
  private _keyPairs: any
  private _connections: Record<string, any>
  private _peers: Record<string, any>
  private _driveStatus: DriveStatuses = 'OFFLINE'
  private _userAgent: string
  private _matomo: any

  constructor(env: 'development' | 'production' | 'test', userAgent: string, signingPubKey?: string, apiURL?: string, IPFSGateway?: string) {
    super()
    
    this._teliosSDK = new ClientSDK({ 
      provider: apiURL || envAPI.prod,
      IPFSGateway
    })

    this.sdk = {
      account: this._teliosSDK.Account,
      mailbox: this._teliosSDK.Mailbox,
      ipfs: this._teliosSDK.IPFS,
      crypto: this._teliosSDK.Crypto
    }

    this.domain = {
      api: apiURL || envAPI.prod,
      mail: env === 'production' || !env ? envAPI.prodMail : envAPI.devMail,
    }

    this.IPFSGateway = IPFSGateway || 'https://ipfs.filebase.io/ipfs'

    this._userAgent = userAgent

    this.env = env
    
    this.models = {
      // @ts-ignore
      Account: new AccountModel(this),
      // @ts-ignore
      Alias: new AliasModel(this),
      // @ts-ignore
      AliasNamespace: new AliasNamespaceModel(this),
      // @ts-ignore
      Contact: new ContactModel(this),
      // @ts-ignore
      Email: new EmailModel(this),
      // @ts-ignore
      File: new FileModel(this),
      // @ts-ignore
      Folder: new FolderModel(this),
      // @ts-ignore
      Mailbox: new MailboxModel(this),
      // @ts-ignore
      Migrate: new MigrateModel(this)
    }

    this.folderCounts = {}

    this.drive = null
    this.encryptionKey = ''
    this.acctPath = ''
    // Fallback to production signing public key if it could not be fetched from well-known resource
    this.teliosPubKey = signingPubKey || "fa8932f0256a4233dde93195d24a6ae4d93cc133d966f3c9f223e555953c70c1"
    
    this._account = {
      uid: '',
      type: 'PRIMARY',
      driveSyncingPublicKey: '',
      driveEncryptionKey:  '',
      secretBoxPubKey:  '',
      secretBoxPrivKey:  '',
      signingPubKey:  '',
      signingPrivKey:  '',
      deviceInfo: {
        keyPair: {
          publicKey: '',
          secretKey: ''
        },
        deviceId: '',
        serverSig: '',
        driveVersion: ''
      },
      mnemonic: ''
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
    this._connections = new Map()
    this._peers = new Map()
    this._swarm = null
  }

  public setIPFSGateway(gatewayURL: string) {
    this.IPFSGateway = gatewayURL
  }

  public getIPFSGateway() : string {
    return this.IPFSGateway
  }

  public setDrive(props: setDriveOpts) {
    const { name, driveKey, blind, keyPair, encryptionKey, broadcast = true, acl = [] } = props
    
    this.encryptionKey = encryptionKey
    
    if(encryptionKey && !Buffer.isBuffer(encryptionKey)) this.encryptionKey = Buffer.from(encryptionKey, 'hex')

    this.drive = new Drive(name, driveKey, {
      keyPair: {
        publicKey: Buffer.from(keyPair?.publicKey, 'hex'),
        secretKey: Buffer.from(keyPair?.secretKey, 'hex')
      },
      encryptionKey: this.encryptionKey,
      checkNetworkStatus: true,
      syncFiles: false,
      blind: blind ? blind : false,
      broadcast: true,
      swarmOpts: {
        server: true,
        client: true
      },
      fullTextSearch: true
    })
    
    return this.drive;
  }

  public getDrive() {
    return this.drive
  }

  public setDriveStatus(status: DriveStatuses) {
    this._driveStatus = status
  }

  public getDriveStatus() {
    return this._driveStatus
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

  public getFolderCount(folderId: any) {
    return this.folderCounts[folderId]
  }

  public setFolderCount(folderId: any, count: number) {
    this.folderCounts[folderId] = count
  }

  public async setAccount(account: AccountSchema, isNew: boolean) {
    this._account = account

    if(account) {
      const Alias = this.models.Alias
      const AliasNamespace = this.models.AliasNamespace
      let aliasArr = []

      const namespaces = await AliasNamespace.find()
      const aliases = await Alias.find()
      
      aliasArr = [...aliases, ...namespaces]

      for (const alias of aliasArr) {
        if(alias.publicKey && alias.privateKey) {
          const keypair = {
            publicKey: alias.publicKey,
            privateKey: alias.privateKey
          }

          this.setKeypair(keypair)
        }
      }

      if(!this._matomo) {
        this._initMatomo(isNew)
      }
    }
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

  public initSocketIO(account:AccountSchema, channel:any) {
    const token = this.refreshToken()
    const domain = this.domain.api.replace('https://', 'wss://')

    const socket = io(domain, {
      path: '/socket.io/',
      reconnectionDelayMax: 10000,
      auth: {
        token
      }
    });

    socket.on('connect', () => {
      channel.send({ event: 'Websocket connection established...'})
    })

    socket.on('disconnect', () => {
      channel.send({ event: 'Websocket disconnected from server...'})
    })

    socket.on('email', (data: any) => {
      channel.send({
        event: 'account:newMessage',
        data: { meta: data.meta, account, async: true },
      })
    })
  }

  public getPeers(): Record<string, any> {
    return this._peers
  }

  public messagePeer(peerPubKey: string, data: { type?: 'newMail', meta?: any, status?: DriveStatuses }) {
    const conn = this._connections.get(peerPubKey)

    if(!conn) throw('Peer is unavailable and cannot receive messages.')

    try {
      const msg = JSON.stringify(data)
      conn.write(msg)
    } catch(err:any) {
      throw err
    }
  }

  public refreshToken() {
    const payload = {
      account_key: this._account.secretBoxPubKey,
      device_signing_key: this._account?.deviceInfo?.keyPair?.publicKey,
      device_id: this._account?.deviceInfo?.deviceId,
      sig: this._account?.deviceInfo?.serverSig
    }

    return this.sdk.account.createAuthToken(payload, this._account?.deviceInfo?.keyPair?.secretKey);
  }

  public killMatomo() {
    if(this._matomo) {
      this._matomo.kill()
      this._matomo = null
    }
  }

  private _initMatomo(isNew: boolean) {
    this._matomo = new Matomo(this._account, this._userAgent, this.env, envAPI)

    let params = {
      e_c: 'Account',
      e_a: isNew ? 'Registered' : 'Signin',
      new_visit: 1
    }

    this._matomo.event(params, () => { return this.refreshToken() })
    this._matomo.heartBeat(30000, () => { return this.refreshToken() })
  }
}
