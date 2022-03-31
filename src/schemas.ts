import { setDriveOpts, AuthPayload, AccountSecrets, ModelType } from './types'

export interface StoreSchema {
  sdk: {
    account: any
    mailbox: any
    crypto: any
  }
  drive: any
  encryptionKey: any
  teliosPubKey: string
  acctPath: string
  domain: {
    api: string
    mail: string
  }
  models: ModelType
  setDrive(props: setDriveOpts): any
  getDrive(): any
  initModels(): Promise<void>
  setAccount(account: AccountSchema | null): void
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
  refreshToken(): any
}

export interface AccountSchema {
  _id?: any,
  accountId?: string
  displayName?: string
  avatar?: string
  uid: string
  driveEncryptionKey: string
  secretBoxPubKey: string
  secretBoxPrivKey: string
  deviceSigningPubKey: string
  deviceSigningPrivKey: string
  serverSig: string
  deviceId: string
  // Timestamps
  createdAt?: string
  updatedAt?: string
}

export interface MailboxSchema {
  _id?: any,
  mailboxId: string
  address: string
  name?: string
  // Timestamps
  createdAt?: string
  updatedAt?: string
}

export interface EmailSchema {
  emailId: string
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
  // Timestamps
  createdAt?: string
  updatedAt?: string
}

export interface AliasSchema {
  aliasId: string
  name: string
  description?: string | undefined
  namespaceKey: string | undefined
  fwdAddresses?: any
  count: number
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
  fileId?: string
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
  phone?: any
  address?: string
  website?: string
  notes?: string
  organization?: any
  // Timestamps
  createdAt?: string
  updatedAt?: string
}

export interface MigrateSchema {
  _id: any
  name: string
}