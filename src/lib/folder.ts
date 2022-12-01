import { FolderOpts } from '../types'
import { FolderSchema } from '../schemas'
import { UTCtimestamp } from '../util/date.util'

export default async (props: FolderOpts) => {
  const { channel, msg, store } = props 
  const { event, payload } = msg

  /*************************************************
   *  GET MAILBOX FOLDERS
   ************************************************/
  if (event === 'folder:getMailboxFolders') {
    try {
      const Folder = store.models.Folder.collection
      
      const folders: FolderSchema[] = await Folder.find({ mailboxId: payload.id }).sort('seq', 1)

      // const promises = folders.map(async f => {
      //   const Email = store.models.Email

      //    // Making sure the folder count is accurate
      //   const { count } = await Folder.findOne({ folderId: f.folderId })

      //   const emails = await Email.find({ unread: true, folderId: f.folderId})
        
      //   const newCount = emails.length;

      //   if(count !== newCount){
      //     await Folder.update({ folderId: f.folderId }, { count: newCount })
      //   }
        
      //   return {
      //     ...f,
      //     count: newCount
      //   }
      // })

      for(const folder of folders) {
        if(!folder.count) folder.count = 0
        store.setFolderCount(folder.folderId, folder.count)
      }

      channel.send({
        event: 'folder:getMailboxFolders:callback',
        data: folders
      });
    } catch(err: any) {
      channel.send({
        event: 'folder:getMailboxFolders:callback',
        error: {
          name: err.name,
          message: err.message,
          stacktrace: err.stack
        }
      })
    }
  }



  /*************************************************
   *  CREATE FOLDER
   ************************************************/
  if (event === 'folder:createFolder') {
    try {
      const Folder = store.models.Folder.collection

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
        type: payload.type || null,
        icon: payload.icon || null,
        color: payload.color || null,
        seq: payload.seq,
        createdAt: payload.createdAt || UTCtimestamp(),
        updatedAt: payload.updatedAt || UTCtimestamp()
      })

      // folder.id = folder.folderId
      channel.send({ event: 'folder:createFolder:callback', data: folder })
    } catch(err: any) {
      channel.send({
        event: 'folder:createFolder:callback',
        error: {
          name: err.name,
          message: err.message,
          stacktrace: err.stack
        }
      })
    }
  }


  /*************************************************
   *  UPDATE FOLDER
   ************************************************/
  if (event === 'folder:updateFolder') {
    try {
      const Folder = store.models.Folder

      const data = await Folder.update({ folderId: payload.folderId }, { name: payload.name })

      channel.send({ event: 'folder:updateFolder:callback', data })
    } catch(err: any) {
      channel.send({
        event: 'folder:updateFolder:callback',
        error: {
          name: err.name,
          message: err.message,
          stacktrace: err.stack
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
      const Folder = store.models.Folder

      // await Folder.update({ folderId: id }, { count: currCount + amount } )

      channel.send({ event: 'folder:updateFolderCount:callback', updated: true })
    } catch(err: any) {
      channel.send({
        event: 'folder:updateFolderCount:callback',
        error: {
          name: err.name,
          message: err.message,
          stacktrace: err.stack
        }
      })
    }
  }

  /*************************************************
   *  DELETE FOLDERS
   ************************************************/
  if (event === 'folder:deleteFolder') {
    try {
      const Folder = store.models.Folder

      const doc = await Folder.remove({ folderId: 6 })

      channel.send({ event: 'folder:deleteFolder:callback', data: doc });

    } catch(err: any) {
      channel.send({
        event: 'folder:deleteFolder:callback',
        error: {
          name: err.name,
          message: err.message,
          stacktrace: err.stack
        }
      })
    }
  }
}