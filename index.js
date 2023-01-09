const userDataPath = process.argv[2]
const env = process.argv[3]
const userAgent = process.argv[4]

const main = require('./dist/main')

module.exports.ClientBackend = (channel, userDataPath, env, userAgent) => {
  main({ channel, userDataPath, env, userAgent })
}

if (env || userDataPath) {
  this.ClientBackend(process, userDataPath, env, userAgent)
}
