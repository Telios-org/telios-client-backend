import { FolderModel } from '../models/folder.model'

import { FolderOpts } from '../types'
import { FolderSchema } from '../schemas'

export default async (props: FolderOpts) => {
  const { channel, userDataPath, msg, store } = props 
  const { event, payload } = msg

  /*************************************************
   *  GET MAILBOX FOLDERS
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