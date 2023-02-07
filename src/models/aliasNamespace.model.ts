import { AliasNamespaceSchema, StoreSchema } from '../schemas'

export class AliasNamespaceModel {
  public collection: any
  
  private _drive: any
  private _store: StoreSchema

  constructor(store: StoreSchema) {
    this._store = store
  }

  public async ready() {
    this._drive = this._store.getDrive()
    this.collection = await this._drive.db.collection('AliasNamespace')

    await this.collection.createIndex(['name', 'mailboxId'])
    
    return this.collection
  }

  public async insert(doc: AliasNamespaceSchema) : Promise<AliasNamespaceSchema> {
    return this.collection.insert(doc)
  }

  public async find(doc?: any) : Promise<AliasNamespaceSchema[]> {
    return this.collection.find(doc)
  }

  public async findOne(doc?: any) : Promise<AliasNamespaceSchema> {
    return this.collection.findOne(doc)
  }

  public async remove(doc: any, opts?: any) {
    return this.collection.delete(doc, opts)
  }
 
  public async update(doc:any, props: any, opts?:any) {
    return this.collection.update(doc, props, {...opts, deIndex: false })
  }

  public async search(doc?: AliasNamespaceSchema, opts?: any) : Promise<AliasNamespaceSchema[]> {
    return this.collection.search(doc, opts)
  }
}