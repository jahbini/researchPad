# vim: et:ts=2:sw=2:sts=2:nowrap

Backbone = require('backbone')
$=require('jquery')
T = require('teacup')
BV = require './button-view.coffee'
buglog = require '../lib/buglog.coffee'
intrologger = (introlog= new buglog "intro").log

implementing = (mixins..., classReference) ->
  for mixin in mixins
    for key, value of mixin::
      classReference::[key] = value
  classReference

protocolPhase = Backbone.Model.extend
  defaults:
    protocol: null

  initialize: ->
    #start a session by waiting for the host with a 5 second count-in
    #  if the showLeadIn is active, then put it up, else be quiet
    Pylon.on 'systemEvent:recordCountDown:start', =>
      Pylon.state.set recording: true
      @set 'protocol', p= Pylon.theProtocol()
      @leadIn = if p.get 'showLeadIn' then (p.get 'leadInDuration') || 5 else 0
      @practice = if p.get 'showPractice' then p.get 'practiceDuration' else 0
      @goDuraftion =  p.get 'goDuration'
      sessionID=Pylon.get('sessionInfo').get('_id')
      if sessionID
        Pylon.saneTimeout 0,()=>@trigger 'leadIn'
      else
        Pylon.saneTimeout 0,()=>@trigger 'start'
      return 

    @on 'abort',=>
      pHT.stopCount()
      Pylon.trigger('systemEvent:recordCountdown:fail')
      Pylon.trigger 'removeRecorderWindow'
      return

    @on 'start', =>
      sessionID=Pylon.get('sessionInfo').get('_id')
      unless sessionID
        @listenToOnce Pylon.get('sessionInfo'), 'change:_id',()=>
          Pylon.saneTimeout 0,()->
            Pylon.trigger 'leadIn'

        pHT.setEnvironment
          headline: "waiting for host"
          paragraph: ""
          nextPhase: 'abort'
          linit: 5
          start: 0
      else
        Pylon.saneTimeout 0,->
          Pylon.trigger 'leadIn'
      return
    @on 'leadIn',()=>
      p = @attributes.protocol
      unless  p.get 'showLeadIn'
        Pylon.saneTimeout 0, @trigger 'practice'
        return
      duration = p.get 'leadInDuration'
      if duration == 0
        start=0
        limit=7
      else
        start = duration
        limit = 0
      pHT.setEnvironment
        headline: "LeadIn"
        paragraph: "Get Ready"
        nextPhase: "practice"
        start: start
        limit: limit
        abortButton: "Stop"
      return

    @on 'practice', =>
      Pylon.trigger 'systemEvent:recordCountDown:over'
      Pylon.trigger 'systemEvent:protocol:active'
      p = @attributes.protocol
      duration = p.get 'practiceDuration'
      unless  (duration >0 && p.get 'showPractice' )
        Pylon.saneTimeout 0, @trigger 'underway' 
        return
      pHT.setEnvironment
        headline: "Practice"
        paragraph:  (p.get "mileStoneText") || "go"
        limit: 0
        start: duration
        nextPhase: "underway"
      return

    @on 'underway', =>
      p = @attributes.protocol
      pHT.setEnvironment
        headline: "Test In Progress"
        paragraph:  (p.get "mileStoneText") || "go"
        limit: (p.get "testDuration") || 9999
        start: 0
        nextPhase: 'countOut'
      return

    Pylon.on 'systemEvent:stopCountDown:start', =>
      @trigger 'countOut'
    @on 'countOut', =>
      Pylon.state.set recording: 'stopping'
      Pylon.trigger 'systemEvent:protocol:terminate'
      p = @attributes.protocol
      unless  p.get 'showLeadIn'
        pHT.stopCount()
        @trigger 'terminate'
        return 
      pHT.setEnvironment
        headline: "LeadOut"
        paragraph: "Good Job"
        start: p.get "leadInDuration"
        limit: 0
        nextPhase: "terminate" 
      return
    @on 'terminate',=>
      pHT.stopCount()
      Pylon.state.set recording: false
      Pylon.trigger 'systemEvent:stopCountDown:over'
      Pylon.trigger 'removeRecorderWindow',2000
      return


pP = new protocolPhase
###
a modal dialog that counts in the test, and then counts out the test
count duration is five seconds - window to show count-down
This is intended to record five seconds of padding to the actual test
###
#recorder
recorderViewTemplate = Backbone.View.extend
  el: "#recorder"
  render: ->

  initialize: ()->
    Pylon.on 'systemEvent:recordCountDown:start', (time)=>
      @$el.fadeIn()
    Pylon.on 'removeRecorderWindow', (time=1000)=>
      @$el.fadeOut(time)
exports.recorderViewTemplate = new recorderViewTemplate

protocolHeadTemplate = Backbone.View.extend
  el: "#count-down"
  stopCount: ->
    clearTimeout @clearCount if @clearCount
    return

  setEnvironment: (struct)->
    if @clearCount
      clearTimeout @clearCount
      @clearCount = null
    @headline = struct.headline
    @paragraph = struct.paragraph
    @abortButton = struct.abortButton || @abortButton
    @limit = struct.limit
    @start = struct.start
    @direction = if @limit < @start  then -1 else 1
    @nextPhase = struct.nextPhase 
    @render @start
    return
  initialize:()->
    @on 'count:continue', (t)=>
      @render t
    @$el.addClass "container"
  render:(t)->
    if t != @start
      @$( ".timer").html t
    else
      @$el.html T.render =>
        T.div ".row",=>
          T.div ".u-pull-left",=>
            T.h3  =>
              T.text @headline  +  (if @direction < 0 then ": count down " else ": time ") 
              T.span ".timer", t
          if @abortButton
            T.button ".u-pull-right.button-primary",
              {onClick:  "$('#action').click()"},
              @abortButton
        T.div ".row",=>
          T.h4 style:"text-align:center",@paragraph
    nextTime = t + @direction
    if @direction > 0
      if nextTime > @limit
        pP.trigger @nextPhase
        return
    else
      if nextTime < @limit
        pP.trigger @nextPhase
        return
    @clearCount = Pylon.saneTimeout 1000, ()=>@trigger "count:continue", nextTime
    return
pHT = new protocolHeadTemplate()
#if window? then window.exports = Pages
#if module?.exports? then module.exports = Pages
