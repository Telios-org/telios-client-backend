import { EmailSchema, FileSchema } from "../schemas"
import { UTCtimestamp } from '../util/date.util'

const MemoryStream = require('memorystream')
const { v4: uuidv4 } = require('uuid')
const fs = require('fs')

export const saveEmailToDrive = async (opts: { email: EmailSchema, drive: any }) : Promise<FileSchema> => {
  return new Promise((resolve, reject) => {
    const readStream = new MemoryStream();
    readStream.end(JSON.stringify(opts.email));

    if(!opts.email.path) {
      opts.email.path = `/email/${uuidv4()}.json`;
    }

    opts.drive.writeFile(opts.email.path, readStream, { encrypted: true })
      .then((data: FileSchema) => {
        resolve(data)
      })
      .catch((err: any) => {
        reject(err)
      });
  });
};

export const saveFileToDrive = async (File: any, opts: { file: any, content?: string, drive: any }) : Promise<FileSchema> => {
  return new Promise(async (resolve, reject) => {
    let readStream

    // When file is over 25mb create readstream from file path
    if(opts.file.localPath) {
      readStream = fs.createReadStream(opts.file.localPath);
      opts.file.path = `/file/${opts.file.filename || opts.file.name}`
    }
    
    if(opts.content) {
      readStream = new MemoryStream()
      readStream.end(Buffer.from(opts.content, 'base64'));

      if(!opts.file.path) {
        opts.file.path = `/file/${opts.file.filename || opts.file.name}`
      }
    }

    if(opts.drive && opts.file.discoveryKey && opts.file.hash) {
      try {
        readStream = await opts.drive.fetchFileByDriveHash(opts.file.discoveryKey, opts.file.hash, { key: opts.file.key, header: opts.file.header });
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

            const doc: FileSchema = await File.insert(opts.file)
            resolve(doc)
          } catch(err: any) {
            reject(err)
          }
        })
        .catch((err: any) => {
          reject(err)
        });
    } else {
      reject(`Unable to establish a readable stream for file ${opts.file.filename}`)
    }
  });
};

export const saveFileFromEncryptedStream = async (writeStream: any, opts: { discoveryKey: string, drive: any, key: string, header: string, hash: string, filename: string }) => {
  return new Promise((resolve: any, reject: any) => {
    if(opts.discoveryKey && opts.drive.discoveryKey !== opts.discoveryKey) {
      opts.drive.fetchFileByDriveHash(opts.discoveryKey, opts.hash, { key: opts.key, header: opts.header })
        .then((stream: any) => {
          stream.on('error', (e: any) => {
            reject(e)
          });
    
          stream.on('data', (chunk: any) => {
            writeStream.write(chunk)
          });
    
          stream.on('end', () => {
            writeStream.end()
          });
    
          writeStream.on('finish', () => {
            resolve()
          });
        })
        .catch((err: any) => {
          reject(err)
          throw err
        });
    } else {
      opts.drive.readFile(`/file/${opts.filename}`, { key: opts.key, header: opts.header })
        .then((stream: any) => {
          stream.on('data', (chunk: any) => {
            writeStream.write(chunk)
          });

          stream.on('end', () => {
            writeStream.end()
          });

          writeStream.on('finish', () => {
            resolve()
          });
        })
        .catch((err: any) => {
          reject(err)
          throw err
        });
    }
  });
};

export const readFile = (path: string, opts: { drive: any, type: string }) => {
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
        });

        stream.on('end', (data: any) => {
          resolve(content)
        });

        stream.on('error', (err: any) => {
          reject(err)
        });
      })
      .catch((err: any) => {
        reject(err)
      });
  });
}

export const decodeB64 = (base64: string) => {
  return Buffer.from(base64, 'base64')
}
