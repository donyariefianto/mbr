'use strict'

/*
|--------------------------------------------------------------------------
| Routes
|--------------------------------------------------------------------------
|
| Http routes are entry points to your web application. You can create
| routes for different URL's and bind Controller actions to them.
|
| A complete guide on routing is available here.
| http://adonisjs.com/docs/4.1/routing
|
*/

/** @type {typeof import('@adonisjs/framework/src/Route/Manager')} */
const Route = use('Route')

// Route.on('/').render({data:'a'})

Route.get('/device','AirpointerController.getDevice')
Route.get('/location/:id','AirpointerController.getLocations')
Route.get('/airpointer','AirpointerController.AirpointerData')
Route.get('/mobiair/:id','AirpointerController.getData')
Route.get('rewind/:tgl/:id','AirpointerController.getDataRewind')
Route.post('/pushData','AirpointerController.pushData')
Route.post('/location','AirpointerController.Location')
Route.post('/device','AirpointerController.device')
Route.get('/report/:tgl/:id','AirpointerController.CreateReport')
 Route.post('/simpanGambar','AirpointerController.saveimg')

Route.get('/', ({ response }) => {
  response.redirect('/api', true)
})

Route.get('/api', ({ response }) => {
  return response.json({status: 200,messages:'mobiair server'})
})