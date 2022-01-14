const { v4: uuidv4 } = require('uuid');
const fs = require('fs')

import { AccountModel } from '../models/account.model'
import { MailboxModel } from '../models/mailbox.model'
import { EmailModel } from '../models/email.model'
import { AliasModel } from '../models/alias.model'
import { AliasNamespaceModel } from '../models/aliasNamespace.model'
import { FileModel } from '../models/file.model'
import { FolderModel, DefaultFolders } from '../models/folder.model'

import * as FileUtil from '../util/file.util'

import { AliasOpts, Attachment } from '../types'
import { 
  StoreSchema, 
  AccountSchema, 
  AliasSchema, 
  AliasNamespaceSchema, 
  FolderSchema, 
  EmailSchema,
  FileSchema,
  MailboxSchema} from '../schemas'
import { isDataView } from 'util/types';

export default async (props: AliasOpts) => {
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
      const Folder = await folderModel.ready()
      
      const folders: FolderSchema[] = await Folder.find({ mailboxId: payload.id }).sort('seq', 1)

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


  /*************************************************
   *  GET MAILBOXE NAMESPACES
   ************************************************/
  if (event === 'mailbox:getMailboxNamespaces') {
    try {
      const aliasNamespaceModel = new AliasNamespaceModel(store)
      const AliasNamespace = await aliasNamespaceModel.ready()

      const namespaces: AliasNamespaceSchema[] = await AliasNamespace.find({ mailboxId: payload.id }).sort('name', 1)

      for (const namespace of namespaces) {
        const keypair = {
          publicKey: namespace.publicKey,
          privateKey: namespace.privateKey
        };

        store.setKeypair(keypair)
      }

      channel.send({
        event: 'mailbox:getMailboxNamespaces:success',
        data: namespaces
      });
    } catch(e: any) {
      channel.send({
        event: 'mailbox:getMailboxNamespaces:error',
        error: {
          name: e.name,
          message: e.message,
          stacktrace: e.stack
        }
      })
    }
  }


  /*************************************************
   *  REGISTER ALIAS NAMESPACE
   ************************************************/
  if (event === 'mailbox:registerAliasNamespace') {
    try {
      const { mailboxId, namespace } = payload

      const Crypto = store.sdk.crypto
      const aliasNamespaceModel = new AliasNamespaceModel(store)
      const AliasNamespace = await aliasNamespaceModel.ready()

      const account: AccountSchema = store.getAccount()

      const keypair = Crypto.boxKeypairFromStr(`${account.secretBoxPrivKey}${namespace}@${store.domain.mail}`)

      const { registered, key } = await Mailbox.registerAliasName({
        alias_name: namespace,
        domain: store.domain.mail,
        key: keypair.publicKey
      });

      const output = await AliasNamespace.insert({
        publicKey: key,
        privateKey: keypair.privateKey,
        name: namespace,
        mailboxId,
        domain: store.domain.mail,
        disabled: false
      })

      store.setKeypair(keypair);

      channel.send({
        event: 'mailbox:registerAliasNamespace:success',
        data: output.dataValues
      })
    } catch(e: any) {
      channel.send({
        event: 'mailbox:registerAliasNamespace:error',
        error: {
          name: e.name,
          message: e.message,
          stacktrace: e.stack
        }
      })
    }
  }


  /*************************************************
   *  GET MAILBOX ALIASES
   ************************************************/
  if (event === 'mailbox:getMailboxAliases') {
    try {
      const aliasModel = new AliasModel(store)
      const Alias = await aliasModel.ready()

      const aliases = await Alias.find({ 
        namespaceKey: { 
          $in: payload.namespaceKeys 
        } 
      }).sort('createdAt', -1)

      const outputAliases = aliases.map((a: AliasSchema) => {
        return {
          ...a,
          fwdAddresses:
            (a.fwdAddresses && a.fwdAddresses.length) > 0
              ? a.fwdAddresses.split(',')
              : [],
          createdAt: new Date(a.createdAt)
        }
      })

      channel.send({
        event: 'mailbox:getMailboxAliases:success',
        data: outputAliases
      })
    } catch(e: any) {
      channel.send({
        event: 'mailbox:getMailboxAliases:error',
        error: {
          name: e.name,
          message: e.message,
          stacktrace: e.stack
        }
      })
    }
  }



  /*************************************************
   *  REGISTER ALIAS ADDRESS
   ************************************************/
  if (event === 'mailbox:registerAliasAddress') {
    const {
      namespaceName,
      domain,
      address,
      description,
      fwdAddresses,
      disabled
    } = payload

    try {
      const aliasModel = new AliasModel(store)
      const Alias = await aliasModel.ready()

      const { registered } = await Mailbox.registerAliasAddress({
        alias_address: `${namespaceName}#${address}@${domain}`,
        forwards_to: fwdAddresses,
        whitelisted: true,
        disabled
      });

      const output = await Alias.insert({
        aliasId: `${namespaceName}#${address}`,
        name: address,
        namespaceKey: namespaceName,
        count: 0,
        description,
        fwdAddresses: fwdAddresses.length > 0 ? fwdAddresses.join(',') : null,
        disabled,
        whitelisted: 1
      })

      channel.send({
        event: 'mailbox:registerAliasAddress:success',
        data: { ...output, fwdAddresses }
      })
    } catch(e: any) {
      channel.send({
        event: 'mailbox:registerAliasAddress:error',
        error: {
          name: e.name,
          message: e.message,
          stacktrace: e.stack
        }
      })
    }
  }

  /*************************************************
   *  UPDATE ALIAS ADDRESS
   ************************************************/
  if (event === 'mailbox:updateAliasAddress') {
    const {
      namespaceName,
      domain,
      address,
      description,
      fwdAddresses,
      disabled
    } = payload

    try {
      const aliasModel = new AliasModel(store)
      const Alias = await aliasModel.ready()

      await Mailbox.updateAliasAddress({
        alias_address: `${namespaceName}#${address}@${domain}`,
        forwards_to: fwdAddresses,
        whitelisted: true,
        disabled
      })

      const output = await Alias.update(
        { name: address },
        {
          fwdAddresses:
            fwdAddresses.length > 0 ? fwdAddresses.join(',') : null,
          description,
          disabled
        }
      )

      channel.send({
        event: 'mailbox:updateAliasAddress:success',
        data: output
      })
    } catch(e: any) {
      channel.send({
        event: 'mailbox:updateAliasAddress:error',
        error: {
          name: e.name,
          message: e.message,
          stacktrace: e.stack
        }
      })
    }
  }



  /*************************************************
   *  REMOVE ALIAS ADDRESS
   ************************************************/
  if (event === 'mailbox:removeAliasAddress') {
    const { namespaceName, domain, address } = payload

    try {
      const aliasModel = new AliasModel(store)
      const Alias = await aliasModel.ready()

      await Mailbox.removeAliasAddress(`${namespaceName}#${address}@${domain}`)

      // TODO: Add a delete methods for Hyperbeedeebee
      await Alias.deleteOne({ aliasId: `${namespaceName}#${address}` })

      channel.send({ event: 'mailbox:removeAliasAddress:success', data: null })
    } catch(e: any) {
      channel.send({
        event: 'mailbox:removeAliasAddress:error',
        error: {
          name: e.name,
          message: e.message,
          stacktrace: e.stack
        }
      })
    }
  }



  /*************************************************
   *  GET EMAILS BY FOLDER ID
   ************************************************/
  if (event === 'mailbox:getMessagesByFolderId') {
    try {
      const emailModel = new EmailModel(store)
      const Email = await emailModel.ready()

      const messages: EmailSchema[] = await Email.find({ folderId: payload.id }).sort('date', -1)

      channel.send({
        event: 'MAIL_WORKER::getMessagesByFolderId',
        data: messages
      })
    } catch(e: any) {
      channel.send({
        event: 'mailbox:getMessagesByFolderId:error',
        error: {
          name: e.name,
          message: e.message,
          stacktrace: e.stack
        }
      })
    }
  }



  /*************************************************
   *  GET MESSAGES BY ALIAS ID
   ************************************************/
  if (event === 'mailbox:getMessagesByAliasId') {
    try {
      const emailModel = new EmailModel(store)
      const Email = await emailModel.ready()

      const messages: EmailSchema[] = await Email.find({ aliasId: payload.id, folderId: 5})
        .sort('date', -1)
        .skip(payload.offset)
        .limit(payload.limit)

      channel.send({
        event: 'mailbox:getMessagesByAliasId:success',
        data: messages
      })
    } catch(e: any) {
      channel.send({
        event: 'mailbox:getMessagesByAliasId:error',
        error: {
          name: e.name,
          message: e.message,
          stacktrace: e.stack
        }
      })
    }
  }



  /*************************************************
   *  GET EMAIL MESSAGES BY ID
   ************************************************/
  if (event === 'mailbox:getMessageById') {
    try {
      const emailModel = new EmailModel(store)
      const Email = await emailModel.ready()

      const email: EmailSchema = await Email.findOne({ emailId: payload.id })
        
        email.attachments = JSON.parse(email.attachments)

        if (email.unread) {
          await Email.update({ emailId: email.emailId })

          email.unread = 0
        }

        channel.send({ event: 'mailbox:getMessageById:success', data: { id: email.emailId, ...email } })
    } catch(e: any) {
      channel.send({
        event: 'mailbox:getMessageById:error',
        error: {
          name: e.name,
          message: e.message,
          stacktrace: e.stack
        }
      })
    }
  }



  /*************************************************
   *  MARK EMAIL AS UNREAD
   ************************************************/
  if (event === 'mailbox:markAsUnread') {
    try {
      const { id } = payload;

      const emailModel = new EmailModel(store)
      const Email = await emailModel.ready()

      await Email.update({ emailId: id }, { unread: 1 })

      channel.send({ event: 'mailbox:markAsUnread:success', data: null })
    } catch(e: any) {
      channel.send({
        event: 'mailbox:markAsUnread:error',
        error: {
          name: e.name,
          message: e.message,
          stacktrace: e.stack
        }
      })
    }
  }
  
  /*************************************************
   *  SEND EMAIL
   ************************************************/
  if (event === 'mailbox:sendEmail') {
    try {
      const account: AccountSchema = store.getAccount()
      const drive = store.getDrive()
      const emailFilename = uuidv4()
      const emailDest = `/email/${emailFilename}.json`

      let res = await Mailbox.send(payload.email, {
        owner: payload.email.from[0].address,
        keypairs: {
          secretBoxKeypair: {
            publicKey: account.secretBoxPubKey,
            privateKey: account.secretBoxPrivKey
          },
          signingKeypair: {
            publicKey: account.deviceSigningPubKey,
            privateKey: account.deviceSigningPrivKey
          }
        },
        drive,
        dest: emailDest
      })

      res = { name: emailFilename, email: payload.email, ...res }

      channel.send({ event: 'mailbox:sendEmail:success', data: res })
    } catch(e: any) {
      channel.send({
        event: 'mailbox:sendEmail:error',
        error: {
          name: e.name,
          message: e.message,
          stacktrace: e.stack
        }
      })
    }
  }



  /*************************************************
   *  SAVE SENT EMAIL TO DATABASE
   ************************************************/
  if (event === 'mailbox:saveSentMessageToDB') {
    try {
      const emailModel = new EmailModel(store)
      const Email = await emailModel.ready()

      const drive = store.getDrive()

      const { messages } = payload
      const msg = messages[0]

      let email = {
        ...msg,
        emailId: uuidv4(),
        path: `/email/${uuidv4()}.json`,
        folderId: 3,
        subject: msg.subject ? msg.subject : '(no subject)',
        fromJSON: JSON.stringify(msg.from),
        toJSON: JSON.stringify(msg.to),
        ccJSON: JSON.stringify(msg.cc),
        bccJSON: JSON.stringify(msg.bcc)
      }

      if (email.attachments && email.attachments.length) {
        email.attachments = email.attachments.map((file: Attachment) => {
          const fileId = file.fileId || uuidv4();
          return {
            id: fileId,
            emailId: email.id,
            filename: file.name || file.filename,
            contentType: file.contentType || file.mimetype,
            size: file.size,
            discoveryKey: file.discoveryKey,
            hash: file.hash,
            header: file.header,
            key: file.key,
            path: file.path
          }
        })
      } else {
        email.attachments = []
      }

      email.attachments = JSON.stringify(email.attachments)

      const file : FileSchema = await FileUtil.saveEmailToDrive({ email, drive })

      const _f = await FileUtil.readFile(email.path, { drive, type: 'email' })

      email = {
        ...email,
        encKey: file.key,
        encHeader: file.header
      };

      Email.insert(email);

      channel.send({ event: 'mailbox:saveSentMessageToDB:success', data: email })
    } catch(e: any) {
      channel.send({
        event: 'mailbox:saveSentMessageToDB:error',
        error: {
          name: e.name,
          message: e.message,
          stacktrace: e.stack
        }
      })
    }
  }



  /*************************************************
   *  SAVE INCOMING EMAIL TO DATABASE
   ************************************************/
  if (event === 'mailbox:saveMessageToDB') {
    try {
      const drive = store.getDrive()
      
      const emailModel = new EmailModel(store)
      const aliasNamespaceModel = new AliasNamespaceModel(store)
      const aliasModel = new AliasModel(store)
      const fileModel = new FileModel(store)
      
      const Email = await emailModel.ready()
      const AliasNamespace = await aliasNamespaceModel.ready()
      const Alias = await aliasModel.ready()
      const File = await fileModel.ready()

      const { messages, type, newMessage } = payload

      const asyncMsgs: Promise<any>[] = []
      const asyncFolders: FolderSchema[] = []
      const newAliases: AliasSchema[] = []

      for await (const msg of messages) {
        const attachments: Attachment[] = []
        let folderId
        let aliasId = null

        if (!msg.email) {
          msg.email = msg
        }

        if (!msg._id) {
          msg._id = uuidv4()
        }

        if (type === 'Sent' && msg.email.emailId) {
          msg.email.emailId = null;
          // This should already be enforced at the composer level.
        }

        if (
          msg.email &&
          msg.email.attachments &&
          msg.email.attachments.length > 0
        ) {
          msg.email.attachments.forEach((file: Attachment) => {
            const fileId = file.fileId || uuidv4()
            const fileObj = {
              id: fileId,
              emailId: msg.email.emailId || msg._id,
              filename: file.filename || file.name,
              contentType: file.contentType,
              size: file.size,
              discoveryKey: file.discoveryKey || drive.discoveryKey,
              path: `/file/${fileId}.file`,
              hash: file.hash,
              header: file.header,
              key: file.key
            }

            attachments.push(fileObj)

            if (file.content) {
              asyncMsgs.push(
                FileUtil.saveFileToDrive(File, {
                  drive,
                  content: file.content,
                  file: fileObj
                })
              )
            }
          })
        }

        let isAlias = false

        switch (type) {
          case 'Incoming':
            // Assign email into appropriate folder/alias
            for await (const recipient of msg.email.to) {
              // Recipient is an alias
              if (recipient.address.indexOf('#') > -1) {
                folderId = 0
                isAlias = true
                const localPart = recipient.address.split('@')[0]
                const recipAliasName = localPart.split('#')[0]
                const recipAliasAddress = localPart.split('#')[1]

                const aliasNamespace: AliasNamespaceSchema = await AliasNamespace.findOne({ name: recipAliasName })

                // Alias is not part of this account so send this email to the main inbox
                if (!aliasNamespace) {
                  folderId = 1
                  break
                }

                const aliasAddrs: AliasSchema[] = await Alias.find()

                // Check if incoming message alias already exists
                const aliasIndex = aliasAddrs.findIndex(
                  (item: AliasSchema) => item.aliasId === localPart
                )

                if (aliasIndex === -1) {
                  // create a new alias!
                  const alias: AliasSchema = await Alias.insert({
                    aliasId: localPart,
                    name: recipAliasAddress,
                    namespaceKey: aliasNamespace.name,
                    count: 0,
                    disabled: false,
                    fwdAddresses: null,
                    whitelisted: 1
                  })

                  aliasId = alias.aliasId
                  newAliases.push({ ...alias, fwdAddresses: [] })
                } else {
                  aliasId = aliasAddrs[aliasIndex].aliasId
                }
              }
            }

            if (!isAlias) {
              folderId = 1
            } else {
              folderId = 5
            }

            break
          case 'Sent':
            folderId = 3 // Save message to Sent
            break
          case 'Draft':
            folderId = 2 // Save message to Drafts
            break
          default:
            folderId = 1
        }

        const msgObj = {
          emailId: msg.email.emailId || msg._id,
          unread: folderId === 3 || folderId === 2 ? 0 : 1,
          folderId,
          aliasId,
          fromJSON: JSON.stringify(msg.email.from),
          toJSON: JSON.stringify(msg.email.to),
          subject: msg.email.subject ? msg.email.subject : '(no subject)',
          date: msg.email.date,
          bccJSON: JSON.stringify(msg.email.bcc),
          ccJSON: JSON.stringify(msg.email.cc),
          bodyAsText: msg.email.bodyAsText || msg.email.text_body,
          bodyAsHtml: msg.email.bodyAsHtml || msg.email.html_body,
          attachments: JSON.stringify(attachments),
          encKey: msg.email.encKey,
          encHeader: msg.email.encHeader,
          path: msg.email.path,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }

        if (msg.email.emailId && type !== 'incoming') {
          asyncMsgs.push(
            Email.update({ emailId: msg.email.emailId }, msgObj)
          )
        } else {
          asyncMsgs.push(
            new Promise((resolve, reject) => {
              // Save email to drive

              FileUtil
                .saveEmailToDrive({ email: msgObj, drive })
                .then((file: FileSchema) => {
                  const _email = {
                    ...msgObj,
                    encKey: file.key,
                    encHeader: file.header,
                    path: file.path,
                    size: file.size
                  }

                  Email.insert(_email)
                    .then((eml: EmailSchema) => {
                      resolve(eml);
                    })
                    .catch((err: any) => {
                      reject(err);
                    })
                })
                .catch((e: any) => {
                  reject(e);
                })
            })
          )
        }
      }

      Promise.all(asyncMsgs)
        .then(async items => {
          const msgArr: EmailSchema[] = []

          await Promise.all(asyncFolders)

          items.forEach(item => {
            if (item && item.dataValues && item.bodyAsText) {
              const msg = { ...item.dataValues }

              msg.id = msg.emailId
              msg.unread = msg.unread ? 1 : 0
              msgArr.push(msg)
            }
          })

          return channel.send({
            event: 'mailbox:saveMessageToDB:success',
            data: {
              msgArr,
              newAliases
            }
          })
        })
        .catch(e => {
          channel.send({
            event: 'mailbox:saveMessageToDB:error',
            error: {
              name: e.name,
              message: e.message,
              stacktrace: e.stack
            }
          })
          throw e
        })
    } catch(e: any) {
      channel.send({
        event: 'mailbox:saveMessageToDB:error',
        error: {
          name: e.name,
          message: e.message,
          stacktrace: e.stack
        }
      })
    }
  }


  /*************************************************
   *  REMOVE EMAILS
   ************************************************/
  if (event === 'mailbox:removeMessages') {
    try {
      const drive = store.getDrive()

      const emailModel = new EmailModel(store)
      const fileModel = new FileModel(store)
      
      const Email = await emailModel.ready()
      const File = await fileModel.ready()

      const msgArr: EmailSchema[] = await Email.find({ emailId: { $in: payload.messageIds }})

      // TODO:
      // Email.deleteMany

      msgArr.forEach(async (msg: EmailSchema) => {
        drive.unlink(msg.path)
        const files: FileSchema[] = await File.find({ emailId: msg.emailId })

        // TODO:
        // File.deleteMany()

        files.forEach(async (file: FileSchema) => {
          drive.unlink(file.path)
        })
      })

      channel.send({ event: 'mailbox:removeMessages:success', data: null })
    } catch(e: any) {
      channel.send({
        event: 'mailbox:removeMessages:error',
        error: {
          name: e.name,
          message: e.message,
          stacktrace: e.stack
        }
      })
    }
  }


  /*************************************************
   *  MOVE EMAILS
   ************************************************/
  if (event === 'mailbox:moveMessages') {
    const { messages } = payload

    try {
      const emailModel = new EmailModel(store)
      const Email = await emailModel.ready()

      const toFolder = messages[0].folder.toId

      for (const email of messages) {
        await Email.update(
          { 
            emailId: email.id 
          }, 
          { 
            folderId: toFolder,
            unread: email.unread
          }, 
          { 
            multi: true 
          }
        )
      }
      channel.send({ event: 'mailbox:moveMessages:success', data: null });
    } catch(e: any) {
      channel.send({
        event: 'mailbox:moveMessages:error',
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
    const address = payload

    try {
      const folderModel = new FolderModel(store)
      const mailboxModel = new MailboxModel(store)
      
      const Mailbox = await mailboxModel.ready()
      const Folder = await folderModel.ready()

      const mailbox: MailboxSchema = await Mailbox.insert({ address })

      for (const folder of DefaultFolders) {
        let _folder: any = { ...folder }
        _folder.mailboxId = mailbox.mailboxId;
        await Folder.create(_folder)
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


  /*************************************************
   *  SAVE FILES
   ************************************************/
  if (event === 'mailbox:saveFiles') {
    try {
      const drive = store.getDrive()

      const { filepath, attachments } = payload


      const fileModel = new FileModel(store)
      const File = await fileModel.ready()

      if (filepath === undefined) return 'canceled'

      await Promise.all(
        attachments.map(async (attachment: any)  => {
          const writeStream = fs.createWriteStream(filepath)

          // TODO: This may not work...
          let file: FileSchema = await File.find({ _id: attachment._id })

          if (!file) {
            file = attachment
          }

          await FileUtil.saveFileFromEncryptedStream(writeStream, {
            drive,
            key: file.key,
            hash: file.hash,
            header: file.header,
            discoveryKey: file.discoveryKey,
            filename: file.filename
          })
        })
      )
      channel.send({ event: 'mailbox:saveFiles:success', data: 'success' })
    } catch(e: any) {
      channel.send({
        event: 'mailbox:saveFiles:error',
        error: {
          name: e.name,
          message: e.message,
          stacktrace: e.stack
        }
      })
    }
  }


  /*************************************************
   *  SEARCH MAILBOX
   ************************************************/
  if (event === 'mailbox:searchMailbox' ) {
    const { searchQuery } = payload

    try {
      if (searchQuery) {
        const emailModel = new EmailModel(store)
        const Email = await emailModel.ready()

        // if (searchQuery.indexOf('from: ') > -1) {
          // return Email.findAll({
          //   attributes: [
          //     ['emailId', 'id'],
          //     'folderId',
          //     'date',
          //     'aliasId',
          //     'subject',
          //     'bodyAsText',
          //     'fromJSON',
          //     'toJSON',
          //     'ccJSON',
          //     'attachments'
          //   ],
          //   where: {
          //     [Op.or]: [{ fromJSON: { [Op.like]: `%${searchQuery}%` } }]
          //   },
          //   raw: true
          // });
        // }

        // if (searchQuery.indexOf('to: ') > -1) {
          // return Email.findAll({
          //   attributes: [
          //     ['emailId', 'id'],
          //     'subject',
          //     'aliasId',
          //     'folderId',
          //     'date',
          //     'bodyAsText',
          //     'fromJSON',
          //     'toJSON',
          //     'ccJSON',
          //     'attachments'
          //   ],
          //   where: {
          //     toJSON: { [Op.like]: `%${searchQuery}%` }
          //   },
          //   raw: true
          // });
        // }

        // const results = await Email.findAll({
        //   attributes: [
        //     ['emailId', 'id'],
        //     'subject',
        //     'aliasId',
        //     'folderId',
        //     'date',
        //     'bodyAsText',
        //     'fromJSON',
        //     'toJSON',
        //     'ccJSON',
        //     'attachments'
        //   ],
        //   where: {
        //     [Op.or]: [
        //       { subject: { [Op.like]: `%${searchQuery}%` } },
        //       { bodyAsText: { [Op.like]: `%${searchQuery}%` } },
        //       { fromJSON: { [Op.like]: `%${searchQuery}%` } },
        //       { toJSON: { [Op.like]: `%${searchQuery}%` } },
        //       { ccJSON: { [Op.like]: `%${searchQuery}%` } },
        //       { attachments: { [Op.like]: `%${searchQuery}%` } }
        //     ]
        //   },
        //   raw: true
        // });

        const results: EmailSchema[] = await Email.search(searchQuery)

        channel.send({
          event: 'mailbox:searchMailbox:success',
          data: results
        });
      }
    } catch(e: any) {
      channel.send({
        event: 'mailbox:searchMailbox:error',
        error: {
          name: e.name,
          message: e.message,
          stacktrace: e.stack
        }
      })
    }
  }


  /*************************************************
   *  CREATE FOLDER
   ************************************************/
  if (event === 'mailbox:createFolder') {
    try {
      const folderModel = new FolderModel(store)
      const Folder = await folderModel.ready()

      let folderId: number = 0
      const cursor = Folder.find()

      try {
        folderId = await cursor.count()
        folderId = folderId += 1
      } catch(e:any) {
        console.log(e)
      }

      const folder: FolderSchema = await Folder.insert({
        folderId: payload.folderId || folderId,
        mailboxId: payload.mailboxId,
        name: payload.name,
        type: payload.type,
        icon: payload.icon,
        color: payload.color,
        seq: payload.seq
      })

      folder.id = folder.folderId
      channel.send({ event: 'mailbox:createFolder:success', data: folder })
    } catch(e: any) {
      channel.send({
        event: 'mailbox:createFolder:error',
        error: {
          name: e.name,
          message: e.message,
          stacktrace: e.stack
        }
      })
    }
  }


  /*************************************************
   *  UPDATE FOLDER
   ************************************************/
  if (event === 'mailbox:updateFolder') {
    try {
      const folderModel = new FolderModel(store)
      const Folder = await folderModel.ready()

      await Folder.update({ folderId: payload.folderId }, { name: payload.name })

      channel.send({ event: 'updateFolder', data: payload })
    } catch(e: any) {
      channel.send({
        event: 'mailbox:updateFolder:error',
        error: {
          name: e.name,
          message: e.message,
          stacktrace: e.stack
        }
      })
    }
  }


  /*************************************************
   *  UPDATE FOLDER COUNT
   ************************************************/
  if (event === 'mailbox:updateFolderCount') {
    const { id, amount } = payload

    try {
      const folderModel = new FolderModel(store)
      const Folder = await folderModel.ready()

      if (amount > 0) {
        await Folder.update({ folderId: id }, { $inc: { count: amount } })
      } else {
        await Folder.update({ folderId: id }, { $inc: { count: Math.abs(amount) } })
      }

      channel.send({ event: 'mailbox:updateFolderCount:success', updated: true })
    } catch(e: any) {
      channel.send({
        event: 'mailbox:updateFolderCount:error',
        error: {
          name: e.name,
          message: e.message,
          stacktrace: e.stack
        }
      })
    }
  }


  /*************************************************
   *  UPDATE ALIAS COUNT
   ************************************************/
  if (event === 'mailbox:updateAliasCount') {
    const { id, amount } = payload

    try {
      const aliasModel = new AliasModel(store)
      const Alias = await aliasModel.ready()

      if (amount > 0) {
        await Alias.update({ aliasId: id }, { $inc: { count: amount } })
      } else {
        await Alias.update({ aliasId: id }, { $inc: { count: Math.abs(amount) } })
      }

      channel.send({ event: 'mailbox:updateFolderCount:success', updated: true })
    } catch(e: any) {
      channel.send({
        event: 'mailbox:updateAliasCount:error',
        error: {
          name: e.name,
          message: e.message,
          stacktrace: e.stack
        }
      })
    }
  }


  /*************************************************
   *  DELETE FOLDERS
   ************************************************/
  // if (event === 'mailbox:deleteFolder') {
  //   try {
  //     const folderModel = new FolderModel(store)
  //     const Folder = await folderModel.ready()

  //     await Folder.destroy({
  //       where: {
  //         folderId: payload.folderId
  //       },
  //       individualHooks: true
  //     });

  //     await Email.destroy({
  //       where: { folderId: payload.folderId },
  //       individualHooks: true
  //     });

  //     channel.send({ event: 'deleteFolder', data: {} });

  //   } catch(e: any) {
  //     channel.send({
  //       event: 'mailbox:deleteFolder:error',
  //       error: {
  //         name: e.name,
  //         message: e.message,
  //         stacktrace: e.stack
  //       }
  //     })
  //   }
  // }
}