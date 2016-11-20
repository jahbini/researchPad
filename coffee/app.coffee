# # stagapp
# vim: et:ts=2:sw=2:sts=2
# ## data handler for clinical recording of SensorTag data
# SensorTag object.

window.$ = $ = require('jquery')
_ = require('underscore')
Backbone = require ('backbone')
require('./lib/console')

PylonTemplate = Backbone.Model.extend
    scan: false

window.Pylon = Pylon = new PylonTemplate
Pylon.on 'all', (event,rest...)->
  mim = event.match /((.*):.*):/
  return null if !mim || mim[2] != 'systemEvent'
  Pylon.trigger mim[1],event,rest
  Pylon.trigger mim[2],event,rest
  return null

Pylon.set 'spearCount', 1
Pylon.set 'hostUrl', hostUrl
# set the button MpdelView
Pylon.set 'BV', BV = require './views/button-view.coffee'


pages = require './views/pages.coffee'
Pylon.set 'adminView', require('./views/adminView.coffee').adminView
loadScript = require("./lib/loadScript.coffee").loadScript
loadScript Pylon.get('hostUrl')+"logon.js", (status)->
  console.log "logon.js returns status of "+status

{uploader,eventModelLoader} = require "./lib/upload.coffee"

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

# #Clinicians --
clinicianModel = Backbone.Model.extend
  defaults:
    name: 'Text'
    password: 'Password'
clinicianCollection = Backbone.Collection.extend
  model: clinicianModel
clinicians = new clinicianCollection
Pylon.set('clinicians',clinicians)

# #Clients --
clientModel = Backbone.Model.extend
  defaults:
    name: 'Text'
    patientOnly: 'Boolean'
clientCollection = Backbone.Collection.extend
  model: clientModel
clients = new clientCollection
Pylon.set('clients',clients)

# #Test Protocols
protocol = Backbone.Model.extend
  defaults:
    name: "Other"
    comments: "Other"
    mileStones: "initiation,completion"
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

rawSession = Backbone.Model.extend {
  idAttribute: '_id'
  url: Pylon.get('hostUrl')+'session'
}

applicationVersion = require './version.coffee'
sessionInfo = new rawSession
  user: ''
  clinic: ''
  patient: ''
  testID: ''
  leftSensorUUID: ''
  rightSensorUUID: ''
  platformIosVersion: ''
  applicationVersion: applicationVersion
console.log "app Ver:", sessionInfo.get 'applicationVersion'

pageGen = new pages.Pages sessionInfo
Pylon.set 'pageGen', pageGen
Pylon.set 'sessionInfo', sessionInfo
console.log "sessionInfo created as: ", sessionInfo

{EventModel} = require "./models/event-model.coffee"
adminEvent = new EventModel "Action"
Pylon.on 'systemEvent', (what="unknown")->
  if sessionInfo.id
    adminEvent.addSample what


aButtonModel = Backbone.Model.extend
  defaults:
    active: false
    funct: ->
    text: '--'
    selector: 'button'

activateNewButtons = ->
  DebugButton = new BV 'debug'
  DebugButton.set
    legend: "Show Log"
    enabled: true

  Pylon.on "systemEvent:debug:show-log",() ->
    DebugButton.set legend: "Hide Log"
    $('#footer').show()
    return false

  Pylon.on "systemEvent:debug:hide-log", ()->
    DebugButton.set legend: "Show Log"
    $('#footer').hide()
    return false
  $('#footer').hide()

  ActionButton = new BV 'admin'
  ActionButton.set
    legend: "Log In"
    enabled: true
  Pylon.on "systemEvent:admin:log-in", enterAdmin
  Pylon.on "systemEvent:admin:log-out", exitAdmin

  Pylon.on "admin:disable", ->
    ActionButton.set 'enabled',false
  Pylon.on "admin:enable", ->
    ActionButton.set 'enabled',true

  ClearButton = new BV 'clear',"u-full-width"
  ClearButton.set
    legend: "Reject"
    enabled: false
  Pylon.on "systemEvent:clear:reject", enterClear

  UploadButton = new BV 'upload',"u-full-width"
  UploadButton.set
    legend: "Accept"
    enabled: false
  Pylon.on "systemEvent:upload:accept", enterUpload

  CalibrateButton = new BV 'calibrate'
  CalibrateButton.set
    legend: "--" # was Calibrate to generate the SystemEvent triggers below
    enabled: false
  Pylon.on "systemEvent:calibrate:backdoor", ()->
  # reject backdoor request if no protocol is selected
    if !sessionInfo.get 'testID'
      pageGen.forceTest 'red'
    Pylon.trigger 'recordCountDown:start', 5
    console.log('enter Recording --- actively recording sensor info')

  Pylon.on "systemEvent:calibrate:exit-calibration", exitCalibrate

  ActionButton = new BV 'action'
  ActionButton.set
    legend: "Record"
    enabled: false
  Pylon.on "systemEvent:action:record", enterRecording
  Pylon.on "systemEvent:action:stop", exitRecording

