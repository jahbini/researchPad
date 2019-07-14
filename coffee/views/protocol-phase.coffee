# vim: et:ts=2:sw=2:sts=2:nowrap

Backbone = require('backbone')
$=require('jquery')
T = require('teacup')
buglog = require '../lib/buglog.coffee'
intrologger = (introlog= new buglog "intro").log
pHT= require "./patient-modal.coffee"

implementing = (mixins..., classReference) ->
  for mixin in mixins
    for key, value of mixin::
      classReference::[key] = value
  classReference

protocolPhase = Backbone.Model.extend
  defaults:
    protocol: null

  initialize: ->
    intrologger "initialize"
    #start a session by waiting for the host with a 5 second count-in
    #  if the showLeadIn is active, then put it up, else be quiet
    Pylon.on 'systemEvent:recordCountDown:start', =>
      @set 'protocol', p= Pylon.theProtocol()
      if !p.get 'gestureCapture'
        Pylon.trigger "systemEvent:externalTimer:show"
      if p.get 'mileStonesAreProtocols'
        @allMyProtocols = (p.get 'mileStones')[..]  #copy mileStones as an array
      else
        @allMyProtocols = [p.get 'name' ]
      
      sessionInfo=Pylon.sessionInfo
      if sessionInfo.isNew()
        start()
      else
        leadIn()
      return 

    abort= ()=>
      pHT.stopCount()
      Pylon.trigger('systemEvent:recordCountdown:fail')
      Pylon.trigger 'removeRecorderWindow'
      return

    start= ()=>
      if sessionInfo.isNew()
        sessionInfo.save()
      sessionID=Pylon.sessionInfo.get('_id')
      unless sessionID
        @listenToOnce Pylon.sessionInfo, 'change:_id',()=>
          intrologger "recieved sessionID, starting protocol with leadIn"
          leadIn()

        pHT.setEnvironment
          headline: "waiting 5 seconds for host"
          paragraph: ""
          nextPhase: abort
          limit: 0
          start: 5
      else
        leadIn()
      return 

    # leadIn means the sessionID for this test run exists
    leadIn= ()=>
      selectTheFirstTest()
      return
    ###    /// WAS   we have no more requirement for lead-in
      p = Pylon.theProtocol()

      unless  p.get 'showLeadIn'
        selectTheFirstTest()
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
        nextPhase: selectTheFirstTest
        start: start
        limit: limit
      return
    ###

    practice= ()=>
      Pylon.trigger 'systemEvent:protocol:active'
      # this is the moment the protocol is selected for display
      p = Pylon.theProtocol()
      duration = p.get 'practiceDuration'
      unless  (duration >0 && p.get 'showPractice' )
        underway()
        return
      pHT.setEnvironment
        headline: "Practice"
        paragraph:  (p.get "mileStoneText") || "go"
        limit: 0
        start: duration
        nextPhase: justWait
        action: "practice/#{duration}"
        buttonSpec:
          phaseButton: "Skip"
          buttonPhaseNext: underway
          zeroButton: "Proceed"
      return

    justWait= ()=>
      Pylon.trigger 'protocol:pause'
      return

    underway= ()=>
      Pylon.trigger 'protocol:proceed'
      p = Pylon.theProtocol()
      limit = p.get 'testDuration'
      if limit == 0
        start = 0
        limit = 9999
      else
        start = limit
        limit = 0
      pHT.setEnvironment
        headline: "Test In Progress"
        paragraph:  (p.get "mileStoneText") || "go"
        start: start
        limit: limit
        nextPhase: selectTheNextTest
        action: "underway/#{p.get 'testDuration'}"
      return

    selectTheNextTest= ()=>
      Pylon.trigger 'protocol:pause'
      newTest = @allMyProtocols.shift()
      if !newTest 
        countOut()
        return
      @allMyProtocols.unshift newTest
      pHT.setEnvironment
        headline: "Test Over. More to come."
        paragraph: "Press button to proceed"
        limit: 0
        start: 0
        nextPhase: justWait
        buttonSpec:
          phaseButton: "Proceed"
          buttonPhaseNext: proceedWithNextTest
      return
    
    setTestOrDefault = (name)->
      test = Pylon.setTheCurrentProtocol name
      if !test
        test = Pylon.setTheCurrentProtocol 'Default'
        if !test || !test.attributes
          alert "No Default Protocol from Server at #{Pylon.get 'hostUrl'}"
        else
          m= test.get 'mileStoneText'
          m += " '" + name + "'"
          test.set 'mileStoneText' ,m
      test

    proceedWithNextTest = ()=>
      newTest = @allMyProtocols.shift()
      setTestOrDefault newTest
      practice()
      return
  
    selectTheFirstTest= ()=>
      Pylon.trigger 'systemEvent:recordCountDown:over'
      Pylon.trigger 'protocol:pause'
      newTest = @allMyProtocols.shift()
      if !newTest 
        countOut()
        return

      setTestOrDefault newTest
      practice()

    Pylon.on "systemEvent:action:stop", countOut=  ()=>
      Pylon.state.set recording: 'stopping'
      Pylon.trigger 'systemEvent:protocol:terminate'
      pHT.stopCount()
      terminate()
      return

    ###   /// was removed -- no leadIn leadOut ref Harry July 2019
      p = @attributes.protocol
      unless  p.get 'showLeadIn'
        pHT.stopCount()
        terminate()
        return
      pHT.setEnvironment
        headline: "LeadOut"
        paragraph: "Good Job"
        start: p.get "leadInDuration"
        limit: 0
        nextPhase: terminate
      return
    ### 

    terminate= ()=>
      pHT.setEnvironment
        headline: "All Done"
        paragraph: "Please wait"
        start: 0
        limit: 0
        nextPhase: terminate 

      pHT.stopCount()
      Pylon.state.set recording: false
      Pylon.trigger 'systemEvent:stopCountDown:over'
      Pylon.trigger 'removeRecorderWindow',2000
      return
    return

pP = new protocolPhase
#if window? then window.exports = Pages
#if module?.exports? then module.exports = Pages
