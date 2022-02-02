const ClientSDK = require('@telios/client-sdk');
const Drive = require('@telios/nebula');
const fs = require('fs');
import envAPI from './env_api';
import { setDriveOpts, AuthPayload, AccountSecrets } from './types';
import { AccountSchema } from './schemas';

export class Store {
  public sdk
  public drive: any
  public encryptionKey: any
  public teliosPubKey: string
  public acctPath: string
  public domain: {

  }
  
  private _teliosSDK: any
  private _account: AccountSchema | any
  private _authPayload: AuthPayload | undefined
  private _accountSecrets: AccountSecrets | undefined
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

    this.drive = null
    this.encryptionKey = ''
    this.acctPath = ''
    
    this._account = undefined
    this._authPayload = undefined
    this._accountSecrets = undefined
    this._keyPairs = new Map()
    // this.account = null;
    // this.currentAccount = null;
    // this.sessionActive = false;
    // this.keypairs = {};
    // this.authPayload = null;
    // this.connection = {};
    // this.theme = 'system';
    // this.initialDraft = null;
    // this.newDraft = null;
    // this.draftDirty = false;
    // this.matomo = null;

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

  public setAccount(account: AccountSchema) {
    this._account = account
  }
  
  public getAccount() : AccountSchema | undefined{
    return this._account
  }

  public setAccountSecrets(secrets: AccountSecrets) {
    this._accountSecrets = secrets
  }

  public getAccountSecrets() : AccountSecrets | undefined {
    return this._accountSecrets
  }

  public setAuthPayload(payload: AuthPayload) {
    this._authPayload = payload
    this._teliosSDK.setAuthPayload(payload)
  }

  public getAuthPayload() {
    return this._authPayload
  }

  public setKeypair(keypair: { publicKey: string, privateKey: string }) {
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

  // setNewDraft(draft) {
  //   this.newDraft = draft;
  // }

  // getNewDraft() {
  //   return this.newDraft;
  // }

  // setInitialDraft(draft) {
  //   this.initialDraft = draft;
  // }

  // getInitialDraft() {
  //   return this.initialDraft;
  // }

  // setDraftDirty(bool) {
  //   this.draftDirty = bool;
  // }

  // getDraftDirty() {
  //   return this.draftDirty;
  // }

  // setAccountSecrets(secrets) {
  //   this.accountSecrets = secrets;
  // }

  // getAccountSecrets() {
  //   return this.accountSecrets;
  // }

  // setTheme(newTheme) {
  //   this.theme = newTheme;
  // }

  // getTheme() {
  //   return this.theme;
  // }
}
