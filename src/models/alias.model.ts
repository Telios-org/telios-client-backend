import { AliasSchema, StoreSchema } from '../schemas'

export class AliasModel {
  public collection: any
  private _drive: any
  private _store: StoreSchema

  constructor(store: StoreSchema) {
    this._store = store
  }

  public async ready() {
    this._drive = this._store.getDrive()
    this.collection = await this._drive.db.collection('Alias')

    await this.collection.createIndex(['createdAt', 'name'])
    
    return this.collection
  }

  public async insert(doc: AliasSchema) : Promise<AliasSchema> {
    return this.collection.insert(doc)
  }

  public async find(doc?: any) : Promise<AliasSchema[]> {
    return this.collection.find(doc)
  }

  public async findOne(doc?: any) : Promise<AliasSchema> {
    return this.collection.findOne(doc)
  }

  public async remove(doc: any, opts?: any) {
    return this.collection.remove(doc, opts)
  }
 
  public async update(doc:any, props: any, opts?:any) {
    return this.collection.update(doc, props, opts)
  }

  public async search(doc?: AliasSchema, opts?: any) : Promise<AliasSchema[]> {
    return this.collection.search(doc, opts)
  }
}