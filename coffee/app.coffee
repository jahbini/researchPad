# # stagapp
# vim: et:ts=2:sw=2:sts=2
# ## data handler for clinical recording of SensorTag data
# SensorTag object.

window.$ = $ = require('jquery')
_ = require('underscore')
Backbone = require ('backbone')
localStorage = window.localStorage
#localStorage.setItem 'debug',"app,capture-log,TIhandler,intro,hand,sensor,state"

onHandheld = document.URL.match /^file:/
localStorage['hash']='' if onHandheld

buglog = require './lib/buglog.coffee'
applogger = (applog= new buglog "app").log
#window.console = new buglog "logon"

PylonTemplate = Backbone.Model.extend
  defaults:
    hostUrl: hostUrl
  state: (require './models/state.coffee').state
  onHandheld: onHandheld
  #get the session model
  setLogonVersion: (version)->
    @.set logonVersion: version
    @.sessionInfo.set logonVersion: version
    @.trigger "systemEvent:LogonVersion:#{version}"
    return
  theSession: ()->
    return @.attributes.sessionInfo
  setTheCurrentProtocol: (p)->
    if !p
      @currentProtocol = p if p == null
    else
      @currentProtocol =  @protocols.findWhere
        name: p
  theProtocol: ()->
    return @currentProtocol if @currentProtocol
    return {} if !@protocols || !sessionInfo.attributes.testID
    return @currentProtocol = @protocols.findWhere
      name: sessionInfo.attributes.testID
  saneTimeout: (t,f)->
    return setTimeout f,t

window.Pylon = Pylon = new PylonTemplate
# configurations needs Pylon as global for it's initialization
Pylon.configurations = require './models/configurations.coffee'
Pylon.clinics= require './models/clinics.coffee'
Pylon.clinicians= require './models/clinicians.coffee'
Pylon.clients= require './models/clients.coffee'
Pylon.protocols= require './models/protocols.coffee'
Pylon.sessionInfo= require './models/session.coffee'
{clinics,configurations,clinicians,clients,protocols,sessionInfo}=Pylon
Pylon.on 'all', (event,rest...)->
  mim = event.match /((.*):.*):/
  return null if !mim || mim[2] != 'systemEvent'
  applogger "event #{event}"
  Pylon.trigger mim[1],event,rest
  Pylon.trigger mim[2],event,rest
  return null

Pylon.set 'spearCount', 1
Pylon.set 'vertmeterScale',
  lo: 55.625
  hi: 56.875

# set the button MpdelView
Pylon.BV= BV = require './views/button-view.coffee'
if Pylon.onHandheld
  Pylon.onWhat = "ontouchstart"
else
  Pylon.onWhat = "onclick"

pages = require './views/pages.coffee'

{uploader,eventModelLoader} = require "./lib/upload.coffee"

###
Section: Data Structures
 Routines to create and handle data structures and interfaces to them
###


adminData = Backbone.Model.extend()
admin = new adminData
    clinics: clinics
    clinicians: clinicians
    clients: clients
    protocol: protocols

applicationVersion = require './version.coffee'

Pylon.set
  platformUUID: window.device?.uuid || "No ID"
  platformIosVersion: window.device?.version|| "noPlatform"
  applicationVersion: applicationVersion

sessionInfo.set
  platformUUID: window.device?.uuid || "No ID"
  platformIosVersion: window.device?.version|| "noPlatform"
  applicationVersion: applicationVersion

applogger "Version:#{sessionInfo.get 'applicationVersion'}"

Pylon.pageGen = pageGen = new pages.Pages sessionInfo

{EventModel} = require "./models/event-model.coffee"
adminEvent = new EventModel "Action"
externalEvent = new EventModel "External"
Pylon.on 'systemEvent', (what="unknown")->
  if sessionInfo.id
    adminEvent.addSample what
