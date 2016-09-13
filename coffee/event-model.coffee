# model def for ten second snippets of the whole trajectory.  snips saved to
# the host as soon as they are complete.  Rejects are saved for later upload

Backbone = require 'backbone'
_ = require 'underscore'
require('../libs/dbg/console')
upload = require './upload.coffee'

EventModel = Backbone.Model.extend {
  url: 'event'
  initialize: (kind,@device=null)->
    @set 'kind', kind
    @flusher = setInterval _.bind(@flush,@), 10000
    sessionInfo = Pylon.get 'sessionInfo'
    debugger
    @.listenTo sessionInfo, 'change:_id',()->
      @set 'trajectory',sessionInfo.get '_id'
    return

  flush: ()->
    flushTime = Date.now()
    if (@.has 'trajectory') && (@.has 'readings')
      uploader.eventModelLoader _.clone @
    @.unset 'readings'
    @.set 'captureDate',flushTime   #new time for next auto flush
    return

  addSample: (sample)=>
    # add the current sample to the collection
    kind = @.get 'kind'
    if kind == 'left' || 'right'
      samples = @.get 'readings'
      samples += sample.toString()
      @.set 'readings',samples
    else
      @flush()
      debugger
      @set 'readings' , sample
}

exports.EventModel = EventModel
