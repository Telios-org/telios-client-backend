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

export interface AccountOpts {
  channel: any
  userDataPath: string,
  msg: AccountMessage,
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