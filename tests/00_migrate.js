const tape = require('tape')
const _test = require('tape-promise').default
const test = _test(tape)
const path = require('path')
const Channel = require('./helper')

test('migrate old account', async t => {
  t.plan(1)
  
  const channel = new Channel(path.join(__dirname, 'Migrate'))

  channel.on('debug', data => {
    console.log('DEBUG', data)
  })

  channel.send({
    event: 'account:login',
    payload: {
      email: '',
      password: ''
    }
  })

  channel.on('account:login:callback', cb => {
    const { error, data } = cb
    if(error) {
      
      t.fail(error.message)
      channel.kill()
    }

    t.equals('2.0', data.deviceInfo.driveVersion)
  })
})