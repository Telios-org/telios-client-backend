import { MigrateSchema, StoreSchema } from '../schemas'

export class MigrateModel {
  public collection: any
  private _drive: any
  private _store: StoreSchema

  constructor(store: StoreSchema) {
    this._store = store
  }

  public async ready() {
    this._drive = this._store.getDrive()
    this.collection = await this._drive.db.collection('Migrate')

    return this.collection
  }

  public async insert(doc: MigrateSchema) : Promise<MigrateSchema> {
    return this.collection.insert(doc)
  }

  public async find(doc?: any) : Promise<MigrateSchema[]> {
    return this.collection.find(doc)
  }

  public async findOne(doc?: any) : Promise<MigrateSchema> {
    return this.collection.findOne(doc)
  }

  public async remove(doc: any, opts?: any) {
    return this.collection.remove(doc, opts)
  }
 
  public async update(doc:any, props: any, opts?:any) {
    return this.collection.update(doc, props, opts)
  }
}