# model def for the sysstem state -- update by events, subscribe to changes
#
buglog = require '../lib/buglog.coffee'
statelogger = (statelog= new buglog "state").log
statelog.enabled = true
Backbone = require 'backbone'
_ = require 'underscore'

State = Backbone.Model.extend
  defaults:
    calibrating: false
    recording: false
    scanning: false
    connected: []
    loggedIn:  false
    connectingLeft: false
    connectingRight: false
  initialize: ()->
    @on 'change',->
      statelogger JSON.stringify @.attributes
    return
  timedState: (key,val1=true,val2=false,time=5000)->
    setTimeout (()->Pylon.state.set key, val1),0
    setTimeout (()->Pylon.state.set key, val2),time

exports.state = new State
