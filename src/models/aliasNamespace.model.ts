import { AliasNamespaceSchema, StoreSchema } from '../schemas'

export class AliasNamespaceModel {
  private _collection: any
  private _drive: any
  private _store: StoreSchema

  constructor(store: StoreSchema) {
    this._store = store
  }

  public async ready() {
    this._drive = this._store.getDrive()
    this._collection = await this._drive.db.collection('AliasNamespace')

    await this._collection.createIndex(['mailboxId', 'name'])
    
    return this._collection
  }

  public async insert(doc: AliasNamespaceSchema) : Promise<AliasNamespaceSchema> {
    return this._collection.insert(doc)
  }

  public async find(doc?: any) : Promise<AliasNamespaceSchema> {
    return this._collection.find(doc)
  }

  public async findOne(doc?: any) : Promise<AliasNamespaceSchema> {
    return this._collection.findOne(doc)
  }

  // public async update(doc: AccountSchema) {
    
  // }

  public async search(doc?: AliasNamespaceSchema, opts?: any) : Promise<AliasNamespaceSchema> {
    return this._collection.search(doc, opts)
  }
}