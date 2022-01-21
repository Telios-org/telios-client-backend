import { EmailSchema, StoreSchema } from '../schemas'
import { QueryOpts } from '../types'

export class EmailModel {
  private _collection: any
  private _drive: any
  private _store: StoreSchema

  constructor(store: StoreSchema) {
    this._store = store
  }

  public async ready() {
    this._drive = this._store.getDrive()
    this._collection = await this._drive.db.collection('Email')

    await this._collection.createIndex(['emailId', 'folderId', 'date', 'createdAt', 'updatedAt'])
    await this._collection.ftsIndex(['subject', 'toJSON', 'fromJSON', 'ccJSON', 'bccJSON', 'bodyAsText', 'attachments'])

    return this._collection
  }

  public async insert(doc: EmailSchema) : Promise<EmailSchema> {
    return this._collection.insert(doc)
  }

  public async find(doc?: any) {
    return this._collection.find(doc)
  }

  public async findOne(doc?: any) : Promise<EmailSchema> {
    return this._collection.findOne(doc)
  }

  // public async update(doc: AccountSchema) {
    
  // }

  public async search(doc?: EmailSchema, opts?: any) : Promise<EmailSchema> {
    return this._collection.search(doc, opts)
  }
}