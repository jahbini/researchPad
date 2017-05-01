# model def for ten second snippets of the whole trajectory.  snips saved to
# the host as soon as they are complete.  Rejects are saved for later upload

Backbone = require 'backbone'
_ = require 'underscore'
{eventModelLoader}  = require '../lib/upload.coffee'

EventModel = Backbone.Model.extend {
  url: 'event'
  # flush and zero out session to prevent uploads
  close: ->
    #  clearInterval @flusher
    @flush()
    #this may be overkill, but we really want no further data for the session
    if @device
      @.unset 'session'

  initialize: (role ,@device=null)->
    @set 'role', role
    #set auto flush to terminate on endRecording
    @flusher = setInterval _.bind(@flush,@), 10000
    Pylon.on 'systemEvent:endRecording', _.bind @close,@

    sessionInfo = Pylon.get 'sessionInfo'
    @.listenTo sessionInfo, 'change:_id',()->
      @set 'session',sessionInfo.get '_id'
    return

  flush: ()->
    if @device
      @set 'UUID', @device.id
    flushTime = Date.now()
    if (@.has 'session') && (@.has 'readings')
      eventModelLoader @
    @.unset 'readings'
    @.set 'captureDate',flushTime   #new time for next auto flush
    return

  addSample: (sample)->
    # add the current sample to the collection
    role = (@.get 'role').toLowerCase()
    if role == 'left' || role == 'right'
      if  samples = @.get 'readings'
        samples += ';'+sample.toString()
      else
        @.set 'captureDate',Date.now()   #new time for next auto flush
        samples = sample.toString()
      @.set 'readings',samples
    else
      @.set 'captureDate',Date.now()   #new time for next auto flush
      @set 'readings' , sample
      @flush()
}

exports.EventModel = EventModel
