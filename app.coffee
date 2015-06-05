# # stagapp
# vim: et:ts=2:sw=2:sts=2
# ## data handler for clinical recording of SensorTag data
# SensorTag object.

Backbone = require ('backbone')
_ = require('underscore')
require('./libs/dbg/console')
Backbone.$ = $ = require('jquery')
pages = require './pages.coffee'


evothings = window.evothings ={}
evothings.util = require('./libs/evothings/util/util').util
evothings.easyble =require('./libs/evothings/easyble/easyble').easyble
evothings.tisensortag=require('./libs/evothings/tisensortag/tisensortag').tisensortag
sensortag = evothings.tisensortag.createInstance()

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


clinic = Backbone.Model.extend()

clinicCollection = Backbone.Collection.extend
  model: clinic
  url: '/clinics'

clinics = new clinicCollection


user = Backbone.Model.extend
  defaults:
    name: 'Text'
    password: 'Password'
    patientOnly: 'Boolean'
userCollection = Backbone.Collection.extend
  model: user
  url: '/users'
users = new userCollection

test = Backbone.Model.extend
  defaults:
    name: "test 0"
    Description: "Test 0"
testCollection = Backbone.Collection.extend
  model: test
  url: "/tests_list.json"
tests = new testCollection

adminData = Backbone.Model.extend()
admin = new adminData
    clinics: clinics
    users: users
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
    @on 'add', countReadings
    @on 'remove', countReadings
    @on 'reset', countReadings

readings = new readingCollection

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



# ## Hardware
# external communications to Hardware
#
# set up the sensorTag and configure to recieve
# accelerometer, magnetometer and gyro data
#


statusHandler = (status) ->
  console.log "new Sensor Status"
  console.log status
  if 'Sensors online' == status
    enterConnected()
    status = 'Sensor online'
  if 'Device data available' == status
    $('#FirmwareData').html sensortag.getFirmwareString()
    sessionInfo.set 'sensorUUID', sensortag?.device?.address
    $('#uuid').html(sensortag?.device?.address).css('color','black')
    console?.log sensortag?.device?.address
  $('#StatusData').html status
  return

errorHandler = (error) ->
  console.log "Sensor error!"
  console.log 'Error: ' + error
  if 'disconnected' == error
    globalState.set 'connected', false
    $('#uuid').html("Must connect to sensor").css('color',"red")
    # If disconneted attempt to connect again. (but not to same device)
    setTimeout (->
      sensortag.connectToClosestDevice()
      return
    ), 1000
  return
    
initializeSensorTag = ->
  # Here sensors are set up.
  #
  # If you wish to use only one or a few sensors, just set up
  # the ones you wish to use.
  #
  # First parameter to sensor function is the callback function.
  # Several of the sensors take a millisecond update interval
  # as the second parameter.
  # Gyroscope takes the axes to enable as the third parameter:
  # 1 to enable X axis only, 2 to enable Y axis only, 3 = X and Y,
  # 4 = Z only, 5 = X and Z, 6 = Y and Z, 7 = X, Y and Z.
  #
  repeat = false
  failures =0
  console.log "initialize Sensor Communication"
  try
    globalState.set 'connected', false
    sensortag.statusCallback(statusHandler)
    sensortag.errorCallback(errorHandler)
    console.log "Status and error handlers OK"
#  sensortag.keypressCallback(keypressHandler)
    sensortag.accelerometerCallback(accelerometerHandler, 100)
    sensortag.magnetometerCallback(magnetometerHandler, 100)
    sensortag.gyroscopeCallback(gyroscopeHandler, 100, 7)
    console.log "Device Sensors OK"
    sensortag.connectToClosestDevice()
  catch e
    failures++
    console.log "failed to initialize"
    console.log e
    # try again after 1/2 second
    repeat = window.setInterval(initializeSensorTag,500)
    return
  # when the try finishes without a catch, clear the retry timer
  if repeat?
    console.log "sensor came on-line after " + failures + " failures"
    window.clearInterval repeat
  else
    console.log "sensor came on-line immediately"
  return

## section: View
# routines to control or coordinate with user
#

templater = (x, y, z, sensor='unknown', unit='') ->
  sensor + ' x=' + (if x >= 0 then '+' else '') + x.toFixed(2) + unit + ' -- ' + 'y=' + (if y >= 0 then '+' else '') + y.toFixed(2) + unit + ' -- ' + 'z=' + (if z >= 0 then '+' else '') + z.toFixed(2) + unit