Pylon.on 'externalEvent', (what="unknown")->
  applogger 'externalEvent', what
  if sessionInfo.id
    try
      externalEvent.addSample what
    catch booBoo
      applogger booBoo
  true

activateNewButtons = ->
  DebugButton = new BV 'debug'
  DebugButton.set
    legend: "----"
    enabled: false

  Pylon.on "systemEvent:debug:show-log",() ->
    DebugButton.set legend: "Hide Log"
    $('#footer').show()
    return false

  Pylon.on "systemEvent:debug:hide-log", ()->
    DebugButton.set legend: "Show Log"
    $('#footer').hide()
    return false
  $('#footer').hide()

  AdminButton = new BV 'admin'
  AdminButton.set
    legend: "Wait on Host"
    enabled: false
  Pylon.canLogIn = false
  Pylon.deviceReady = false
  #canLogIn will be triggered when both the clinics and protocols are fetched from host
  #  At this time, we ask for the handheld specific information
  #  When it returns, it may have started everything
  Pylon.on 'canLogIn', ->
    Pylon.canLogIn = true
    CalibrateButton.set enabled:true
    $('scanDevices').removeClass('disabled').prop('disabled',false)
    AdminButton.set
      enabled:true
      legend: "Log In"

  Pylon.on "systemEvent:admin:log-in", enterAdmin
  Pylon.on "systemEvent:admin:log-out", exitAdmin

  Pylon.on "admin:disable", ->
    AdminButton.set 'enabled',false
  Pylon.on "admin:enable", ->
    AdminButton.set 'enabled',true

  ClearButton = new BV 'clear',"u-full-width"
  ClearButton.set
    legend: "Reject"
    enabled: false

  UploadButton = new BV 'upload',"u-full-width"
  UploadButton.set
    legend: "Accept"
    enabled: false

  AcceptButton = new Pylon.BV 'acceptor'
  AcceptButton.set
    legend: "accept"
    enabled: true

  RejectButton = new Pylon.BV 'rejector'
  RejectButton.set
    legend: "reject"
    enabled: true

  Pylon.on "systemEvent:upload:accept", enterUpload
  Pylon.on "systemEvent:acceptor:accept", enterUpload
  Pylon.on "systemEvent:rejector:reject", enterClear
  Pylon.on "systemEvent:clear:reject", enterClear


  CalibrateButton = new BV 'calibrate'
  CalibrateButton.set
    legend: "notify" # the legend generates the SystemEvent triggers below
    enabled: false

  stopNotify = ()->
    CalibrateButton.set legend: "notify",enabled: true
    Pylon.state.set
      calibrating: false
    return false

  Pylon.on "systemEvent:calibrate:notify",() ->
    Pylon.state.set
      calibrating: true
    CalibrateButton.set legend: "burst mode", enabled: false
    setTimeout stopNotify,10000
    return false

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
    applogger "failure in activatAdminPage",e
  return false

exitAdmin = () ->
  enterLogout()
  # force app reload on logout -- clear all vars
  window.location.reload()
  return false

enterLogin = (hash)->
  applogger "Obtaining Clone of", hash
  sessionLoad = Backbone.Model.extend
    url: "#{Pylon.get('hostUrl')}session/#{hash}"
    idAttribute: '_id'

  model = new sessionLoad
  model.on 'sync',()->
    mHash = model.get model.idAttribute
    ###
    if mHash == hash
      alert "hash not changed"
    if !mHash
      alert "No Hash"
    ###
    #

    sessionInfo.set  sessionInfo.idAttribute, (model.get model.idAttribute)
    m= model.attributes
    sessionInfo.set
      client: m.client
      clinic: m.clinic
      clinician: m.clinician
      password: m.password
      testID: m.testID
      platformUUID: window.device?.uuid || "No ID"
      platformIosVersion: window.device?.version|| "noPlatform"
      applicationVersion: applicationVersion
      captureDate: Date()
      timeStamp: Date.now()

    applogger "now sessionInfo is",sessionInfo
    applogger "session fetched on fetch",model
    sessionInfo.save()
    enterRecording()
    return

  model.fetch()
  return


