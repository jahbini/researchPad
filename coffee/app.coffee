# # stagapp
# vim: et:ts=2:sw=2:sts=2
# ## data handler for clinical recording of SensorTag data
# SensorTag object.

Backbone = require ('backbone')
_ = require('underscore')
require('../libs/dbg/console')
Backbone.$ = $ = require('jquery')

PylonTemplate = Backbone.Model.extend
    scan: false
Pylon = new PylonTemplate
if window? then window.Pylon = window.exports = Pylon
if module?.exports? then module.exports = Pylon

pages = require './pages.coffee'


# Host we communicate with
mainHost =
  iP: "192.168.1.200"
  port: 3000
  protocol: "http"

###
Section: Data Structures
 Routines to create and handle data structures and interfaces to them
###

systemCommunicator = Backbone.Model.extend
  defaults:
    calibrating: false
    recording: false
    connected: false
    calibrate: false
    loggedIn:  false

globalState = new systemCommunicator


clinicModel = Backbone.Model.extend()

clinicCollection = Backbone.Collection.extend
  model: clinicModel
  url: 'http://192.168.1.200:3000/clinics'

clinics = new clinicCollection
Pylon.set('clinics',clinics)


clinicianModel = Backbone.Model.extend
  defaults:
    name: 'Text'
    password: 'Password'
clinicianCollection = Backbone.Collection.extend
  model: clinicianModel
  url: '/users'
clinicians = new clinicianCollection
Pylon.set('clinicians',clinicians)


clientModel = Backbone.Model.extend
  defaults:
    name: 'Text'
    patientOnly: 'Boolean'
clientCollection = Backbone.Collection.extend
  model: clientModel
  url: '/users'
clients = new clientCollection
Pylon.set('clients',clients)

test = Backbone.Model.extend
  defaults:
    name: "test 0"
    Description: "Test 0"
testCollection = Backbone.Collection.extend
  model: test
  url: "/tests_list.json"
tests = new testCollection
Pylon.set('tests',tests)

adminData = Backbone.Model.extend()
admin = new adminData
    clinics: clinics
    clinicians: clinicians
    clients: clients
    tests: tests

reading = Backbone.Model.extend
  defaults:
    sensor: 'gyro'
  initialize: ->
    d = new Date
    @set 'time', d.getTime()

readingCollection = Backbone.Collection.extend
  model: reading
  initialize: ->

readings = new readingCollection
Pylon.set('readings',readings)
pageGen = new pages.Pages sessionInfo
Pylon.set('pageGen',pageGen)

#debug -- should show up on server
readings.push new reading
 raw: [ 1,2,3,4,5,6]
 sensor: 'DebugOnly'


rawSession = Backbone.Model.extend()
sessionInfo = new rawSession
  user: ''
  patient: ''
  testID: ''
  sensorUUID: ''
  platformUUID: ''

enterDebug = () ->
  useButton  buttonModelDebugOn
  setButtons()
  $('#footer').show()
  return false

exitDebug = () ->
  useButton  buttonModelDebugOff
  setButtons()
  $('#footer').hide()
  return false

exitAdmin = () ->
  globalState.set 'loggedIn', true
  enterLogout()
  return false

enterAdmin = ->
  try
    pageGen.activateAdminPage()
  catch e
    console.log e
  return false

aButtonModel = Backbone.Model.extend
  defaults:
    active: false
    funct: ->
    text: '--'
    selector: 'button'

buttonModelDebugOn = new aButtonModel
  active: true
  selector: 'debug'
  text: "Hide Log"
  funct: ->
    exitDebug()

buttonModelDebugOff = new aButtonModel
  active: true
  selector: 'debug'
  text: "Show Log"
  funct: ->
    enterDebug()

buttonModelActionRecord = new aButtonModel
  active: true
  selector: 'action',
  text: 'Record',
  funct: ->
    enterRecording()

buttonModelActionStop = new aButtonModel
  active: true
  selector: 'action',
  text: 'Stop',
  funct: ->
    enterStop()

buttonModelActionDisabled = new aButtonModel
  selector: 'action',
  text: 'no connect',

buttonModelActionRecorded = new aButtonModel
  selector: 'action',
  text: 'Recorded',

buttonModelClear = new aButtonModel
  active: false
  selector: 'clear'
  text: 'Clear'
  funct: ()->
    enterClear()

buttonModelUpload = new aButtonModel
  active: false
  selector: 'upload'
  text: 'Upload'
  funct: ->
    enterUpload()

buttonModelCalibrating = new aButtonModel
  active: true
  selector: 'calibrate'
  text: 'Stop Calib'
  funct: ->
    exitCalibrate()

