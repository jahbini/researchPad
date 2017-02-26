# # stagapp
# vim: et:ts=2:sw=2:sts=2
# ## data handler for clinical recording of SensorTag data
# SensorTag object.

$ = require('jquery')
_ = require('underscore')
Backbone = require ('backbone')
require('./console')

localStorage = window.localStorage
Pylon = window.Pylon

needs = (array, key)->
  return false for id in array when id is key
  return true

hiWater = ()->
  high = localStorage.getItem('hiWater') || 1
  try
    #force high into numeric form
    high=1*high+1
  catch
    high=1
  localStorage.setItem 'hiWater', high
  return high
      
oldAll = -1  
records = ()->
  all = localStorage.getItem('all_events')
  all =  (all && all.split(",")) || []
  # update the count of local items on the screen
  if (l=all.length) != oldAll
    Pylon.trigger "UploadCount", all.length
  oldAll = l
  return all

#store new backbone object.attributes into localStorage, based on upload ticket.
setNewItem = (backboneAttributes)->
  events =records()
  return events unless backboneAttributes
  localStorage.setItem backboneAttributes.LSid, JSON.stringify backboneAttributes
  if needs events, backboneAttributes.LSid
    events.push backboneAttributes.LSid
    localStorage.setItem 'all_events', events.join ','
  return events

# get next item gets and removes a model from local storage,
# converts it to object form (attributes)
getNextItem = ()->
  events = records()
  return null if !events.length
  key = events.shift()
  item = localStorage.getItem key
  localStorage.removeItem key
  localStorage.setItem 'all_events', events.join ','
  try
    uploadDataObject = JSON.parse item
  catch e
    console.log "Error in localStorage retrieval- key==#{key}"
    console.log "upload item discarded -- invalid JSON"
    return null
  eventModelLoader uploadDataObject

# eventModelUploader will upload models to the server.
# if the communication fails, the model is serialized and put into localStorage
#  the uploadData is in object form (after JSON.parse, before JSON.stringify)
MyId = ()->
  return "Up-#{hiWater()}"

eventModelLoader = (uploadDataModel)->
  if (uDM=uploadDataModel).attributes
    uDM.attributes.url = uDM.url if uDM.attributes
    uDM = uDM.attributes
  hopper = Backbone.Model.extend {
    url: Pylon.get('hostUrl')+uDM.url
  }
  uploadDataObject = new hopper uDM
  uploadDataObject.set 'LSid',MyId() unless uploadDataModel.LSid
  uploadDataObject.set 'hostFails',0 unless uploadDataModel.hostFails 
  stress = Pylon.get 'stress'
  if stress> Math.random()
    #pretend to fail
    setNewItem uploadDataObject.attributes
    console.log "stress test upload failure, item #{uploadDataObject.get 'LSid'}, retry in 5 seconds"
    return
  uDM=uploadDataObject.attributes
  if uDM.session
    console.log "upload attempt #{uDM.LSid} ",uDM.url, uDM.readings.substring(0,30),uDM.role, uDM.session
  else
    console.log "upload attempt #{uDM.LSid} ",uDM.url, uDM._id
    
  uploadDataObject.save null,{
    success: (a,b,code)->
      uDM= a.attributes
      if uDM.session # events have a session attribute, the sessionInfo does not
        console.log "upload success #{uDM.LSid} ",uDM.url, uDM.readings.substring(0,30),uDM.role, uDM.session
      else
        Pylon.trigger 'sessionUploaded'
        console.log "upload success #{uDM.LSid} ",uDM.url, uDM._id
      console.log "upload on #{a.get "LSid"} complete"
      setTimeout getNextItem, 0
      return
    error: (a,b,c)->
      uDM= a.attributes
      if uDM.session
        console.log "upload failure #{uDM.LSid} ",uDM.url, uDM.readings.substring(0,30),uDM.role, uDM.session
      else
        console.log "upload failure #{uDM.LSid} ",uDM.url, uDM.id
      setTimeout getNextItem, 5000
      failCode = b.status
      # we try 10 times 
      fails = a.get 'hostFails'
      fails +=1
      console.log "Upload #{fails} failures (#{failCode}) on #{a.get 'LSid'}"
      # Try Again
      # insert the item into localStorage for upload again later
      setNewItem a.attributes
      return
    }
  return

uploader = ->
  alert "Uploader Called!"
  return

### this is how seen exports things -- it's clean.  we use it as example
#seen = {}
#if window? then window.seen = seen # for the web
#if module?.exports? then module.exports = seen # for node
#
###
module.exports = {uploader:uploader,eventModelLoader: eventModelLoader}
