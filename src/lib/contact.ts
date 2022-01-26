import { ContactModel } from '../models/contact.model'

import { ContactOpts } from '../types'
import { ContactSchema } from '../schemas'

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
    const Contact = new ContactModel(store)
    await Contact.ready()

    const _contactList = contactList.map((contact: ContactSchema) => {
      if(!contact.contactId) {
        const _id = new ObjectID()
        contact.contactId = _id.toString('hex')
        contact._id = _id
      }

      if(contact.givenName || contact.familyName) {
        contact.name = `${contact.givenName} ${contact.familyName}` 
      } else {
        contact.name = ''
      }

      return contact
    })

    try {
      const upserted = []

      for(let contact of _contactList) {
        contact.createdAt = contact.createdAt || new Date().toISOString()
        contact.updatedAt = contact.updatedAt || new Date().toISOString()
        const result = await Contact.update({ _id: contact._id }, contact, { upsert: true })
        if(result.nUpserted) upserted.push(contact)
      }

      channel.send({ event: 'contact:createContacts:success', data: upserted })
    } catch(e: any) {
      channel.send({
        event: 'contact:createContacts:error',
        error: {
          name: e.name,
          message: e.message,
          stacktrace: e.stack
        } 
      })
    }
  }


  /***************************************
   *  GET CONTACT BY ID
   **************************************/
  if (event === 'contact:getContactById') {
    const { id } = payload
    const contactModel = new ContactModel(store)
    const Contact = await contactModel.ready()

    try {
      const contact = await Contact.findOne({ contactId: id })
      channel.send({ event: 'contact:getContactById:success', data: contact })
    } catch(e: any) {
      channel.send({
        event: 'contact:getContactById:error',
        error: {
          name: e.name,
          message: e.message,
          stacktrace: e.stack
        } 
      })
    }
  }


  /***************************************
   *  UPDATE CONTACT
   **************************************/
  if (event === 'contact:updateContact') {
    const Contact = new ContactModel(store)
    await Contact.ready()

    if(payload._id) delete payload._id

    try {
      await Contact.update({ contactId: payload.contactId }, payload)
      channel.send({ event: 'contact:updateContact:success', data: null })
    } catch(e: any) {
      channel.send({
        event: 'contact:updateContact:error',
        error: {
          name: e.name,
          message: e.message,
          stacktrace: e.stack
        } 
      })
    }
  }


  /***************************************
   *  SEARCH CONTACT
   **************************************/
  if (event === 'contact:searchContact') {
    const { searchQuery } = payload
    const contactModel = new ContactModel(store)
    const Contact = await contactModel.ready()

    try {
      const contacts: ContactSchema[] = await Contact.search(searchQuery)
      channel.send({ event: 'contact:searchContact:success', data: contacts })
    } catch(e: any) {
      channel.send({
        event: 'contact:searchContact:error',
        error: {
          name: e.name,
          message: e.message,
          stacktrace: e.stack
        } 
      })
    }
  }


  /***************************************
   *  REMOVE CONTACT
   **************************************/
  if (event === 'contact:removeContact') {
    const { id } = payload
    const Contact = new ContactModel(store)
    await Contact.ready()

    try {
      await Contact.remove({ contactId: id })
      channel.send({ event: 'contact:removeContact:success', data: null })
    } catch(e: any) {
      channel.send({
        event: 'contact:removeContact:error',
        error: {
          name: e.name,
          message: e.message,
          stacktrace: e.stack
        } 
      })
    }
  }


  /***************************************
   *  GET ALL CONTACTS
   **************************************/
  if (event === 'contact:getAllContacts') {
    const contactModel = new ContactModel(store)
    const Contact = await contactModel.ready()

    try {
      const contacts: ContactSchema[] = await Contact.find()
      channel.send({ event: 'contact:getAllContacts:success', data: contacts })
    } catch(e: any) {
      channel.send({
        event: 'contact:getAllContacts:error',
        error: {
          name: e.name,
          message: e.message,
          stacktrace: e.stack
        } 
      })
    }
  }
}