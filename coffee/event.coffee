# model def for ten second snippets of the whole trajectory.  snips saved to
# the host as soon as they are complete.  Rejects are saved for later upload

Backbone = require ('backbone')
require('../libs/dbg/console')

Event = Backbone.Model.extend {
  url: 'event'
  initialize: ()->
    @
  flush: ()=>
    @.set 'readings',''

  addSample: (sample)->
    # add the current sample to the collection
    @flush()
    @push s
}

exports.Event = Event
