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
  const { event, data, error } = m

  if(error) this.emit(event, error)
  
  this.emit(event, data)
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
const { ClientBackend } = require('telios-client-backend')
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

channel.on('account:create:error', error => {
  // handle error
})

channel.on('account:create:success', data => {
  // handle success
})
```

### Drive API
#### `channel.on('drive:network:updated', data => {})`

### Account API
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

#### `channel.send({ event: 'account:logout' })`

### Mailbox API
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

### Email API

### Contacts API

### Folder API
