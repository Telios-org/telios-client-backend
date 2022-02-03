import { Store } from './Store'
import Account from './lib/account'
import Mailbox from './lib/mailbox'
import Alias from './lib/alias'
import Email from './lib/email'
import Folder from './lib/folder'
import MessageHandler from './lib/messageHandler'
import Contact from './lib/contact'
import Migrate from './lib/migrate'

import { MainOpts } from './types'
import { StoreSchema } from './schemas'

export = (props: MainOpts) => {
  const { channel, userDataPath, env } = props
  const store: StoreSchema = new Store(env)
  const messageHandler = new MessageHandler(channel, store)

  channel.on('message', (msg: any) => {
    Account({ channel, userDataPath, msg, store })
    Mailbox({ channel, userDataPath, msg, store })
    Alias({ channel, userDataPath, msg, store })
    Email({ channel, userDataPath, msg, store })
    Folder({ channel, userDataPath, msg, store })
    Contact({ channel, userDataPath, msg, store })
    Migrate({ channel, userDataPath, msg, store })
    messageHandler.listen(msg)
  })
}
