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
  Pylon.set 'hostUrl', "http://Retro.local:3000/"
else
  Pylon.set 'hostUrl', "http://sensor.retrotope.com:80/"
pages = require './pages.coffee'
Pylon.set 'adminView', require('./adminView.coffee').adminView
loadScript = require("./loadScript.coffee").loadScript
loadScript Pylon.get('hostUrl')+"logon.js", (status)->
  console.log "logon.js returns status of "+status

uploader = require "./upload.coffee"

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

# #Clinicians -- users without 'patientOnly' attribute
clinicianModel = Backbone.Model.extend
  defaults:
    name: 'Text'
    password: 'Password'
clinicianCollection = Backbone.Collection.extend
  model: clinicianModel
  url: '/users'
clinicians = new clinicianCollection
Pylon.set('clinicians',clinicians)

# #Clients -- users with 'patientOnly' attribute
clientModel = Backbone.Model.extend
  defaults:
    name: 'Text'
    patientOnly: 'Boolean'
clientCollection = Backbone.Collection.extend
  model: clientModel
  url: '/users'
clients = new clientCollection
Pylon.set('clients',clients)

# #Test Protocols
protocol = Backbone.Model.extend
  defaults:
    name: "Other"
    Description: "Other"
protocolCollection = Backbone.Collection.extend
  model: protocol
  url: Pylon.get('hostUrl')+'protocols'
protocols = new protocolCollection
Pylon.set('protocols',protocols)

adminData = Backbone.Model.extend()
admin = new adminData
    clinics: clinics
    clinicians: clinicians
    clients: clients
    protocol: protocols

rawSession = Backbone.Model.extend()
sessionInfo = new rawSession
  user: ''
  clinic: ''
  patient: ''
  protocolID: ''
  sensorUUID: ''
  platformUUID: ''

pageGen = new pages.Pages sessionInfo
Pylon.set 'pageGen', pageGen
Pylon.set 'sessionInfo', sessionInfo
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

enterAdmin = ->
  try
    pageGen.activateAdminPage()
  catch e
    console.log e
  return false

exitAdmin = () ->
  enterLogout()
  return false

enterLogout = () ->
  g=Pylon.get 'globalState'
  g.set loggedIn: false, recording: false
  Pylon.get('devices').each (body)->
    readings = body.get('readings')
    readings.reset silent: true
    readings.reset silent: true
    return

  model = Pylon.get('sessionInfo')
  model.unset 'clinic', silent: true
  model.unset 'clinician', silent: true
  model.unset 'password', silent: true
  model.unset 'client', silent: true
  model.unset 'protocolID', silent: true

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
  # reject record request if no protocol is selected
  if !sessionInfo.get('protocolID')
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

enterUpload = ->
  uploader()
  pageGen.forceTest()
  enterClear() 
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
  TiHandler = new TiHandlerDef sessionInfo
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

  protocols.on 'change', ()->
    console.log "got reply from server for protocol collection"
  protocols.fetch
    success: (collection,response,options)->
      console.log "protocols request success"
      collection.trigger 'change'
    error: (collection,response,options)->
      console.log (Pylon.get('hostUrl')+'protocols')
      console.log "protocols fetch error - response"
      console.log response.statusText
      console.log "protocols fetch error - collection"
      console.log collection


  clinics.on 'change', ()->
    console.log "got reply from server for clinics collection"
  clinics.fetch
    success: (collection,response,options)->
      console.log "clinic request success"
      collection.trigger 'change'
    error: (collection,response,options)->
      console.log (Pylon.get('hostUrl')+'clinics')
      console.log "clinics fetch error - response"
      console.log response.statusText
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
