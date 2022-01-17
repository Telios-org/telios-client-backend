const tape = require('tape')
const _test = require('tape-promise').default
const test = _test(tape)
const path = require('path')
const del = require('del')
const fs = require('fs')
const Channel = require('./helper')

test('register new mailbox', async t => {
  t.plan(1)
  let channel

  try {
    channel = await channelInit()
  } catch(err) {
    t.fail(err)
  }

  channel.send({
    event: 'mailbox:register',
    payload: {
      account_key: '0000000000010000000000000001000000000000001000000000000001000000',
      addr: 'alice@telios.io'
    }
  })

  channel.on('mailbox:register:success', data => {
    t.ok(dat, 'Created new mailbox')
  })

  channel.on('mailbox:register:error', error => {
    console.log('ERR', JSON.stringify(error))
    t.fail(error)
  })
})

test('get new mail metadata from api server', async t => {})

test('mark messages as synced', async t => {})

test('get mailboxes', async t => {})

test('save mailbox', async t => {})

test('search mail', async t => {})


async function channelInit() {
  const channel = new Channel(path.join(__dirname, 'Drive'))

  return new Promise((resolve, reject) => {
    channel.send({
      event: 'account:login',
      payload: {
        email: 'alice@telios.io',
        password: 'letmein123'
      }
    })
  
    channel.on('account:login:error', error => {
      reject(error)
    })
  
    channel.on('account:login:success', data => {
      resolve(channel)
    })
  })
}