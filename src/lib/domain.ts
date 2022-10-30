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
      
      const res = await Domain.register(payload)

      const doc = { 
        name: payload.domain,
        active: false,
        dns: {
          vcode: {
            type: res.verification.type,
            name: res.verification.name,
            value: res.verification.value,
            verified: false
          }
        },
        createdAt: UTCtimestamp(),
        updatedAt: UTCtimestamp()
      }

      const domain: DomainSchema = await domainModel.insert(doc)
      
      channel.send({ event: 'domain:register:callback', data: domain })
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
      const res = await Domain.delete(payload)
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
      const domain: DomainSchema = await domainModel.findOne({ name: payload.domain})

      // If verified, then update domain record
      if(res.verified) {

        if(domain.dns.vcode)
          domain.dns.vcode.verified = true

        await domainModel.update({ 
          name: payload.domain 
        }, 
        { 
          dns: domain.dns,
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
      const domain: DomainSchema = await domainModel.findOne({ name: payload.domain }) 
      const dns = await Domain.verifyDNS(payload.domain)

      if(!domain.active) {
        await domainModel.update({ 
          name: payload.domain 
        }, 
        { 
          dns: {
            vcode: domain.dns.vcode,
            mx: dns.mx,
            spf: dns.spf,
            dkim: dns.dkim,
            dmarc: dns.dmarc
          },
          active: dns.mx.verified && dns.spf.verified && dns.dkim.verified && dns.dmarc.verified,
          updatedAt: UTCtimestamp() 
        })
      }

      channel.send({ event: 'domain:verifyDNS:callback', data: dns })
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