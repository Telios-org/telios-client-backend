import { AccountModel } from './models/account.model'
import { AliasModel } from './models/alias.model'
import { AliasNamespaceModel } from './models/aliasNamespace.model'
import { ContactModel } from './models/contact.model'
import { EmailModel } from './models/email.model'
import { FileModel } from './models/file.model'
import { FolderModel } from './models/folder.model'
import { MailboxModel } from './models/mailbox.model'
import { MigrateModel } from './models/migrate.model'

import { StoreSchema } from './schemas'

export interface ModelType {
  Account: AccountModel
  Alias: AliasModel
  AliasNamespace: AliasNamespaceModel
  Contact: ContactModel
  Email: EmailModel
  File: FileModel
  Folder: FolderModel
  Mailbox: MailboxModel
  Migrate: MigrateModel
}

export interface MainOpts {
  channel: any
  userDataPath: string
  env: 'development' | 'production' | 'test'
}

export interface AccountMessage {
  event: 'account:create' 
        | 'account:login'
        | 'account:resetPassword'
        | 'account:recover'
        | 'account:createSyncCode'
        | 'account:getSyncInfo'
        | 'account:sync'
        | 'account:remove'
        | 'account:update'
        | 'account:retrieveStats' 
        | 'account:logout' 
        | 'account:exit'
        | 'account:refreshToken'
  payload: {
    accountId: string,
    displayName: string,
    deviceType: 'DESKTOP' | 'MOBILE'
    avatar: string,
    email: string
    password: string
    recoveryEmail: string
    vcode: string
    code: string
    passphrase: string
    newPass: string,
    driveKey: string,
    encryptionKey: string
    mnemonic: string
  }
}

export interface MailboxMessage {
  event: 'mailbox:register'
        | 'mailbox:getNewMailMeta' 
        | 'mailbox:markArrayAsSynced' 
        | 'mailbox:getMailboxes'
        | 'mailbox:saveMailbox'
        | 'mailbox:updateMailboxName'
  payload: any
}

export interface EmailMessage {
  event: 'email:getMessagesByFolderId'
        | 'email:getMessagesByAliasId'
        | 'email:getUnreadMessagesByFolderId'
        | 'email:getReadMessagesByFolderId'
        | 'email:getUnreadMessagesByAliasId'
        | 'email:getReadMessagesByAliasId'
        | 'email:getMessageById'
        | 'email:markAsUnread'
        | 'email:sendEmail'
        | 'email:saveSentMessageToDB'
        | 'email:saveMessageToDB'
        | 'email:removeMessages'
        | 'email:moveMessages'
        | 'email:saveFiles'
        | 'email:searchMailbox'
  payload: any
}

export interface FolderMessage {
  event: 'folder:getMailboxFolders'
        | 'folder:createFolder'
        | 'folder:updateFolder'
        | 'folder:updateFolderCount'
        | 'folder:deleteFolder'
  payload: any
}

export interface AliasMessage {
  event: 'alias:updateAliasCount'
        | 'alias:getMailboxNamespaces'
        | 'alias:registerAliasNamespace'
        | 'alias:getMailboxAliases'
        | 'alias:registerAliasAddress'
        | 'alias:updateAliasAddress'
        | 'alias:removeAliasAddress'
  payload: any
}

export interface ContactMessage {
  event: 'contact:createContacts'
        | 'contact:getContactById'
        | 'contact:updateContact'
        | 'contact:searchContact'
        | 'contact:removeContact'
        | 'contact:getAllContacts'
  payload: any
}

export interface MsgHelperMessage {
  event: 'messageHandler:initMessageListener'
        | 'messageHandler:newMessageBatch'
        | 'messageHandler:newMessage'
        | 'messageHandler:retryMessageBatch'
  payload: any
}

export interface MigrateMessage {
  event: 'migrate:up' | 'migrate:down'
  payload: any
}

export interface FileMessage {
  event: 'file:saveFile' | 'alias:getFile'
  payload: any
}

export interface AccountOpts {
  channel: any
  userDataPath: string,
  msg: AccountMessage,
  store: StoreSchema
}

export interface MailboxOpts {
  channel: any
  userDataPath: string,
  msg: MailboxMessage,
  store: StoreSchema
}

export interface FolderOpts {
  channel: any
  userDataPath: string,
  msg: FolderMessage,
  store: StoreSchema
}

export interface FileOpts {
  channel: any
  userDataPath: string,
  msg: FileMessage,
  store: StoreSchema
}

export interface AliasOpts {
  channel: any
  userDataPath: string,
  msg: AliasMessage,
  store: StoreSchema
}

export interface EmailOpts {
  channel: any
  userDataPath: string,
  msg: EmailMessage,
  store: StoreSchema
}

export interface ContactOpts {
  channel: any
  userDataPath: string,
  msg: ContactMessage,
  store: StoreSchema
}

export interface MigrateOpts {
  channel: any
  userDataPath: string,
  msg: MigrateMessage,
  store: StoreSchema
}

export interface setDriveOpts {
  name: string
  blind?: boolean
  keyPair: {
    publicKey: string,
    secretKey: string
  },
  driveKey?: string
  encryptionKey?: string
  broadcast?: boolean
  acl?: string[]
}

export type DriveStatuses = 'ONLINE' | 'OFFLINE' | 'BUSY' | 'AWAY'

export interface QueryOpts {
  count?: boolean
  sort?: (sortKey: string, direction: number) => any
  skip?: (amount: number) => any
  limit?: (amount: number) => any
}

export interface ChannelError {
  name: string
  message: string
  stack: string
}

export interface AuthPayload {
  claims: {
    account_key: string
    device_signing_key?: string
    device_id?: string
  }
  device_signing_priv_key?: string
  sig?: string
}

export interface AccountSecrets {
  password: string | undefined
  email: string | undefined
}

export interface Attachment {
  _id?: any
  fileId?: string
  cid?: string
  emailId?: string
  name?: string
  content?: string
  filename?: string
  contentType?: string
  localPath?: string
  mimetype?: string
  extension?: string
  size: number
  discoveryKey?: string
  hash?: string
  header?: string
  key?: string
  path?: string
}