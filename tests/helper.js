const EventEmitter = require('events')
const path = require('path')
const fs = require('fs')
const { fork } = require('child_process')

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