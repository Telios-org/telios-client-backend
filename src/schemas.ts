import { setDriveOpts, AuthPayload, AccountSecrets } from './types'

export interface AccountSchema {
  uid: string
  driveEncryptionKey: string
  secretBoxPubKey: string
  secretBoxPrivKey: string
  deviceSigningPubKey: string
  deviceSigningPrivKey: string
  serverSig: string
  deviceId: string,
  // Timestamps
  createdAt: string,
  updatedAt: string
}

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