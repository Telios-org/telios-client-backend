import { MailboxSchema, StoreSchema } from '../schemas'

export class MailboxModel {
  private _collection: any
  private _drive: any
  private _store: StoreSchema

  constructor(store: StoreSchema) {
    this._store = store
  }

  public async ready() {
    this._drive = this._store.getDrive()
    this._collection = await this._drive.db.collection('Mailbox')
  }

  public async insert(doc: MailboxSchema) : Promise<MailboxSchema> {
    return this._collection.insert(doc)
  }

  public async find(doc?: any) : Promise<MailboxSchema> {
    return this._collection.find(doc)
  }

  public async findOne(doc?: any) : Promise<MailboxSchema> {
    return this._collection.findOne(doc)
  }

  // public async update(doc: AccountSchema) {
    
  // }
}