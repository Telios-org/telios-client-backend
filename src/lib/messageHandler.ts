const path = require('path')
const removeMd = require('remove-markdown')

import { MsgHelperMessage } from '../types'
import { 
  AccountSchema, 
  StoreSchema
} from '../schemas'


export default class MesssageHandler {
  private drive: any
  private mailbox: any
  private channel: any
  private store: StoreSchema

  constructor(channel:any, store: StoreSchema) {
    this.drive = null
    this.mailbox = null
    this.channel = channel
    this.store = store
  }

  async initDrive() {
    if (!this.drive) {
      this.drive = this.store.getDrive()
    }

    // If worker is running before drive is ready then call .ready()
    if (!this.drive.discoveryKey) {
      await this.drive.ready()
    }

    this.drive.on('fetch-error', async (e:any) => {
      this.channel.send({
        event: 'messageHandler:fetchError',
        data: {
          message: e.message,
          stack: e.stack
        }
      })
    })
  }

  /**
   * Batches an array of file metadata and makes parallel requests per batch size. This happens when
   * a user needs to sync a large amount of messages. Requesting them synchronously would take a very long time,
   * and fetching all of them at once in parallel could be too large.
   */
  async fetchBatch(files: any[], account?: AccountSchema) {
    this.mailbox = this.store.sdk.mailbox
    const keyPairs: any = this.store.getKeypairs()
    this.drive = this.store.getDrive()

    files = files.map(f => {
      if (account) {
        let publicKey
        let privateKey

        if (account.secretBoxPubKey === f.account_key) {
          publicKey = account.secretBoxPubKey
          privateKey = account.secretBoxPrivKey
        } else {
          publicKey = keyPairs[f.account_key] && keyPairs[f.account_key].publicKey ? keyPairs[f.account_key].publicKey : null
          privateKey = keyPairs[f.account_key] && keyPairs[f.account_key].privateKey ? keyPairs[f.account_key].privateKey : null
        }

        const fileMeta = this.mailbox._decryptMailMeta(
          f,
          privateKey,
          publicKey
        )

        f = { _id: f._id, ...fileMeta }
      }

      return f
    })

    await this.drive.fetchFileBatch(files, (stream: any, file: any) => {
      return new Promise((resolve, reject) => {
        let content = ''

        stream.on('data', (chunk: any) => {
          content += chunk.toString('utf-8')
        })

        stream.on('error', (err: any) => {
          if (!file.failed) {
            file.failed = 1
          } else {
            file.failed += 1
          }

          this.channel.send({
            event: 'messageHandler:fetchError',
            data: {
              file,
              message: err.message,
              stack: err.stack
            }
          })

          resolve(null)
        })

        stream.on('end', () => {
          content = JSON.parse(content)

          this.channel.send({
            event: 'messageHandler:fileFetched',
            data: {
              _id: file._id,
              email: {
                key: file.key,
                header: file.header,
                content
              },
            }
          })

          resolve(null)
        })
      })
    })
  }

  async fetchFile(discoveryKey: string, fileMeta: any) {
    try {
      let keyPair

      while (!keyPair) {
        if(this.drive && this.drive._workerKeyPairs) {
          keyPair = this.drive._workerKeyPairs.getKeyPair()
        }
      }

      const stream = await this.drive.fetchFileByDriveHash(discoveryKey, fileMeta.hash, { key: fileMeta.key, header: fileMeta.header, keyPair })

      let content:any = ''

      stream.on('data', (chunk: any) => {
        content += chunk.toString('utf-8')
      })

      stream.on('error', (err: any) => {

        if (!fileMeta.failed) {
          fileMeta.failed = 1
        } else {
          fileMeta.failed += 1
        }

        this.channel.send({
          event: 'messageHandler:fetchError',
          data: {
            file: fileMeta,
            message: err.message,
            stack: err.stack
          }
        })
      })

      stream.on('end', () => {
        content = JSON.parse(content)

        // Send OS notification
        this.notify({
          title: content.subject,
          message: content.text_body,
          metadata: {
            type: 'email',
            hash: fileMeta.hash
          }
        })

        this.channel.send({
          event: 'messageHandler:fileFetched',
          data: {
            _id: fileMeta._id,
            email: {
              key: fileMeta.key,
              header: fileMeta.header,
              content
            },
          }
        })
      })
    } catch (err:any) {
      this.channel.send({
        event: 'messageHandler:fetchError',
        data: {
          file: fileMeta,
          message: err.message,
          stack: err.stack
        }
      })
    }
  }

  notify(props: { title: string, message: string, metadata: any }) {
    let bodyAsText = removeMd(props.message)
    bodyAsText = bodyAsText.replace(/\[(.*?)\]/g, '')
    bodyAsText = bodyAsText.replace(/(?:\u00a0|\u200C)/g, '')
    const selection = bodyAsText.split(' ').slice(0, 20)

    if (selection[selection.length - 1] !== '...') {
      selection.push('...')
    }

    this.channel.send({
      event: 'notify',
      data: {
        icon: path.join(__dirname, '../img/telios_notify_icon.png'),
        title: props.title,
        message: selection.join(' '),
        sound: true, // Only Notification Center or Windows Toasters
        metadata: props.metadata
      }
    })
  }

  async listen(msg: MsgHelperMessage) {
    const { event, payload } = msg
    /*************************************************
     *  INTIALIZE NEW INCOMING MESSAGE LISTENER
     ************************************************/
    if (event === 'messageHandler:initMessageListener') {
      await this.initDrive()
    }



    /*************************************************
     *  FETCH MESSAGES FROM METDATA ARRAY
     ************************************************/
    if (event === 'messageHandler:newMessageBatch') {
      const { meta, account } = payload
      this.fetchBatch(meta, account)
    }



    /*************************************************
     *  HANDLE SINGLE MESSAGE
     ************************************************/
    if (event === 'messageHandler:newMessage') {
      const { meta } = payload;
      const account = this.store.getAccount()
      const fileMeta = this.mailbox._decryptMailMeta(meta, account.secretBoxPrivKey, account.secretBoxPubKey);
      await this.fetchFile(fileMeta.discovery_key, fileMeta)
    }



    /*************************************************
     *  RETRY FAILED MESSAGES
     ************************************************/
    if (event === 'messageHandler:retryMessageBatch') {
      const { batch } = payload
      this.fetchBatch(batch)
    }
  }
}