pointFormat = (p, unit ='v', precision=2) ->
  unit + ' x=' + (if p.x >= 0 then '+' else '') + p.x.toFixed(precision) + ' -- ' + 'y=' + (if p.y >= 0 then '+' else '') + p.y.toFixed(precision) + ' -- ' + 'z=' + (if p.z >= 0 then '+' else '') + p.z.toFixed(precision)


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
  defaults: {
    active: false
    funct: ->
    text: '--'
    selector: 'button'
  }


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
    $('#TotalReadings').html "Items:"
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
  $('#TotalReadings').html "Items:"
  # start with the logging info suppressed
  exitDebug()
  return

countReadings = ->
  $('#TotalReadings').html "Items:" + readings.length
  return

users.push new user(
    name: 'Client 1'
    password: 'Y'
    patientOnly: true
  )
users.push new user(
    name: 'Client 2'
    password: 'Y'
    patientOnly: true
  )
users.push new user(
    name: 'Client 3'
    password: 'Y'
    patientOnly: true
  )
users.push new user(
    name: 'Client 4'
    password: 'Y'
    patientOnly: true
  )
users.push new user(
    name: 'Client 5'
    password: 'Y'
    patientOnly: true
  )
users.push new user(
    name: 'Client 6'
    password: 'Y'
    patientOnly: true
  )
users.push new user(
    name: 'Client 7'
    password: 'Y'
    patientOnly: true
  )
users.push new user(
    name: 'Client 8'
    password: 'Y'
    patientOnly: true
  )
users.push new user(
    name: 'Other'
    password: 'Y'
    patientOnly: true
  )

users.push new user(
    name: 'Tracy Jones, ARNP'
    password: 'Y'
    patientOnly: false
  )
users.push new user(
    name: 'Israt Jahan, MD'
    password: 'Y'
    patientOnly: false
  )
users.push new user(
    name: 'Jessica Shaw, MPH'
    password: 'Y'
    patientOnly: false
  )
users.push new user(
    name: 'Kevin Allison, BS'
    password: 'Y'
    patientOnly: false
  )
users.push new user(
    name: 'Mary Freeman, LPN'
    password: 'Y'
    patientOnly: false
  )
users.push new user(
    name: 'Tanya Aranca, BS'
    password: 'Y'
    patientOnly: false
  )
users.push new user(
    name: 'Other'
    password: 'Y'
    patientOnly: false
  )

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
  $('#TotalReadings').html "Items:"
  $('#uuid').html("Must connect to sensor").css('color',"violet")
  return

## subsection State handlers that depend on the View
enterClear = ->
  # Clear only clears the data -- does NOT disconnedt
  readings.reset()
  $('#TotalReadings').html "Items:"
  buttonModelClear.set('active',false);
  buttonModelUpload.set('active',false);
  useButton buttonModelActionRecord
  setButtons()
  return false

enterConnected = ->
  # enable the recording button
  noCalibration = true #for temporarily
  console.log('enterConnected')
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
  console.log('enterCalibrate')
  calibrating = true
  useButton  buttonModelCalibrating
  setButtons()
  return false

exitCalibrate = ->
  console.log('exitCalibrate')
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
  console.log('enter Recording')
  globalState.set 'recording',  true
  useButton buttonModelActionStop
  setButtons()
  return false

enterStop = ->
  console.log('enter Stop')
  globalState.set 'recording',  false
  useButton  buttonModelActionRecorded
  buttonModelUpload.set('active',true)
  buttonModelClear.set('active',true)
  setButtons()
  return false

enterUpload = ->
  console.log('enter Upload')
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

#
# ### Subsection State Handlers that depend on the Hardware
visualHandler = require('./visual.coffee')
smoother = new visualHandler(globalState)

# ## stopRecording
# halt the record session -- no restart allowed
# upload button remains enabled, clear button remains enabled

stopRecording = ->
  if globalState.get 'recording'
    globalState.set 'recording', false
    $('#record').prop('disabled', true).text('finished').fadeTo 200, 0.3
  return

# ## subsection State routines that depend on hardware and update the view or data structures

# calculations implemented as based on TI wiki pages
# http://processors.wiki.ti.com/index.php/SensorTag_User_Guide

accelerometerHandler = smoother.readingHandler(
  sensor: 'accel'
  debias: 'calibrateAccel'
  source: sensortag.getAccelerometerValues
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
  source: sensortag.getMagnetometerValues
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
  source: sensortag.getGyroscopeValues
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

  
pageGen = new pages.Pages admin, sessionInfo

sensorIsReady = false
domIsReady = false

rediness = ->
  enterAdmin()
  clinics.fetch 
    success: (model,response,options)->
      console.log "clinic request success"
      console.log response
      console.log model
    error: (model,response,options)->
      console.log "clinic request error from server"
      console.log response
      console.log model
        
  if sensorIsReady && domIsReady
    sessionInfo.set('platformUUID',window.device.uuid)
    $("#platformUUID").text(window.device.uuid)
    if sensorIsReady && ! ( globalState.get 'connected' )
      initializeSensorTag()
  
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

