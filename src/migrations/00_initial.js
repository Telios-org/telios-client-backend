const Migrate = require("@telios/nebula-migrate")
const { Sequelize } = require('sequelize')
const AccountModel = require('./helpers/AccountModel.js')
const ClientSDK = require("@telios/client-sdk")

module.exports = {
  up: async ({ rootdir, drivePath, password }) => {
    try {
      const sequelize = await new Sequelize(null, null, password, {
        dialect: 'sqlite',
        dialectModulePath: '@journeyapps/sqlcipher',
        storage: `${rootdir}/app.db`,
        transactionType: 'IMMEDIATE'
      });

      await sequelize.authenticate()

      const Account = await AccountModel.init(sequelize)

      const account = await Account.findOne()

      const encryptionKey = account.driveEncryptionKey
      const keyPair = {
        publicKey: account.deviceSigningPubKey,
        secretKey: account.deviceSigningPrivKey
      }
      const sdk = new ClientSDK()
      const { mnemonic } = sdk.Account.makeKeys()

      process.send({ event: 'debug:info', data: { name: 'OLD INFO', rootdir, drivePath, encryptionKey, keyPair }})

      await Migrate({ rootdir, drivePath, encryptionKey, keyPair })

      return { 
        mnemonic,
        encryptionKey,
        keyPair,
        account
      }
    } catch(err) {
      process.send({ event: 'debug:info', data: { message: err.message, stack: err.stacktrace }})
      throw err
    }
  },
  down: async () => {
    
  }
}