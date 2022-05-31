const tape = require('tape')
const _test = require('tape-promise').default
const test = _test(tape)
const path = require('path')
const fs = require('fs')
const Channel = require('./helper')
const { account } = require('@telios/client-sdk/lib/routes')

test('sync account with another device/peer', async t => {
  t.plan(1)

  // Login to Device A
  const channel1 = new Channel(path.join(__dirname, 'Accounts'))
  
  const channel2 = new Channel(path.join(__dirname, 'Accounts2'))

  channel2.send({
    event: 'account:sync',
    payload: {
      driveKey: '0000000000000000000000000000000000000000000000000000000000000000',
      email: 'bob@telios.io',
      password: 'letmein123'
    }
  })

  channel2.on('debug', data => {
    console.log(data)
  })

  channel2.on('account:sync:callback', cb => {
    const { error, data } = cb
    
    if(error) t.fail(error.message)

    console.log('SUCCESS ::', data)

    t.teardown(async () => {
      channel1.kill()
      channel2.kill()
    })
  })
})


// async function cleanup() {
//   if (fs.existsSync(path.join(__dirname, '/Accounts'))) {
//     fs.rmSync(path.join(__dirname, 'Accounts'), { recursive: true })
//   }
// }
