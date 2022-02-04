import { EmailSchema, StoreSchema } from '../schemas'
import { QueryOpts } from '../types'

export interface EmailProps {
  emailId?: any
  folderId?: number
  aliasId?: string | null
  subject?: string
  unread?: boolean
  date?: string
  toJSON?: string
  fromJSON?: string
  ccJSON?: string
  bccJSON?: string
  bodyAsText?: string
  bodyAsHtml?: string
  attachments?: string
  path?: string
  count?: any
  // Timestamps
  createdAt?: string
  updatedAt?: string
}

export class EmailModel {
  private _collection: any
  private _drive: any
  private _store: StoreSchema

  constructor(store: StoreSchema) {
    this._store = store
  }

  public async ready() {
    this._drive = this._store.getDrive()
    this._collection = await this._drive.db.collection('Email')

    await this._collection.createIndex(['date'])
    await this._collection.createIndex(['emailId'])
    await this._collection.createIndex(['folderId'])

    return this._collection
  }

  public async insert(doc: EmailProps) : Promise<EmailSchema> {
    const d = await this._collection.insert(doc)
    this._collection.ftsIndex(['subject', 'toJSON', 'fromJSON', 'ccJSON', 'bccJSON', 'bodyAsText', 'attachments'])
    return d
  }

  public async find(doc?: EmailProps) {
    return this._collection.find(doc)
  }

  public async findOne(doc?: EmailProps) : Promise<EmailSchema> {
    return this._collection.findOne(doc)
  }

  public async update(doc: EmailProps, updateVars: any, opts?: any) {
    // TODO: update search index
    return this._collection.update(doc, updateVars, opts)
  }

  public async remove(doc: EmailProps, opts?: any) {
    return this._collection.remove(doc, opts)
  }

  public async search(query: string) : Promise<EmailSchema[]> {
    return this._collection.search(query)
  }
}