const ClientSDK = require("@telios/client-sdk")
const Drive = require('@telios/nebula')
const fs = require('fs')
const envAPI = require('../src/env_api')
import { setDriveOpts, AuthPayload } from './types'
import { AccountSchema } from './schemas'

export class Store {
  public sdk
  public drive: any
  public encryptionKey: any
  public teliosPubKey: string
  public acctPath: string
  
  private _account: AccountSchema | undefined
  private _authPayload: AuthPayload | undefined

  constructor(env: 'development' | 'production' | 'test') {
    const teliosSDK = new ClientSDK({ 
      provider: env === 'production' || !env ? envAPI.prod : envAPI.dev 
    })

    this.sdk = {
      account: teliosSDK.Account,
      mailbox: teliosSDK.Mailbox,
      crypto: teliosSDK.Crypto
    }

    this.drive = null
    this.encryptionKey = ''
    this.acctPath = ''
    
    this._account = undefined
    this._authPayload = undefined
    // this.accountSecrets = {};
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
      }
    });
    return this.drive;
  }

  public getDrive() {
    return this.drive
  }

  public getAccount() {
    return this._account
  }

  public setAccount(account: AccountSchema) {
    this._account = account
  }

  public setAuthPayload(payload: AuthPayload) {
    this._authPayload = payload
  }

  public getAuthPayload() {
    return this._authPayload
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

  // setDBConnection(account, db) {
  //   this.connection = {};
  //   this.connection[account] = db;
  //   this.currentAccount = account;
  // }

  // getDBConnection(account) {
  //   return this.connection[account];
  // }

  // async closeDBConnection() {
  //   await this.connection[this.currentAccount].close();
  //   delete this.connection[this.currentAccount];
  // }

  // setKeypair(keypair) {
  //   this.keypairs[keypair.publicKey] = keypair
  // }

  // getKeypairs() {
  //   return this.keypairs;
  // }

  // setMailbox(mailbox) {
  //   this.api.mailbox = mailbox;
  // }

  // getMailbox() {
  //   return this.api.mailbox;
  // }

  // setSessionActive(bool) {
  //   this.sessionActive = bool;
  // }

  // getSessionActive() {
  //   return this.sessionActive;
  // }

  // setTheme(newTheme) {
  //   this.theme = newTheme;
  // }

  // getTheme() {
  //   return this.theme;
  // }
}
