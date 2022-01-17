import { AliasSchema, StoreSchema } from '../schemas'

export class AliasModel {
  private _collection: any
  private _drive: any
  private _store: StoreSchema

  constructor(store: StoreSchema) {
    this._store = store
  }

  public async ready() {
    this._drive = this._store.getDrive()
    this._collection = await this._drive.db.collection('Alias')

    await this._collection.createIndex(['createdAt', 'name'])
    
    return this._collection
  }

  public async insert(doc: AliasSchema) : Promise<AliasSchema> {
    return this._collection.insert(doc)
  }

  public async find(doc?: any) : Promise<AliasSchema> {
    return this._collection.find(doc)
  }

  public async findOne(doc?: any) : Promise<AliasSchema> {
    return this._collection.findOne(doc)
  }

  // public async update(doc: AccountSchema) {
    
  // }

  public async search(doc?: AliasSchema, opts?: any) : Promise<AliasSchema> {
    return this._collection.search(doc, opts)
  }
}