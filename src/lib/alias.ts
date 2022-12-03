const Crypto = require('@telios/nebula/lib/crypto')

import { AliasOpts } from '../types'
import {
  AccountSchema, 
  AliasSchema, 
  AliasNamespaceSchema } from '../schemas'
import { UTCtimestamp } from '../util/date.util'

export default async (props: AliasOpts) => {
  const { channel, msg, store } = props 
  const { event, payload } = msg

  const Mailbox = store.sdk.mailbox

  /*************************************************
   *  REGISTER ALIAS NAMESPACE
   ************************************************/
  if (event === 'alias:registerAliasNamespace') {
    try {
      const { mailboxId, namespace } = payload

      const AliasNamespace = store.models.AliasNamespace

      const account: AccountSchema = store.getAccount()

      const keypair = Crypto.boxKeypairFromStr(`${account.secretBoxPrivKey}${namespace}@${store.domain.mail}`)

      const { registered, key } = await Mailbox.registerAliasName({
        alias_name: namespace,
        domain: store.domain.mail,
        key: keypair.publicKey
      })

      const output = await AliasNamespace.insert({
        name: namespace,
        publicKey: key,
        privateKey: keypair.privateKey,
        mailboxId,
        domain: store.domain.mail,
        disabled: false,
        createdAt: UTCtimestamp(),
        updatedAt: UTCtimestamp(),
      })

      store.setKeypair(keypair)

      channel.send({
        event: 'alias:registerAliasNamespace:callback',
        data: output
      })
    } catch(err:any) {
      channel.send({
        event: 'alias:registerAliasNamespace:callback',
        error: {
          name: err.name,
          message: err.message,
          stacktrace: err.stack
        }
      })
    }
  }



  /*************************************************
   *  GET MAILBOX NAMESPACES
   ************************************************/
  if (event === 'alias:getMailboxNamespaces') {
    try {
      const AliasNamespace = store.models.AliasNamespace.collection

      const namespaces: AliasNamespaceSchema[] = await AliasNamespace.find({ mailboxId: payload.id }).sort('name', 1)

      channel.send({
        event: 'alias:getMailboxNamespaces:callback',
        data: namespaces
      })
    } catch(err:any) {
      channel.send({
        event: 'alias:getMailboxNamespaces:callback',
        error: {
          name: err.name,
          message: err.message,
          stacktrace: err.stack
        }
      })
    }
  }


  /*************************************************
   *  REGISTER ALIAS ADDRESS
   ************************************************/
   if (event === 'alias:registerAliasAddress') {
    const {
      namespaceName,
      domain,
      address,
      description,
      fwdAddresses,
      disabled,
      createdAt,
      updatedAt
    } = payload

    try {
      let aliasAddress
      let aliasId
      let keypair

      const Alias = store.models.Alias
      const account: AccountSchema = store.getAccount()

      if(namespaceName) {
        aliasAddress = `${namespaceName}#${address}@${domain}`;
        aliasId = `${namespaceName}#${address}`
      } else {
        keypair = Crypto.boxKeypairFromStr(`${account.secretBoxPrivKey}${address}@${store.domain.mail}`)

        store.setKeypair(keypair)

        aliasAddress = `${address}@${domain}`;
        aliasId = address
      }
    

      const { registered } = await Mailbox.registerAliasAddress({
        alias_address: aliasAddress,
        forwards_to: fwdAddresses,
        whitelisted: true,
        key: keypair ? keypair.publicKey : null,
        disabled
      })

      const output = await Alias.insert({
        aliasId: aliasId,
        name: address,
        namespaceKey: namespaceName,
        count: 0,
        description,
        fwdAddresses: fwdAddresses.length > 0 ? fwdAddresses.join(',') : null,
        disabled,
        publicKey: keypair ? keypair.publicKey : null,
        privateKey: keypair ? keypair.privateKey : null,
        whitelisted: true,
        createdAt: createdAt || UTCtimestamp(),
        updatedAt: updatedAt || UTCtimestamp()
      })

      channel.send({
        event: 'alias:registerAliasAddress:callback',
        data: { ...output, fwdAddresses }
      })
    } catch(err:any) {
      channel.send({
        event: 'alias:registerAliasAddress:callback',
        error: {
          name: err.name,
          message: err.message,
          stacktrace: err.stack
        }
      })
    }
  }



  /*************************************************
   *  GET ALIAS ADDRESS
   ************************************************/
  if (event === 'alias:getMailboxAliases') {
    try {
      const Alias = store.models.Alias.collection
      let aliases

      if(payload.namespaceKeys && payload.namespaceKeys.length) {
        aliases = await Alias.find({ namespaceKey: { $in: [...payload.namespaceKeys] }}).sort('createdAt', -1)
      } else if(payload.namespaceKeys && payload.namespaceKeys.length === 0) {
        aliases = await Alias.find({ namespaceKey: { $in: [null] }}).sort('createdAt', -1)
      } else {
        aliases = await Alias.find().sort('createdAt', -1)
      }

      const outputAliases = aliases.map((a: AliasSchema) => {
        store.setFolderCount(a.aliasId, a.count)
        return {
          ...a,
          fwdAddresses:
            (a.fwdAddresses && a.fwdAddresses.length) > 0
              ? a.fwdAddresses.split(',')
              : []
        }
      })

      channel.send({
        event: 'alias:getMailboxAliases:callback',
        data: outputAliases
      })
    } catch(err:any) {
      channel.send({
        event: 'alias:getMailboxAliases:callback',
        error: {
          name: err.name,
          message: err.message,
          stacktrace: err.stack
        }
      })
    }
  }



  /*************************************************
   *  UPDATE ALIAS ADDRESS
   ************************************************/
  if (event === 'alias:updateAliasAddress') {
    const {
      namespaceName,
      domain,
      address,
      description,
      fwdAddresses,
      disabled
    } = payload

    try {
      const Alias = store.models.Alias

      await Mailbox.updateAliasAddress({
        alias_address: `${namespaceName}#${address}@${domain}`,
        forwards_to: fwdAddresses,
        whitelisted: true,
        disabled
      })

      const output = await Alias.update(
        { name: address },
        {
          fwdAddresses:
            fwdAddresses.length > 0 ? fwdAddresses.join(',') : null,
          description,
          disabled
        }
      )

      channel.send({
        event: 'alias:updateAliasAddress:callback',
        data: output
      })
    } catch(err:any) {
      channel.send({
        event: 'alias:updateAliasAddress:callback',
        error: {
          name: err.name,
          message: err.message,
          stacktrace: err.stack
        }
      })
    }
  }



  /*************************************************
   *  REMOVE ALIAS ADDRESS
   ************************************************/
  if (event === 'alias:removeAliasAddress') {
    const { namespaceName, domain, address } = payload

    try {
      const Alias = store.models.Alias

      if(namespaceName) {
        await Mailbox.removeAliasAddress(`${namespaceName}#${address}@${domain}`)
        await Alias.remove({ aliasId: `${namespaceName}#${address}` })
      } else {
        await Mailbox.removeAliasAddress(`${address}@${domain}`)
        await Alias.remove({ aliasId: `${address}` })
      }

      channel.send({ event: 'alias:removeAliasAddress:callback', data: null })
    } catch(err:any) {
      channel.send({
        event: 'alias:removeAliasAddress:callback',
        error: {
          name: err.name,
          message: err.message,
          stacktrace: err.stack
        }
      })
    }
  }

    /*************************************************
   *  UPDATE ALIAS COUNT
   ************************************************/
     if (event === 'alias:updateAliasCount') {
      const { id, amount } = payload
  
      try {
        const Alias = store.models.Alias

        const currCount = store.getFolderCount(id)
        await Alias.update({ aliasId: id }, { count: currCount + amount })
        store.setFolderCount(id, currCount + amount)
        
        channel.send({ event: 'alias:updateAliasCount:callback', updated: true })
      } catch(err:any) {
        channel.send({
          event: 'alias:updateAliasCount:callback',
          error: {
            name: err.name,
            message: err.message,
            stacktrace: err.stack
          }
        })
      }
    }

}