enterLogout = () ->
  Pylon.state.set loggedIn: false, recording: false

  model = Pylon.sessionInfo
  model.unset 'clinic', silent: true
  model.unset 'clinician', silent: true
  model.unset 'password', silent: true
  model.unset 'client', silent: true
  model.unset 'testID'

  $('#password').val('')
  $('option:selected').prop('selected',false)
  $('option.forceSelect').prop('selected',true)
  $('#done').removeClass('button-primary').addClass('disabled').attr('disabled','disabled').off('click')

  Pylon.button_action.set enabled: false
  Pylon.trigger 'admin:enable'
  Pylon.button_admin.set legend:"Log In" , enabled: true

  Pylon.button_upload.set 'enabled',false
  Pylon.button_clear.set 'enabled',false
  return false

# ## Section State Handlers

initAll = ->
  # start with the logging info suppressed
  Pylon.trigger "systemEvent:debug:Hide Log"
  $('#uuid').html("Must connect to sensor").css('color',"violet")
  enterAdmin()
  return

{eventModelLoader}  = require './lib/upload.coffee'
## subsection State handlers that depend on the View
enterClear = (accept=false)->
  # Clear only clears the data -- does NOT disconnedt
  Pylon.trigger "removeRecorderWindow"
  Pylon.trigger "removeAcceptReject"
  $('#testID').prop("disabled",false)
  Pylon.button_clear.set 'enabled',false
  Pylon.button_upload.set 'enabled',false
  Pylon.button_action.set enabled: true, legend: "Record"
  # on tests that have subtests, we need to regain the
  # lockDown capability status of the parent suite
  p=Pylon.setTheCurrentProtocol Pylon.sessionInfo.get 'testID'
  if Pylon.onHandheld
    restart = Pylon.sessionInfo.get 'lockdownMode'
  else
    restart = localStorage['hash']
  sessionInfo.close accept
  pageGen.forceTest()
  Pylon.saneTimeout 200,()->
    if restart
      window.location.reload()
  return

# upload and clear keys are equivalent and only suggest failure or success
enterUpload = ->
  return enterClear true

enterCalibrate = ->
  return
  applogger 'enterCalibrate -- not used currently'
  Pylon.state.set
    calibrating: false
  Pylon.button_action.set enabled: true, legend: "Record"
  Pylon.button_calibrate.set
    legend: "Exit Calibration"
    enabled: false
  return false

exitCalibrate = ->
  Pylon.state.set
    calibrating: false
  Pylon.button_calibrate.set 'legend',"Calibrate"
  return false

enterRecording = ->
  applogger "Attempt to enter Record Phase"
  # reject record request if no protocol is selected
  testID = sessionInfo.get 'testID'
  if !testID
    pageGen.forceTest 'red'
    return false

  applogger "Attempt to enter Record Phase -- testID ok"
  numSensors=0
  numSensors++ if Pylon.get "Left"
  numSensors++ if Pylon.get "Right"
  try
    theTest = Pylon.theProtocol()
    if numSensors < theTest.get 'sensorsNeeded'
      pageGen.forceTest 'red',"need sensor"
      return false
  catch
    applogger "theTest is not initialized"
    Pylon.saneTimeout 500, enterRecording
    return
  # sync the sessionInfo up to the server as an empty
  # session structure.  We need the mongo _id that the server
  # sends back
  applogger "Attempt to enter Record Phase -- number of sensors ok"

  # signal for logon.js that we are not scanning
  Pylon.state.set scanning: false

  Pylon.button_admin.set 'enabled',false
  # reject record request if we are already recording or stopping
  return if Pylon.state.get 'recording'
  Pylon.state.set
    recording:true
    scanning: false
  applogger "Record state set scanning false, recording true"

  # start recording and show a lead in timer of 5 seconds
  Pylon.button_calibrate.set 'enabled',false
  (Pylon.get 'Left')?.set numReadings: 0
  (Pylon.get 'Right')?.set numReadings: 0
  $('#testID').prop("disabled",true)
  applogger "Attempt to enter Record Phase -- awaiting promise resolution"
  Pylon.trigger "showRecorderWindow"
  if 0 == theTest.get 'sensorsNeeded'
    Promise.all [
      # do not ask the sensortags to connect -- this does not affect the rest of the bluetooth timers.
      resolveLockdown Pylon.theProtocol()
      ]
      .then recordingIsActive
  else
    Promise.all [
      resolveConnected 'Left'
      resolveConnected 'Right'
      resolveLockdown Pylon.theProtocol()
      ]
      .then recordingIsActive
  return

