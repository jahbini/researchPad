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
  uploadKey = localStorage.key(0)
  return if !uploadKey

  try
    uploadData = localStorage.getItem(uploadKey)
    uploadData = JSON.parse(uploadData)
  catch e
    console.log "Error in upload"
    console.log e
    console.log "upload item removed"
    localStorage.removeItem(uploadKey)
    setTimeout dumpLocal, 30000
    uploadData = false

  return if !uploadData?.attribute?.url

  hopper = Backbone.Model.extend {
    url: uploadData.attribute.url
    urlRoot: Pylon.get 'hostUrl'
  }
  uploadData = new hopper uploadData

  uploadData.save()
    .done (a,b,c)->
      Pylon.trigger "upload:complete", a
      console.log "Save Complete "+a
      #and clear out the collection of readings
      localStorage.removeItem(uploadKey)
      return
    .fail (a,b,c)->
      failCode = a.status
      # if the server cannot process the upload, throw it away
      if failCode == 500 || failCode == 400
        localStorage.removeItem(uploadKey)
        return

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

eventModelLoader = (e)->
  e.set 'url',e.url
  localStorage.setItem(e.cid,JSON.stringify(e.toJSON()))
  dumpLocal()

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

  console.log "Prepare upload on " + Date()
  theClinic = sessionInfo.get 'clinic'
  uploadData = new hopper
  uploadData.set('readings',devicesData )
  uploadData.set('sensorUUID',"0-0-0")
  uploadData.set('clinic',theClinic.get("_id") )
  uploadData.set('patientID',sessionInfo.get('client') )
  uploadData.set('client',sessionInfo.get('client') )
  uploadData.set('user',sessionInfo.get('clinician') )
  uploadData.set('clinician',sessionInfo.get('clinician') )
  uploadData.set('password',sessionInfo.get('password') )
  uploadData.set('protocolID',sessionInfo.get('protocolID') )
  uploadData.set('testID',sessionInfo.get('protocolID') )
  uploadData.set('platformUUID',sessionInfo.get('platformUUID') )
  uploadData.set('applicationVersion',sessionInfo.get('applicationVersion') )
  uploadData.set('captureDate',Date())

  console.log "Store upload"
  localStorage.setItem(uploadData.cid,JSON.stringify(uploadData.toJSON()))
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
