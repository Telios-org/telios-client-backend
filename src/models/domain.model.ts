import { DomainSchema, StoreSchema } from '../schemas'

export class DomainModel {
  public collection: any
  private _drive: any
  private _store: StoreSchema

  constructor(store: StoreSchema) {
    this._store = store
  }

  public async ready() {
    this._drive = this._store.getDrive()
    this.collection = await this._drive.db.collection('Domain')
    await this.collection.createIndex(['name'])
    return this.collection
  }

  public async insert(doc: DomainSchema) : Promise<DomainSchema> {
    const d = await this.collection.insert(doc)
    this.collection.ftsIndex(['name'], [d])
    return d
  }

  public async find(doc?: any) : Promise<DomainSchema[]> {
    return this.collection.find(doc)
  }

  public async findOne(doc?: any) : Promise<DomainSchema> {
    return this.collection.findOne(doc)
  }

  public async remove(doc: any, opts?: any) {
    return this.collection.remove(doc, opts)
  }
 
  public async update(doc:any, props: any, opts?:any) {
    const result = await this.collection.update(doc, props, opts)
    
    // TODO: refactor this so we don't have to do a lookup for text indexing
    this.collection.findOne(doc).then((contact:DomainSchema) => {
      this.collection.ftsIndex(['name'], [contact])
    })
    
    return result
  }

  public async search(query: string) : Promise<DomainSchema[]> {
    return this.collection.search(query)
  }
}