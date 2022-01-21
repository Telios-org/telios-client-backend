import { AliasModel } from '../models/alias.model'
import { AliasNamespaceModel } from '../models/aliasNamespace.model'

import { AliasOpts } from '../types'
import {
  AccountSchema, 
  AliasSchema, 
  AliasNamespaceSchema } from '../schemas'

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

      const Crypto = store.sdk.crypto
      const aliasNamespaceModel = new AliasNamespaceModel(store)
      const AliasNamespace = await aliasNamespaceModel.ready()

      const account: AccountSchema = store.getAccount()

      const keypair = Crypto.boxKeypairFromStr(`${account.secretBoxPrivKey}${namespace}@${store.domain.mail}`)

      const { registered, key } = await Mailbox.registerAliasName({
        alias_name: namespace,
        domain: store.domain.mail,
        key: keypair.publicKey
      });

      const output = await AliasNamespace.insert({
        publicKey: key,
        privateKey: keypair.privateKey,
        name: namespace,
        mailboxId,
        domain: store.domain.mail,
        disabled: false
      })

      store.setKeypair(keypair);

      channel.send({
        event: 'alias:registerAliasNamespace:success',
        data: output
      })
    } catch(e: any) {
      channel.send({
        event: 'alias:registerAliasNamespace:error',
        error: {
          name: e.name,
          message: e.message,
          stacktrace: e.stack
        }
      })
    }
  }



  /*************************************************
   *  GET MAILBOX NAMESPACES
   ************************************************/
  if (event === 'alias:getMailboxNamespaces') {
    try {
      const aliasNamespaceModel = new AliasNamespaceModel(store)
      const AliasNamespace = await aliasNamespaceModel.ready()

      const namespaces: AliasNamespaceSchema[] = await AliasNamespace.find({ mailboxId: payload.id }).sort('name', 1)

      for (const namespace of namespaces) {
        const keypair = {
          publicKey: namespace.publicKey,
          privateKey: namespace.privateKey
        };

        store.setKeypair(keypair)
      }

      channel.send({
        event: 'alias:getMailboxNamespaces:success',
        data: namespaces
      });
    } catch(e: any) {
      channel.send({
        event: 'alias:getMailboxNamespaces:error',
        error: {
          name: e.name,
          message: e.message,
          stacktrace: e.stack
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
      const aliasModel = new AliasModel(store)
      const Alias = await aliasModel.ready()

      const { registered } = await Mailbox.registerAliasAddress({
        alias_address: `${namespaceName}#${address}@${domain}`,
        forwards_to: fwdAddresses,
        whitelisted: true,
        disabled
      });

      const output = await Alias.insert({
        aliasId: `${namespaceName}#${address}`,
        name: address,
        namespaceKey: namespaceName,
        count: 0,
        description,
        fwdAddresses: fwdAddresses.length > 0 ? fwdAddresses.join(',') : null,
        disabled,
        whitelisted: 1,
        createdAt,
        updatedAt
      })

      channel.send({
        event: 'alias:registerAliasAddress:success',
        data: { ...output, fwdAddresses }
      })
    } catch(e: any) {
      channel.send({
        event: 'alias:registerAliasAddress:error',
        error: {
          name: e.name,
          message: e.message,
          stacktrace: e.stack
        }
      })
    }
  }



  /*************************************************
   *  GET ALIAS ADDRESS
   ************************************************/
  if (event === 'alias:getMailboxAliases') {
    try {
      const aliasModel = new AliasModel(store)
      const Alias = await aliasModel.ready()

      const aliases = await Alias.find({ 
        namespaceKey: { 
          $in: payload.namespaceKeys 
        } 
      }).sort('createdAt', -1)

      const outputAliases = aliases.map((a: AliasSchema) => {
        return {
          ...a,
          fwdAddresses:
            (a.fwdAddresses && a.fwdAddresses.length) > 0
              ? a.fwdAddresses.split(',')
              : [],
          createdAt: new Date(a.createdAt)
        }
      })

      channel.send({
        event: 'alias:getMailboxAliases:success',
        data: outputAliases
      })
    } catch(e: any) {
      channel.send({
        event: 'alias:getMailboxAliases:error',
        error: {
          name: e.name,
          message: e.message,
          stacktrace: e.stack
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
      const aliasModel = new AliasModel(store)
      const Alias = await aliasModel.ready()

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
        event: 'alias:updateAliasAddress:success',
        data: output
      })
    } catch(e: any) {
      channel.send({
        event: 'alias:updateAliasAddress:error',
        error: {
          name: e.name,
          message: e.message,
          stacktrace: e.stack
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
      const aliasModel = new AliasModel(store)
      const Alias = await aliasModel.ready()

      await Mailbox.removeAliasAddress(`${namespaceName}#${address}@${domain}`)
      await Alias.remove({ aliasId: `${namespaceName}#${address}` })

      channel.send({ event: 'alias:removeAliasAddress:success', data: null })
    } catch(e: any) {
      channel.send({
        event: 'alias:removeAliasAddress:error',
        error: {
          name: e.name,
          message: e.message,
          stacktrace: e.stack
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
      const aliasModel = new AliasModel(store)
      const Alias = await aliasModel.ready()

      await Alias.update({ aliasId: id }, { $inc: { count: amount } })

      channel.send({ event: 'alias:updateAliasCount:success', updated: true })
    } catch(e: any) {
      channel.send({
        event: 'alias:updateAliasCount:error',
        error: {
          name: e.name,
          message: e.message,
          stacktrace: e.stack
        }
      })
    }
  }
}