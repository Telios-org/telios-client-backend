import { MailboxModel } from '../models/mailbox.model'
import { EmailModel } from '../models/email.model'
import { FolderModel, DefaultFolders } from '../models/folder.model'

import { MailboxOpts } from '../types'
import { 
  AccountSchema, 
  EmailSchema,
  MailboxSchema} from '../schemas'

export default async (props: MailboxOpts) => {
  const { channel, msg, store } = props 
  const { event, payload } = msg

  const Mailbox = store.sdk.mailbox
  
  /***************************************
   *  REGISTER MAILBOX
   **************************************/
  if (event === 'mailbox:register') {
    try {
      await Mailbox.registerMailbox(payload)
      channel.send({ event: 'mailbox:register:success', data: payload })
    } catch(e: any) {
      console.log('ERROR', e)
      channel.send({
        event: 'mailbox:register:error',
        error: JSON.stringify(e) })
    }
  }



  /*************************************************
   *  GET NEW MAIL META DATA FROM API SERVER
   ************************************************/
  if (event === 'mailbox:getNewMailMeta') {
    try {
      const account: AccountSchema = store.getAccount()
      channel.send({ event: 'mailbox:info', data: { account } })
      let meta = {}

      meta = await Mailbox.getNewMailMeta(
        account.secretBoxPrivKey,
        account.secretBoxPubKey
      )

      channel.send({ event: 'mailbox:info', data: { meta } })

      channel.send({ event: 'mailbox:getNewMailMeta:success', data: { meta, account } })
    } catch(e: any) {
      channel.send({
        event: 'mailbox:getNewMailMeta:error',
        error: {
          name: e.name,
          message: e.message,
          stacktrace: e.stack
        }
      })
    }
  }



/*************************************************
 *  MARK EMAILS AS SYNCED
 ************************************************/
  if (event === 'mailbox:markArrayAsSynced') {
    try {
      await Mailbox.markAsSynced(payload.msgArray)
      channel.send({ event: 'mailbox:markArrayAsSynced:success', data: payload.msgArray })
    } catch(e: any) {
      channel.send({
        event: 'mailbox:markArrayAsSynced:error',
        error: {
          name: e.name,
          message: e.message,
          stacktrace: e.stack
        }
      })
    }
  }



  /*************************************************
   *  GET MAILBOXES
   ************************************************/
  if (event === 'mailbox:getMailboxes') {
    try {
      const mailboxModel = new MailboxModel(store)
      const Mailbox = await mailboxModel.ready()

      const mailboxes = await Mailbox.findOne()
      
      channel.send({ event: 'mailbox:getMailboxes:success', data: mailboxes })
    } catch(e: any) {
      channel.send({
        event: 'mailbox:getMailboxes:error',
        error: {
          name: e.name,
          message: e.message,
          stacktrace: e.stack
        }
      })
    }
  }



  /*************************************************
   *  SAVE MAILBOX
   ************************************************/
  if (event === 'mailbox:saveMailbox') {
    const { address } = payload

    try {
      const folderModel = new FolderModel(store)
      const mailboxModel = new MailboxModel(store)
      
      const Mailbox = await mailboxModel.ready()
      const Folder = await folderModel.ready()

      const mailbox: MailboxSchema = await Mailbox.insert({ address })

      for (const folder of DefaultFolders) {
        let _folder: any = { ...folder }
        _folder.mailboxId = mailbox.mailboxId;
        await Folder.insert(_folder)
      }

      channel.send({ event: 'mailbox:saveMailbox:success', data: mailbox })
    } catch(e: any) {
      channel.send({
        event: 'mailbox:saveMailbox:error',
        error: {
          name: e.name,
          message: e.message,
          stacktrace: e.stack
        }
      })
    }
  }
}