recordingIsActive = ()->
  applogger 'Recording --- actively recording sensor info'
  Pylon.trigger 'systemEvent:recordCountDown:start',5

  testID = sessionInfo.get 'testID'
  lastSession = sessionInfo.get sessionInfo.idAttribute
  Pylon.handheld.save {testID,lastSession}
  return

resolveLockdown = (p)->
  # are we in lockdown mode?
  if sessionInfo.get 'lockdownMode'
    Pylon.trigger 'systemEvent:lockdown:lock'
    applogger "Lockdown needed"
    return new Promise (resolve)->
      Pylon.on 'systemEvent:lockdown:unlock',()->
        applogger "Lockdown Resolved"
        resolve()
      return
  return new Promise (resolve)->resolve()

resolveConnected = (leftRight)->
  device = Pylon.get leftRight
  if device && !device.get 'connected'
    applogger "Device needed",leftRight
    return new Promise (resolve)->
      device.once 'change:connected',()->
        applogger 'Device Resolved',leftRight
        resolve()
  else
    applogger 'Device Resolved immediate',leftRight
    return new Promise (resolve)->resolve()

Pylon.on ('systemEvent:recordCountDown:fail'), ->
    applog "Failure to obtain host session credentials"
    Pylon.state.set recording:  false
    Pylon.button_calibrate.set 'enabled',true
    pageGen.forceTest 'orange'
    $('#testID').prop("disabled",true)
    return

Pylon.on 'systemEvent:recordCountDown:start', ->
  # change the record button into the stop button
  #Pylon.button_action.set enabled: true, legend: "Stop"
  Pylon.button_action.set enabled: false  # retain legend 'Record'
  return false

# Pylon.on "systemEvent:action:stop", exitRecording
exitRecording = -> # Stop Recording
  return if 'stopping' == Pylon.state.get 'recording'
  #Pylon.state.set recording: 'stopping'
  #Pylon.trigger 'systemEvent:stopCountDown:start', 5
  Pylon.button_action.set enabled: false
  Pylon.button_admin.set enabled: true
  return false

Pylon.on 'systemEvent:stopCountDown:over', ->
  applogger 'Stop -- stop recording'
  # shut down the notifications
  Pylon.state.set recording: false
  Pylon.trigger 'systemEvent:endRecording'
  Pylon.button_action.set enabled: false
  Pylon.button_upload.set enabled: true
  Pylon.button_calibrate.set enabled: true
  Pylon.button_clear.set enabled: true
  Pylon.button_admin.set enabled: true
  return false

#
# ### Subsection State Handlers that depend on the Hardware
startBlueTooth = ->
  TiHandlerDef = require('./TiHandler.coffee')
  TiHandler = new TiHandlerDef sessionInfo
  window.TiHandler = TiHandler
  Pylon.TiHandler = TiHandler

setSensor = ->
  pageGen.activateSensorPage()
  return false