buttonModelCalibrate = new aButtonModel
  active: true
  selector: 'calibrate'
  text: 'Calibrate'
  funct: ->
    enterCalibrate()

buttonModelCalibrateOff = new aButtonModel
  selector: 'calibrate'
  text: 'Calibrate'

buttonModelAdmin = new aButtonModel
  active: true
  selector: 'admin'
  text: 'Log In'
  funct: ->
    enterAdmin()

buttonModelAdminDisabled = new aButtonModel
  active: false
  selector: 'admin'
  text: 'Log In'

buttonModelAdminLogout = new aButtonModel
  active: true
  selector: 'admin'
  text: 'Log out'
  funct: ->
    exitAdmin()

buttonCollection = {
  admin: buttonModelAdminDisabled
  calibrate: buttonModelCalibrateOff
  debug: buttonModelDebugOff
  action: buttonModelActionDisabled
  upload: buttonModelUpload
  clear: buttonModelClear
  }

useButton= (model) ->
  key = model.get('selector')
  buttonCollection[key] = model


enterLogout = () ->
  globalState.set 'loggedIn', false
  if globalState.get 'recording'
    globalState.set 'recording', false
    readings.reset()
  pageGen.resetAdmin()
  useButton buttonModelActionDisabled
  useButton buttonModelAdmin
  buttonModelUpload.set('active',false)
  buttonModelClear.set('active',false)
  setButtons()
  return false

setButtons = (log) ->
  pageGen.activateButtons buttonCollection
  if log
    for key, value of buttonCollection
      console.log '--' + key
      console.log value.toJSON()
  return

clearUserInterface = ->
  # Clear current values.
  $('#StatusData').html 'Ready to connect'
  $('#FirmwareData').html '?'
  # start with the logging info suppressed
  exitDebug()
  return

tests.push new test
  name: 'T25FW'
  Description: 'T25FW'

tests.push new test
  name: '9HPT (dom)'
  Description: '9HPT (dom)'

tests.push new test
  name: '9HPT (non-dom)'
  Description: '9HPT (non-dom)'

tests.push new test
  name: 'Other'
  Description: 'Other'

# ## Section State Handlers

initAll = ->
  rtemp = undefined
  clearUserInterface()
  $('#uuid').html("Must connect to sensor").css('color',"violet")
  return

## subsection State handlers that depend on the View
enterClear = ->
  # Clear only clears the data -- does NOT disconnedt
  readings.reset()
  buttonModelClear.set('active',false);
  buttonModelUpload.set('active',false);
  useButton buttonModelActionRecord
  setButtons()
  return false

enterConnected = ->
  # enable the recording button
  noCalibration = true #for temporarily
  console.log('enterConnected -- enable recording button')
  globalState.set 'connected', true
  useButton buttonModelAdminDisabled
#  eliminate Calibrate button functionality
  if noCalibration
    if globalState.get 'loggedIn'
      useButton buttonModelActionRecord
    else
      useButton buttonModelAdmin
  else
    useButton buttonModelActionDisabled
    useButton buttonModelCalibrate
  setButtons()
  return false

enterCalibrate = ->
  console.log('enterCalibrate -- not used currently')
  calibrating = true
  useButton  buttonModelCalibrating
  setButtons()
  return false

exitCalibrate = ->
  console.log('exitCalibrate -- not used currently')
  calibrating = false
  if globalState.get 'loggedIn'
    useButton buttonModelActionRecord
  useButton buttonModelAdmin
  useButton buttonModelCalibrateOff
  setButtons()
  return false

enterRecording = ->
  if !sessionInfo.get('testID')
    pageGen.forceTest 'red'
    return false
  console.log('enter Recording --- actively recording sensor info')
  globalState.set 'recording',  true
  useButton buttonModelActionStop
  setButtons()
  return false

enterStop = ->
  console.log('enter Stop -- stop recording')
  globalState.set 'recording',  false
  useButton  buttonModelActionRecorded
  buttonModelUpload.set('active',true)
  buttonModelClear.set('active',true)
  setButtons()
  return false

