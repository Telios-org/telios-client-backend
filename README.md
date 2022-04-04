# telios-backend

![Build Status](https://github.com/Telios-org/telios-client-backend/actions/workflows/node.js.yml/badge.svg)

A reusable backend to for telios email clients to use between desktop and mobile.

## Installation

```shell
npm i --save @telios/telios-client-backend
```

## Usage

Electron example:
```js
const path = require('path')
const fs = require('fs')
const { fork } = require('child_process')
const { remote } = require('electron')
const userDataPath = remote.app.getPath('userData')
const filePath = path.join(__dirname, '/node_modules/telios-client-backend/index.js')

let cwd = path.join(__dirname, '..');

if (!fs.existsSync(path.join(cwd, 'app.asar'))) {
  cwd = null;
}

const child = fork(filePath, [userDataPath, 'development'], {
  stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
  cwd
})

// listen for channel events
child.on('message', m => {
  const { event } = m
  
  this.emit(event, m)
})

child.stderr.on('error', data => {
  this.emit('error', data.toString())
})

// Send channel events
child.send({ 
  event: 'account:create', 
  payload: {
    email: 'alice@telios.io',
    password: 'letmein123',
    vcode: 'btester1',
    recoveryEmail: 'alice@mail.com'
  }
})

```

Mobile example:

```js
const bridge = require('rn-bridge')
const { ClientBackend } = require('@telios/telios-client-backend');

const channel = bridge.channel

const userDataPath = bridge.app.datadir()
const env = 'development'

// Instantiate backend
ClientBackend(channel, userDataPath, env)

channel.send({ 
  event: 'account:create', 
  payload: {
    email: 'alice@telios.io',
    password: 'letmein123',
    vcode: 'btester1',
    recoveryEmail: 'alice@mail.com'
  }
})

channel.on('account:create:callback', cb => {
  const { error, data } = cb
})

```

## Drive API

#### `channel.on('drive:network:updated', data => {})`

#### `channel.on('drive:peer:updated', data => {})`

Returns the following peer info:

```js
  {
    peerKey: '00000000000000000000000000000000',
    status: 'ONLINE' | 'OFFLINE' | 'BUSY',  'AWAY',
    server: true | false
  }
```

## Account API

#### `channel.send({ event: 'account:create', payload })`
```js
const payload = {
  email: 'alice@telios.io',
  password: 'letmein123',
  vcode: 'testcode123',
  recoveryEmail: 'alice@mail.com'
}
```

#### `channel.send({ event: 'account:login', payload })`
```js
const payload = {
  email: 'alice@telios.io',
  password: 'letmein123'
}
```

#### `channel.send({ event: 'account:resetPassword', payload })`
```js
const payload = {
  passphrase: 'hub edit torch trust silent absorb news process pioneer category arrive prevent scrub senior cruise love wire elder field parent device physical warm clutch',
  email: 'bob@telios.io',
  newPass: 'letmein999',
}
```

#### `channel.send({ event: 'account:authorized', payload })`

#### `channel.send({ event: 'account:update', payload })`

#### `channel.send({ event: 'account:retrieveStats' })`

#### `channel.send({ event: 'account:logout' })`

#### `channel.send({ event: 'account:refreshToken' })`

## Mailbox API

#### `channel.send({ event: 'mailbox:register', payload })`
```js
const payload = {
  account_key,
  addr: 'alice@telios.io'
}
```

#### `channel.send({ event: 'mailbox:getNewMailMeta' })`

#### `channel.send({ event: 'mailbox:markArrayAsSynced', payload })`
```js
const payload = {
  msgArray: ['emailId1', 'emailId2']
}
```

#### `channel.send({ event: 'mailbox:getMailboxes' })`

#### `channel.send({ event: 'mailbox:saveMailbox', payload })`
```js
const payload = {
  address: 'bob@telios.io'
}
```

## Alias API

#### `channel.send({ event: 'alias:registerAliasNamespace', payload })`
```js
const payload = {
  mailboxId: mailboxId,
  namespace: 'alice2022'
}
```

#### `channel.send({ event: 'alias:getMailboxNamespaces', payload })`
```js
const payload = { 
  id: mailboxId 
} 
```

#### `channel.send({ event: 'alias:getMailboxAliases', payload })`
```js
const payload = {
  namespaceKeys: ['alice2022']
}
```

#### `channel.send({ event: 'alias:updateAliasAddress', payload })`
```js
const payload = {
  namespaceName: 'alice2022',
  domain: 'dev,telios.io',
  address: 'netflix',
  description: 'Updated description',
  fwdAddresses: ['alice@mail.com', 'alice@somemail.com'],
  disabled: true,
  updatedAt: UTCTimestamp
}
```

#### `channel.send({ event: 'alias:updateAliasCount', payload })`
```js
const payload = { 
  id: 'alice2022#netflix' , 
  amount: 1 // Use a negative integer to decrement count
}
```

#### `channel.send({ event: 'alias:removeAliasAddress', payload })`
```js
const payload = {
  namespaceName: 'alice2022',
  domain: 'dev,telios.io',
  address: 'netflix'
}
```

## Folder API

#### `channel.send({ event: 'folder:createFolder', payload })`
```js
const payload = {
  mailboxId: mailboxId,
  folderId: 6,
  name: 'Test',
  type: 'default',
  icon: 'trash-o',
  seq: 6,
  createdAt: UTCTimestamp,
  updatedAt: UTCTimestamp
}
```

#### `channel.send({ event: 'folder:updateFolder', payload })`
```js
const payload = {
  folderId: 6,
  name: 'Foo Folder'
}
```

#### `channel.send({ event: 'folder:updateFolderCount', payload })`
```js
const payload = {
  id: 6,
  amount: 1 // use a negative integer to decrement count
}
```

#### `channel.send({ event: 'folder:getMailboxFolders', payload })`
```js
const payload = { 
  id: mailboxId 
}
```

#### `channel.send({ event: 'folder:deleteFolder', payload })`
```js
const payload = { 
  id: mailboxId 
}
```

## Email API

#### `channel.send({ event: 'email:sendEmail', payload })`
```js
const payload = { 
  email: {
    from: [{"name":"Bob Kinderly","address":"bob@telios.io"}],
    to: [{"name":"Alice Drumpf","address":"alice@telios.io"}],
    subject: 'Subject-d510aa65-40c0-4b36-98ba-84735aa961d0',
    date: '2022-01-20T18:21:33.062Z',
    cc: [{"name":"Json Waterfall","address":"jwaterfall@telios.io"}],
    bcc: [{"name":"Albus Dumbeldore","address":"albus.dumbeldore@howgwarts.edu"}],
    bodyAsText: 'This is a test message-d510aa65-40c0-4b36-98ba-84735aa961d0',
    bodyAsHTML: '<div>This is a test message-d510aa65-40c0-4b36-98ba-84735aa961d0</div>',
    attachments: [{
      filename: 'image.png',
      content: 'b64EncodedString',
      mimetype: 'image/png',
      size: 1024// bytes
    }]
  } 
}
```

#### `channel.send({ event: 'email:saveMessageToDB', payload })`
```js
const payload = {
  type: 'Incoming' | 'Draft',
  messages: [{
    from: [{"name":"Bob Kinderly","address":"bob@telios.io"}],
    to: [{"name":"Alice Drumpf","address":"alice@telios.io"}],
    subject: 'Subject-d510aa65-40c0-4b36-98ba-84735aa961d0',
    date: '2022-01-20T18:21:33.062Z',
    cc: [{"name":"Json Waterfall","address":"jwaterfall@telios.io"}],
    bcc: [{"name":"Albus Dumbeldore","address":"albus.dumbeldore@howgwarts.edu"}],
    bodyAsText: 'This is a test message-d510aa65-40c0-4b36-98ba-84735aa961d0',
    bodyAsHTML: '<div>This is a test message-d510aa65-40c0-4b36-98ba-84735aa961d0</div>',
    attachments: [{
      filename: 'image.png',
      content: 'b64EncodedString',
      mimetype: 'image/png',
      size: 1024// bytes
    }]
  }] 
}
```

#### `channel.send({ event: 'email:getMessagesByFolderId', payload })`
```js
const payload = {
  id: 5 
}
```

#### `channel.send({ event: 'email:getMessagesByAliasId', payload })`
```js
const payload = {
  id: 'alice2022#existing' 
}
```

#### `channel.send({ event: 'email:moveMessages', payload })`
```js
const emails = emailArr.map(msg => {
  return {
    ...msg,
    folder: { // Add this object to each email with the ID of the folder the email is moving to
      toId: 1
    }
  }
})

  const payload = {
    messages: emails
  }
```

#### `channel.send({ event: 'email:getMessageById', payload })`
```js
const payload = {
  id: emailId 
}
```

#### `channel.send({ event: 'email:markAsUnread', payload })`
```js
const payload = {
  id: emailId 
}
```

#### `channel.send({ event: 'email:removeMessages', payload })`
```js
const payload = {
  messageIds: [emailId]
}
```

#### `channel.send({ event: 'email:searchMailbox', payload })`
```js
const payload = {
  searchQuery: 'Alice tax returns'
}
```

## Contacts API
#### `channel.send({ event: 'contact:createContacts', payload })`
```js
const payload = {
    contactList: [{
      name: 'Albus Dumbeldore',
      givenName: 'Albus',
      familyName: 'Dumbeldore',
      nickname: 'Dumbeldorf',
      birthday: '2022-01-21T20:31:46.726Z', // ISO datetime
      publicKey: '00000000000000000000000000000000',
      pgpPublicKey: '00000000000000000000000000000000',
      email: 'albus.dumbeldore@hogwarts.edu',
      phone: '555-555-5555',
      address: '123 Any St.',
      website: 'https://hogwarts.edu',
      notes: 'Lorem ipsum dolar sit amet...',
      organization: [ { name: 'Hogwarts Inc' } ]
    }]
  }
```

#### `channel.send({ event: 'contact:getContactById', payload })`
```js
const payload = {
  id: contact.contactId
}
```

#### `channel.send({ event: 'contact:updateContact', payload })`
```js
const payload = {
  ...contact,
  id: contact.contactId,
  givenName: 'Snape'
}
```

#### `channel.send({ event: 'contact:searchContact', payload })`
```js
const payload = {
  searchQuery: 'albus'
}
```

#### `channel.send({ event: 'contact:getAllContacts' })`

#### `channel.send({ event: 'contact:removeContact', payload })`
```js
const payload = {
  id: contact.contactId
}
```

## Messages Handler API
#### `channel.send({ event: 'messageHandler:initMessageListener' })`
#### `channel.send({ event: 'messageHandler:newMessageBatch', payload })`
#### `channel.send({ event: 'messageHandler:newMessage', payload })`
#### `channel.send({ event: 'messageHandler:retryMessageBatch', payload })`
