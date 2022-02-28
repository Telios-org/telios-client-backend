import { MigrateModel } from '../models/migrate.model'
import { MigrateSchema } from '../schemas'

const fs = require('fs')
const path = require('path')

export default async (props: any) => {
  const { channel, msg, store } = props 
  const { event, payload } = msg
  
  /***************************************
   *  RUN MIGRATION
   **************************************/
  if (event === 'migrate:run') {
    try {
      const migrateModel = new MigrateModel(store)
      const Migrate = await migrateModel.ready()

      const migrations: MigrateSchema[] = await Migrate.find()

      // 1. Check migrations directory
      // fs.readdirSync(path.join(__dirname, '../../src', 'migrations')).forEach((file: any) => {
      //   const filePath = `${path.join(__dirname, '../../src', 'migrations')}/${file}`
      //   // const Script = require(filePath)
      //   // Script.up()
      // });
      
      // 2. Get ran migrations from db
      // 3. If new migration in dir that does not exist in db, then run up
      // 4. Save script name to DB as already being ran
      // 5. DONE
    } catch(err: any) {
      channel.send({
        event: 'migrate:run:callback',
        error: {
          name: err.name,
          message: err.message,
          stacktrace: err.stack
        }
      })
    }
  }
}