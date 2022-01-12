export interface MainOpts {
  channel: any
  userDataPath: string
  env: 'development' | 'production' | 'test'
}

export interface AccountMessage {
  event: 'account:create' | 'account:login'| 'account:remove' | 'account:logout' | 'account:exit'
  payload: {
    email: string
    password: string
    recoveryEmail: string
    vcode: string
  }
}

export interface MailboxMessage {
  event: 'mailbox:register'
        | 'mailbox:getNewMailMeta' 
        | 'mailbox:markArrayAsSynced' 
        | 'mailbox:getMailboxes'
        | 'mailbox:getMailboxFolders'
        | 'mailbox:registerAliasNamespace'
        | 'mailbox:getMailboxAliases'
        | 'mailbox:registerAliasAddress'
        | 'mailbox:updateAliasAddress'
        | 'mailbox:removeAliasAddress'
        | 'mailbox:getMessagesByFolderId'
        | 'mailbox:getMessagesByAliasId'
        | 'mailbox:getMessageById'
        | 'mailbox:markAsUnread'
        | 'mailbox:sendEmail'
        | 'mailbox:saveSentMessageToDB'
        | 'mailbox:saveMessageToDB'
        | 'mailbox:removeMessages'
        | 'mailbox:moveMessages'
        | 'mailbox:saveMailbox'
        | 'mailbox:saveFiles'
        | 'mailbox:searchMailbox'
        | 'mailbox:createFolder'
        | 'mailbox:updateFolder'
        | 'mailbox:updateFolderCount'
        | 'mailbox:updateAliasCount'
        | 'mailbox:deleteFolder'
  payload: any
}

export interface AccountOpts {
  channel: any
  userDataPath: string,
  msg: AccountMessage,
  store: any
}

export interface MailboxOpts {
  channel: any
  userDataPath: string,
  msg: MailboxMessage,
  store: any
}

export interface setDriveOpts {
  name: string
  keyPair?: {
    publicKey: string,
    privateKey: string
  },
  encryptionKey: string
  acl?: string[]
}

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
    device_signing_key: string
    device_id: string
  }
  device_signing_priv_key: string
  sig: string
}

export interface AccountSecrets {
  password: string | undefined
  email: string | undefined
}