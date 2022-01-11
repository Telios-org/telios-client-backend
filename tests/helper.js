const EventEmitter = require('events')
const path = require('path')
const fs = require('fs')
const { fork } = require('child_process')

class Channel extends EventEmitter {
  constructor(dirPath) {
    super()

    if(!fs.existsSync(path.join(__dirname, 'Drive/Accounts')))
      fs.mkdirSync(path.join(__dirname, 'Drive/Accounts'), { recursive: true })

    this.process = fork('./index', [dirPath, 'development'], {
      stdio: ['pipe', 'pipe', 'pipe', 'ipc']
    })

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
    this.process.kill(0)
  }
}

module.exports = Channel


// process.stderr.on('data', data => {
//   console.log(data.toString())
// })

// process.stderr.on('error', data => {
//   t.fail(data.toString())
// })

// process.on('message', m => {
//   console.log('MESSAGE', m)
//   const { error, data } = m

//   if(error) return t.fail(m.error.stacktrace)
  
//   t.ok(data)
// })