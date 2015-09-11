# # stagapp
# vim: et:ts=2:sw=2:sts=2
# ## data handler for clinical recording of SensorTag data
# SensorTag object.

$ = require('jquery')
_ = require('underscore')
Backbone = require ('backbone')
require('../libs/dbg/console')

localStorage = window.localStorage
Pylon = window.Pylon

dumpLocal =  ->
  sessionInfo = Pylon.get "sessionInfo"
  trajectoryKey = localStorage.key(0)
  return if !trajectoryKey
  brainDump = localStorage.getItem(trajectoryKey)
  brainDump = JSON.parse(brainDump)

  hopper = Backbone.Model.extend {
    url: Pylon.get('hostUrl')+'trajectory'
    urlRoot: Pylon.get 'hostUrl'
  }
  brainDump = new hopper brainDump

  brainDump.save()
    .done (a,b,c)->
      Pylon.trigger "upload:complete", a
      console.log "Save Complete "+a
      #and clear out the collection of readings
      localStorage.removeItem(trajectoryKey)
      return
    .fail (a,b,c)->
      Pylon.trigger "upload:failure", message: "upload queued"
      currentlyUploading = false
      console.log a
      console.log b
      console.log c
      console.log "Trajectory upload failure, retry in 30 seconds"
      debugger
      return
  setTimeout dumpLocal, 30000
  return false


uploader = ->
  sessionInfo = Pylon.get "sessionInfo"
  console.log('enter Upload -- send data to localStorage queue to server')
  deviceSummary = Backbone.Model.extend()
  deviceDataCollection = Backbone.Collection.extend
    model: deviceSummary
  devicesData = new deviceDataCollection
  noData = true
  for i,body of Pylon.get('devices').toJSON()
  #    eliminate empty uploads per : https://github.com/jahbini/stagapp/issues/15
    continue if ! (r = body.readings)
    continue if r.length == 0
    noData = false
    console.log body.nickname+" has "+body.readings.length+" readings for upload."
    devicesData.push
      sensorUUID: body.UUID
      role: body.role
      type: body.type
      fwRev: body.fwRev
      assignedName: body.assignedName
      nickname: body.nickname
      readings: r.toJSON()
  return false if noData  

  hopper = Backbone.Model.extend {
    url: Pylon.get('hostUrl')+'trajectory'
    urlRoot: Pylon.get 'hostUrl'
  }
  
  console.log "Prepare upload"
  theClinic = sessionInfo.get 'clinic'
  brainDump = new hopper
  brainDump.set('readings',devicesData )
  brainDump.set('sensorUUID',"0-0-0")
  brainDump.set('clinic',theClinic.get("_id") )
  brainDump.set('patientID',sessionInfo.get('client') )
  brainDump.set('client',sessionInfo.get('client') )
  brainDump.set('user',sessionInfo.get('clinician') )
  brainDump.set('clinician',sessionInfo.get('clinician') )
  brainDump.set('password',sessionInfo.get('password') )
  brainDump.set('protocolID',sessionInfo.get('protocolID') )
  brainDump.set('testID',sessionInfo.get('protocolID') )
  brainDump.set('platformUUID',sessionInfo.get('platformUUID') )

  console.log "Store upload"
  localStorage.setItem(brainDump.cid,JSON.stringify(brainDump.toJSON())) 
  console.log "Upload upload"
  dumpLocal()
  console.log "return from upload"
  return

dumpLocal()

### this is how seen exports things -- it's clean.  we use it as example
#seen = {}
#if window? then window.seen = seen # for the web
#if module?.exports? then module.exports = seen # for node
#
###
module.exports = uploader
