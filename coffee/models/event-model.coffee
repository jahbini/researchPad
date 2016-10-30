# model def for ten second snippets of the whole trajectory.  snips saved to
# the host as soon as they are complete.  Rejects are saved for later upload

Backbone = require 'backbone'
_ = require 'underscore'
require('../lib/console')
{eventModelLoader}  = require '../lib/upload.coffee'

EventModel = Backbone.Model.extend {
  url: 'event'
  initialize: (role ,@device=null)->
    @set 'role', role
    @flusher = setInterval _.bind(@flush,@), 10000
    sessionInfo = Pylon.get 'sessionInfo'
    @.listenTo sessionInfo, 'change:_id',()->
      @set 'session',sessionInfo.get '_id'
    return

  flush: ()->
    if @device
      @set 'UUID', @device.id
    flushTime = Date.now()
    if (@.has 'session') && (@.has 'readings')
      eventModelLoader _.clone @
    @.unset 'readings',''
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
      console.log "Action Event:",sample
      @.set 'captureDate',Date.now()   #new time for next auto flush
      @set 'readings' , sample
      @flush()
}

exports.EventModel = EventModel
