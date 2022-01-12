import { AccountModel } from '../models/account.model'
import { MailboxModel } from '../models/mailbox.model'
import { EmailModel } from '../models/email.model'
import { FileModel } from '../models/file.model'
import { FolderModel } from '../models/folder.model'

import { MailboxOpts } from '../types'
import { StoreSchema, AccountSchema } from '../schemas'

export default async (props: MailboxOpts) => {
  const { channel, userDataPath, msg, store } = props 
  const { event, payload } = msg

  const Mailbox = store.sdk.mailbox
  const mailboxModel = new MailboxModel(store)

  /***************************************
   *  REGISTER MAILBOX
   **************************************/
  if (event === 'mailbox:register') {
    try {
      await Mailbox.registerMailbox(payload)
      channel.send({ event: 'mailbox:register:success', data: payload })
    } catch(e: any) {
      channel.send({
        event: 'mailbox:register:error',
        error: {
          name: e.name,
          message: e.message,
          stacktrace: e.stack
        }
      })
    }
  }



  /*************************************************
   *  GET NEW MAIL META DATA FROM API SERVER
   ************************************************/
  if (event === 'mailbox:getNewMailMeta') {
    try {
      const account: AccountSchema = store.getAccount()

      let meta = {}

      meta = await Mailbox.getNewMailMeta(
        account.secretBoxPrivKey,
        account.secretBoxPubKey
      )

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
      const mailboxes = await mailboxModel.findOne()

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
   *  GET MAILBOXES
   ************************************************/
  if (event === 'mailbox:getMailboxFolders') {
    try {
      const folderModel = new FolderModel(store)
      const collection = await folderModel.ready()
      
      const folders = await collection.find({ mailboxId: payload.id }).sort('seq', 1)

      channel.send({
        event: 'mailbox:getMailboxFolders:success',
        data: folders
      });
    } catch(e: any) {
      channel.send({
        event: 'mailbox:getMailboxFolders:error',
        error: {
          name: e.name,
          message: e.message,
          stacktrace: e.stack
        }
      })
    }
  }


    // /*************************************************
  //  *  GET MAILBOXES
  //  ************************************************/
  // if (event === 'mailbox:getMailboxes') {
  //   try {
      
  //   } catch(e: any) {
  //     channel.send({
  //       event: 'mailbox:getMailboxes:error',
  //       error: {
  //         name: e.name,
  //         message: e.message,
  //         stacktrace: e.stack
  //       }
  //     })
  //   }
  // }


    // /*************************************************
  //  *  GET MAILBOXES
  //  ************************************************/
  // if (event === 'mailbox:getMailboxes') {
  //   try {
      
  //   } catch(e: any) {
  //     channel.send({
  //       event: 'mailbox:getMailboxes:error',
  //       error: {
  //         name: e.name,
  //         message: e.message,
  //         stacktrace: e.stack
  //       }
  //     })
  //   }
  // }


    // /*************************************************
  //  *  GET MAILBOXES
  //  ************************************************/
  // if (event === 'mailbox:getMailboxes') {
  //   try {
      
  //   } catch(e: any) {
  //     channel.send({
  //       event: 'mailbox:getMailboxes:error',
  //       error: {
  //         name: e.name,
  //         message: e.message,
  //         stacktrace: e.stack
  //       }
  //     })
  //   }
  // }
}