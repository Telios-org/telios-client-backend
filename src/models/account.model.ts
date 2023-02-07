const fs = require('fs')
const path = require('path')
const sodium = require('sodium-native')
const MemStream = require('memorystream')
const blake = require('blakejs')
import * as FileUtil from '../util/file.util'

import { AccountSchema, StoreSchema, DeviceSchema } from '../schemas'

export class AccountModel {
  public collection: any
  private _drive: any
  private _store: StoreSchema

  constructor(store: StoreSchema) {
    this._store = store
  }

  public async ready(drive?:any) {
    if(!drive) {
      this._drive = this._store.getDrive()
    } else {
      this._drive = drive
    }

    this.collection = await this._drive.db.collection('Account')

    return this.collection
  }

  public async insert(doc: AccountSchema): Promise<AccountSchema> {
    return this.collection.insert(doc)
  }

  public async find(doc?: any): Promise<AccountSchema[]> {
    return this.collection.find(doc)
  }

  public async findOne(doc?: any): Promise<AccountSchema> {
    return this.collection.findOne(doc)
  }

  public async remove(doc: any, opts?: any) {
    return this.collection.delete(doc, opts)
  }
 
  public async update(doc:any, props: any, opts?:any) {
    return this.collection.update(doc, props, {...opts, deIndex: false })
  }

  public setDeviceInfo(payload: DeviceSchema, password: string) {
    const filePath = path.join(`${this._store.getAccountPath()}/Drive/device`)

    const cipher = this._encrypt(JSON.stringify(payload), password)

    fs.writeFileSync(filePath, cipher)
  }

  public getDeviceInfo(password: string): any {
    const filePath = path.join(`${this._store.getAccountPath()}/Drive/device`)

    if (!fs.existsSync(filePath)) return null 

    const cipher = fs.readFileSync(filePath)

    const deciphered = this._decrypt(cipher, password)

    return JSON.parse(deciphered.toString())
  }

  public async setVault(
    password: string,
    type: 'recovery' | 'vault',
    payload: {
      master_pass?: string
      drive_encryption_key?: any
    },
  ) {
    const ipfsStream = new MemStream()

    const cipher = this._encrypt(JSON.stringify(payload), password)

    ipfsStream.end(cipher)

    const { cid } = await FileUtil.saveFileToIPFS(this._store.sdk.ipfs, ipfsStream)

    await this._drive._localDB.put('vault', { isSet: true })

    const driveStream = new MemStream()
   
    driveStream.end(cipher)

    await this._drive.writeFile(`/${type}`, driveStream, { encrypted: false, customData: { cid: cid } })
  }

  public getVault(
    password: string,
    type: 'recovery' | 'vault',
    customPath?: string
  ): { drive_encryption_key: any, keyPair: any, master_pass: any } {
    let vaultPath

    if(customPath) {
      vaultPath = customPath
    } else {
      vaultPath = path.join(`${this._store.getAccountPath()}/Drive/Files/`, type)
    }

    if (!fs.existsSync(vaultPath)) throw { type: 'VAULTERROR', message: `${type} file not found.` }

    const cipher = fs.readFileSync(vaultPath)

    const deciphered = this._decrypt(cipher, password)

    return JSON.parse(deciphered.toString())
  }

  private _encrypt(msg: string, password: string) {
    const keyPair = this._keypairFromStr(password)
    return this._encryptPubSecretBoxMessage(
      msg,
      keyPair.publicKey,
      keyPair.privateKey,
    )
  }

  private _decrypt(cipher: string, password: string): string {
    const keyPair = this._keypairFromStr(password)
    const deciphered = this._decryptPubSecretBoxMessage(
      cipher,
      keyPair.publicKey,
      keyPair.privateKey,
    )
    return deciphered.toString('utf-8')
  }

  private _encryptPubSecretBoxMessage(msg: string, sbpkey: any, privKey: any) {
    const m = Buffer.from(msg, 'utf-8')
    const c = Buffer.alloc(m.length + sodium.crypto_box_MACBYTES)
    const n = Buffer.alloc(sodium.crypto_box_NONCEBYTES)
    const pk = Buffer.alloc(sodium.crypto_box_PUBLICKEYBYTES)
    const sk = Buffer.alloc(sodium.crypto_box_SECRETKEYBYTES)

    pk.fill(Buffer.from(sbpkey, 'hex'))
    sk.fill(Buffer.from(privKey, 'hex'))

    sodium.crypto_box_easy(c, m, n, pk, sk)

    return c
  }

  private _decryptPubSecretBoxMessage(c: string, pk: any, sk: any) {
    const m = Buffer.alloc(c.length - sodium.crypto_box_MACBYTES)
    const n = Buffer.alloc(sodium.crypto_box_NONCEBYTES)

    const bool = sodium.crypto_box_open_easy(m, c, n, pk, sk)

    if (!bool) throw new Error('Unable to decrypt message.')

    return m
  }

  private _keypairFromStr(str: string): { publicKey: any; privateKey: any } {
    let pk = Buffer.alloc(sodium.crypto_box_PUBLICKEYBYTES)
    let sk = Buffer.alloc(sodium.crypto_box_SECRETKEYBYTES)
    let seed = Buffer.alloc(sodium.crypto_box_SEEDBYTES)

    const buf = Buffer.from(blake.blake2sHex(str))

    seed.fill(buf)

    sodium.crypto_box_seed_keypair(pk, sk, seed)

    return {
      publicKey: pk,
      privateKey: sk,
    }
  }
}
