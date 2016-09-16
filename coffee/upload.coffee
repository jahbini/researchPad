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
  uploadData = uploadData.attribute if uploadData.attribute
  return if !uploadData?.url

  hopper = Backbone.Model.extend {
    url: Pylon.get('hostUrl')+uploadData.url
  }
  uploadData = new hopper uploadData

  uploadData.save()
    .done (a,b,c)->
      Pylon.trigger "systemEvent","upload complete - #{a.message || '---'}"
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
      return
  setTimeout dumpLocal, 30000
  return false

eventModelLoader = (e)->
  e.set 'url',e.url
  localStorage.setItem(e.cid,JSON.stringify(e.toJSON()))
  dumpLocal()

uploader = ->
  alert "Uploader Called!"
  return

dumpLocal()

### this is how seen exports things -- it's clean.  we use it as example
#seen = {}
#if window? then window.seen = seen # for the web
#if module?.exports? then module.exports = seen # for node
#
###
module.exports = {uploader:uploader,eventModelLoader: eventModelLoader}
