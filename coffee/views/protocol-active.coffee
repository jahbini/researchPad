# vim: et:ts=2:sw=2:sts=2:nowrap

Backbone = require('backbone')
$=require('jquery')
T = require('teacup')
BV = require './button-view.coffee'
{colorTextBody,colorTextExample} = require './stroop.coffee'
{tappingBody,tappingExample} = require './tapping.coffee'
{tenIconBody,tenIconExample} = require './ten-icon.coffee'

saneTimeout = (time,f) ->
  setTimeout f,time

implementing = (mixins..., classReference) ->
  for mixin in mixins
    for key, value of mixin::
      classReference::[key] = value
  classReference

shuffle = (a) ->
  for i in [a.length-1..1]
    j = Math.floor Math.random() * (i)
    [a[i], a[j]] = [a[j], a[i]]
  a

###
# touchEntries has a converter fn for each of the keys of the touch structure from the OS
# used by logTouch fn to create uploadable event object from touch stuff from iOS
###
touchEntries =
  screenX:  (x)-> x.toFixed 0
  screenY:  (y)-> y.toFixed 0
  touchType:  (v)-> v
  identifier:  (i)-> ""+i
  radiusX: (x)-> x.toFixed 0
  radiusY: (y)-> y.toFixed 0
  target: (t)->
    extent = t.getBoundingClientRect()
    v="<#{t.localName}"
    v+= " id=\"#{t.id}\"" if t.id
    v+= ' className="' + t.className + '"' if t.className
    v+= ' t=' + extent.top.toFixed 0
    v+= ' b=' + extent.bottom.toFixed 0
    v+= ' l=' + extent.left.toFixed 0
    v+= ' r=' + extent.right.toFixed 0
    v+= '>'
    return v

logTouch = (event)->
  touches = for eachTouch in event.targetTouches
    touch={}
    for key,f of touchEntries
      if key == 'radiusX' || key == 'radiusY'
        if  0 == eachTouch[key]
          continue
      touch[key] = f eachTouch[key] 
    touch
  Pylon.trigger 'externalEvent', JSON.stringify {type: event.type,touches: touches}

listenForTouch = () ->
  b=document.body
  b.addEventListener "touchstart", logTouch
  b.addEventListener "touchend", logTouch
  b.addEventListener "touchcancel", logTouch
  b.addEventListener "touchmove", logTouch

dontListenForTouch = () ->
  b=document.body
  b.removeEventListener "touchstart", logTouch
  b.removeEventListener "touchend", logTouch
  b.removeEventListener "touchcancel", logTouch
  b.removeEventListener "touchmove", logTouch


Pylon.on "quickClass",(who,domClass)->
  who.addClass domClass
  setTimeout (()->who.removeClass domClass ), 100

#upload view template is now non-functional -- noop for initialize,render
ProtocolReportTemplate = Backbone.View.extend
    el: "#protocol-report"
    initialize: ()->
      # show protocol-report when the start count-down is finished

      Pylon.on 'protocol:phase',(phase)=>
        if phase
          theTest = Pylon.theProtocol()
          Pylon.trigger "systemEvent:phase:#{theTest.get 'name'}/#{phase}".replace /\ /g,'-'
        return
      Pylon.on 'protocol:response',(entry)=>
        @renderExample.response entry,@renderBody.wanted  if @renderExample
        return
      Pylon.on 'systemEvent:protocol:active', ()=>
        dontListenForTouch()
        theTest = Pylon.theProtocol()
        @$el.hide()
        if  !theTest.get 'gestureCapture'
          @$el.show()
          Pylon.trigger "systemEvent:externalTimer:show"
          return
        @$el.show()
        listenForTouch()
        @$el.fadeIn()
        @$el.addClass 'active'
        # start with only the goButton enabled
        @$('button').prop disabled: false
        @showProtocol (theTest.get 'name'),theTest
        return

      Pylon.on 'systemEvent:protocol:terminate', (time=1000)=>
        @renderExample.clear() if @renderExample
        @renderExample=null
        @renderBody=null
        dontListenForTouch()
        @$('button').prop disabled: true
        @$el.fadeOut(time)
      ###
      # Protocol pause to turn off active test body region
      ###
      Pylon.on 'protocol:pause',()=>
        @$el.fadeOut(100)
        return 
      Pylon.on 'protocol:proceed',()=>
        @$el.fadeIn(100)
        return 

    showProtocol: (name,theTest)->
      engine=theTest.get 'engine'
      switch engine
        when 'stroop'
          @renderExample =  new colorTextExample model: theTest
          @renderBody = new colorTextBody model: theTest
        when 'sdmt','smdt'
          @renderExample = new tenIconExample model: theTest
          @renderBody = new tenIconBody model: theTest
        else
          @renderExample = new tappingExample model: theTest
          @renderBody = new tappingBody model: theTest
      @render()
      return

    # show panel of action buttons
    render: ()->
      theTest = Pylon.theProtocol()
      return unless theTest.get 'gestureCapture'
      @renderBody.render()
      @

exports.ProtocolReportTemplate = new ProtocolReportTemplate
#if window? then window.exports = Pages
#if module?.exports? then module.exports = Pages
