const path = require('path')
const removeMd = require('remove-markdown')
const RequestChunker = require('@telios/nebula/util/requestChunker')
const { v4: uuidv4 } = require('uuid')

import { MsgHelperMessage } from '../types'
import { 
  AccountSchema, 
  StoreSchema
} from '../schemas'
import { Stream } from 'stream'


export default class MesssageHandler {
  private drive: any
  private mailbox: any
  private ipfs: any
  private channel: any
  private store: StoreSchema

  constructor(channel:any, store: StoreSchema) {
    this.drive = null
    this.mailbox = null
    this.ipfs = null
    this.channel = channel
    this.store = store
  }

  async initDrive() {
    if (!this.drive) {
      this.drive = this.store.getDrive()
    }

    // If worker is running before drive is ready then call .ready()
    if (this.drive && !this.drive.discoveryKey) {
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
    this.ipfs = this.store.sdk.ipfs

    const keyPairs: any = this.store.getKeypairs()
    this.drive = this.store.getDrive()

    files = files.map(f => {
      try {
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
      } catch(err:any) {
        this.channel.send({
          event: 'messageHandler:fetchError',
          data: {
            file: {...f, failed: 99},
            message: err && err.message,
            stack: err && err.stack
          }
        });
        f = {}
        return f
      }
    })

    const ipfsFiles = files.filter(file => JSON.stringify(file) !== '{}' && file.cid)

    // If files have an IPFS content identifier (cid) then fetch files from SIA/IPFS
    if(ipfsFiles.length) {
      const batches = new RequestChunker(ipfsFiles, 1) // Only fetch one file at a time to reduce data corruption

      for (let batch of batches) {
        const requests = []

        for (let file of batch) {
          requests.push(new Promise((resolve: any, reject: any) => {
            this.ipfs.get(file.cid, file.key, file.header)
              .then((stream: Stream) => {
                let content = ''

                stream.on('data', (chunk) => {
                  content += chunk.toString('utf-8')
                });

                stream.on('end', () => {
                  content = JSON.parse(content);

                  const email = transformEmail({
                    key: file.key,
                    header: file.header,
                    content
                  });

                  const requestId = uuidv4()

                  this.channel.send({ 
                    event: 'email:saveMessageToDB', 
                    payload: {
                      messages: [email],
                      requestId,
                      type: 'Incoming',
                      async: false
                    } 
                  })

                  this.channel.once('email:saveMessageToDB:callback', (cb: any) => {
                    const { error, data } = cb

                    if(error) return reject(error)

                    if(data.requestId === requestId) {
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
    
                      return resolve()
                    } 
                  })
                });

                stream.on('error', (err) => {
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
                  });

                  return resolve()
                });
              });
          }))
        }

        await Promise.all(requests)
      }
    }
  }

  async fetchFile(discoveryKey: string, fileMeta: any) {
    try {
      this.ipfs = this.store.sdk.ipfs
      
      let keyPair
      let stream

      while (!keyPair) {
        if(this.drive && this.drive._workerKeyPairs) {
          keyPair = this.drive._workerKeyPairs.getKeyPair()
        }
      }

      if(fileMeta.cid) {
        stream = await this.ipfs.get(fileMeta.cid, fileMeta.key, fileMeta.header);
      } else {
        stream = await this.drive.fetchFileByDriveHash(discoveryKey, fileMeta.hash, { key: fileMeta.key, header: fileMeta.header, keyPair })
      }

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
      let { meta } = payload;

      if(!meta.discoveryKey && meta.msg) {
        // Decipher meta
        const account = this.store.getAccount();
        meta = this.store.sdk.mailbox._decryptMailMeta(meta, account.secretBoxPrivKey, account.secretBoxPubKey);
      }
      
      await this.fetchFile(meta.cid, meta)
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


function transformEmail(data: any) {
  const { path, key, header } = data.email;
  const email = data.email.content;

  return {
    unread: true,
    fromJSON: JSON.stringify(email.from),
    toJSON: JSON.stringify(email.to),
    ccJSON: JSON.stringify(email.cc),
    bccJSON: JSON.stringify(email.bcc),
    bodyAsHtml: email.html_body,
    bodyAsText: email.text_body,
    path,
    encKey: key,
    encHeader: header,
    ...email
  };
}