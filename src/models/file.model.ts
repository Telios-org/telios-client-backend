import { FileSchema, StoreSchema } from '../schemas'

export class FileModel {
  public collection: any
  private _drive: any
  private _store: StoreSchema

  constructor(store: StoreSchema) {
    this._store = store
  }

  public async ready() {
    this._drive = this._store.getDrive()
    this.collection = await this._drive.db.collection('Files')

    await this.collection.createIndex(['createdAt', 'filename'])

    return this.collection
  }

  public async insert(doc: FileSchema) : Promise<FileSchema> {
    return this.collection.insert(doc)
  }

  public async find(doc?: any) : Promise<FileSchema[]> {
    return this.collection.find(doc)
  }

  public async findOne(doc?: any) : Promise<FileSchema> {
    return this.collection.findOne(doc)
  }

  public async remove(doc: any, opts?: any) {
    return this.collection.delete(doc, opts)
  }
 
  public async update(doc:any, props: any, opts?:any) {
    return this.collection.update(doc, props, {...opts, deIndex: false })
  }

  public async search(doc?: FileSchema, opts?: any) : Promise<FileSchema[]> {
    return this.collection.search(doc, opts)
  }
}