const { v4: uuidv4 } = require('uuid')
const fs = require('fs')

import { EmailModel } from '../models/email.model'
import { AliasModel } from '../models/alias.model'
import { AliasNamespaceModel } from '../models/aliasNamespace.model'
import { FileModel } from '../models/file.model'

import * as FileUtil from '../util/file.util'

import { EmailOpts, Attachment } from '../types'
import { 
  AccountSchema, 
  AliasSchema, 
  AliasNamespaceSchema, 
  FolderSchema, 
  EmailSchema,
  FileSchema } from '../schemas'

const removeMd = require('remove-markdown')

const BSON = require('bson')
const { ObjectID } = BSON

export default async (props: EmailOpts) => {
  const { channel, msg, store } = props 
  const { event, payload } = msg

  const Mailbox = store.sdk.mailbox

  /*************************************************
   *  SEND EMAIL
   ************************************************/
  if (event === 'email:sendEmail') {
    try {
      let { email } = payload
      const account: AccountSchema = store.getAccount()
      const drive = store.getDrive()
      const emailFilename = uuidv4()
      const emailDest = `/email/${emailFilename}.json`

      const Email = new EmailModel(store)
      await Email.ready()

      const fileModel = new FileModel(store)
      const File = await fileModel.ready()
      
      let _attachments: Attachment[] = []
      let attachments: Attachment[] = email?.attachments
      let totalAttachmentSize = 0

      // 1. Save individual attachments to local disk
      if(attachments?.length) {
        for(let attachment of attachments) {
          await new Promise((resolve, reject) => {
            try {
              totalAttachmentSize += attachment.size

              // Don't send file data if size is over 25mb
              if(totalAttachmentSize > 25600000) {
                FileUtil.saveFileToDrive(File, { file: attachment, content: attachment.content, drive }).then((file: FileSchema) => {
                  _attachments.push({
                    _id: file._id,
                    filename: attachment.filename,
                    contentType: file.contentType,
                    size: file.size,
                    discoveryKey: file.discovery_key,
                    hash: file.hash,
                    path: file.path,
                    header: file.header,
                    key: file.key
                  })
  
                  resolve(file)
                }).catch((e: any) => {
                  reject(e)
                })
              } else {
                _attachments.push(attachment)
                resolve(attachment)
              }
              
            } catch(e) {
              reject(e)
            }
          })
        }
  
        email.attachments = _attachments
      }

      // 2. send then save email file on drive
      let res = await Mailbox.send(email, {
        owner: email.from[0].address,
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

      // 3. Save email in DB
      let _email = {
        ...email,
        aliasId: null,
        emailId: uuidv4(),
        path: res.path,
        folderId: 3, // Sent folder
        subject: email.subject ? email.subject : '(no subject)',
        fromJSON: JSON.stringify(email.from),
        toJSON: JSON.stringify(email.to),
        ccJSON: JSON.stringify(email.cc),
        bccJSON: JSON.stringify(email.bcc),
        bodyAsText: removeMd(email.bodyAsText),
        bodyAsHtml: email.bodyAsHtml,
        attachments: JSON.stringify(email.attachments),
        date: email.date || new Date().toISOString(),
        createdAt: email.createdAt || new Date().toISOString(),
        updatedAt: email.updatedAt || new Date().toISOString()
      }

      const doc = await Email.insert(_email)

      channel.send({ event: 'email:sendEmail:success', data: doc })
    } catch(e: any) {
      channel.send({
        event: 'email:sendEmail:error',
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
  if (event === 'email:saveMessageToDB') {
    try {
      const drive = store.getDrive()
      
      const Email = new EmailModel(store)
      const aliasNamespaceModel = new AliasNamespaceModel(store)
      const aliasModel = new AliasModel(store)
      const fileModel = new FileModel(store)
      
      await Email.ready()
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
              _id: new ObjectID(),
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
            if (item && item.bodyAsText) {
              const msg = { ...item }

              msg.id = msg.emailId
              msg.unread = msg.unread ? 1 : 0
              msgArr.push(msg)
            }
          })

          return channel.send({
            event: 'email:saveMessageToDB:success',
            data: {
              msgArr,
              newAliases
            }
          })
        })
        .catch(e => {
          channel.send({
            event: 'email:saveMessageToDB:error',
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
        event: 'email:saveMessageToDB:error',
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
  if (event === 'email:getMessagesByFolderId') {
    try {
      const emailModel = new EmailModel(store)
      const Email = await emailModel.ready()

      const messages: EmailSchema[] = await Email.find({ folderId: payload.id }).sort('date', -1)

      channel.send({
        event: 'email:getMessagesByFolderId:success',
        data: messages
      })
    } catch(e: any) {
      channel.send({
        event: 'email:getMessagesByFolderId:error',
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
  if (event === 'email:getMessagesByAliasId') {
    try {
      const emailModel = new EmailModel(store)
      const Email = await emailModel.ready()

      const messages: EmailSchema[] = await Email.find({ aliasId: payload.id, folderId: 5})
        .sort('date', -1)
        .skip(payload.offset)
        .limit(payload.limit)

      channel.send({
        event: 'email:getMessagesByAliasId:success',
        data: messages
      })
    } catch(e: any) {
      channel.send({
        event: 'email:getMessagesByAliasId:error',
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
  if (event === 'email:getMessageById') {
    try {
      const Email = new EmailModel(store)
      await Email.ready()

      const email: EmailSchema = await Email.findOne({ emailId: payload.id })
        
        email.attachments = JSON.parse(email.attachments)

        if (email.unread) {
          await Email.update({ emailId: email.emailId }, { unread: 0 })

          email.unread = 0
        }

        channel.send({ event: 'email:getMessageById:success', data: { id: email.emailId, ...email } })
    } catch(e: any) {
      channel.send({
        event: 'email:getMessageById:error',
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
  if (event === 'email:markAsUnread') {
    try {
      const { id } = payload;

      const Email = new EmailModel(store)
      await Email.ready()

      await Email.update({ emailId: id }, { unread: 1 })

      channel.send({ event: 'email:markAsUnread:success', data: null })
    } catch(e: any) {
      channel.send({
        event: 'email:markAsUnread:error',
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
  if (event === 'email:removeMessages') {
    try {
      const drive = store.getDrive()

      const Email = new EmailModel(store)
      const fileModel = new FileModel(store)
      
      await Email.ready()
      const File = await fileModel.ready()

      const msgArr: EmailSchema[] = await Email.find({ emailId: { $in: payload.messageIds }})

      for(const msg of msgArr) {
        await Email.remove({ emailId: msg.emailId })
        
        drive.unlink(msg.path)

        const files: FileSchema[] = await File.find({ emailId: msg.emailId })

        for(const file of files) {
          await File.remove({ fileId: file.fileId})
          drive.unlink(file.path)          
        }
      }

      channel.send({ event: 'email:removeMessages:success', data: null })
    } catch(e: any) {
      channel.send({
        event: 'email:removeMessages:error',
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
  if (event === 'email:moveMessages') {
    const { messages } = payload

    try {
      const Email = new EmailModel(store)
      await Email.ready()

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
      channel.send({ event: 'email:moveMessages:success', data: null });
    } catch(e: any) {
      channel.send({
        event: 'email:moveMessages:error',
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
  if (event === 'email:saveFiles') {
    try {
      const drive = store.getDrive()

      const { filepath, attachments } = payload

      const fileModel = new FileModel(store)
      const File = await fileModel.ready()

      if (filepath === undefined) return 'canceled'

      await Promise.all(
        attachments.map(async (attachment: any)  => {
          if(attachment.content) {
            fs.writeFileSync(filepath, Buffer.from(attachment.content, 'base64'))
          }

          if(attachment._id) {
            const writeStream = fs.createWriteStream(filepath)

            let file: FileSchema = await File.findOne({ path: attachment.path })

            channel.send({ event: 'debug:file', data: file })

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
          }
        })
      )
      channel.send({ event: 'email:saveFiles:success', data: 'success' })
    } catch(e: any) {
      channel.send({
        event: 'email:saveFiles:error',
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
  if (event === 'email:searchMailbox' ) {
    const { searchQuery } = payload

    try {
      if (searchQuery) {
        const emailModel = new EmailModel(store)
        const Email = await emailModel.ready()

        const results: EmailSchema[] = await Email.search(searchQuery)

        channel.send({
          event: 'email:searchMailbox:success',
          data: results
        });
      }
    } catch(e: any) {
      channel.send({
        event: 'email:searchMailbox:error',
        error: {
          name: e.name,
          message: e.message,
          stacktrace: e.stack
        }
      })
    }
  }


  /*************************************************
   *  DEPRECATED - SAVE SENT EMAIL TO DATABASE
   ************************************************/
  // if (event === 'email:saveSentMessageToDB') {
  //   try {
  //     const emailModel = new EmailModel(store)
  //     const Email = await emailModel.ready()

  //     const drive = store.getDrive()

  //     const { messages } = payload
  //     const msg = messages[0]

  //     let email = {
  //       ...msg,
  //       emailId: uuidv4(),
  //       path: `/email/${uuidv4()}.json`,
  //       folderId: 3,
  //       subject: msg.subject ? msg.subject : '(no subject)',
  //       fromJSON: JSON.stringify(msg.from),
  //       toJSON: JSON.stringify(msg.to),
  //       ccJSON: JSON.stringify(msg.cc),
  //       bccJSON: JSON.stringify(msg.bcc)
  //     }

  //     if (email.attachments && email.attachments.length) {
  //       email.attachments = email.attachments.map((file: Attachment) => {
  //         const fileId = file.fileId || uuidv4();
  //         return {
  //           id: fileId,
  //           emailId: email.id,
  //           filename: file.name || file.filename,
  //           contentType: file.contentType || file.mimetype,
  //           size: file.size,
  //           discoveryKey: file.discoveryKey,
  //           hash: file.hash,
  //           header: file.header,
  //           key: file.key,
  //           path: file.path
  //         }
  //       })
  //     } else {
  //       email.attachments = []
  //     }

  //     email.attachments = JSON.stringify(email.attachments)

  //     const file : FileSchema = await FileUtil.saveEmailToDrive({ email, drive })

  //     const _f = await FileUtil.readFile(email.path, { drive, type: 'email' })

  //     email = {
  //       ...email,
  //       encKey: file.key,
  //       encHeader: file.header
  //     };

  //     Email.insert(email)

  //     channel.send({ event: 'email:saveSentMessageToDB:success', data: email })
  //   } catch(e: any) {
  //     channel.send({
  //       event: 'email:saveSentMessageToDB:error',
  //       error: {
  //         name: e.name,
  //         message: e.message,
  //         stacktrace: e.stack
  //       }
  //     })
  //   }
  // }
}