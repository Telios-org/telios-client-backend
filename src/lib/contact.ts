import { ContactModel } from '../models/contact.model'

import { ContactOpts } from '../types'
import { ContactSchema } from '../schemas'
import { UTCtimestamp } from '../util/date.util'

const BSON = require('bson')
const { ObjectID } = BSON

export default async (props: ContactOpts) => {
  const { channel, msg, store } = props 
  const { event, payload } = msg

  /***************************************
   *  CREATE CONTACTS
   **************************************/
  if (event === 'contact:createContacts') {
    const { contactList } = payload
    const Contact = store.models.Contact

    const _contactList = contactList.map((contact: ContactSchema) => {
      if(!contact.contactId) {
        const _id = new ObjectID()
        contact.contactId = _id.toString('hex')
        contact._id = _id
      }

      return contact
    })

    try {
      const upserted = []

      for(let contact of _contactList) {
        contact.createdAt = contact.createdAt || UTCtimestamp
        contact.updatedAt = contact.updatedAt || UTCtimestamp
        const result = await Contact.update({ _id: contact._id }, contact, { upsert: true })
        if(result.nUpserted) upserted.push(contact)
      }

      channel.send({ event: 'contact:createContacts:callback', data: upserted })
    } catch(err: any) {
      channel.send({
        event: 'contact:createContacts:callback',
        error: {
          name: err.name,
          message: err.message,
          stacktrace: err.stack
        } 
      })
    }
  }


  /***************************************
   *  GET CONTACT BY ID
   **************************************/
  if (event === 'contact:getContactById') {
    const { id } = payload
    const Contact = store.models.Contact

    try {
      const contact = await Contact.findOne({ contactId: id })
      channel.send({ event: 'contact:getContactById:callback', data: contact })
    } catch(err: any) {
      channel.send({
        event: 'contact:getContactById:callback',
        error: {
          name: err.name,
          message: err.message,
          stacktrace: err.stack
        } 
      })
    }
  }


  /***************************************
   *  UPDATE CONTACT
   **************************************/
  if (event === 'contact:updateContact') {
    const Contact = store.models.Contact

    if(payload._id) delete payload._id

    try {
      await Contact.update({ contactId: payload.contactId }, payload)
      channel.send({ event: 'contact:updateContact:callback', data: null })
    } catch(err: any) {
      channel.send({
        event: 'contact:updateContact:callback',
        error: {
          name: err.name,
          message: err.message,
          stacktrace: err.stack
        } 
      })
    }
  }


  /***************************************
   *  SEARCH CONTACT
   **************************************/
  if (event === 'contact:searchContact') {
    const { searchQuery } = payload
    const Contact = store.models.Contact

    try {
      const contacts: ContactSchema[] = await Contact.search(searchQuery)
      channel.send({ event: 'contact:searchContact:callback', data: contacts })
    } catch(err: any) {
      channel.send({
        event: 'contact:searchContact:callback',
        error: {
          name: err.name,
          message: err.message,
          stacktrace: err.stack
        } 
      })
    }
  }


  /***************************************
   *  REMOVE CONTACT
   **************************************/
  if (event === 'contact:removeContact') {
    const { id } = payload
    const Contact = store.models.Contact

    try {
      await Contact.remove({ contactId: id })
      channel.send({ event: 'contact:removeContact:callback', data: null })
    } catch(err: any) {
      channel.send({
        event: 'contact:removeContact:callback',
        error: {
          name: err.name,
          message: err.message,
          stacktrace: err.stack
        } 
      })
    }
  }


  /***************************************
   *  GET ALL CONTACTS
   **************************************/
  if (event === 'contact:getAllContacts') {
    const Contact = store.models.Contact

    try {
      const contacts: ContactSchema[] = await Contact.find()
      channel.send({ event: 'contact:getAllContacts:callback', data: contacts })
    } catch(err: any) {
      channel.send({
        event: 'contact:getAllContacts:callback',
        error: {
          name: err.name,
          message: err.message,
          stacktrace: err.stack
        } 
      })
    }
  }
}