import { DomainOpts } from '../types'
import { DomainSchema } from '../schemas'
import { UTCtimestamp } from '../util/date.util'

export default async (props: DomainOpts) => {
  const { channel, msg, store } = props 
  const { event, payload } = msg

  const Domain = store.sdk.domain

  /***************************************
   *  CHECK IF DOMAIN IS AVAILABLE
   **************************************/
   if (event === 'domain:isAvailable') {
    try {
      const bool = await Domain.isAvailable(payload.domain)
      channel.send({ event: 'domain:isAvailable:callback', data: bool })
    } catch(err: any) {
      channel.send({
        event: 'domain:isAvailable:callback',
        error: {
          name: err.name,
          message: err.message,
          stacktrace: err.stack
        }
      })
    }
  }
  
  /***************************************
   *  REGISTER CUSTOM DOMAIN
   **************************************/
  if (event === 'domain:register') {
    try {
      const domainModel = store.models.Domain
      
      const res = await Domain.register(payload.domain)

      const domain: DomainSchema = await domainModel.insert({ 
        name: payload.domain,
        createdAt: UTCtimestamp(),
        updatedAt: UTCtimestamp()
      })
      
      channel.send({ event: 'domain:register:callback', data: res })
    } catch(err: any) {
      channel.send({
        event: 'domain:register:callback',
        error: {
          name: err.name,
          message: err.message,
          stacktrace: err.stack
        }
      })
    }
  }

  /***************************************
   *  DELETE CUSTOM DOMAIN
   **************************************/
  if (event === 'domain:delete') {
    try {
      const domainModel = store.models.Domain
      const res = await Domain.delete(payload.domain)
      await domainModel.remove({ name: payload.domain })
      channel.send({ event: 'domain:delete:callback', data: res })
    } catch(err: any) {
      channel.send({
        event: 'domain:delete:callback',
        error: {
          name: err.name,
          message: err.message,
          stacktrace: err.stack
        }
      })
    }
  }

  /***************************************
   *  GET DOMAIN BY NAME
   **************************************/
  if (event === 'domain:getDomainByName') {
    try {
      const domainModel = store.models.Domain
      const domain = await domainModel.findOne({ name: payload.name })
      channel.send({ event: 'domain:getDomainByName:callback', data: domain })
    } catch(err: any) {
      channel.send({
        event: 'domain:getDomainByName:callback',
        error: {
          name: err.name,
          message: err.message,
          stacktrace: err.stack
        }
      })
    }
  }

  /***************************************
   *  GET ALL DOMAINS
   **************************************/
  if (event === 'domain:getDomains') {
    try {
      const domainModel = store.models.Domain
      const domains = await domainModel.find()
      channel.send({ event: 'domain:getDomains:callback', data: domains })
    } catch(err: any) {
      channel.send({
        event: 'domain:getDomains:callback',
        error: {
          name: err.name,
          message: err.message,
          stacktrace: err.stack
        }
      })
    }
  }

  /***************************************
   *  VERIFY DOMAIN OWNERSHIP
   **************************************/
  if (event === 'domain:verifyOwnership') {
    try {
      const domainModel = store.models.Domain
      const res = await Domain.verifyOwnership(payload.domain)

      // If verified, then update domain record
      if(res.verified) {
        await domainModel.update({ 
          name: payload.domain 
        }, 
        { 
          verified: true,
          updatedAt: UTCtimestamp() 
        })
      }

      channel.send({ event: 'domain:verifyOwnership:callback', data: res })
    } catch(err: any) {
      channel.send({
        event: 'domain:verifyOwnership:callback',
        error: {
          name: err.name,
          message: err.message,
          stacktrace: err.stack
        }
      })
    }
  }

  /***************************************
   *  VERIFY DOMAIN DNS SETTINGS
   **************************************/
  if (event === 'domain:verifyDNS') {
    const domainModel = store.models.Domain

    try {
      const records = await Domain.verifyDNS(payload.domain)
      let MXVerified = false
      let SPFVerified = false
      let DKIMVerified = false
      let DMARCVerified = false
      let dkim = {
        value: ""
      }

      for(const record of records) {
        if(record.type === 'MX' && record.verified) {
          MXVerified = true
        }
  
        if(record.type === 'TXT' && record.value.indexOf('spf') > -1 && record.verified) {
          SPFVerified = true
        }
  
        if(record.type === 'TXT' && record.name.indexOf('dkim') > -1 && record.verified) {
          DKIMVerified = true
          dkim.value = record.value
        }
  
        if(record.type === 'TXT' && record.name.indexOf('_dmarc') > -1 && record.verified) {
          DMARCVerified = true
        }
      }

      if(MXVerified && SPFVerified && DKIMVerified && DMARCVerified) {
        await domainModel.update({ 
          name: payload.domain 
        }, 
        { 
          active: true, 
          dkim: dkim.value, 
          updatedAt: UTCtimestamp() 
        })
      }

      channel.send({ event: 'domain:verifyDNS:callback', data: records })
    } catch(err: any) {
      channel.send({
        event: 'domain:verifyDNS:callback',
        error: {
          name: err.name,
          message: err.message,
          stacktrace: err.stack
        }
      })
    }
  }

  /***************************************
   *  REGISTER NEW DOMAIN MAILBOX
   **************************************/
  if (event === 'domain:registerMailbox') {
  }

    /***************************************
   *  UPDATE DOMAIN MAILBOX
   **************************************/
  if (event === 'domain:updateMailbox') {
  }

  /***************************************
   *  DELETE DOMAIN MAILBOX
   **************************************/
  if (event === 'domain:deleteMailbox') {
  }
}