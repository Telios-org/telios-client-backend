const { v4: uuidv4 } = require('uuid')
const fs = require('fs')
const path = require('path')

import * as FileUtil from '../util/file.util'
import { UTCtimestamp } from '../util/date.util'
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
  const ipfs = store.sdk.ipfs

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

      //Is the email going somewhere off network?
      const recipients = [...email.to, ...email.cc, ...email.bcc];
      const isOffWorlding = recipients.some((r) => !r.account_key)

      // 1. Save individual attachments to local disk
      if(attachments?.length) {
        for(let attachment of attachments) {
          await new Promise((resolve, reject) => {
            try {

              totalAttachmentSize += attachment.size;
              let filename = attachment.filename || attachment.name

              if(attachment.content !== null && !attachment.path){
                  FileUtil.saveFileToDrive(File, { file: attachment, content: attachment.content, drive, ipfs }).then((file) => {
                      _attachments.push({
                          _id: file._id,
                          filename,
                          content: file.content,
                          contentType: file.contentType,
                          size: file.size,
                          discoveryKey: file.discovery_key,
                          cid: file.cid,
                          hash: file.hash,
                          path: file.path,
                          header: file.header,
                          key: file.key
                      });
                      resolve(file);
                  }).catch((err) => {
                      reject(err);
                  });
              }else if(isOffWorlding){
                  //If we send the message outside the network we need to send the base64 content
                  FileUtil.readFile(attachment.path as string, { drive, type: 'attachment', cid: attachment.cid } ).then((content: string) => {
                      _attachments.push({
                          ...attachment,
                          content
                      });
                      resolve(content);
                  }).catch((err) => {
                      reject(err);
                  });
              }else{
                  //If we stay within network all the information necessary is already available
                  _attachments.push({
                      ...attachment
                  });
                  resolve(attachment)
              }
              
          }
          catch (e) {
              reject(e);
          }
          })
        }
  
        email.attachments = _attachments
      }

      // Remove BCC list from email that wil be retrieved
      const bcc = email.bcc
      email.bcc = []

      const file = await FileUtil.saveEmailToDrive({ email, drive, ipfs })

      // Add it back after local email is saved
      email.bcc = bcc

      const meta = {
        cid: file.cid,
        key: file.key,
        header: file.header,
        path: file.path,
        size: file.size
      }

      // 2. send then save email file on drive
      await Mailbox.send({ ...email, ...meta}, {
        owner: email.from[0].address,
        keypairs: {
          secretBoxKeypair: {
            publicKey: account.secretBoxPubKey,
            privateKey: account.secretBoxPrivKey
          },
          signingKeypair: {
            publicKey: account.deviceInfo?.keyPair?.publicKey,
            privateKey: account.deviceInfo?.keyPair?.secretKey
          }
        }
      })

      // 3. Save email in DB
      let _email = {
        ...meta,
        aliasId: null,
        emailId: uuidv4(),
        folderId: 3, // Sent folder
        subject: email.subject ? email.subject : '(no subject)',
        fromJSON: JSON.stringify(email.from),
        toJSON: JSON.stringify(email.to),
        ccJSON: JSON.stringify(email.cc),
        bccJSON: JSON.stringify(email.bcc),
        bodyAsText: removeMd(email.bodyAsText),
        bodyAsHtml: email.bodyAsHtml ? email.bodyAsHtml : `<div>${removeMd(email.bodyAsText)}</div>`,
        attachments: JSON.stringify(email.attachments),
        date: email.date || UTCtimestamp(),
        createdAt: email.createdAt || UTCtimestamp(),
        updatedAt: email.updatedAt || UTCtimestamp()
      }

      const doc = await Email.insert(_email)

      channel.send({ event: 'email:sendEmail:callback', data: doc, meta: { isOffWorlding } })
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
          for(let file of msg.email.attachments) {
            const fileId = file.fileId || uuidv4()
            let filename = file.filename || file.name || 'unnamed'
            if(file.contentType === "text/x-amp-html"){
              filename="x-amp-html.html"
            }

            file = await FileUtil.saveFileToDrive(File, {
              drive,
              ipfs,
              content: file.content,
              file: {
                _id: new ObjectID(),
                id: fileId,
                cid: file.cid,
                emailId: msg.email.emailId || msg._id,
                filename,
                contentType: file.contentType,
                size: file.size,
                discoveryKey: file.discoveryKey || drive.discoveryKey,
                hash: file.hash,
                header: file.header,
                key: file.key
              }
            })

            if(file.discovery_key) delete file.discovery_key

            attachments.push(file)

            // TODO: We might want to add some additional logic to not automatically download attachments over a certain size.
            // if (file.content) {
              // asyncMsgs.push(
              //   FileUtil.saveFileToDrive(File, {
              //     drive,
              //     ipfs,
              //     content: file.content,
              //     file: fileObj
              //   })
              // )
            // }
          // })
          }
        }

        let isAlias = false

        switch (type) {
          case 'Incoming':
            const recipients = [...msg.email.to, ...msg.email.cc, ...msg.email.bcc]
            
            // Assign email into appropriate folder/alias
            for await (const recipient of recipients) {
              const localPart = recipient.address.split('@')[0]

              try {
                const alias: AliasSchema = await Alias.findOne({ name: localPart })

                // Recipient is an alias.
                if(alias) {
                  isAlias = true
                  aliasId = localPart
                }
              } catch(err: any) {
                // not found
              }

              // Recipient is an alias. Check if we need to create a new on-the-fly alias
              if (recipient.address.indexOf('#') > -1) {
                folderId = 0
                isAlias = true
                
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
                    createdAt: UTCtimestamp(),
                    updatedAt: UTCtimestamp()
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
          bodyAsText: removeMd(msg.email.bodyAsText || msg.email.text_body),
          attachments: JSON.stringify(attachments),
          path: msg.email.path,
          createdAt: UTCtimestamp(),
          updatedAt: UTCtimestamp()
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
                .saveEmailToDrive({ email: msgObj, drive, ipfs })
                .then((file: FileSchema) => {
                  delete msgObj.bodyAsHtml

                  const _email = {
                    ...msgObj,
                    path: file.path,
                    size: file.size,
                    cid: file.cid,
                    key: file.key,
                    header: file.header
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

          for(const item of items) {
            if (item) {
              const msg = { ...item }

              msg.unread = msg.unread ? true : false
              msgArr.push(msg)
            }
          }

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

      let messages: EmailSchema[]

      if(payload.unread) {
        messages = await Email.find({ folderId: payload.id, unread: payload.unread }).sort('date', -1).skip(payload.offset).limit(payload.limit)
      } else {
        messages = await Email.find({ folderId: payload.id }).sort('date', -1).skip(payload.offset).limit(payload.limit)
      }

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
   *  GET UNREAD EMAILS BY FOLDER ID
   ************************************************/
  if (event === 'email:getUnreadMessagesByFolderId') {
    try {
      const Email = store.models.Email.collection

      let messages: EmailSchema[]

      messages = await Email.find({ folderId: payload.id, unread: true }).sort('date', -1).skip(payload.offset).limit(payload.limit)

      channel.send({
        event: 'email:getUnreadMessagesByFolderId:callback',
        data: messages
      })
    } catch(err: any) {
      channel.send({
        event: 'email:getUnreadMessagesByFolderId:callback',
        error: {
          name: err.name,
          message: err.message,
          stacktrace: err.stack
        }
      })
    }
  }


  /*************************************************
   *  GET READ EMAILS BY FOLDER ID
   ************************************************/
   if (event === 'email:getReadMessagesByFolderId') {
    try {
      const Email = store.models.Email.collection

      let messages: EmailSchema[]

      messages = await Email.find({ folderId: payload.id, unread: false }).sort('date', -1).skip(payload.offset).limit(payload.limit)

      channel.send({
        event: 'email:getReadMessagesByFolderId:callback',
        data: messages
      })
    } catch(err: any) {
      channel.send({
        event: 'email:getReadMessagesByFolderId:callback',
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

      let messages: EmailSchema[]

      if(payload.unread) {
        messages = await Email.find({ aliasId: payload.id, folderId: 5, unread: payload.unread }).sort('date', -1).skip(payload.offset).limit(payload.limit)
      } else {
        messages = await Email.find({ aliasId: payload.id, folderId: 5 }).sort('date', -1).skip(payload.offset).limit(payload.limit)
      }
      
      messages = messages.map((email: any) => {
        if(email.bodyAsHtml) {
          delete email.bodyAsHtml
        }

        if(email.bodyAsText) {
          email.bodyAsText = email.bodyAsText.split(" ").slice(0, 20).join(" ")
        }

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
   *  GET UNREAD MESSAGES BY ALIAS ID
   ************************************************/
   if (event === 'email:getUnreadMessagesByAliasId') {
    try {
      const Email = store.models.Email.collection

      let messages: EmailSchema[]

      messages = await Email.find({ aliasId: payload.id, folderId: 5, unread: true }).sort('date', -1).skip(payload.offset).limit(payload.limit)

      messages = messages.map((email: any) => {
        if(email.bodyAsHtml) {
          delete email.bodyAsHtml
        }

        if(email.bodyAsText) {
          email.bodyAsText = email.bodyAsText.split(" ").slice(0, 20).join(" ")
        }

        return email
      })

      channel.send({
        event: 'email:getUnreadMessagesByAliasId:callback',
        data: messages
      })
    } catch(err: any) {
      channel.send({
        event: 'email:getUnreadMessagesByAliasId:callback',
        error: {
          name: err.name,
          message: err.message,
          stacktrace: err.stack
        }
      })
    }
  }



  /*************************************************
   *  GET UNREAD MESSAGES BY ALIAS ID
   ************************************************/
   if (event === 'email:getReadMessagesByAliasId') {
    try {
      const Email = store.models.Email.collection

      let messages: EmailSchema[]

      messages = await Email.find({ aliasId: payload.id, folderId: 5, unread: false }).sort('date', -1).skip(payload.offset).limit(payload.limit)
      
      messages = messages.map((email: any) => {
        if(email.bodyAsHtml) {
          delete email.bodyAsHtml
        }

        if(email.bodyAsText) {
          email.bodyAsText = email.bodyAsText.split(" ").slice(0, 20).join(" ")
        }

        return email
      })

      channel.send({
        event: 'email:getReadMessagesByAliasId:callback',
        data: messages
      })
    } catch(err: any) {
      channel.send({
        event: 'email:getReadMessagesByAliasId:callback',
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
      const File = store.models.File;

      const eml: EmailSchema = await Email.findOne({ emailId: payload.id })

      let email: any = await FileUtil.readFile(eml.path, { drive, type: 'email', cid: eml.cid })

      email = JSON.parse(email)

      if(!email.bodyAsHtml) {
        email.bodyAsHtml = `<div>${removeMd(email.bodyAsText)}</div>`
      }

      if(typeof email.attachments === 'string') {
        email.attachments = JSON.parse(email.attachments)
      }

      if(typeof eml.bccJSON === 'string'){
        email.bcc = JSON.parse(eml.bccJSON)//bcc gets stripped unpon send so we need to restore from collection
      }
       
      for(let i = 0; i < email.attachments.length; i += 1) {
        const _file = email.attachments[i]
        if(!_file.hash && !_file.key && !_file.header) {
          const attachment = await File.findOne({ path: _file.path })
          _file.hash = attachment.hash
          _file.header = attachment.header
          _file.key = attachment.key
        }
    }
      
      email.unread = eml.unread
      email.cid = eml.cid
      email.key = eml.key
      email.header = eml.header
      email.folderId = eml.folderId

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
        
        // Remove email from SIA/IPFS storage
        if(msg.cid) {
          await ipfs.delete(msg.cid);
        }

        await Email.remove({ emailId: msg.emailId })
        
        drive.unlink(msg.path)

        const files: FileSchema[] = await File.find({ emailId: msg.emailId })

        for(const file of files) {
          await File.remove({ fileId: file.fileId})
          drive.unlink(file.path)

          // Remove attachment from SIA/IPFS storage
          if(file.cid) {
            await ipfs.delete(file.cid)
          }
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
              ipfs,
              cid: file.cid,
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