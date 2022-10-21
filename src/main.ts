import { Store } from './Store'
import Account from './lib/account'
import Mailbox from './lib/mailbox'
import Alias from './lib/alias'
import Email from './lib/email'
import Folder from './lib/folder'
import MessageHandler from './lib/messageHandler'
import Contact from './lib/contact'
import Domain from './lib/domain'
const axios = require('axios')

import Migrate from './lib/migrate'

import { MainOpts } from './types'
import { StoreSchema } from './schemas'

export = (props: MainOpts) => {
  const { channel, userDataPath, env } = props
  let resource: any
  // @ts-ignore
  let store: StoreSchema = new Store(env, null, null)
  let messageHandler = new MessageHandler(channel, store)
  
  channel.on('message', async (msg: any) => {
    if(!resource) {
      try {
        resource = await getTeliosResources()

        const signingPubKey = env === 'production' ? resource.SIGNING_PUB_KEY : resource.SIGNING_PUB_KEY_DEV
        const apiURL = env === 'production' ? resource.API_SERVER : resource.API_SERVER_TEST 

        // @ts-ignore`
        store = new Store(env, signingPubKey, apiURL)
        messageHandler = new MessageHandler(channel, store)
      } catch(err:any) {
        // No internet connection
      }
    }
    Account({ channel, userDataPath, msg, store })
    Mailbox({ channel, userDataPath, msg, store })
    Alias({ channel, userDataPath, msg, store })
    Email({ channel, userDataPath, msg, store })
    Folder({ channel, userDataPath, msg, store })
    Contact({ channel, userDataPath, msg, store })
    Migrate({ channel, userDataPath, msg, store })
    Domain({ channel, userDataPath, msg, store })
    messageHandler.listen(msg)
  })
}

async function getTeliosResources(): Promise<any> {
  return new Promise((resolve, reject) => {
    axios.get('https://www.telios.io/.well-known/telios.json')
      .then((res:any) => {
        const data = res.data
        resolve(data)
      })
      .catch((err:any) => {
        reject(err)
      })
  })
}
