const Migrate = require("@telios/nebula-migrate")
const ClientSDK = require("@telios/client-sdk")
const sqlite3 = require('@journeyapps/sqlcipher').verbose()
const fs = require('fs')
const path = require('path')

module.exports = {
  up: async ({ rootdir, drivePath, password }) => {
    try {
        const { data, account } = await extractDB(rootdir, password)
        
        const encryptionKey = account.driveEncryptionKey
        const keyPair = {
          publicKey: account.deviceSigningPubKey,
          secretKey: account.deviceSigningPrivKey
        }
        const sdk = new ClientSDK()
        const { mnemonic } = sdk.Account.makeKeys()
        
        fs.mkdirSync(path.join(rootdir, drivePath, 'migrate'))
        fs.writeFileSync(path.join(rootdir, drivePath, '/migrate/data.json'), JSON.stringify(data))
  
        await Migrate({ rootdir, drivePath, encryptionKey: Buffer.from(encryptionKey, 'hex'), keyPair, data })
  
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

async function extractDB(rootdir, password) {
  let db = new sqlite3.Database(`${rootdir}/app.db`)
  let account = {}
  let data = {
    "main": {
      "collections": {
        "file": [],
        "Mailbox": [],
        "Alias": [],
        "AliasNamespace": [],
        "Contact": [],
        "Email": [],
        "Folder": []
      },
      "tx": []
    },
    "meta": {},
    "local": {}
  }

  return new Promise((resolve, reject) => {
    db.serialize(function() {
      db.run("PRAGMA cipher_compatibility = 4")
    
      db.run(`PRAGMA key = '${password}'`)

      db.each("SELECT * FROM Account", function(err, row) {
        account = row
      })
    
      db.each("SELECT * FROM Mailbox", function(err, row) {
        data.main.collections.Mailbox.push(row)
      })

      db.each("SELECT * FROM Alias", function(err, row) {
        data.main.collections.Alias.push(row)
      })

      db.each("SELECT * FROM Namespace", function(err, row) {
        data.main.collections.AliasNamespace.push(row)
      })

      db.each("SELECT * FROM Contact", function(err, row) {
        data.main.collections.Contact.push(row)
      })

      db.each("SELECT * FROM Folder", function(err, row) {
        data.main.collections.Folder.push(row)
      })
    })

    db.close(() => {
      db = new sqlite3.Database(`${rootdir}/email.db`)

      db.serialize(function() {
        db.run("PRAGMA cipher_compatibility = 4")
    
        db.run(`PRAGMA key = '${password}'`)

        db.each("SELECT * FROM Email", function(err, row) {
          data.main.collections.Email.push({ path: row.path })
        })
      })

      db.close(() => {
        resolve({ data, account })
      })
    })
  })
}