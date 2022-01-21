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

    if(!fs.existsSync(path.join(__dirname, 'Drive/Accounts')))
      fs.mkdirSync(path.join(__dirname, 'Drive/Accounts'), { recursive: true })

    this.process = fork('./index', [dirPath, 'development'], {
      stdio: ['pipe', 'pipe', 'pipe', 'ipc']
    })

    this.pid = this.process.pid

    this.process.on('message', m => {
      const { event, data, error } = m

      if(error) this.emit(event, error)
      
      this.emit(event, data)
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
  const channel = new Channel(path.join(__dirname, 'Drive'))

  return new Promise((resolve, reject) => {
    channel.send({
      event: 'account:login',
      payload: {
        email: 'bob@telios.io',
        password: 'letmein123'
      }
    })
  
    channel.on('account:login:error', error => {
      reject(error)
    })
  
    channel.on('account:login:success', data => {
      resolve(channel)
    })
  })
}

module.exports.MockEmail = ({ subject, to, from, cc, bcc, emailId, folderId, aliasId, unread }) => {
  const uuid = uuidv4()

  const _to = [ { name: 'Alice Drumpf', address: 'alice@telios.io' } ]
  const _from = [ { name: 'Bob Kinderly', address: 'bob@telios.io' } ]
  const _cc = [ { name: 'Json Waterfall', address: 'jwaterfall@telios.io' } ]
  const _bcc = [ { name: 'Albus Dumbeldore', address: 'albus.dumbeldore@howgwarts.edu' } ]

  if(to) _to.push(to)
  if(from) _to.push(from)
  if(cc) _to.push(cc)
  if(bcc) _to.push(bcc)

  return {
    emailId,
    folderId,
    aliasId,
    subject: subject || `Subject-${uuid}`,
    unread,
    date: new Date().toISOString(),
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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
}