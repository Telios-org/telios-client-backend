import { DefaultFolders } from '../models/folder.model'

import { MailboxOpts } from '../types'
import { AccountSchema, MailboxSchema} from '../schemas'
import { UTCtimestamp } from '../util/date.util'

const BSON = require('bson')
const { ObjectID } = BSON

export default async (props: MailboxOpts) => {
  const { channel, msg, store } = props 
  const { event, payload } = msg

  const MailboxSDK = store.sdk.mailbox
  
  /***************************************
   *  REGISTER MAILBOX
   **************************************/
  if (event === 'mailbox:register') {
    try {
      await MailboxSDK.registerMailbox(payload)
      channel.send({ event: 'mailbox:register:callback', data: payload })
    } catch(err: any) {
      channel.send({
        event: 'mailbox:register:callback',
        error: {
          name: err.name,
          message: err.message,
          stacktrace: err.stack
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

      meta = await MailboxSDK.getNewMailMeta(
        account.secretBoxPrivKey,
        account.secretBoxPubKey
      )

      channel.send({ event: 'mailbox:getNewMailMeta:callback', data: { meta, account } })
    } catch(err: any) {
      channel.send({
        event: 'mailbox:getNewMailMeta:callback',
        error: {
          name: err.name,
          message: err.message,
          stacktrace: err.stack
        }
      })
    }
  }



/*************************************************
 *  MARK EMAILS AS SYNCED
 ************************************************/
  if (event === 'mailbox:markArrayAsSynced') {
    try {
      await MailboxSDK.markAsSynced(payload.msgArray)
      channel.send({ event: 'mailbox:markArrayAsSynced:callback', data: payload.msgArray })
    } catch(err: any) {
      channel.send({
        event: 'mailbox:markArrayAsSynced:callback',
        error: {
          name: err.name,
          message: err.message,
          stacktrace: err.stack
        }
      })
    }
  }



  /*************************************************
   *  GET MAILBOXES
   ************************************************/
  if (event === 'mailbox:getMailboxes') {
    try {
      const Mailbox = store.models.Mailbox

      const mailboxes: MailboxSchema[] = await Mailbox.find()

      const _mailboxes = mailboxes.map(mailbox => {
        if(mailbox.type === 'PRIMARY' && !mailbox.password || mailbox.type === 'PRIMARY' && !mailbox.domainKey) {
          const acctSecrets = store.getAccountSecrets()
          
          return {
            ...mailbox,
            password: acctSecrets.password,
            domainKey: 'telios.io'
          }
        } else {
          return mailbox
        }
      })
      
      channel.send({ event: 'mailbox:getMailboxes:callback', data: _mailboxes })
    } catch(err: any) {
      channel.send({
        event: 'mailbox:getMailboxes:callback',
        error: {
          name: err.name,
          message: err.message,
          stacktrace: err.stack
        }
      })
    }
  }



  /*************************************************
   *  SAVE MAILBOX
   ************************************************/
  if (event === 'mailbox:saveMailbox') {
    let { address, mailboxId } = payload

    try {
      const Mailbox = store.models.Mailbox
      const Folder = store.models.Folder

      const _id = new ObjectID()

      if(!mailboxId) {
        mailboxId = _id.toString('hex')
      }

      const acctSecrets = store.getAccountSecrets()

      const mailbox: MailboxSchema = await Mailbox.insert({ 
        _id, 
        address, 
        mailboxId,
        displayName: address,
        type: 'PRIMARY',
        password: acctSecrets.password,
        domainKey: 'telios.io',
        createdAt: UTCtimestamp(),
        updatedAt: UTCtimestamp()
      })

      for (const folder of DefaultFolders) {
        let _folder: any = { ...folder }
        _folder.mailboxId = mailbox.mailboxId
        await Folder.insert(_folder)
      }

      channel.send({ event: 'mailbox:saveMailbox:callback', data: mailbox })
    } catch(err: any) {
      channel.send({
        event: 'mailbox:saveMailbox:callback',
        error: {
          name: err.name,
          message: err.message,
          stacktrace: err.stack
        }
      })
    }
  }

  /*************************************************
   *  UPDATE MAILBOX DISPLAY NAME
   ************************************************/
   if (event === 'mailbox:updateMailboxName') {
    let { name, mailboxId } = payload

    try {
      const Mailbox = store.models.Mailbox

      const mailbox: MailboxSchema = await Mailbox.update({ mailboxId }, { displayName: name, updatedAt: UTCtimestamp() })

      channel.send({ event: 'mailbox:updateMailboxName:callback', data: mailbox })
    } catch(err: any) {
      channel.send({
        event: 'mailbox:updateMailboxName:callback',
        error: {
          name: err.name,
          message: err.message,
          stacktrace: err.stack
        },
        data: null
      })
    }
  }
}