import { EmailSchema, StoreSchema } from '../schemas'
import { QueryOpts } from '../types'

export interface EmailProps {
  emailId?: any
  folderId?: number
  mailboxId?: number,
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
  public collection: any
  private _drive: any
  private _store: StoreSchema

  constructor(store: StoreSchema) {
    this._store = store
  }

  public async ready() {
    this._drive = this._store.getDrive()
    this.collection = await this._drive.db.collection('Email')

    await this.collection.createIndex(['date', 'folderId', 'emailId'])

    return this.collection
  }

  public async insert(doc: EmailProps) : Promise<EmailSchema> {
    let bodyAsText = ""

    if(doc.bodyAsText) {
      bodyAsText = doc.bodyAsText.split(" ").slice(0, 20).join(" ")
    }

    if(doc.attachments) {
      let attachments = JSON.parse(doc.attachments)
      attachments = attachments.map((file:any) => {
        if(file.content) {
          delete file.content
        }

        return file
      })

      doc.attachments = JSON.stringify(attachments)
    }

    const sparseEmail = {
      emailId: doc.emailId,
      folderId: doc.folderId,
      mailboxId: doc.mailboxId,
      aliasId: doc.aliasId,
      subject: doc.subject,
      unread: doc.unread,
      date: doc.date,
      toJSON: doc.toJSON,
      fromJSON: doc.fromJSON,
      bccJSON: doc.bccJSON, // We need this this info gets stripped in the file upon sending
      bodyAsText: bodyAsText,
      attachments: doc.attachments,
      path: doc.path,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt
    }

    const d = await this.collection.insert(sparseEmail)
    
    const fullDoc = { ...doc, _id: d._id }

    this.collection.ftsIndex(['subject', 'toJSON', 'fromJSON', 'ccJSON', 'bccJSON', 'bodyAsText', 'attachments'], [fullDoc])
    
    return {...doc, ...d}
  }

  public async find(doc?: EmailProps) : Promise<EmailSchema[]> {
    return this.collection.find(doc)
  }

  public async findOne(doc?: EmailProps) : Promise<EmailSchema> {
    return this.collection.findOne(doc)
  }

  public async update(doc: EmailProps, updateVars: any, opts?: any) {
    // TODO: update search index
    return this.collection.update(doc, updateVars, opts)
  }

  public async remove(doc: EmailProps, opts?: any) {
    return this.collection.remove(doc, opts)
  }

  public async search(query: string) : Promise<EmailSchema[]> {
    return this.collection.search(query)
  }
}