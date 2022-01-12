import { FileSchema, StoreSchema } from '../schemas'

export class FileModel {
  private _collection: any
  private _drive: any
  private _store: StoreSchema

  constructor(store: StoreSchema) {
    this._store = store
  }

  public async ready() {
    this._drive = this._store.getDrive()
    this._collection = await this._drive.db.collection('Email')

    await this._collection.createIndex(['emailId', 'folderId', 'filename'])
  }

  public async insert(doc: FileSchema) : Promise<FileSchema> {
    return this._collection.insert(doc)
  }

  public async find(doc?: any) : Promise<FileSchema> {
    return this._collection.find(doc)
  }

  public async findOne(doc?: any) : Promise<FileSchema> {
    return this._collection.findOne(doc)
  }

  // public async update(doc: AccountSchema) {
    
  // }

  public async search(doc?: FileSchema, opts?: any) : Promise<FileSchema> {
    return this._collection.search(doc, opts)
  }
}