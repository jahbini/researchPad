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
      if p.get 'mileStonesAreProtocols'
        @allMyProtocols = (p.get 'mileStones')[..]  #copy mileStones as an array
      else
        @allMyProtocols = [p]
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
          limit: 5
          start: 0
      else
        Pylon.saneTimeout 0,->
          Pylon.trigger 'leadIn'
      return
    @on 'leadIn',()=>
      p = Pylon.theProtocol()
      unless  p.get 'showLeadIn'
        Pylon.saneTimeout 0, @trigger 'selectTheFirstTest'
        return
      duration = p.get 'leadInDuration'
      if duration == 0
        start=5
        limit=0
      else
        start = duration
        limit = 0
      pHT.setEnvironment
        headline: "LeadIn"
        paragraph: "Get Ready"
        nextPhase: "selectTheFirstTest"
        start: start
        limit: limit
        phaseButton: "Stop"
      return

    @on 'close preamble',()=>
      Pylon.trigger 'systemEvent:recordCountDown:over'
      @.trigger 'selectTheFirstTest'

    @on 'practice', =>
      Pylon.trigger 'systemEvent:protocol:active'
      # this is the moment the protocol is selected for display
      p = Pylon.theProtocol()
      duration = p.get 'practiceDuration'
      unless  (duration >0 && p.get 'showPractice' )
        Pylon.saneTimeout 0, @trigger 'underway' 
        return
      pHT.setEnvironment
        headline: "Practice"
        paragraph:  (p.get "mileStoneText") || "go"
        limit: 0
        start: duration
        nextPhase: "justWait"
        phaseButton: "Proceed to Test"
        buttonPhaseNext: "underway"
      return

    @on 'justWait',=>
      Pylon.trigger 'protocol:pause'
      return

    @on 'underway', =>
      Pylon.trigger 'protocol:proceed'
      p = Pylon.theProtocol()
      pHT.setEnvironment
        headline: "Test In Progress"
        paragraph:  (p.get "mileStoneText") || "go"
        start: (p.get "testDuration") || 9999
        limit: 0
        nextPhase: 'selectTheNextTest'
      return

    @on 'selectTheNextTest',()->
      Pylon.trigger 'protocol:pause'
      newTest = @allMyProtocols.shift()
      if !newTest 
        @trigger 'countOut'
        return
      @allMyProtocols.unshift newTest
      pHT.setEnvironment
        headline: "Ready?"
        paragraph: "Press button to proceed"
        limit: 0
        start: 1
        nextPhase: "justWait"
        phaseButton: "Proceed to Test"
        buttonPhaseNext: "proceedWithNextTest"
      return
    
    @on 'proceedWithNextTest',()->
      newTest = @allMyProtocols.shift()
      Pylon.setTheCurrentProtocol newTest
      @.trigger 'practice'
      return

    @on 'selectTheFirstTest',()->
      Pylon.trigger 'protocol:pause'
      newTest = @allMyProtocols.shift()
      if !newTest 
        @trigger 'countOut'
        return

      Pylon.setTheCurrentProtocol newTest
      @.trigger 'practice'
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
    @phaseButton = struct.phaseButton
    @limit = struct.limit
    @start = struct.start
    @direction = if @limit < @start  then -1 else 1
    @nextPhase = struct.nextPhase 
    @buttonPhase = struct.buttonPhaseNext || struct.nextPhase
    @render @start
    return
  initialize:()->
    Pylon.on 'buttonPhase',()=>
      pP.trigger @buttonPhase
      return
    @on 'count:continue', (t)=>
      @render t
    @$el.addClass "container"
  render:(t)->
    if t != @start
      @$( ".timer").html t
    else
      @$el.html T.render =>
        T.div ".row",=>
          if @phaseButton
            T.button ".u-pull-left.button-primary",
              {onClick:  "Pylon.trigger('buttonPhase');"},
              @phaseButton
          T.div ".u-pull-left",=>
            T.h3  =>
              T.text @headline  +  (if @direction < 0 then ": count down " else ": time ") 
              T.span ".timer", t
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
