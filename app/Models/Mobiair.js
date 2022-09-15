'use strict'

/** @type {typeof import('@adonisjs/lucid/src/Lucid/Model')} */
const Model = use('Model')

class Mobiair extends Model {
  static get table () {
    return 'mobiair_raw'
  }
}

module.exports = Mobiair
