# vim: et:ts=2:sw=2:sts=2:nowrap

Backbone = require('backbone')
$=require('jquery')
T = require('teacup')
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
    intrologger "initialize"
    @on 'unlocked',()->
      intrologger "unlocking handheld"
      Pylon.trigger "systemEvent:lockdown:unlock"
    Pylon.on 'systemEvent:lockdown:lock',=>
      intrologger "locking handheld"
      p = Pylon.theProtocol()
      if p.get 'lockDown'
        if localStorage['clientUnlockOK'] == 'true'
          Pylon.saneTimeout 0,()=>@trigger 'continueCloneableSuite'
        else
          Pylon.saneTimeout 0,()=>@trigger 'startCloneableSuite'
        return

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
      
      sessionInfo=Pylon.get('sessionInfo')
      if sessionInfo.isNew()
        Pylon.saneTimeout 0,()=>@trigger 'start'
      else
        Pylon.saneTimeout 0,()=>@trigger 'leadIn'
      return 

    @on 'abort',=>
      pHT.stopCount()
      Pylon.trigger('systemEvent:recordCountdown:fail')
      Pylon.trigger 'removeRecorderWindow'
      return

    @on 'start', =>
      if sessionInfo.isNew()
        sessionInfo.save()
      sessionID=Pylon.get('sessionInfo').get('_id')
      unless sessionID
        @listenToOnce Pylon.get('sessionInfo'), 'change:_id',()=>
          Pylon.saneTimeout 0,()=>
            @.trigger 'leadIn'

        pHT.setEnvironment
          headline: "waiting for host"
          paragraph: ""
          nextPhase: 'abort'
          limit: 0
          start: 5
      else
        Pylon.saneTimeout 0,()=>
          @.trigger 'leadIn'
      return 

    startCloneableSuite= ()->
      pHT.setEnvironment
        headline: "Write This Unlock Code Down"
        paragraph: "#{localStorage['clientUnlock']} This four digit code is your patient unlock code for this series."
        nextPhase: "continueCloneableSuite"
        start: 0
        limit: 0
        buttonSpec:
          phaseButton: "Enter Lock Down Mode"
      return

    continueCloneableSuite= ()=>  # put up unlock screen
      #code = prompt "Ready for next test. enter code to abort","proceed"
      paragraph = "Press the keys with your unlock code"
      p= Pylon.theProtocol()
      if p.get 'demoOnly'
        paragraph += " DEMO ONLY code = #{localStorage['clientUnlock']}"
      pHT.setEnvironment
        headline: "Enter the Unlock Code"
        paragraph: paragraph
        nextPhase: "unlocked"
        clientcode: localStorage['clientUnlock']
        start: 0
        limit: 0
        #buttonSpec:
        #  phaseButton: "Hi I am unlock"
      return

    @on 'continueCloneableSuite', continueCloneableSuite
    @on 'startCloneableSuite', startCloneableSuite
    # leadIn means the sessionID for this test run exists
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
        buttonSpec:
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
        action: "practice/#{duration}"
        buttonSpec:
          phaseButton: "Skip"
          buttonPhaseNext: "underway"
          zeroButton: "Proceed"
      return

    @on 'justWait',=>
      Pylon.trigger 'protocol:pause'
      return

    @on 'underway', =>
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
        nextPhase: 'selectTheNextTest'
        action: "underway/#{p.get 'testDuration'}"
      return

    @on 'selectTheNextTest',()->
      Pylon.trigger 'protocol:pause'
      newTest = @allMyProtocols.shift()
      if !newTest 
        @trigger 'countOut'
        return
      @allMyProtocols.unshift newTest
      pHT.setEnvironment
        headline: "Test Over. More to come."
        paragraph: "Press button to proceed"
        limit: 0
        start: 0
        nextPhase: "justWait"
        buttonSpec:
          phaseButton: "Proceed"
          buttonPhaseNext: "proceedWithNextTest"
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

    @on 'proceedWithNextTest',()->
      newTest = @allMyProtocols.shift()
      setTestOrDefault newTest
      @.trigger 'practice'
      return
    @on 'selectTheFirstTest',()->
      Pylon.trigger 'protocol:pause'
      newTest = @allMyProtocols.shift()
      if !newTest 
        @trigger 'countOut'
        return

      setTestOrDefault newTest
      @.trigger 'practice'
      return

    Pylon.on "systemEvent:action:stop", =>
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
      pHT.setEnvironment
        headline: "Get Ready"
        paragraph: "Please wait"
        start: 0
        limit: 0
        nextPhase: "terminate" 
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
    Pylon.on 'showRecorderWindow', ()=>
      p = Pylon.theProtocol()
      if p.get 'gestureCapture'
        @$el.addClass 'hide-top'
        @$el.removeClass 'show-top'
      else
        @$el.addClass 'show-top'
        @$el.removeClass 'hide-top'
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
    @buttonSpec = struct.buttonSpec
    @buttonPhase = @buttonSpec?.buttonPhaseNext || struct.nextPhase
    @limit = struct.limit
    @start = struct.start
    @direction = if @limit < @start  then -1 else if @limit==@start then 0 else 1
    @nextPhase = struct.nextPhase 
    intrologger "sequence now #{struct.action}, will be #{@nextPhase}"
    if struct.action
      Pylon.trigger "protocol:phase", struct.action 
    @clientcode = struct.clientcode
    @render @start
    return
  initialize:()->
    @code = ''
    Pylon.on 'buttonPhase',()=>
      pP.trigger @buttonPhase
      return
    @on 'count:continue', (t)=>
      @render t
    @$el.addClass "container"
    Pylon.on 'clientcode', (digit)=>
      @code += digit
      @code=@code[-10..]
      if @code.match @clientcode
        localStorage['clientUnlockOK']='true'
        Pylon.handheld.save 'clientUnlockOK',true
        pP.trigger @nextPhase
      if @code.match Pylon.unlock
        localStorage['clientUnlockOK']='false'
        localStorage['clientUnlock']=''
        xhr = Pylon.handheld.save clinic:null, clinician:null, client: null, testID:"", clientUnlock: "", clientUnlockOK:false
        # force this as binding so window is defined
        xhr.always ()=> window.location.reload()
        return

  render:(t)->
    if t != @start && t != @limit
      @$( ".timer").html t
    else
      intrologger "rendering top modal, start:#{@start}, limit:#{@limit}, direction: #{@direction}"
      @$el.html T.render =>
        T.div ".row",=>
          if @buttonSpec
            T.button ".u-pull-left.button-primary",
              {onClick:  "Pylon.trigger('buttonPhase');"},
              if t==0
                @buttonSpec.zeroButton || @buttonSpec.phaseButton
              else
                @buttonSpec.phaseButton
          T.div ".u-pull-left",=>
            T.h3  =>
              if @direction
                if t !=  @limit
                  T.text @headline  +  (if @direction < 0 then ": count down " else ": time ") 
                  T.span ".timer", t
                else
                  T.text @headline + "- Finished"
              else
                T.text @headline 
        T.div ".row",=>
          T.h4 style:"text-align:center",@paragraph
        if @clientcode  #put up ten key pad
          T.div style:"height:0.5in"
          T.div ".row", =>
            T.div ".three.columns", =>
              T.div ".row",-> T.raw "&nbsp;"
              T.div ".row",->
            T.div  ".nine.columns","keypad",->
              T.div ".row",style:'padding-bottom:13px;',->
                activeKey k for k in [1..3]
              T.div ".row",style:'padding-bottom:13px;',->
                activeKey k for k in [4..6]
              T.div ".row",style:'padding-bottom:13px;',->
                activeKey k for k in [7..9]
              T.div ".row",->
                T.div ".two.columns",style:"min-width:90px;",->T.raw "&nbsp;"
                activeKey 0
    return unless @direction
    nextTime = t + @direction
    if @direction > 0
      if nextTime > @limit
        intrologger "rendering top modal countup nextTime:#{nextTime}"
        pP.trigger @nextPhase
        return
    else
      if nextTime < @limit
        intrologger "rendering top modal countdown nextTime:#{nextTime}"
        pP.trigger @nextPhase
        return
    @clearCount = Pylon.saneTimeout 1000, ()=>@trigger "count:continue", nextTime
    return

activeKey = (digit)->
  T.div ".two.columns.round-button",
    style: "min-width:90px;height:100%",
    "#{Pylon.onWhat}":"Pylon.trigger('clientcode','#{digit}');Pylon.trigger('quickClass',$(this),'reversed')",
    digit

pHT = new protocolHeadTemplate()
#if window? then window.exports = Pages
#if module?.exports? then module.exports = Pages
