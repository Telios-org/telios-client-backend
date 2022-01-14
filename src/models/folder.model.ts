import { FolderSchema, StoreSchema } from '../schemas'

export class FolderModel {
  private _collection: any
  private _drive: any
  private _store: StoreSchema

  constructor(store: StoreSchema) {
    this._store = store
  }

  public async ready() {
    this._drive = this._store.getDrive()
    this._collection = await this._drive.db.collection('Folder')

    await this._collection.createIndex(['seq', 'folderId', 'createdAt', 'updatedAt'])
    return this._collection
  }

  public async insert(doc: FolderSchema) : Promise<FolderSchema> {
    return this._collection.insert(doc)
  }

  public async find(doc?: any) : Promise<FolderSchema> {
    return this._collection.find(doc)
  }

  public async findOne(doc?: any) : Promise<FolderSchema> {
    return this._collection.findOne(doc)
  }

  // public async update(doc: AccountSchema) {
    
  // }
}

export const DefaultFolders = [
  {
    id: 1,
    name: 'Inbox',
    type: 'default',
    icon: 'inbox',
    seq: 1
  },
  {
    id: 2,
    name: 'Drafts',
    type: 'default',
    icon: 'pencil',
    seq: 2
  },
  {
    id: 3,
    name: 'Sent',
    type: 'default',
    icon: 'send-o',
    seq: 3
  },
  {
    id: 4,
    name: 'Trash',
    type: 'default',
    icon: 'trash-o',
    seq: 4
  },
  {
    id: 5,
    name: 'Alias',
    type: 'hidden',
    icon: null,
    seq: 5
  }
]