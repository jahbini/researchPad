# # stagapp
# vim: et:ts=2:sw=2:sts=2
# ## data handler for clinical recording of SensorTag data
# SensorTag object.

$ = require('jquery')
_ = require('underscore')
Backbone = require ('backbone')
require('../libs/dbg/console')

PylonTemplate = Backbone.Model.extend
    scan: false
Pylon = new PylonTemplate
if window? then window.Pylon = window.exports = Pylon
if module?.exports? then module.exports = Pylon

Pylon.set 'spearCount', 5
development = false
if development
  Pylon.set 'hostUrl', "http://192.168.1.200:3000/"
else
  Pylon.set 'hostUrl', "http://sensor.retrotope.com:80/"
pages = require './pages.coffee'
Pylon.set 'adminView', require('./adminView.coffee').adminView
loadScript = require("./loadScript.coffee").loadScript
loadScript Pylon.get('hostUrl')+"logon.js", (status)->
  console.log "logon.js returns status of "+status

###
Section: Data Structures
 Routines to create and handle data structures and interfaces to them
###

systemCommunicator = Backbone.Model.extend
  defaults:
    calibrating: false
    recording: false
    connected: []
    calibrate: false
    loggedIn:  false

Pylon.set 'globalState', new systemCommunicator


clinicModel = Backbone.Model.extend()

clinicCollection = Backbone.Collection.extend
  model: clinicModel
  url: Pylon.get('hostUrl')+'clinics'

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

rawSession = Backbone.Model.extend()
sessionInfo = new rawSession
  user: ''
  patient: ''
  testID: ''
  sensorUUID: ''
  platformUUID: ''

pageGen = new pages.Pages sessionInfo
Pylon.set 'pageGen', pageGen
Pylon.set 'sessionInfo', sessionInfo

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
  Pylon.get('globalState').set 'loggedIn', true
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
  g=Pylon.get 'globalState'
  g.set 'loggedIn', false
  if g.get 'recording'
    g.set 'recording', false
  Pylon.get('devices').each (body)->
    body.reset 'readings', silent: true
    body.reset 'readings', silent: true
  model = Pylon.get('sessionInfo')
  model.unset 'clinic', silent: true
  model.unset 'clinician', silent: true
  model.unset 'password', silent: true
  model.unset 'client', silent: true
  model.unset 'testID', silent: true

  $('#password').val('')
  $('option:selected').prop('selected',false)
  $('option.forceSelect').prop('selected',true)
  $('#done').removeClass('button-primary').addClass('disabled').attr('disabled','disabled').off('click')

  useButton buttonModelActionDisabled
  useButton buttonModelAdmin
  buttonModelUpload.set('active',false)
  buttonModelClear.set('active',false)
  setButtons()
  return false

setButtons = () ->
  pageGen.activateButtons buttonCollection
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
  # start with the logging info suppressed
  exitDebug()
  $('#uuid').html("Must connect to sensor").css('color',"violet")
  return

## subsection State handlers that depend on the View
enterClear = ->
  # Clear only clears the data -- does NOT disconnedt
  Pylon.get('devices').each (body)->
    readings = body.get('readings')
    readings.reset silent: true
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
  g=Pylon.get('globalState')
  useButton buttonModelAdminDisabled
#  eliminate Calibrate button functionality
  if noCalibration
    if g.get 'loggedIn'
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
  if Pylon.get('globalState').get 'loggedIn'
    useButton buttonModelActionRecord
  useButton buttonModelAdmin
  useButton buttonModelCalibrateOff
  setButtons()
  return false

enterRecording = ->
  # reject record request if no test is selected
  if !sessionInfo.get('testID')
    pageGen.forceTest 'red'
    return false
  # reject record request if we are already recording
  gs = Pylon.get('globalState')
  return if gs.get 'recording'
  # start recording and show a lead in timer of 5 seconds
  gs.set 'recording',  true
  Pylon.trigger 'recordCountDown:start', 5
  console.log('enter Recording --- actively recording sensor info')

Pylon.on 'recordCountDown:over', ->
  # change the record button into the stop button
  useButton buttonModelActionStop
  setButtons()
  return false

