# vim: et:ts=2:sw=2:sts=2:nowrap

Backbone = require('backbone')
$=require('jquery')
T = require('teacup')
BV = require './button-view.coffee'
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
        switch theTest.get 'name'
          when 'Stroop Test' , 'stroop test' , 'Stroop test'
            @renderExample =  new colorTextExample model: theTest
            @renderBody = new colorTextBody model: theTest
          when 'ten icons'
            @renderExample = new tenIconExample model: theTest
            @renderBody = new tenIconBody model: theTest
          else
            @renderExample = new tappingExample model: theTest
            @renderBody = new tappingBody model: theTest
        @render()
        return

      Pylon.on 'systemEvent:protocol:terminate', (time=1000)=>
        @renderExample.clear() if @renderExample
        @renderExample=null
        @renderBody=null
        dontListenForTouch()
        @$('button').prop disabled: true
        @$el.fadeOut(time)

    # show panel of action buttons
    render: ()->
      theTest = Pylon.theProtocol()
      return unless theTest.get 'showMileStones'
      @renderBody.render()
      @

tappingBody = Backbone.View.extend
  el: "#protocol-report"
  clear: ()->
    @$el.html('')
    return
  initialize: ()->
    mileStones = @model.get('mileStones')
    @$el.html T.render =>
      T.div ".container", =>
        extraClass = ""
        T.div "row",style:"text-align:center", =>
          for btn in mileStones
            btnName = btn.replace(/ /g,'-').toLocaleLowerCase()
            T.button ".primary.round-button#{extraClass}",
              {style:"margin-right:1in",onClick: "Pylon.trigger('systemEvent:mileStone:#{btnName}');Pylon.trigger('quickClass',$(this),'reversed')"},
              -> T.span "#{btn}"
    return

colorTextBody = Backbone.View.extend
  el: "#protocol-report"
  clear: ()->
    @$el.html('')
    return
  initialize: ()->
    @wanted=null

    @$el.html T.render =>
      T.div ".container",style:"font-size:265%", =>
        extraClass = ""
        T.div ".row",style:"text-align:center", =>
          #select ther elements of currentTest in random order
          examples= shuffle (@model.get 'currentTest')[..]
          #make sure that the text and color are never the same
          names = shuffle examples[..]
          for example,i in examples
            btn = names[i]
            btnName = btn.replace(/ /g,'-').toLocaleLowerCase()
            T.span 
              onClick: "Pylon.trigger('protocol:response','#{btnName}');Pylon.trigger('quickClass',$(this),'reversed');"
              style: "padding-right:0.5em; text-shadow:2px 2px 3px #000000; color:#{example}"
              ,btn
        T.div ".row",style:"text-align:center;border:black;",->
          T.span "#text-here","What is the name of this color?"
    return
  render:()->
    text = @model.selectFromCurrentTest()
    #@$('#text-here').html  text
    @$('#text-here').attr "style", "text-shadow:2px 2px 3px #000000; color:#{text}"
    @wanted = text
    return

activeKey = (digit)->
  T.div "#digit-#{digit}.two.columns",
    style: "text-align: center;",
    onclick:"Pylon.trigger('protocol:response',#{digit});Pylon.trigger('quickClass',$(this),'reversed')",
    digit

tenIconBody = Backbone.View.extend
  el: "#protocol-report"
  clear: ()->
    @$el.html('')
    return
  initialize: ()->
    @wanted=null
    @$el.html T.render =>
      T.div ".container",style:"font-size:265%", =>
        T.div ".row", =>
          T.div ".three.columns", =>
            T.div ".row",-> T.raw "&nbsp;"
            T.div ".row",->
          T.div  ".five.columns","keypad",->
            T.div ".row",->
              activeKey k for k in [1..3]
            T.div ".row",->
              activeKey k for k in [4..6]
              T.div  "#icon-here.offset-by-two.two.columns","icon"
            T.div ".row",->
              activeKey k for k in [7..9]
            T.div ".row",->
              T.div ".two.columns",->T.raw "&nbsp;"
              activeKey 0
              T.div ".two.columns",->T.raw "&nbsp;"
    return
  render:()->
    icon = @model.selectFromCurrentTest()
    @$('#icon-here').html  icon
    @wanted = @model.order icon
    return

tappingExample = Backbone.View.extend
  el: "#example"
  response: (got,wanted)->
    Pylon.trigger "systemEvent:protocol:got-#{got}"
    return
  clear: ()->
    @$el.html('')
    return
  initialize: ()->
    return

colorTextExample = Backbone.View.extend
  el: "#example"
  clear: ()->
    @$el.html('')
    return
  response: (got,wanted)->
    Pylon.trigger "systemEvent:protocol:got-#{got}/wanted-#{wanted}"
    return
  initialize: ()->
    @$el.html T.render =>
      T.div ".container", =>
        T.div ".row",style:"text-align:center", =>
          for example in @model.setCurrentTest 5
            T.span ".example",
              {style:"padding-right:1em;"},
              => 
                T.text example
                T.raw "&nbsp;"
                T.span style: "background-color:#{example}", -> T.raw "&nbsp&nbsp;&nbsp&nbsp; "
    return

tenIconExample = Backbone.View.extend
  el: "#example"
  clear: ()->
    @$el.html('')
    return
  response: (got,wanted)->
    Pylon.trigger "systemEvent:protocol:got-#{got}/wanted-#{wanted}"
    return
  initialize: ()->
    @$el.html T.render =>
      T.div ".container",style:"width:100%", =>
        extraClass = ".u-pull-left"
        T.div ".row",style:"text-align:center", =>
          i=0
          for example in @model.setCurrentTest 10
            T.div "#example-#{example}.#{extraClass}",
              {style:"padding-right:0.5em;" },
              -> T.pre "#{example}\n#{i++}"
            #extraClass = ".offset-by-one.column"
    return

exports.ProtocolReportTemplate = new ProtocolReportTemplate
#if window? then window.exports = Pages
#if module?.exports? then module.exports = Pages
