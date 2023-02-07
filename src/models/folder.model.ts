import { channel } from 'diagnostics_channel'
import { FolderSchema, StoreSchema } from '../schemas'
import { Store } from '../Store'
import { UTCtimestamp } from '../util/date.util'

export class FolderModel {
  public collection: any
  private _drive: any
  private _store: StoreSchema

  constructor(store: StoreSchema) {
    this._store = store
  }

  public async ready() {
    this._drive = this._store.getDrive()
    this.collection = await this._drive.db.collection('Folder')

    await this.collection.createIndex(['seq', 'folderId', 'mailboxId'])
    
    return this.collection
  }

  public async insert(doc: FolderSchema) : Promise<FolderSchema> {
    return this.collection.insert(doc)
  }

  public async find(doc?: any) : Promise<FolderSchema[]> {
    return this.collection.find(doc)
  }

  public async findOne(doc?: any) : Promise<FolderSchema> {
    return this.collection.findOne(doc)
  }

  public async remove(doc: any, opts?: any) {
    return this.collection.delete(doc, opts)
  }
 
  public async update(doc:any, props: any, opts?:any) {
    if(props['$inc']) {
      const currentCount = this._store.getFolderCount(doc.folderId)
      this._store.setFolderCount(doc.folderId, currentCount + props['$inc'].count)
    }
    return this.collection.update(doc, props, { ...opts, deIndex: false })
  }
}

export const DefaultFolders = [
  {
    folderId: 1,
    name: 'Inbox',
    type: 'default',
    icon: 'inbox',
    seq: 1,
    count: 0,
    createdAt: UTCtimestamp(),
    updatedAt: UTCtimestamp()
  },
  {
    folderId: 2,
    name: 'Drafts',
    type: 'default',
    icon: 'pencil',
    seq: 2,
    count: 0,
    createdAt: UTCtimestamp(),
    updatedAt: UTCtimestamp()
  },
  {
    folderId: 3,
    name: 'Sent',
    type: 'default',
    icon: 'send-o',
    seq: 3,
    count: 0,
    createdAt: UTCtimestamp(),
    updatedAt: UTCtimestamp()
  },
  {
    folderId: 4,
    name: 'Trash',
    type: 'default',
    icon: 'trash-o',
    seq: 4,
    count: 0,
    createdAt: UTCtimestamp(),
    updatedAt: UTCtimestamp()
  },
  {
    folderId: 5,
    name: 'Alias',
    type: 'hidden',
    icon: null,
    seq: 5,
    count: 0,
    createdAt: UTCtimestamp(),
    updatedAt: UTCtimestamp()
  }
]