'use strict'

/** @type {typeof import('@adonisjs/lucid/src/Lucid/Model')} */
const Model = use('Model')

class Location extends Model {
  static get table () {
    return 'locations'
  }
}

module.exports = Location