enterAdmin = ->
  try
    pageGen.activateAdminPage()
  catch e
    console.log "failure in activatAdminPage",e
  return false

exitAdmin = () ->
  enterLogout()
  return false

enterLogout = () ->
  g=Pylon.get 'globalState'
  g.set loggedIn: false, recording: false
  # devices no longer contain collections of readings, now is an EventModel

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

  (Pylon.get 'button-action').set enabled: false
  Pylon.trigger 'admin:enable'
  (Pylon.get 'button-admin').set legend:"Log In" , enabled: true

  (pylon.get 'button-upload').set 'enabled',false
  (pylon.get 'button-clear').set 'enabled',false
  return false

# ## Section State Handlers

initAll = ->
  rtemp = undefined
  # start with the logging info suppressed
  Pylon.trigger "systemEvent:debug:Hide Log"
  $('#uuid').html("Must connect to sensor").css('color',"violet")
  enterAdmin()
  return

## subsection State handlers that depend on the View
enterClear = (accept=false)->
  # Clear only clears the data -- does NOT disconnedt
  Pylon.trigger "removeRecorderWindow"

  $('#testID').prop("disabled",false)
  pageGen.forceTest()
  sessionInfo.set accepted: accept
  sessionInfo.save()
    .done ->  # only remove clear, upload buttons on success
      sessionInfo.set '_id',null,{silent:true}
      enableRecordButtonOK()
      (Pylon.get 'button-clear').set 'enabled',false
      (Pylon.get 'button-upload').set 'enabled',false
    .fail (errorResponse)->
      alert "Host Reject:#{errorResponse.status}"

# upload and clear keys are equivalent and only suggest failure or success
enterUpload = ->
  return enterClear true

enterCalibrate = ->
  return
  console.log('enterCalibrate -- not used currently')
  calibrating = true
  (Pylon.get 'button-action').set
    enabled: true
    legend: "Record"
  (Pylon.get 'button-calibrate').set
    legend: "Exit Calibration"
    enabled: false
  return false

exitCalibrate = ->
  calibrating = false
  (Pylon.get 'button-calibrate').set 'legend',"Calibrate"
  return false

enterRecording = ->
  # reject record request if no protocol is selected
  if !sessionInfo.get 'testID'
    pageGen.forceTest 'red'
    return false

  # sync the sessionInfo up to the server as an empty
  # session structure.  We need the mongo _id that the server
  # sends back
  if !sessionInfo.get '_id'
    sessionInfo.save()
    return false
  (Pylon.get 'button-admin').set 'enabled',false
  # reject record request if we are already recording
  gs = Pylon.get('globalState')
  return if gs.get 'recording'
  # start recording and show a lead in timer of 5 seconds
  gs.set 'recording',  true
  $('#testID').prop("disabled",true)
  Pylon.trigger 'recordCountDown:start', 5
  console.log('enter Recording --- actively recording sensor info')

Pylon.on ('recordCountDown:fail'), ->
    pageGen.forceTest 'orange'
    gs.set 'recording',  false
    $('#testID').prop("disabled",true)

Pylon.on 'recordCountDown:over', ->
  # change the record button into the stop button
  (Pylon.get 'button-action').set
    enabled: true
    legend: "Stop"
  return false

exitRecording = -> # Stop Recording
  gs = Pylon.get('globalState')
  return if 'stopping' == gs.get 'recording'
  gs.set 'recording', 'stopping'
  Pylon.trigger 'stopCountDown:start', 5
  Pylon.get('button-action').set enabled: false
  (Pylon.get 'button-admin').set 'enabled',true
  return false

