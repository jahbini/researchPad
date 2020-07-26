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
      Pylon.sessionInfo.set 'duration',-1
      if !p.get 'gestureCapture'
        Pylon.set 'logonVersion',"Not Active"
        Pylon.sessionInfo.set 'duration',0
        Pylon.trigger "systemEvent:externalTimer:show"
        if "Not Active" == Pylon.get "logonVersion"
          alert "Initialization Failure, press OK to reload"
          window.location.reload()
          return
      if p.get 'mileStonesAreProtocols'
        @allMyProtocols = (p.get 'mileStones')[..]  #copy mileStones as an array
      else
        @allMyProtocols = [p.get 'name' ]
      
      sessionInfo=Pylon.sessionInfo
      if sessionInfo.isNew()
        startProtocol()
      else
        leadIn()
      return 

    abort= ()=>
      pHT.stopCount()
      Pylon.trigger('systemEvent:recordCountdown:fail')
      Pylon.trigger 'removeRecorderWindow'
      return

    startProtocol= ()=>
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
      if !p.get 'gestureCapture'
        pHT.setEnvironment
          buttonSpec:
            phaseButton: ()-> T.h4 "Stop"
            buttonPhaseNext: exitThisTest
          headline: "Test In Progress"
          paragraph:  (p.get "mileStoneText") || "go"
          start: 0  # since we are using the walkcourse ssensors not the sensorTags
          limit: 0  # do not show any time duration on walking tests
          nextPhase: selectTheNextTest
          action: "underway/#{p.get 'testDuration'}"
      else
        pHT.setEnvironment
          headline: "Test In Progress"
          paragraph:  (p.get "mileStoneText") || "go"
          start: start
          limit: limit
          nextPhase: selectTheNextTest
          action: "underway/#{p.get 'testDuration'}"
      return

    ###
    #fake clicking the stop button
    ###

    exitThisTest = ()->
      Pylon.trigger "systemEvent:action:stop"
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

    Pylon.on "systemEvent:action:stop", countOut=  ()=>
      # was -- Pylon.state.set recording: 'stopping' # lead-out phase of test is gone
      Pylon.state.set recording: false
      Pylon.trigger 'systemEvent:protocol:terminate'
      pHT.stopCount()
      terminate()
      return

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
      #JAH -- put up accept or reject buttons
      Pylon.trigger 'removeRecorderWindow',2000
      $("#acceptreject").fadeIn()

    return

Pylon.on "removeAcceptReject",->
  $("#acceptreject").fadeOut()
  return
pP = new protocolPhase
#if window? then window.exports = Pages
#if module?.exports? then module.exports = Pages
