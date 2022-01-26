import { ContactSchema, StoreSchema } from '../schemas'

export class ContactModel {
  private _collection: any
  private _drive: any
  private _store: StoreSchema

  constructor(store: StoreSchema) {
    this._store = store
  }

  public async ready() {
    this._drive = this._store.getDrive()
    this._collection = await this._drive.db.collection('Contact')

    return this._collection
  }

  public async insert(doc: ContactSchema) : Promise<ContactSchema> {
    const d = await this._collection.insert(doc)
    this._collection.ftsIndex(['name', 'email'])
    return d
  }

  public async find(doc?: any) : Promise<ContactSchema> {
    return this._collection.find(doc)
  }

  public async findOne(doc?: any) : Promise<ContactSchema> {
    return this._collection.findOne(doc)
  }

  public async remove(doc: any, opts?: any) {
    return this._collection.remove(doc, opts)
  }
 
  public async update(doc:any, props: any, opts?:any) {
    const result = await this._collection.update(doc, props, opts)
    this._collection.ftsIndex(['name', 'email'])
    return result
  }
}