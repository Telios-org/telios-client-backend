
const userDataPath = process.argv[2]
const env = process.argv[3]

module.exports.ClientBackend = (channel, userDataPath, env) => {
  require('./dist/main.js')({ channel, userDataPath })
}


if(env || userDataPath) {
  this.ClientBackend(process, userDataPath, env)
}
