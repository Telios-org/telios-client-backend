import { setDriveOpts, AuthPayload, AccountSecrets } from './types'

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
  new(env: 'development' | 'production' | 'test'): any
  setDrive(props: setDriveOpts): any
  getDrive(): any
  setAccount(account: AccountSchema): void
  getAccount(): AccountSchema | undefined
  setAccountSecrets(secrets: AccountSecrets): void
  getAccountSecrets(): AccountSecrets
  setAuthPayload(payload: AuthPayload): void
  getAuthPayload(): AuthPayload | undefined
}

export interface AccountSchema {
  uid: string
  driveEncryptionKey: string
  secretBoxPubKey: string
  secretBoxPrivKey: string
  deviceSigningPubKey: string
  deviceSigningPrivKey: string
  serverSig: string
  deviceId: string
  // Timestamps
  createdAt: string
  updatedAt: string
}

export interface MailboxSchema {
  mailboxId: string
  address: string
  name: string
  // Timestamps
  createdAt: string
  updatedAt: string
}

export interface EmailSchema {
  emailId: string
  folderId: number
  aliasId?: string | null
  subject: string
  unread: number
  date: string
  toJSON: string
  fromJSON: string
  ccJSON?: string
  bccJSON?: string
  bodyAsText: string
  bodyAsHtml: string
  attachments: string
  path: string
  count?: any
  // Timestamps
  createdAt: string
  updatedAt: string
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
  createdAt: string
  updatedAt: string
}

export interface AliasNamespaceSchema {
  name: string
  publicKey: string
  privateKey: string
  mailboxId: string
  domain: string
  disabled?: boolean
  // Timestamps
  createdAt: string
  updatedAt: string
}

export interface FileSchema {
  _id: any
  fileId?: string
  emailId: string
  folderId: number
  filename: string
  contentType: string
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
  createdAt: string
  updatedAt: string
}

export interface FolderSchema {
  _id: any
  id: number
  folderId: number
  mailboxId: number
  name: string
  type: string
  count: number
  icon: string
  color: string
  seq: number
  // Timestamps
  createdAt: string
  updatedAt: string
}

export interface ContactSchema {
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
  createdAt: string
  updatedAt: string
}