enableRecordButtonOK= ()->
  #clear out any readings from an old session
  (Pylon.get 'Left')?.set numReadings: 0
  (Pylon.get 'Right')?.set numReadings: 0
  canRecord = true
  if ! Pylon.state.get 'loggedIn'
    canRecord = false
    Pylon.button_admin.set enabled: true, legend: "log in"
  if canRecord
    Pylon.button_action.set enabled: true, legend: "Record"
    $('#testID').prop("disabled",false)
  return false

Pylon.on 'sessionUploaded',enableRecordButtonOK

Pylon.on 'adminDone', ->
  #the clinician has just logged in via the app admin panel

  # send up a new client unlock code
  # and all the login info from the admin panel to track
  # the handheld's state
  if lockdownMode =Pylon.sessionInfo.get 'lockdownMode'
    clientUnlock=10000*Math.random()
    clientUnlock +=  1000 if clientUnlock<1000  # make sure no leading zeroes
    clientUnlock -= 10000 if clientUnlock>10000 #make sure only four digits
    clientUnlock = "#{clientUnlock.toFixed()}"
  else
    clientUnlock = ''
  localStorage['clientUnlock']=clientUnlock
  clientUnlockOK = false
  localStorage['clientUnlockOK']='false'
  {clinic,clinician,client,password,lockdownMode} = sessionInfo.attributes
  applogger "session not NEW!" unless sessionInfo.isNew()
  testID = ""
  Pylon.handheld.save {testID,clinic,clinician,clientUnlock,lockdownMode,clientUnlockOK,client,password},{silent: true}

  Pylon.button_admin.set 'legend',"Log Out"
  Pylon.state.set 'loggedIn',  true
  pageGen.activateSensorPage()
  enableRecordButtonOK()
  return

protocolsShowedErrors=1
protocols.on 'fetched', ->
  Pylon.state.set 'protocols',true
  if Pylon.state.all ['clinics','handheld']
    Pylon.trigger 'canLogIn'

clinics.on 'fetched', ->
  Pylon.state.set 'clinics',true
  if Pylon.state.all ['protocols','handheld']
    Pylon.trigger 'canLogIn'

getConfiguration = ->
  applogger "configurations request initiate"
  configurations.fetch
    success: (collection,response,options)->
      applogger "configurations request success"
      collection.trigger 'fetched'
    error: (collection,response,options)->
      configurationsShowedErrors--
      if configurationsShowedErrors
        return
      configurationsShowedErrors=15
      applogger (Pylon.get('hostUrl')+'configurations'), "configurations fetch error - response:", response.statusText
getConfiguration()
configurationTimer = setInterval getConfiguration, 11000
configurations.on 'fetched' , ->
  clearInterval configurationTimer

getHandheld = ->
  applogger "Handheld request initiate"
  Pylon.handheld.save {
    platformUUID: Pylon.get 'platformUUID'
    platformIosVersion: Pylon.get "platformIosVersion"
    applicationVersion: Pylon.get "applicationVersion"
    },
    success: (collection,response,options)->
      applogger "Handheld request success"
      collection.trigger 'fetched'
    error: (collection,response,options)->
      handheldShowedErrors--
      if handheldShowedErrors
        return
      handheldShowedErrors=15
      applogger (Pylon.get('hostUrl')+'handheld'), "handheld fetch error - response:", response.statusText

getProtocol = ->
  applogger "protocol request initiate"
  protocols.fetch
    success: (collection,response,options)->
      applogger "protocols request success"
      collection.trigger 'fetched'
    error: (collection,response,options)->
      protocolsShowedErrors--
      if protocolsShowedErrors
        return
      protocolsShowedErrors=15
      applogger (Pylon.get('hostUrl')+'protocols'), "protocols fetch error - response:", response.statusText
getProtocol()
protocolTimer = setInterval getProtocol, 11000
protocols.on 'fetched' , ->
  clearInterval protocolTimer

