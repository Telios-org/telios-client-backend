const userDataPath = process.argv[2];
const env = process.argv[3];

const main = require('./dist/main');

module.exports.ClientBackend = (channel, userDataPath, env) => {
  main({ channel, userDataPath, env });
};

if (env || userDataPath) {
  this.ClientBackend(process, userDataPath, env);
}
