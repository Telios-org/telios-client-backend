import { setDriveOpts, AuthPayload, AccountSecrets, ModelType, DriveStatuses } from './types'

interface IEmissions {
  'peer-updated': (data: {
      peerKey: string
      status: DriveStatuses
      server: boolean
  }) => void
}

export declare interface StoreSchema {
  _userAgent: string
  _accountSecrets: {
    email: string
    password: string
  }
  sdk: {
    account: any
    mailbox: any
    ipfs: any
    crypto: any
    domain: any
  }
  env: 'development' | 'production' | 'test'
  drive: any
  encryptionKey: any
  IPFSGateway: string
  teliosPubKey: string
  acctPath: string
  domain: {
    api: string
    mail: string
  }
  folderCounts: any
  models: ModelType
  on: <K extends "peer-updated">(event: K, listener: IEmissions[K]) => this
  emit: <K extends "peer-updated">(event: K, ...args: Parameters<IEmissions[K]>) => boolean
  setIPFSGateway(gatewayURL: string): void
  getIPFSGateway(): string
  setDrive(props: setDriveOpts): any
  getDrive(): any
  setDriveStatus(string: DriveStatuses): any
  getDriveStatus(): DriveStatuses
  initModels(): Promise<void>
  setAccount(account: AccountSchema | null, isNew: boolean): void
  setAccountPath(path: string): void
  getAccountPath(): string
  getAccount(): AccountSchema
  setAccountSecrets(secrets: AccountSecrets): void
  getAccountSecrets(): AccountSecrets
  setAuthPayload(payload: AuthPayload): void
  getAuthPayload(): AuthPayload
  setKeypair(keypair: {
      publicKey: string
      privateKey: string
  }): void
  getKeypairs(): any
  initSocketIO(account: AccountSchema, channel:any): void
  // joinPeer(peerPubKey: string): any
  getPeers(): Record<string, any>
  messagePeer(peerPubKey: string, data: { type?: 'newMail', meta?: any, status?: DriveStatuses }): any
  refreshToken(): any
  killMatomo(): void
  getFolderCount(folderId: any): any
  setFolderCount(folderId: any, count: number): any
  clear(): void
  killMatomo(): void
}

export interface DeviceSchema {
  keyPair: {
    publicKey: string,
    secretKey: string
  }
  deviceId?: string
  deviceType?: string,
  serverSig?: string
  driveSyncingPublicKey?: string
  driveVersion: string
}

export interface AccountSchema {
  _id?: any,
  type: 'PRIMARY' | 'CLAIMABLE' | 'SUB',
  plan: string
  accountId?: string
  displayName?: string
  avatar?: string
  uid: string
  driveSyncingPublicKey: string
  driveEncryptionKey: string
  secretBoxPubKey: string
  secretBoxPrivKey: string
  signingPubKey?: string
  signingPrivKey?: string
  deviceId?: string
  serverSig?: string
  deviceInfo? : DeviceSchema
  mnemonic: string
  // Timestamps
  createdAt?: string
  updatedAt?: string
}

export interface MailboxSchema {
  _id?: any,
  type: 'PRIMARY' | 'CLAIMABLE' | 'SUB',
  mailboxId: string
  address: string
  name?: string
  displayName?: string
  password?: string
  domainKey?: string
  driveSyncingPublicKey?: string
  driveEncryptionKey?: string
  mnemonic?: string
  syncCode?: string
  // Timestamps
  createdAt?: string
  updatedAt?: string
}

export interface EmailSchema {
  emailId?: string
  requestId?: string
  folderId: number
  mailboxId: number
  aliasId?: string | null
  subject: string
  unread: boolean
  date: string
  toJSON: string
  fromJSON: string
  ccJSON?: string
  bccJSON?: string
  bodyAsText: string
  bodyAsHtml?: string
  attachments: string
  path: string
  count?: any
  cid?: string
  key?: string
  header?: string
  // Timestamps
  createdAt?: string
  updatedAt?: string
}

export interface AliasSchema {
  aliasId: string
  name: string
  publicKey?: string
  privateKey?: string
  description?: string | undefined
  namespaceKey: string | undefined
  fwdAddresses?: any
  count: number
  seq?: number
  disabled?: boolean | undefined
  whitelisted?: boolean | undefined
  // Timestamps
  createdAt?: string
  updatedAt?: string
}

export interface AliasNamespaceSchema {
  name: string
  publicKey: string
  privateKey: string
  mailboxId: string
  domain: string
  disabled?: boolean
  // Timestamps
  createdAt?: string
  updatedAt?: string
}

export interface FileSchema {
  _id?: any
  uuid?: string
  fileId?: string
  cid?: string
  emailId: string
  folderId: number
  filename: string
  contentType: string
  content: string
  size: number
  drive: string
  path: string
  key?: any
  header?: any
  hash: string
  feed?: string
  encrypted?: boolean
  discoveryKey?: any
  discovery_key?: any
  // Timestamps
  createdAt?: string
  updatedAt?: string
}

export interface FolderSchema {
  _id?: any
  folderId: number
  mailboxId: number
  name: string
  type: string
  count?: number
  icon?: string
  color?: string
  seq: number
  // Timestamps
  createdAt?: string
  updatedAt?: string
}

export interface ContactSchema {
  _id: any
  contactId: number
  name: string
  givenName?: string
  familyName?: string
  nickname?: string
  birthday?: string
  publicKey?: string
  pgpPublicKey?: string
  photo?: string
  email: string
  phone?: [
    {
      value: string
      type?: string
    }
  ]
  address?: [
    {
      formatted?: string
      street: string
      street2?: string
      city: string
      state: string
      postalCode?: string
      country?: string
      type?: string
    }
  ]
  website?: string
  notes?: string
  organization?: [
    {
      name: string
      jobTitle?: string
    }
  ]
  // Timestamps
  createdAt?: string
  updatedAt?: string
}

export interface MigrateSchema {
  _id: any
  name: string
}

export interface DomainSchema {
  _id?: any
  name: string
  active?: boolean
  dns: {
    vcode?: {
      type: string
      name: string
      value: string
      verified: boolean
    }
    mx?: {
      type: string
      name: string
      value: string
      verified: boolean
    }
    dkim?: {
      type: string
      name: string
      value: string
      verified: boolean
    }
    spf?: {
      type: string
      name: string
      value: string
      verified: boolean
    }
    dmarc?: {
      type: string
      name: string
      value: string
      verified: boolean
    }
  }
  createdAt?: string
  updatedAt?: string
}