clinicShowedErrors=1
getClinics = ->
  applogger "clinic request initiate"
  clinics.fetch
    success: (collection,response,options)->
      applogger "clinic request success"
      collection.trigger 'fetched'
    error: (collection,response,options)->
      clinicShowedErrors--
      if clinicShowedErrors
        return
      clinicShowedErrors=5
      applogger (Pylon.get('hostUrl')+'clinics')
      applogger "clinics fetch error - response:#{response.statusText}"
getClinics()
clinicTimer = setInterval getClinics,10000
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
Pylon.stress = (percent=50)->
  Pylon.set stress: percent/100
Pylon.rate = (ms=10)->
  Pylon.set sensorRate: ms
Pylon.rate 10

$(document).on 'deviceready', ->
  applogger "device ready"
  require './lib/capture-log.coffee'
  # we are running on a device, not from the web demo page.
  sessionInfo.set 'platformUUID' , window.device?.uuid || "No ID"
  sessionInfo.set('platformIosVersion',window.device?.version|| "noPlatform")

  Pylon.set
    platformUUID: window.device?.uuid || "No ID"
    platformIosVersion: window.device?.version|| "noPlatform"
    applicationVersion: applicationVersion

  sessionInfo.set
    platformUUID: window.device?.uuid || "No ID"
    platformIosVersion: window.device?.version|| "noPlatform"
    applicationVersion: applicationVersion


  $("#platformUUID").text sessionInfo.attributes.platformUUID
  $("#platformIosVersion").text "iOS Ver:"+sessionInfo.attributes.platformIosVersion

  # the sessionInfo stuff is loaded, and can be transferred to the handheld object
  Pylon.deviceReady = true
  # we have the UUID, so we can ask the ost for the handheld record
  applogger "Getting handheld from canLogIn"
  handheld = Pylon.handheld = require './models/handheld.coffee'
  handheld.on 'fetched',->
    Pylon.state.set 'handheld',true
    if Pylon.state.all ['protocols','clinics']
      Pylon.trigger 'canLogIn'

  applogger "device info is", window.device.uuid
  getHandheld()
  handheldTimer = setInterval getHandheld, 11000
  handheld.on 'fetched' , ->
    clearInterval handheldTimer
  Pylon.on "UploadCount", (count)->
    $("#UploadCount").html "Queued:#{count}"
  startBlueTooth()
  #delay loading harry's code until all is quiet on the UIO front
  loadScript = require("./lib/loadScript.coffee").loadScript
  getLogon = ()-> 
    loadScript Pylon.get('hostUrl')+"logon.js?bla=#{Date.now()}", (status)->
      if status == 'loaded'
        clearInterval logonTimer
      applogger "logon.js returns status of "+status
  getLogon()
  logonTimer = setInterval  getLogon, 12000
  return

onPause= ()->
  # Handle the pause event
  Pylon.devices.map (d)->
    TiHandler.detachDevice d.cid
  return

detectHash= ()-> #if there is a hash, it is a session to be cloned
  return if Pylon.onHandheld
  if window.location.hash  #the URL hash takes precedence
    if hash = window.location.hash[1..]
      enterLogin hash
    localStorage['hash'] = hash  #update or erase hash
  if hash = localStorage['hash']
    enterLogin hash

$ ->
  $('body').css 'background:yellow' if (sessionInfo.get 'applicationVersion').match /test/
  # Force a page reload if put in background to wipe the sessionInfo and other state
  document.addEventListener 'resume',()->
    window.location.reload()
  document.addEventListener 'pause', onPause, false

  # document.addEventListener 'online', ()-> require './lib/net-view.coffee'

  pageGen.renderPage()
  activateNewButtons()
  if $('#console-log')?
    # allow the applog to use #console-log from now on
    applog.useDiv 'console-log'
    Pylon.trigger "systemEvent:debug:Hide Log"
  initAll()
  setSensor()
  detectHash()
  applogger "DOM ready"
  return false
