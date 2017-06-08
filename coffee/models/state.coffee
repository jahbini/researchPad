# model def for the sysstem state -- update by events, subscribe to changes
#
buglog = require '../lib/buglog.coffee'
statelogger = (statelog= new buglog "app").log
statelog.enabled = true
Backbone = require 'backbone'
_ = require 'underscore'

State = Backbone.Model.extend
  defaults:
    calibrating: false
    recording: false
    scanning: false
    connected: []
    calibrate: false
    loggedIn:  false
  initialize: ()->
    @on 'change',->
      statelogger JSON.stringify @.attributes
    return

exports.state = new State
