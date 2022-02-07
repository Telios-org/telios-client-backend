const { v4: uuidv4 } = require('uuid')
const fs = require('fs')
const path = require('path')

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

      const Email = store.models.Email
      const File = store.models.File
      
      let _attachments: Attachment[] = []
      let attachments: Attachment[] = email?.attachments
      let totalAttachmentSize = 0

      // 1. Save individual attachments to local disk
      if(attachments?.length) {
        for(let attachment of attachments) {
          await new Promise((resolve, reject) => {
            try {
              totalAttachmentSize += attachment.size
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
              }).catch((err: any) => {
                reject(err)
              })              
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
        date: email.date || new Date().toUTCString(),
        createdAt: email.createdAt || new Date().toUTCString(),
        updatedAt: email.updatedAt || new Date().toUTCString()
      }

      const doc = await Email.insert(_email)

      channel.send({ event: 'email:sendEmail:callback', data: doc })
    } catch(err: any) {
      channel.send({
        event: 'email:sendEmail:callback',
        error: {
          name: err.name,
          message: err.message,
          stacktrace: err.stack
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
      
      const Email = store.models.Email
      const AliasNamespace = store.models.AliasNamespace
      const Alias = store.models.Alias
      const File = store.models.File

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
                    whitelisted: true,
                    createdAt: new Date().toUTCString(),
                    updatedAt: new Date().toUTCString()
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

        let msgObj: EmailSchema = {
          emailId: msg.email.emailId || msg._id,
          unread: folderId === 3 || folderId === 2 ? false : true,
          folderId,
          aliasId,
          mailboxId: 1,
          fromJSON: JSON.stringify(msg.email.from),
          toJSON: JSON.stringify(msg.email.to),
          subject: msg.email.subject ? msg.email.subject : '(no subject)',
          date: msg.email.date,
          bccJSON: JSON.stringify(msg.email.bcc),
          ccJSON: JSON.stringify(msg.email.cc),
          bodyAsText: msg.email.bodyAsText || msg.email.text_body,
          attachments: JSON.stringify(attachments),
          path: msg.email.path,
          createdAt: new Date().toUTCString(),
          updatedAt: new Date().toUTCString()
        }

        if (msg.email.emailId && type !== 'incoming') {
          asyncMsgs.push(
            Email.update({ emailId: msg.email.emailId }, msgObj)
          )
        } else {
          asyncMsgs.push(
            new Promise((resolve, reject) => {
              // Save email to drive

              // Add bodyAsHtml back to email obj
              msgObj = { ...msgObj, bodyAsHtml: msg.email.bodyAsHtml || msg.email.html_body }

              FileUtil
                .saveEmailToDrive({ email: msgObj, drive })
                .then((file: FileSchema) => {
                  delete msgObj.bodyAsHtml

                  const _email = {
                    ...msgObj,
                    path: file.path,
                    size: file.size
                  }

                  Email.insert(_email)
                    .then((eml: EmailSchema) => {
                      resolve(eml)
                    })
                    .catch((err: any) => {
                      reject(err)
                    })
                })
                .catch((err: any) => {
                  reject(err)
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

              msg.unread = msg.unread ? true : false
              msgArr.push(msg)
            }
          })

          return channel.send({
            event: 'email:saveMessageToDB:callback',
            data: {
              msgArr,
              newAliases
            }
          })
        })
        .catch(e => {
          channel.send({
            event: 'email:saveMessageToDB:callback',
            error: {
              name: e.name,
              message: e.message,
              stacktrace: e.stack
            }
          })
          throw e
        })
    } catch(err: any) {
      channel.send({
        event: 'email:saveMessageToDB:callback',
        error: {
          name: err.name,
          message: err.message,
          stacktrace: err.stack
        }
      })
    }
  }


  /*************************************************
   *  GET EMAILS BY FOLDER ID
   ************************************************/
  if (event === 'email:getMessagesByFolderId') {
    try {
      const Email = store.models.Email.collection

      let messages: EmailSchema[] = await Email.find({ folderId: payload.id }).sort('date', -1).skip(payload.offset).limit(payload.limit)

      messages = messages.map((email: any) => {
        delete email.bodyAsHtml
        return email
      })

      channel.send({
        event: 'email:getMessagesByFolderId:callback',
        data: messages
      })
    } catch(err: any) {
      channel.send({
        event: 'email:getMessagesByFolderId:callback',
        error: {
          name: err.name,
          message: err.message,
          stacktrace: err.stack
        }
      })
    }
  }



  /*************************************************
   *  GET MESSAGES BY ALIAS ID
   ************************************************/
  if (event === 'email:getMessagesByAliasId') {
    try {
      const Email = store.models.Email.collection

      let messages: EmailSchema[] = await Email.find({ aliasId: payload.id, folderId: 5})
        .sort('date', -1)
        .skip(payload.offset)
        .limit(payload.limit)
      
      messages = messages.map((email: any) => {
        delete email.bodyAsHtml
        return email
      })

      channel.send({
        event: 'email:getMessagesByAliasId:callback',
        data: messages
      })
    } catch(err: any) {
      channel.send({
        event: 'email:getMessagesByAliasId:callback',
        error: {
          name: err.name,
          message: err.message,
          stacktrace: err.stack
        }
      })
    }
  }



  /*************************************************
   *  GET EMAIL MESSAGES BY ID
   ************************************************/
  if (event === 'email:getMessageById') {
    try {
      const drive = store.getDrive()

      const Email = store.models.Email

      const eml: EmailSchema = await Email.findOne({ emailId: payload.id })

      let email: any = await FileUtil.readFile(eml.path, { drive, type: 'email'})

      email = JSON.parse(email)
      email.attachments = JSON.parse(email.attachments)

      if (email.unread) {
        await Email.update({ emailId: email.emailId }, { unread: false })
        email.unread = false
      }

      channel.send({ event: 'email:getMessageById:callback', data: { id: email.emailId, ...email } })
    } catch(err: any) {
      channel.send({
        event: 'email:getMessageById:callback',
        error: {
          name: err.name,
          message: err.message,
          stacktrace: err.stack
        }
      })
    }
  }



  /*************************************************
   *  MARK EMAIL AS UNREAD
   ************************************************/
  if (event === 'email:markAsUnread') {
    try {
      const { id } = payload

      const Email = store.models.Email

      await Email.update({ emailId: id }, { unread: true })

      channel.send({ event: 'email:markAsUnread:callback', data: null })
    } catch(err: any) {
      channel.send({
        event: 'email:markAsUnread:callback',
        error: {
          name: err.name,
          message: err.message,
          stacktrace: err.stack
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
      
      const Email = store.models.Email
      const File = store.models.File

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

      channel.send({ event: 'email:removeMessages:callback', data: null })
    } catch(err: any) {
      channel.send({
        event: 'email:removeMessages:callback',
        error: {
          name: err.name,
          message: err.message,
          stacktrace: err.stack
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
      const Email = store.models.Email

      const toFolder = messages[0].folder.toId

      for (const email of messages) {
        await Email.update(
          { 
            emailId: email.emailId 
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
      channel.send({ event: 'email:moveMessages:callback', data: null })
    } catch(err: any) {
      channel.send({
        event: 'email:moveMessages:callback',
        error: {
          name: err.name,
          message: err.message,
          stacktrace: err.stack
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

      const File = store.models.File

      if (filepath === undefined) return 'canceled'

      await Promise.all(
        attachments.map(async (attachment: any)  => {
          let _filepath = filepath.replace(/\\/g, '/').split('/')
          let filename

          if(_filepath[_filepath.length-1].indexOf('.') > -1) {
            filename = _filepath[_filepath.length-1]
            _filepath.pop()
          }

          _filepath = _filepath.join('/')

          fs.mkdirSync(_filepath, { recursive: true })

          if(attachments.length === 1) {
            _filepath = path.join(_filepath, filename)
          } else {
            _filepath = path.join(_filepath, attachment.filename)
          }

          if(attachment.content) {
            fs.writeFileSync(_filepath, Buffer.from(attachment.content, 'base64'))
          }

          if(attachment._id) {
            let file

            const writeStream = fs.createWriteStream(_filepath)

            try {
              file = await File.findOne({ _id: attachment._id })
            } catch(err) {
              // no file found
            }

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
      channel.send({ event: 'email:saveFiles:callback', data: 'success' })
    } catch(err: any) {
      channel.send({
        event: 'email:saveFiles:callback',
        error: {
          name: err.name,
          message: err.message,
          stacktrace: err.stack
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
        const Email = store.models.Email

        let results: EmailSchema[] = await Email.search(searchQuery)

        results = results.map((email: any) => {
          delete email.bodyAsHtml
          return email
        })

        channel.send({
          event: 'email:searchMailbox:callback',
          data: results
        })
      }
    } catch(err: any) {
      channel.send({
        event: 'email:searchMailbox:callback',
        error: {
          name: err.name,
          message: err.message,
          stacktrace: err.stack
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
  //         const fileId = file.fileId || uuidv4()
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
  //     }

  //     Email.insert(email)

  //     channel.send({ event: 'email:saveSentMessageToDB:callback', data: email })
  //   } catch(err: any) {
  //     channel.send({
  //       event: 'email:saveSentMessageToDB:callback',
  //       error: {
  //         name: e.name,
  //         message: e.message,
  //         stacktrace: e.stack
  //       }
  //     })
  //   }
  // }
}