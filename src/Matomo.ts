const axios = require('axios')

import { AccountSchema } from './schemas'

export class Matomo {
  private _defaultData: {
    uid: string
    ua: any
    url: string
  }
  private _options: {
    url: string,
    method: string
  }

  private _heartBeatInt: any

  constructor(account: AccountSchema, userAgent: string, env: 'development' | 'production', envAPI: { prod: string, dev: string } ) {
    const requestBase = env === 'production' ? envAPI.prod : envAPI.dev

    this._defaultData = {
      uid: account.uid,
      ua: userAgent,
      url: `http://localhost?env=${env}`
    }

    this._options = {
      url: `${requestBase}/matomo`,
      method: 'post'
    }
  }

  heartBeat(interval: number, refreshToken: any) {
    const payload = {
      ...this._defaultData,
      ping: 1
    }

    this._heartBeatInt = setInterval(async () => {
      try {
        const options = {
          ...this._options,
          headers: {
            'Authorization': `Bearer ${refreshToken()}`,
            'Content-Type': 'application/json'
          },
          data: payload
        }

        await axios(options);
      } catch (err) {
        throw err
      }
    }, interval)
  }

  async event(data: { e_c: string, e_a: string, new_visit: number }, refreshToken: any) {
    const payload = {
      ...this._defaultData,
      ...data
    }

    const options = {
      ...this._options,
      headers: {
        'Authorization': `Bearer ${refreshToken()}`,
        'Content-Type': 'application/json'
      },
      data: payload
    }

    try {
      await axios(options)
    } catch (err) {
      throw err
    }
  }

  kill() {
    clearInterval(this._heartBeatInt)
  }
}
