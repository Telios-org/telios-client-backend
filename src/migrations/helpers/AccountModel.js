const Sequelize = require('sequelize')
const { Model } = require('sequelize')

const model = {
  accountId: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  uid: {
    type: Sequelize.STRING,
    allowNull: false
  },
  driveEncryptionKey: {
    type: Sequelize.STRING,
    allowNull: false
  },
  secretBoxPubKey: {
    type: Sequelize.STRING,
    allowNull: false
  },
  secretBoxPrivKey: {
    type: Sequelize.STRING,
    allowNull: false
  },
  deviceSigningPubKey: {
    type: Sequelize.STRING,
    allowNull: false
  },
  deviceSigningPrivKey: {
    type: Sequelize.STRING,
    allowNull: false
  },
  serverSig: {
    type: Sequelize.STRING,
    allowNull: false
  },
  deviceId: {
    type: Sequelize.STRING,
    allowNull: false
  }
}

class Account extends Model {}

module.exports.Account = Account

module.exports.model = model

module.exports.init = async (sequelize) => {
  Account.init(model, {
    sequelize,
    tableName: 'Account',
    freezeTableName: true,
    timestamps: true
  })

  return Account
}