enterStop = ->
  gs = Pylon.get('globalState')
  return if 'stopping' == gs.get 'recording'
  gs.set 'recording', 'stopping'
  Pylon.trigger 'stopCountDown:start', 5
  return false

Pylon.on 'stopCountDown:over', ->
  console.log('enter Stop -- stop recording')
  Pylon.get('globalState').set 'recording',  false
  useButton buttonModelActionRecorded
  buttonModelUpload.set('active',true)
  buttonModelClear.set('active',true)
  setButtons()
  return false

currentlyUploading = false
enterUpload = ->
  return if currentlyUploading
  currentlyUploading = true
  console.log('enter Upload -- send data to Retrotope server')
  deviceSummary = Backbone.Model.extend()
  deviceDataCollection = Backbone.Collection.extend
    model: deviceSummary
  devicesData = new deviceDataCollection
  noData = true
  for i,body of Pylon.get('devices').toJSON()
  #    eliminate empty uploads per : https://github.com/jahbini/stagapp/issues/15
    console.log body.nickname+" has "+body.readings.length+" readings for upload."
    continue if ! (r = body.readings)
    continue if r.length == 0
    noData = false
    devicesData.push
      sensorUUID: body.UUID
      role: body.role
      type: body.type
      nickname: body.nickname
      readings: r.toJSON()
  return false if noData  

  hopper = Backbone.Model.extend {
    url: Pylon.get('hostUrl')+'trajectory'
    urlRoot: Pylon.get 'hostUrl'
  }
  
  brainDump = new hopper
  brainDump.set('readings',devicesData )
  brainDump.set('sensorUUID',"0-0-0")
  brainDump.set('patientID',sessionInfo.get('client') )
  brainDump.set('user',sessionInfo.get('clinician') )
  brainDump.set('password',sessionInfo.get('password') )
  brainDump.set('testID',sessionInfo.get('testID') )
  brainDump.set('platformUUID',sessionInfo.get('platformUUID') )

  brainDump.save()
    .done (a,b,c)->
      Pylon.trigger "upload:complete", a
      console.log "Save Complete "+a
      pageGen.forceTest()
      currentlyUploading = false
      enterClear()
      #and clear out the collection of readings
      return
    .fail (a,b,c)->
      Pylon.trigger "upload:failure", a
      currentlyUploading = false
      console.log b
      console.log c
      console.log "Braindump failure"
      debugger
      return
  return false
# ## stopRecording
# halt the record session -- no restart allowed
# upload button remains enabled, clear button remains enabled

stopRecording = ->
  g=Pylon.get('globalState')
  if g.get 'recording'
    g.set 'recording', false
    $('#record').prop('disabled', true).text('finished').fadeTo 200, 0.3
  return


Pylon.on 'connected', enterConnected
#
# ### Subsection State Handlers that depend on the Hardware
startBlueTooth = ->
  TiHandlerDef = require('./TiHandler.coffee')
  TiHandler = new TiHandlerDef  reading, sessionInfo
  window.TiHandler = TiHandler
  Pylon.set 'TiHandler', TiHandler

setSensor = ->
  pageGen.activateSensorPage()
  setButtons()
  return false

Pylon.on 'adminDone', ->
  g=Pylon.get('globalState')
  g.set 'loggedIn',  true
  useButton  buttonModelAdminLogout
  if Pylon.get('devices').pluck('connected')
      .length  > 0
    useButton buttonModelActionRecord
  pageGen.activateSensorPage()
  setButtons()
  return false

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
      console.log (Pylon.get('hostUrl')+'clinics')
      console.log "clinics fetch error - response"
      console.log response
      console.log "clinics fetch error - collection"
      console.log collection

  sessionInfo.set('platformUUID',window.device.uuid)
  $("#platformUUID").text(window.device.uuid)

### this is how seen exports things -- it's clean.  we use it as example
#seen = {}
#if window? then window.seen = seen # for the web
#if module?.exports? then module.exports = seen # for node
#
#  And since we are in a browser ---
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
  pageGen.renderPage() 
  if $('#console-log')?
    window.console=console = new Console('console-log')
    exitDebug()
  initAll()
  setSensor()
  rediness()
  return false
