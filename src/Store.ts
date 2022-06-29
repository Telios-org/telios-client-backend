const EventEmitter = require('events')
const ClientSDK = require('@telios/client-sdk')
const Drive = require('@telios/nebula')

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
  public models: ModelType

  private _teliosSDK: any
  private _account: AccountSchema
  private _authPayload: AuthPayload
  private _accountSecrets: AccountSecrets
  private _keyPairs: any
  private _connections: Record<string, any>
  private _peers: Record<string, any>
  private _driveStatus: DriveStatuses = 'OFFLINE'

  constructor(env: 'development' | 'production' | 'test', signingPubKey?: string, apiURL?: string) {
    super()
    
    this._teliosSDK = new ClientSDK({ 
      provider: apiURL || envAPI.prod
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

    this.drive = null
    this.encryptionKey = ''
    this.acctPath = ''
    // Fallback to production signing public key if it could not be fetched from well-known resource
    this.teliosPubKey = signingPubKey || "fa8932f0256a4233dde93195d24a6ae4d93cc133d966f3c9f223e555953c70c1"
    
    this._account = {
      uid: '',
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
        serverSig: ''
      }
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

  public setDrive(props: setDriveOpts) {
    const { name, driveKey, blind, keyPair, encryptionKey, acl = [] } = props
    
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
      swarmOpts: {
        server: true,
        client: true,
        acl: []
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

  public joinPeer(peerKey: string) {
    if(!this._swarm) {
      this._swarm = this.drive._swarm.server

      this._swarm.on('connection', (socket:any, info:any) => {
        const peerKey = socket.remotePublicKey.toString('hex')
        let conn = this._connections.get(peerKey)
        
        if(!conn) {
          // Send current drive status to peer every 5 seconds
          socket.statusInterval = setInterval(() => {
            const _conn = this._connections.get(peerKey)

            if(!_conn) {
              return clearInterval(socket.statusInterval)
            }

            conn.write(JSON.stringify({ status: this.getDriveStatus() }))
          }, 5000)

          this._connections.set(peerKey, socket)
          conn = socket
        }

        conn.on('data', (data: any) => {
          try {
            const msg = JSON.parse(data.toString())
            const peer = this._peers.get(peerKey)
            if(!peer || msg.status === 'OFFLINE' && peer.status !== msg.status) {
              this.emit('peer-updated', { peerKey, status: msg.status, server: true })
              this._peers.set(peerKey, { status: msg.status, server: true })
            }
    
          } catch(err) {
            // Could not parse JSON
          }
        })
    
        conn.on('error', async (err: any) => {
          clearInterval(socket.statusInterval)
          this.emit('peer-updated', { peerKey, status: 'OFFLINE', server: true })
          this.drive._swarm.server.leavePeer(Buffer.from(peerKey, 'hex'))
          this._peers.delete(peerKey)
          this._connections.delete(peerKey)

          if(peerKey === this.teliosPubKey) {
            // Attempt to reconnect to server
            await this.drive._swarm.server.flush();
            this.joinPeer(peerKey)
          }
        })
      })
    }
   
    this._swarm.joinPeer(Buffer.from(peerKey, 'hex'))
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
}
