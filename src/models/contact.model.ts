import { ContactSchema, StoreSchema } from '../schemas'

export class ContactModel {
  public collection: any
  private _drive: any
  private _store: StoreSchema

  constructor(store: StoreSchema) {
    this._store = store
  }

  public async ready() {
    this._drive = this._store.getDrive()
    this.collection = await this._drive.db.collection('Contact')

    return this.collection
  }

  public async insert(doc: ContactSchema) : Promise<ContactSchema> {
    const d = await this.collection.insert(doc)
    
    this.collection.ftsIndex(['name', 'email', 'nickname'], [d])
    return d
  }

  public async find(doc?: any) : Promise<ContactSchema[]> {
    return this.collection.find(doc)
  }

  public async findOne(doc?: any) : Promise<ContactSchema> {
    return this.collection.findOne(doc)
  }

  public async remove(doc: any, opts?: any) {
    return this.collection.remove(doc, opts)
  }
 
  public async update(doc:any, props: any, opts?:any) {
    const result = await this.collection.update(doc, props, opts)
    
    // TODO: refactor this so we don't have to do a lookup for text indexing
    this.collection.findOne(doc).then((contact:ContactSchema) => {
      this.collection.ftsIndex(['name', 'email', 'nickname'], [contact])
    })
    
    return result
  }

  public async search(query: string) : Promise<ContactSchema[]> {
    return this.collection.search(query)
  }
}