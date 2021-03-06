import { Stream } from "stream"
import { EmailSchema, FileSchema } from "../schemas"
import { UTCtimestamp } from '../util/date.util'

const MemoryStream = require('memorystream')
const { v4: uuidv4 } = require('uuid')
const fs = require('fs')

export const saveEmailToDrive = async (opts: { email: EmailSchema, drive: any, ipfs?: any }) : Promise<FileSchema> => {
  return new Promise((resolve, reject) => {
    const readStream = new MemoryStream()
    readStream.end(JSON.stringify(opts.email))

    if(!opts.email.path) {
      opts.email.path = `/email/${uuidv4()}.json`
    }

    opts.drive.writeFile(opts.email.path, readStream, { encrypted: true })
      .then(async (file: FileSchema) => {

        // SAVE TO IPFS
        if(opts.ipfs) {
          const _file = await opts.drive.metadb.get(file.hash)

          if(_file && _file.value.path) {
            const filesDir = opts.drive._filesDir
            const stream = fs.createReadStream(filesDir + _file.value.path)
            const { cid } = await saveFileToIPFS(opts.ipfs, stream)
            file.cid = cid
          }
        }

        resolve(file)
      })
      .catch((err: any) => {
        reject(err)
      })
  })
}

export const saveFileToDrive = async (File: any, opts: { file: any, content?: string, drive: any, ipfs?: any }) : Promise<FileSchema> => {
  return new Promise(async (resolve, reject) => {
    let readStream: any
    let filename = opts.file.filename || opts.file.name

    // When file is over 25mb create readstream from file path
    if(opts.file.localPath) {
      readStream = fs.createReadStream(opts.file.localPath)
      opts.file.path = `/file/${filename}`
    }
    
    if(opts.content) {
      readStream = new MemoryStream()
      readStream.end(Buffer.from(opts.content, 'base64'))

      if(!opts.file.path) {
        opts.file.path = `/file/${filename}`
      }
    }

    if(!opts.file.cid && opts.file.localPath && !opts.drive && opts.file.discoveryKey && opts.file.hash) {
      try {
        readStream = await opts.drive.fetchFileByDriveHash(opts.file.discoveryKey, opts.file.hash, { key: opts.file.key, header: opts.file.header })
      } catch(e) {
        reject(e)
      }
    }

    if(!opts.file.localPath && opts.ipfs && opts.file.cid) {
      try {
        readStream = await opts.ipfs.get(opts.file.cid, opts.file.key, opts.file.header)
      } catch(e) {
        reject(e)
      }
    }

    if(readStream) {
      readStream.on('error', (e: any) => {
        reject(e)
      })

      opts.drive.writeFile(opts.file.path, readStream, { encrypted: true })
        .then(async (file: any) => {
          if(!opts.file.contentType && file.mimetype) {
            opts.file.contentType = file.mimetype
          }
          
          opts.file.key = file.key.toString('hex')
          opts.file.header = file.header.toString('hex')
          opts.file.hash = file.hash
          opts.file.discovery_key = file.discovery_key

          try {
            opts.file.createdAt = UTCtimestamp()
            opts.file.updatedAt = UTCtimestamp()

            // SAVE TO IPFS
            if(opts.ipfs) {
              const _file = await opts.drive.metadb.get(file.hash)

              if(_file && _file.path) {
                const filesDir = opts.drive._filesDir
                const stream = fs.createReadStream(filesDir + _file.value.path)
                const { cid } = await saveFileToIPFS(opts.ipfs, stream)
                opts.file.cid = cid
              }
            }

            const doc: FileSchema = await File.insert(opts.file)
            resolve(doc)
            
          } catch(err: any) {
            reject(err)
          }
        })
        .catch((err: any) => {
          reject(err)
        })
    } else {
      reject(`Unable to establish a readable stream for file ${opts.file.filename}`)
    }
  })
}

export const saveFileFromEncryptedStream = async (writeStream: any, opts: { discoveryKey: string, drive: any, key: string, header: string, hash: string, filename: string, cid?: string, ipfs?: any }) => {
  return new Promise((resolve: any, reject: any) => {
    if(!opts.cid && opts.discoveryKey && opts.drive.discoveryKey !== opts.discoveryKey) {
      opts.drive.fetchFileByDriveHash(opts.discoveryKey, opts.hash, { key: opts.key, header: opts.header })
        .then((stream: any) => {
          stream.on('error', (e: any) => {
            reject(e)
          })
    
          stream.on('data', (chunk: any) => {
            writeStream.write(chunk)
          })
    
          stream.on('end', () => {
            writeStream.end()
          })
    
          writeStream.on('finish', () => {
            resolve()
          })
        })
        .catch((err: any) => {
          reject(err)
          throw err
        })
    } else {
      opts.drive.readFile(`/file/${opts.filename}`, { key: opts.key, header: opts.header })
        .then((stream: any) => {
          stream.on('data', (chunk: any) => {
            writeStream.write(chunk)
          })

          stream.on('end', () => {
            writeStream.end()
          })

          writeStream.on('finish', () => {
            resolve()
          })
        })
        .catch((err: any) => {
          reject(err)
          throw err
        })
    }
  })
}

export const readFile = (path: string, opts: { drive: any, type: string, ipfs?: any }):Promise<string> => {
  return new Promise((resolve, reject) => {
    let content = ''
    
    opts.drive.readFile(path)
      .then((stream: any) => {
        stream.on('data', (chunk: any) => {
          if (opts.type === 'email') {
            content += chunk.toString('utf8')
          } else {
            content += chunk.toString('base64')
          }
        })

        stream.on('end', (data: any) => {
          resolve(content)
        })

        stream.on('error', (err: any) => {
          reject(err)
        })
      })
      .catch((err: any) => {
        reject(err)
      })
  })
}

export const saveFileToIPFS = async (ipfs: any, stream: Stream) : Promise<{cid:string}> => {
  return new Promise(async (resolve, reject) => {

    ipfs.add(stream)
      .then((file: { uuid: string, key?: string, header?: string, size?: number }) => {
        // Check when file upload is done!
        const statusInterval = setInterval(async () => {
          const status = await ipfs.status(file.uuid)
          if(status.error) {
            clearInterval(statusInterval)
            return reject(status.error)
          }
          if(status.done) {
            clearInterval(statusInterval)

            if(!status.cid) return reject('IPFS CID not found.')

            return resolve({ cid: status.cid })
          }
        }, 500)
        
      }).catch((err: any) => {
        reject(err)
      })
  })
}

export const getIPFSUploadStatus = async (ipfs: any, uuid: string) : Promise<{ uuid: string, uploaded: number, error: string, done: boolean, cid?: string }> => {
  return await ipfs.status(uuid)
}

export const readIPFSFile = async (ipfs: any, cid: string, key: string, header: string) : Promise<Stream> => {
  return await ipfs.get(cid, key, header)
}

export const deleteIPFSFile = async (ipfs: any, cid: string) : Promise<Stream> => {
  return await ipfs.delete(cid)
}

export const decodeB64 = (base64: string) => {
  return Buffer.from(base64, 'base64')
}
