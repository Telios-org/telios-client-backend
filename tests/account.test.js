const tape = require('tape')
const _test = require('tape-promise').default
const test = _test(tape)
const path = require('path')
const del = require('del')
const fs = require('fs')
const Channel = require('./helper')
const channel = new Channel(path.join(__dirname, 'Drive'))

test('create account', async t => {
  t.plan(3)

  channel.on('drive:networkUpdated', data => {
    const { network } = data
    
    if(network?.drive)
      t.equals(network.drive, true) // Drive is connected to p2p network

    if(network?.internet)
      t.equals(network.internet, true) // Drive is connected to the global internet
  })

  channel.send({
    event: 'account:create', 
    payload: {
      email: 'alice@telios.io',
      password: 'letmein123',
      vcode: 'testcode123',
      recoveryEmail: 'alice@mail.com'
    }
  })

  channel.on('account:create:error', error => {
    console.log(error)
    // t.fail(error)
  })

  channel.on('account:create:success', data => {
    t.ok(data.uid)
  })
})

test.onFinish(async () => {
  await cleanup()
  process.exit(0)
})

async function cleanup() {
  if (fs.existsSync(path.join(__dirname, '/Drive'))) {
    await del([
      path.join(__dirname, '/Drive')
    ])
  }
}