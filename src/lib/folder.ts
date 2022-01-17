import { FolderModel } from '../models/folder.model'

import { FolderOpts } from '../types'
import { FolderSchema } from '../schemas'

export default async (props: FolderOpts) => {
  const { channel, userDataPath, msg, store } = props 
  const { event, payload } = msg

  /*************************************************
   *  GET MAILBOX FOLDERS
   ************************************************/
  if (event === 'folder:getMailboxFolders') {
    try {
      const folderModel = new FolderModel(store)
      const Folder = await folderModel.ready()
      
      const folders: FolderSchema[] = await Folder.find({ mailboxId: payload.id }).sort('seq', 1)

      channel.send({
        event: 'folder:getMailboxFolders:success',
        data: folders
      });
    } catch(e: any) {
      channel.send({
        event: 'folder:getMailboxFolders:error',
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
  if (event === 'folder:createFolder') {
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
      channel.send({ event: 'folder:createFolder:success', data: folder })
    } catch(e: any) {
      channel.send({
        event: 'folder:createFolder:error',
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
  if (event === 'folder:updateFolder') {
    try {
      const folderModel = new FolderModel(store)
      const Folder = await folderModel.ready()

      await Folder.update({ folderId: payload.folderId }, { name: payload.name })

      channel.send({ event: 'updateFolder', data: payload })
    } catch(e: any) {
      channel.send({
        event: 'folder:updateFolder:error',
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
  if (event === 'folder:updateFolderCount') {
    const { id, amount } = payload

    try {
      const folderModel = new FolderModel(store)
      const Folder = await folderModel.ready()

      if (amount > 0) {
        await Folder.update({ folderId: id }, { $inc: { count: amount } })
      } else {
        await Folder.update({ folderId: id }, { $inc: { count: Math.abs(amount) } })
      }

      channel.send({ event: 'folder:updateFolderCount:success', updated: true })
    } catch(e: any) {
      channel.send({
        event: 'folder:updateFolderCount:error',
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
  // if (event === 'folder:deleteFolder') {
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
  //       event: 'folder:deleteFolder:error',
  //       error: {
  //         name: e.name,
  //         message: e.message,
  //         stacktrace: e.stack
  //       }
  //     })
  //   }
  // }
}