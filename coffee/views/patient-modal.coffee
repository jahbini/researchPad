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
      #JAH
      @$el.fadeOut(time)

    return
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
    intrologger "sequence now #{struct.action}"
    if struct.action
      Pylon.trigger "protocol:phase", struct.action 
    @clientcode = struct.clientcode
    @render @start
    return
  initialize:()->
    @code = ''
    Pylon.on 'buttonPhase',()=>
      @buttonPhase()
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
        @nextPhase()
      if @code.match Pylon.unlock
        localStorage['clientUnlockOK']='false'
        localStorage['clientUnlock']=''
        xhr = Pylon.handheld.save clinic:null, clinician:null, client: null, testID:"", clientUnlock: "", clientUnlockOK:false, lockdownMode:false
        # force this as binding so window is defined
        # when the handheld structure is saved properly, we reboot
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
        @nextPhase()
        return
    else
      if nextTime < @limit
        intrologger "rendering top modal countdown nextTime:#{nextTime}"
        @nextPhase()
        return
    @clearCount = Pylon.saneTimeout 1000, ()=>@trigger "count:continue", nextTime
    return

activeKey = (digit)->
  T.div ".two.columns.round-button",
    style: "min-width:90px;height:100%",
    "#{Pylon.onWhat}":"Pylon.trigger('clientcode','#{digit}');Pylon.trigger('quickClass',$(this),'reversed')",
    digit

pHT = new protocolHeadTemplate()
if window? then window.exports = pHT
if module?.exports? then module.exports = pHT