Pylon.on 'stopCountDown:over', ->
  console.log('enter Stop -- stop recording')
  Pylon.trigger 'systemEvent:endRecording'
  Pylon.get('globalState').set 'recording',  false
  (Pylon.get 'button-upload').set 'enabled',true
  (Pylon.get 'button-clear').set 'enabled',true
  (Pylon.get 'button-admin').set 'enabled',true
  return false


#
# ### Subsection State Handlers that depend on the Hardware
startBlueTooth = ->
  TiHandlerDef = require('./TiHandler.coffee')
  TiHandler = new TiHandlerDef sessionInfo
  window.TiHandler = TiHandler
  Pylon.set 'TiHandler', TiHandler

setSensor = ->
  pageGen.activateSensorPage()
  return false

enableRecordButtonOK= ()->
  #clear out any readings from an old session
  (Pylon.get 'Left')?.set numReadings: 0
  (Pylon.get 'Right')?.set numReadings: 0
  canRecord = true
  gs=Pylon.get('globalState')
  if ! gs.get 'connected'
    canRecord = false
    (Pylon.get "button-scan").set enabled: true
  if ! gs.get 'loggedIn'
    canRecord = false
    (Pylon.get "button-admin").set enabled: true, legend: "log in"
  if canRecord
    (Pylon.get 'button-action').set legend: "record", enabled: true
  return false

Pylon.on 'connected', ->
  console.log('enterConnected -- enable recording button')
  Pylon.get('globalState').set connected: true
  return enableRecordButtonOK()

Pylon.on 'adminDone', ->
  (Pylon.get 'button-admin').set 'legend',"Log Out"
  Pylon.get('globalState').set 'loggedIn',  true
  pageGen.activateSensorPage()
  return enableRecordButtonOK()

protocolsShowedErrors=1
getProtocol = ->
  protocols.on 'change', ()->
    console.log "got reply from server for protocol collection"
  protocols.fetch
    success: (collection,response,options)->
      console.log "protocols request success"
      collection.trigger 'fetched'
    error: (collection,response,options)->
      protocolsShowedErrors--
      if protocolsShowedErrors
        return
      protocolsShowedErrors=15
      console.log (Pylon.get('hostUrl')+'protocols'), "protocols fetch error - response:", response.statusText

protocolTimer = setInterval getProtocol, 500
protocols.on 'fetched' , ->
  clearInterval protocolTimer

clinicShowedErrors=1
getClinics = ->
  clinics.on 'change', ()->
    console.log "got reply from server for clinics collection"
  clinics.fetch
    success: (collection,response,options)->
      console.log "clinic request success"
      collection.trigger 'fetched'
    error: (collection,response,options)->
      clinicShowedErrors--
      if clinicShowedErrors
        return
      clinicShowedErrors=15
      console.log (Pylon.get('hostUrl')+'clinics')
      console.log "clinics fetch error - response"
      console.log response.statusText
      console.log "clinics fetch error - collection"
      console.log collection
clinicTimer = setInterval getClinics,600
clinics.on 'fetched', ->
  clearInterval clinicTimer
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
#---
# generated by js2coffee 2.0.1
Pylon.test = (page='test.html')->
  window.location.assign(page)
Pylon.a = ()->
  window.location.assign 'alabaster.html'

$(document).on 'deviceready', ->
  sessionInfo.set 'platformUUID' , window.device?.uuid || "No ID"
  sessionInfo.set('platformIosVersion',window.device?.version|| "noPlatform")
  $("#platformUUID").text sessionInfo.attributes.platformUUID
  $("#platformIosVersion").text sessionInfo.attributes.platformIosVersion
  startBlueTooth()
  return

$ ->
  # Force a page reload if put in background to wipe the sessionInfo and other state
  document.addEventListener 'resume',()->
    window.location.reload()
  document.addEventListener 'online', ()->
    require './lib/net-view.coffee'

  pageGen.renderPage()
  activateNewButtons()
  if $('#console-log')?
    window.console=console = new Console('console-log',this)
    Pylon.trigger "systemEvent:debug:Hide Log"
  initAll()
  setSensor()
  return false
