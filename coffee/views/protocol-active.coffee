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
#

###
#type: "touchstart"
#touches: TouchList
#0: Touch
# altitudeAngle: 0
#  azimuthAngle: 0
#   clientX: 321
#    clientY: 158
#     force: 0
#      identifier: 2043187604
#       pageX: 321
#        pageY: 158
#         radiusX: 128.796875
#          radiusY: 128.796875
#           rotationAngle: 0
#            screenX: 321
#             screenY: 158
#              target: <div class="three columns">
#               touchType: "direct"
#                Touch Prototype
#                1: Touch
#                 altitudeAngle: 0
#                  azimuthAngle: 0
#                   clientX: 562
#                    clientY: 354
#                     force: 0
#                      identifier: 2043187605
#                       pageX: 562
#                        pageY: 354
#                         radiusX: 154.5625
#                          radiusY: 154.5625
#                           rotationAngle: 0
#                            screenX: 562
#                             screenY: 354
#                              target: <div class="row">
#                               touchType: "direct"
#                                Touch Prototype
#                                length: 2
###

###
# touchEntries has a converter fn for each of the keys of the touch structure from the OS
# used by logTouch fn to create uploadable event object from touch stuff from iOS
###
touchEntries =
  screenX:  (x)-> x.toFixed 2
  screenY:  (y)-> y.toFixed 2
  touchType:  (v)-> v
  identifier:  (i)-> ""+i
  radiusX: (x)-> x.toFixed 2
  radiusY: (y)-> y.toFixed 2
  target: (t)->
    v="<#{t.localName}"
    v+= ' id="' + t.id +'"' if t.id
    v+= ' className="' + t.className + '"' if t.className
    v+= '>'
    v

logTouch = (event)->
  touches = for eachTouch in event.targetTouches
    touch={}
    for key,f of touchEntries
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
        @$el.attr( style: 'display:none')
        return unless theTest.get 'showMileStones'
        @$el.attr( style: 'display')
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
      return unless theTest.get 'showMileStones'
      @renderBody.render()
      @

exports.ProtocolReportTemplate = new ProtocolReportTemplate
#if window? then window.exports = Pages
#if module?.exports? then module.exports = Pages
