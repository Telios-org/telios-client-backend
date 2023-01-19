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

    this.process = fork('./index', [dirPath, 'development', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:107.0) Gecko/20100101 Firefox/107.0'], {
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
      env: {
        NODE_ICU_DATA: '/Users/garethharte/Documents/GitHub.nosync/telios-client-backend/node_modules/full-icu'
      }
    })

    this.pid = this.process.pid

    this.process.on('message', m => {
      const { event } = m

      console.log(m)
      
      this.emit(event, m)
    })

    this.process.stderr.on('error', data => {
      console.log(data.toString())
      this.emit('error', data.toString())
    })
  }

  send(data) {
    this.process.send(data)
  }

  kill() {
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

module.exports.MockEmail = ({ subject, to, from, cc, bcc, emailId, folderId, aliasId, unread, attachments }) => {
  const uuid = uuidv4()

  let _to = [ { name: 'Alice Drumpf', address: 'alice@telios.io', account_key:'fd6ee19c98c8d7fc1ff51b1c85c5d42947614e61cfc726633476bc8b61f3fb6a' } ]
  let _from = [ { name: 'Bob Kinderly', address: 'bob@telios.io', account_key:'deb827d7326235dc4d59fc65d0fadff362259a29e23fe26c9e45baa5e2f07d07' } ]
  let _cc = [ { name: 'Json Waterfall', address: 'jwaterfall@telios.io', account_key:'8eee3a83210d1060f1c13f90490828e10f8442e5d1dd0df1f56beb6cef17cd30' } ]
  let _bcc = [ { name: 'Albus Dumbeldore', address: 'albus.dumbeldore@howgwarts.edu' } ]
  let _attachments = [{
    filename: 'test_image.png',
    extension: '.png',
    contentType: 'image/png',
    size: 280000000,
    content: b64EncodedAttachment
  }]


  if(to){
    if(Array.isArray(to)) _to = to
    else _to.push(to)
  }

  if(from){
    if(Array.isArray(from)) _from = from
    else _from.push(from)
  }

  if(cc){
    if(Array.isArray(cc)) _cc = cc
    else _to.push(cc)
  }

  if(bcc){
    if(Array.isArray(bcc)) _bcc = bcc
    else _to.push(bcc)
  }

  if(attachments){
    if(Array.isArray(attachments)) _attachments = attachments
    else _to.push(attachments)
  }
  
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
    attachments: _attachments,
    path: null,
    // Timestamps
    createdAt: new Date().toUTCString(),
    updatedAt: new Date().toUTCString()
  }
}

module.exports.MockAliasEmail = ({ subject, to, from, cc, bcc, aliasAddress, unread, attachments }) => {
  const uuid = uuidv4()

  let _to = [ { name: 'Alice Drumpf', address: aliasAddress } ]
  let _from = [ { name: 'Bob Kinderly', address: 'bob@telios.io', account_key:'deb827d7326235dc4d59fc65d0fadff362259a29e23fe26c9e45baa5e2f07d07' } ]
  let _cc = [ { name: 'Json Waterfall', address: 'jwaterfall@telios.io', account_key:'8eee3a83210d1060f1c13f90490828e10f8442e5d1dd0df1f56beb6cef17cd30' } ]
  let _bcc = [ { name: 'Albus Dumbeldore', address: 'albus.dumbeldore@howgwarts.edu' } ]
  let _attachments = [{
    filename: 'test_image.png',
    extension: '.png',
    contentType: 'image/png',
    size: 280000000,
    content: b64EncodedAttachment
  }]


  if(to){
    if(Array.isArray(to)) _to = to
    else _to.push(to)
  }

  if(from){
    if(Array.isArray(from)) _from = from
    else _from.push(from)
  }

  if(cc){
    if(Array.isArray(cc)) _cc = cc
    else _to.push(cc)
  }

  if(bcc){
    if(Array.isArray(bcc)) _bcc = bcc
    else _to.push(bcc)
  }

  if(attachments){
    if(Array.isArray(attachments)) _attachments = attachments
    else _to.push(attachments)
  }
  
  return {
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
    attachments: _attachments,
    path: null,
    // Timestamps
    createdAt: new Date().toUTCString(),
    updatedAt: new Date().toUTCString()
  }
}