enterUpload = ->
  console.log('enter Upload -- send data to Retrotope server')
  hopper = undefined
  brainDump = undefined
  #    eliminate empty uploads per : https://github.com/jahbini/stagapp/issues/15
  if !readings.length
   return false
  hostUrl = '192.168.1.200:3000'
  hopper = Backbone.Model.extend {
    url: '/trajectory'
    urlRoot: hostUrl
  }
  console?log 'hostURL=' + hostURL
  #console?log sessionInfo
  brainDump = new hopper

  brainDump.set('readings',readings )
  brainDump.set('sensorUUID',sessionInfo.get('sensorUUID') )
  brainDump.set('patientID',sessionInfo.get('patient') )
  brainDump.set('user',sessionInfo.get('clinician') )

  brainDump.set('password',sessionInfo.get('password') )
  brainDump.set('testID',sessionInfo.get('testID') )
  brainDump.set('platformUUID',sessionInfo.get('platformUUID') )

  brainDump.save()
  pageGen.forceTest()
  enterClear()
  return false
# ## stopRecording
# halt the record session -- no restart allowed
# upload button remains enabled, clear button remains enabled

stopRecording = ->
  if globalState.get 'recording'
    globalState.set 'recording', false
    $('#record').prop('disabled', true).text('finished').fadeTo 200, 0.3
  return


#
# ### Subsection State Handlers that depend on the Hardware
startBlueTooth = ->
  TiHandlerDef = require('./TiHandler.coffee')
  TiHandler = new TiHandlerDef globalState, reading, sessionInfo, enterConnected
  window.TiHandler = TiHandler
  Pylon.set 'TiHandler', TiHandler

visualHandler = require('./visual.coffee')
smoother = new visualHandler(globalState)
accelerometerHandler = smoother.readingHandler(
  sensor: 'accel'
  debias: 'calibrateAccel'
  source: ->
    TiHandler.getAccelerometerValues
  units: 'G'
  calibrator: [
    smoother.calibratorAverage
    smoother.calibratorSmooth
  ]
  viewer: smoother.viewSensor('accel-view', 0.4)
  htmlID: 'AccelerometerData')

magnetometerHandler = smoother.readingHandler(
  sensor: 'mag'
  debias: 'calibrateMag'
  calibrator: [
    smoother.calibratorAverage
    smoother.calibratorSmooth
  ]
  source: ->
    TiHandler.getMagnetometerValues
  units: '&micro;T'
  viewer: smoother.viewSensor('magnet-view', 0.05)
  htmlID: 'MagnetometerData')

gyroscopeHandler = smoother.readingHandler(
  sensor: 'gyro'
  debias: 'calibrateGyro'
  calibrator: [
    smoother.calibratorAverage
    smoother.calibratorSmooth
  ]
  source: ->
    TiHandler.getGyroscopeValues
  viewer: smoother.viewSensor('gyro-view', 0.005)
  htmlID: 'GyroscopeData')


setSensor = ->
  pageGen.activateSensorPage()
  setButtons()
  return false

adminDone= ->
  globalState.set 'loggedIn',  true
  useButton  buttonModelAdminLogout
  if globalState.get 'connected'
    useButton buttonModelActionRecord
  pageGen.activateSensorPage()
  setButtons()
  return false

Pylon.set 'accelerometerHandler', accelerometerHandler
Pylon.set 'magnetometerHandler', magnetometerHandler
Pylon.set 'gyroscopeHandler', gyroscopeHandler

sensorIsReady = false
domIsReady = false

rediness = ->
  return unless sensorIsReady && domIsReady
  clinics.on 'change', ()->
    console.log "got reply from server for clinics collection"
  clinics.fetch
    success: (collection,response,options)->
      console.log "clinic request success"
      collection.trigger 'change'
    error: (collection,response,options)->
      console.log "clinics fetch error - response"
      console.log response
      console.log "clinics fetch error - collection"
      console.log collection

  sessionInfo.set('platformUUID',window.device.uuid)
  $("#platformUUID").text(window.device.uuid)
  if sensorIsReady && ! ( globalState.get 'connected' )
    console.log "Activating sensor attempt"
    try
      TiHandler.initializeSensorTag 
      console.log "TiHandler initialized"
    catch e
      console.log "error from TiHandler"
      console.log e
  console.log "Activating sensor exit"

### this is how seen exports things -- it's clean.  we use it as example
#seen = {}
#if window? then window.seen = seen # for the web
#if module?.exports? then module.exports = seen # for node
###
###  And since we are in a browser ---
###
window.$=$
window.sessionInfo = sessionInfo
window.Pages = pageGen
window.Me = this
window.Buttons = buttonCollection
#---
# generated by js2coffee 2.0.1

$(document).on 'deviceready', ->
  sensorIsReady = true
  startBlueTooth()
  rediness()
  return

$ ->
  domIsReady = true
  pageGen.renderPage adminDone
  if $('#console-log')?
    window.console=console = new Console('console-log')
    exitDebug()
  initAll()
  setSensor()
  rediness()
  return false
