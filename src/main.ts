import { Store } from './Store'
import Account from './lib/account'
import Mailbox from './lib/mailbox'
import Alias from './lib/alias'
import Email from './lib/email'
import Folder from './lib/folder'
// import Contacts from './lib/contacts'

import { MainOpts } from './types'

export = (props: MainOpts) => {
  const { channel, userDataPath, env } = props
  const store = new Store(env)

  channel.on('message', (msg: any) => {
    Account({ channel, userDataPath, msg, store })
    Mailbox({ channel, userDataPath, msg, store })
    Alias({ channel, userDataPath, msg, store })
    Email({ channel, userDataPath, msg, store })
    Folder({ channel, userDataPath, msg, store })
    // Contacts({ channel, userDataPath, msg, store })
  })
}