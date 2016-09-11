# model def for ten second snippets of the whole trajectory.  snips saved to
# the host as soon as they are complete.  Rejects are saved for later upload

Backbone = require ('backbone')
require('../libs/dbg/console')
upload = require './upload.coffee'

Event = Backbone.Model.extend {
  url: 'event'
  initialize: (kind)->
    @set 'kind', kind
    @flusher = setInterval flush, 10000
    sessionInfo = Pylon.get 'sessionInfo'
    sessionInfo.listenTo 'change:_id',()->
      set 'trajectory',sessionInfo.get '_id'

  flush: ()=>
    flushTime = Date.now()
    if (@.has 'trajectory') && (@.has 'readings')
      uploader.eventLoader _.clone @
    @.unset 'readings'
    @.set 'captureDate',flushTime   #new time for next auto flush
    return

  addSample: (sample)->
    # add the current sample to the collection
    if 'event' == @.get 'kind'
      @flush()
    samples = @.get 'readings'
    samples += sample.toString()
    @.set 'readings',samples
}

exports.Event = Event
