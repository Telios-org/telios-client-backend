const Migrate = require("@telios/nebula-migrate")
const ClientSDK = require("@telios/client-sdk")
const sqlite3 = require('@journeyapps/sqlcipher').verbose()

module.exports = {
  up: async ({ rootdir, drivePath, password }) => {
    try {
        const account = await getAccount(`${rootdir}/app.db`, password)
        const encryptionKey = account.driveEncryptionKey
        const keyPair = {
          publicKey: account.deviceSigningPubKey,
          secretKey: account.deviceSigningPrivKey
        }
        const sdk = new ClientSDK()
        const { mnemonic } = sdk.Account.makeKeys()
  
        await Migrate({ rootdir, drivePath, encryptionKey: Buffer.from(encryptionKey, 'hex'), keyPair })
  
        return { 
          mnemonic,
          encryptionKey,
          keyPair,
          account
        }
    } catch(err) {
      throw err
    }
  },
  down: async () => {
    
  }
}

async function getAccount(dbPath, password) {
  const db = new sqlite3.Database(dbPath)

  return new Promise((resolve, reject) => {
    db.serialize(function() {
      db.run("PRAGMA cipher_compatibility = 4")
    
      db.run(`PRAGMA key = '${password}'`)
    
      db.each("SELECT * FROM Account", function(err, row) {
        return resolve(row)
      })
    })
  })
}