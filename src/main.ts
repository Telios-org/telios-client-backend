import { Store } from './Store'
import Account from './lib/account'
// import Mailbox from './lib/mailbox'
// import Messages from './lib/messages'
// import Contacts from './lib/contacts'
// import Files from './lib/files'

import { MainOpts } from './types'

export = (props: MainOpts) => {
  const { channel, userDataPath, env } = props
  const store = new Store(env)

  channel.on('message', (msg: any) => {
    Account({ channel, userDataPath, msg, store })
    // Mailbox({ channel, userDataPath, msg, store })
    // Messages({ channel, userDataPath, msg, store })
    // Contacts({ channel, userDataPath, msg, store })
    // Files({ channel, userDataPath, msg, store })
  })
}