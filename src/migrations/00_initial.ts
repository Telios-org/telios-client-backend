const Migrate = require("@telios/nebula-migrate")
const { Sequelize } = require('sequelize')
const AccountModel = require('./helpers/AccountModel.js')
const ClientSDK = require("@telios/client-sdk")

export default {
  up: async (props: { rootdir: string, drivePath: string, password: string }) => {
    try {
      const sequelize = await new Sequelize(null, null, props.password, {
        dialect: 'sqlite',
        dialectModulePath: '@journeyapps/sqlcipher',
        storage: `${props.rootdir}/app.db`,
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

      await Migrate({ rootdir: props.rootdir, drivePath: props.drivePath, encryptionKey: Buffer.from(encryptionKey, 'hex'), keyPair })

      return { 
        mnemonic,
        encryptionKey,
        keyPair,
        account
      }
    } catch(err:any) {
      throw err
    }
  },
  down: async () => {
    
  }
}