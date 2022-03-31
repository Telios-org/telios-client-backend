const EventEmitter = require('events')
const path = require('path')
const fs = require('fs')
const { fork } = require('child_process')
const { v4: uuidv4 } = require('uuid')
const b64EncodedAttachment = require('./attachment')

class Channel extends EventEmitter {
  constructor(dirPath) {
    super()

    this.pid = null

    if(!fs.existsSync(path.join(__dirname, 'Accounts')))
      fs.mkdirSync(path.join(__dirname, 'Accounts'), { recursive: true })

    this.process = fork('./index', [dirPath, 'development'], {
      stdio: ['pipe', 'pipe', 'pipe', 'ipc']
    })

    this.pid = this.process.pid

    this.process.on('message', m => {
      const { event } = m
      
      this.emit(event, m)
    })

    this.process.stderr.on('error', data => {
      this.emit('error', data.toString())
    })
  }

  send(data) {
    this.process.send(data)
  }

  kill() {
    // this.process.kill(0)
    process.kill(this.process.pid)
  }
}

module.exports = Channel

module.exports.OpenChannel = () => {
  const channel = new Channel(path.join(__dirname, 'Accounts'))

  return new Promise((resolve, reject) => {
    channel.send({
      event: 'account:login',
      payload: {
        email: 'bob@telios.io',
        password: 'letmein123'
      }
    })
  
    channel.on('account:login:callback', data => {
      const { error } = data

      if(error) return reject(error)

      resolve(channel)
    })
  })
}

module.exports.MockEmail = ({ subject, to, from, cc, bcc, emailId, folderId, aliasId, unread }) => {
  const uuid = uuidv4()

  const _to = [ { name: 'Alice Drumpf', address: 'alice@telios.io', account_key:'123456' } ]
  const _from = [ { name: 'Bob Kinderly', address: 'bob@telios.io', account_key:'654321' } ]
  const _cc = [ { name: 'Json Waterfall', address: 'jwaterfall@telios.io', account_key:'112333' } ]
  const _bcc = [ { name: 'Albus Dumbeldore', address: 'albus.dumbeldore@howgwarts.edu' } ]

  if(to) _to.push(to)
  if(from) _from.push(from)
  if(cc) _cc.push(cc)
  if(bcc) _bcc.push(bcc)

  return {
    emailId,
    folderId,
    aliasId,
    subject: subject || `Subject-${uuid}`,
    unread,
    date: new Date().toUTCString(),
    to: _to,
    from: _from,
    cc: _cc,
    bcc: _bcc,
    text_body: `This is a test message-${uuid}`,
    bodyAsText: `This is a test message-${uuid}`,
    html_body: `<div>This is a test message-${uuid}</div>`,
    bodyAsHtml: `<div>This is a test message-${uuid}</div>`,
    attachments: [{
      filename: 'test_image.png',
      extension: '.png',
      contentType: 'image/png',
      size: 280000000,
      content: b64EncodedAttachment
    }],
    path: null,
    // Timestamps
    createdAt: new Date().toUTCString(),
    updatedAt: new Date().toUTCString()
  }
}