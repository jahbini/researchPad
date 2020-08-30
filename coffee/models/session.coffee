# # stagapp
# vim: et:ts=2:sw=2:sts=2
# ## data handler for clinical recording of SensorTag data
# SensorTag object.

Backbone = require ('backbone')
{eventModelLoader}  = require '../lib/upload.coffee'

rawSession = Backbone.Model.extend {
  idAttribute: '_id'
  url: Pylon.get('hostUrl')+'session'
  getEventPath: ()->
    return "#{@rawPath}/event#{@.eventCounter++}.json"
  rawPath:""
  eventCounter: 0
  setPath: ()->
    try
      clinicName = localStorage['clinicName']
      clinicianName= localStorage['clinicianName']
      clientName= localStorage['clientName']
    catch err
      return
    @rawPath= "#{clinicName}/#{clinicianName}/#{clientName}/#{@.get 'beginTime'}".replace(/ +/g,'_').toLowerCase()
    @save 
      path: "#{@rawPath}/session.json",
      eMailCarbon: Pylon.eMailCarbon
      clinicName: clinicName
      clinicianName: clinicianName
      clinicianEmail: localStorage['clinicianEmail'] 
      clientName: clientName
      logonVersion: Pylon.get 'logonVersion'
    return

  close: (accepted)->
    endTime = Date.now()
    endTimeHuman = new Date()
    endTimeHuman.setTime endTime
    @.set 
      accepted: accepted
      endTime: endTime
      endTimeLocal: endTimeHuman.toLocaleTimeString()
      endDateLocal: endTimeHuman.toLocaleDateString()
    debugger
    eventModelLoader @
    @unset 'beginTime',silent:true
    @unset 'path',silent:true
    @unset '_id',silent:true
    @eventCounter = 0
    return

  initialize: ()->
    Pylon.on 'systemEvent:recordCountDown:start',()=>
      beginTime = Date.now()
      beginTimeLocal = new Date()
      beginTimeLocal.setTime beginTime
      @set beginTime:beginTime, beginTimeLocal: beginTimeLocal.toLocaleTimeString() ,beginDateLocal: beginTimeLocal.toLocaleDateString()
      @.setPath()
      return
    # clear out the subprotocol of a suite of tests
    @on 'change:testID',()->
      @eventCounter = 0
      Pylon.setTheCurrentProtocol null
      if @.attributes.testID
        @.attributes.protocolName = @.attributes.testID  # for the email summary
      else
        @unset 'beginTime',silent:true
        @unset 'path',silent:true
        @unset '_id',silent:true
        @eventCounter = 0
      return
}

sessionInfo = new rawSession
  clinic: ''
  testID: ''
  lockdownMode: false
  leftSensorUUID: ''
  rightSensorUUID: ''
  platformIosVersion: ''
  applicationVersion: ''

module.exports = sessionInfo
