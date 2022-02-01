import { MigrateSchema, StoreSchema } from '../schemas'

export class MigrateModel {
  private _collection: any
  private _drive: any
  private _store: StoreSchema

  constructor(store: StoreSchema) {
    this._store = store
  }

  public async ready() {
    this._drive = this._store.getDrive()
    this._collection = await this._drive.db.collection('Migrate')

    return this._collection
  }

  public async insert(doc: MigrateSchema) : Promise<MigrateSchema> {
    return this._collection.insert(doc)
  }

  public async find(doc?: any) : Promise<MigrateSchema> {
    return this._collection.find(doc)
  }

  public async findOne(doc?: any) : Promise<MigrateSchema> {
    return this._collection.findOne(doc)
  }
}