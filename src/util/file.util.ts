import { Stream } from "stream"
import { EmailSchema, FileSchema } from "../schemas"
import { UTCtimestamp } from '../util/date.util'

const MemoryStream = require('memorystream')
const { v4: uuidv4 } = require('uuid')
const fetch = require('node-fetch')
const https = require('https')
const fs = require('fs')
const path = require('path')

export const saveEmailToDrive = async (opts: { email: EmailSchema, drive: any, ipfs?: any }) : Promise<FileSchema> => {
  return new Promise((resolve, reject) => {
    const readStream = new MemoryStream()

    if(!opts.email.path) {
      opts.email.path = `/email/${uuidv4()}.json`
    }

    readStream.end(JSON.stringify(opts.email))

    opts.drive.writeFile(opts.email.path, readStream, { encrypted: true })
      .then(async (file: FileSchema) => {

        // SAVE TO IPFS
        if(opts.ipfs) {

          if(file && file.path) {
            const filesDir = opts.drive._filesDir;

            let fp

            if(file.encrypted) {
              fp = file.uuid
            } else {
              fp = file.path
            }

            const stream = fs.createReadStream(path.join(filesDir, fp))
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
      opts.file.path = `/file/${uuidv4()}`
    }
    
    if(opts.content) {
      readStream = new MemoryStream()
      let buff = !Buffer.isBuffer(opts.content) ? Buffer.from(opts.content, 'base64') : opts.content
      
      readStream.end(buff)

      if(!opts.file.path) {
        opts.file.path = `/file/${uuidv4()}`
      }
    }

    if(!opts.content && !opts.file.cid && opts.file.localPath && !opts.drive && opts.file.discoveryKey && opts.file.hash) {
      try {
        readStream = await opts.drive.fetchFileByDriveHash(opts.file.discoveryKey, opts.file.hash, { key: opts.file.key, header: opts.file.header })
      } catch(e) {
        reject(e)
      }
    }

    if(!opts.content && !opts.file.localPath && opts.ipfs && opts.file.cid) {
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
              const filesDir = opts.drive._filesDir;

              let fp

              if(file.encrypted) {
                fp = file.uuid
              } else {
                fp = file.path
              }

              const stream = fs.createReadStream(path.join(filesDir, fp))
              const { cid } = await saveFileToIPFS(opts.ipfs, stream)
              file.cid = cid
              if(opts.file.filename) file.filename = opts.file.filename
            }

            const doc: FileSchema = await File.insert(file)
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

export const saveFileFromEncryptedStream = async (
  writeStream: any, 
  opts: { 
    discoveryKey: string, 
    drive: any, 
    key: string, 
    header: string, 
    hash: string, 
    filename: string, 
    path: string, 
    cid?: string, 
    ipfs?: any 
  }) => {
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
      opts.drive.readFile(opts.path, { key: opts.key, header: opts.header })
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

export const readFile = async (path: string, opts: { drive: any, type: string, ipfs?: any, cid?:string, IPFSGateway: string }):Promise<any> => {
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
      .catch(async(err: any) => {
        // reject(err)

        try {
          // Attempt to pull and store file directly from IPFS
          const file = await opts.drive._collections.files.findOne({ path: path })
    
          const ipfsStream = await getFileByCID({ cid: opts.cid, IPFSGateway: opts.IPFSGateway, async: true })
    
          const ws = fs.createWriteStream(`${opts.drive._filesDir}/${file.uuid}`)
    
          //@ts-ignore
          ipfsStream.pipe(ws)
          
          //@ts-ignore
          ipfsStream.on('end', async () => {
            opts.drive.readFile(path).then((stream: any) => {
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
          })
        } catch(err: any) {
          return err
        }
      })
  })
}

export const saveFileToIPFS = async (ipfs: any, stream: Stream) : Promise<{cid:string}> => {
  return new Promise(async (resolve, reject) => {

    ipfs.add(stream)
      .then(async (file: { uuid: string, key?: string, header?: string, size?: number }) => {
        // Check when file upload is done!
        try {
          const cid = await checkStatus(ipfs, file.uuid)
          return resolve({ cid })
        } catch(err:any) {
          return reject(err)
        }
      }).catch((err: any) => {
        return reject(err)
      })
  })
}

export const getIPFSUploadStatus = async (ipfs: any, uuid: string) : Promise<{ uuid: string, uploaded: number, error: string, done: boolean, cid?: string }> => {
  return await ipfs.status(uuid)
}

export const readIPFSFile = async (ipfs: any, cid: string, key?: string, header?: string) : Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    ipfs.get(cid, key, header)
      .then((stream:any) => {
        let buffArr:Array<Buffer> = []

        stream.on('data', (chunk: Buffer) => {
          buffArr.push(chunk)
        })

        stream.on('end', () => {
          resolve(Buffer.concat(buffArr))
        })

        stream.on('error', (err:any) => {
          reject(err)
        })
      })
      .catch((err:any) => {
        reject(err)
      })
  })
}

export const getFileByCID = async (opts: { cid?: string, IPFSGateway?: string, async?: Boolean }) : Promise<Stream | Buffer> => {
  let IPFSGateway = 'https://ipfs.filebase.io/ipfs'
  
  if(opts.IPFSGateway) IPFSGateway = opts.IPFSGateway
  
  return new Promise((resolve: any, reject: any) => {
    //@ts-ignore
    const env = process.env.NODE_ENV;
    
    if(env === 'test_sdk') {
      const stream = fs.createReadStream(path.join(__dirname, '../../tests/data', opts.cid))
      resolve(stream)
    } else {

      const httpsAgent = new https.Agent({
        rejectUnauthorized: false
      })

      fetch(`${IPFSGateway}/${opts.cid}`, { 
          method: 'get',
          agent: httpsAgent,
          headers: {
            'Content-Type': 'application/octet-stream'
          }
        })
        .then(async (data: any) => {
          let buffArr:Array<Buffer> = []

          const stream = data.body

          if(opts.async) return resolve(stream)

          stream.on('data', (chunk: Buffer) => {
            buffArr.push(chunk)
          })

          stream.on('end', () => {
            resolve(Buffer.concat(buffArr))
          })

          stream.on('error', (err:any) => {
            reject(err)
          })
        })
        .catch((err: any) => {
          reject(err)
        });
    }
  })
}

export const deleteIPFSFile = async (ipfs: any, cid: string) : Promise<Stream> => {
  return await ipfs.delete(cid)
}

export const decodeB64 = (base64: string) => {
  return Buffer.from(base64, 'base64')
}

async function checkStatus(ipfs: any, fileId: string) : Promise<string> {
  return new Promise(async (resolve, reject) => {
    try {
      const status = await ipfs.status(fileId)

      if(status.error) return reject(status.error)

      if(status.done) {
        if(!status.cid) return reject('IPFS CID not found.')

        return resolve(status.cid)
      } else {
        setTimeout( () => {
          return checkStatus(ipfs, fileId)
        }, 1000)
      }
    } catch(err:any) {
      return reject(err)
    }
  })
}