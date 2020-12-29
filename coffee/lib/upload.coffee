# # stagapp
# vim: et:ts=2:sw=2:sts=2
# ## data handler for clinical recording of SensorTag data
# SensorTag object.

$ = require('jquery')
_ = require('underscore')
Backbone = require ('backbone')
buglog = require './buglog.coffee'
uplogger = (uplog= new buglog "uploader").log
#uplog.enable 'uploader'

#uplogger "initializing"
localStorage = window.localStorage
Pylon = window.Pylon

uploading = false

timeOutScheduled = false
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
      
#store prepared backbone object.attributes into localStorage, based on upload ticket.
setBadItem = (backboneAttributes)->
  #must have an LSid
  #trash_can is a string of comma separated LSid's of objects to upload
  bad = localStorage.getItem('trash_can')
  bad =  (bad && bad.split(",")) || []
  #put the bad object back in the localStorage at it's old name
  localStorage.setItem backboneAttributes.LSid, JSON.stringify backboneAttributes
  if needs bad, backboneAttributes.LSid
    bad.push backboneAttributes.LSid
    localStorage.setItem 'trash_can', bad.join ','
  return
  
      
oldAll = -1  
records = ()->
  #all_events is a string of comma separated LSid's of objects to upload
  all = localStorage.getItem('all_events')
  all =  (all && all.split(",")) || []
  # update the count of local items on the screen
  if (l=all.length) != oldAll
    Pylon.trigger "UploadCount", all.length
  oldAll = l
  return all

#store prepared backbone object.attributes into localStorage, based on upload ticket.
setNewItem = (backboneAttributes,time=50)->
  #must have an LSid
  events =records()
  #uplogger "keys = #{events.join ','}"
  
  localStorage.setItem backboneAttributes.LSid, JSON.stringify backboneAttributes
  if needs events, backboneAttributes.LSid
    events.push backboneAttributes.LSid
    localStorage.setItem 'all_events', events.join ','
  timeOutScheduled = true
  setTimeout getNextItem, time
  return
  
accessItem = (lsid)->
  #uplogger "accessing item #{lsid}"
  return localStorage.getItem lsid
  

removeItem = (lsid)->
  #uplogger "removing item #{lsid}"
  events = records()
  ###
  remove item from event array 
  coffee> a=[10,11,12,13,14,15,10,11,12,13,14,15]
    [ 10, 11, 12, 13, 14, 15, 10, 11, 12, 13, 14, 15 ]
  coffee> a.splice(key,1) for id,key in a when id is 13
    [ [ 13 ], [ 13 ] ]
  coffee> a
    [ 10, 11, 12, 14, 15, 10, 11, 12, 14, 15 ]
  ###
  events.splice(key,1) for id,key in events when id is lsid
  localStorage.removeItem lsid
  localStorage.setItem 'all_events', events.join ','
  #uplogger "removeItem set all_events #{events.join ',' }"
  return
  
# get next item gets and removes a model from local storage,
# converts it to object form (attributes)
getNextItem = ()->
  #uplogger "Uploader Activated"
  events = records()
  if !events.length
    #uplogger "Nothing  to Upload"
    timeOutScheduled = false
    return null
  if !events.length || uploading
    #uplogger "Busy -- "
    return null
  
  key = events.shift()
  item = accessItem key 
  try
    uploadDataObject = JSON.parse item
  catch e
    uplogger "Error in localStorage retrieval- key==#{key}"
    uplogger "item discarded -- invalid JSON",item
    return null
  sendToHost uploadDataObject

# eventModelUploader will upload models to the server.
# if the communication fails, the model is serialized and put into localStorage
#  the uploadData is in object form (after JSON.parse, before JSON.stringify)
MyId = ()->
  return "Up-#{hiWater()}"

eventModelLoader = (uploadDataModel)->
  if !uploadDataModel.attributes
    uplogger "Refusing to upload model with no attributes"
  item = {}
  for key,value of uploadDataModel.attributes
    item[key] = value
  item.LSid = MyId()
  item.url = uploadDataModel.url
  item.hostFails = 0
  
  #uplogger "adding #{item.LSid} to localStorage"
  setNewItem item
  return

sendToHost = (uDM)->    
  uploading = uDM.LSid  
  url = uDM.url
  url = (Pylon.get 'hostUrl')+url unless url.match 'http[s]?://'
  hopper = Backbone.Model.extend {
    url: url
  }
  uploadDataObject = new hopper uDM
  ###
  #  uncomment to force failures in testing
  if .2 > Math.random()
    uploadDataObject.url = "silly"
  ###

  uploadDataObject.save null,{
    success: (a,b,code)->
      uDM= a.attributes
      id = uDM.LSid
      removeItem id
      uploading = false
      if uDM.session # events have a session attribute, the sessionInfo does not
        uplogger "success #{id} #{uDM.url}, #{uDM._id}"
      else
        uplogger "success #{id} (session) "
        Pylon.trigger 'sessionUploaded'
      #uplogger "upload of #{id} complete"
      setTimeout getNextItem, 0
      return
    error: (a,b,c)->
      uploading = false
      # rotate error item to end of the upload stuff
      stophere = "error"
      uDM= a.attributes
      code=b.statusText
      if uDM.session
        uplogger "failure #{uDM.LSid} #{code} ",uDM.url, uDM.readings.substring(0,30),uDM.role, uDM.session
      else
        uplogger "failure (session) #{code} #{uDM.LSid} ",uDM.url, uDM.id
      id = uDM.LSid
      removeItem id
      uDM.hostFails += 1
      if uDM.hostFails >10
        uplogger "item #{id} removed from upload queue"
        setBadItem uDM
        timeOutScheduled = true
        setTimeout getNextItem, 0
        return

      #otherwise, put it at the end of the upload queue
      setNewItem uDM, 100
      return
    }
  return

uploader = ->
  alert "Uploader Called!"
  return
  
timeOutScheduled = true
setTimeout getNextItem, 5000
### this is how seen exports things -- it's clean.  we use it as example
#seen = {}
#if window? then window.seen = seen # for the web
#if module?.exports? then module.exports = seen # for node
#
###
module.exports = {uploader:uploader,eventModelLoader: eventModelLoader}
