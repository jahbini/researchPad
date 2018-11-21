# vim: et:ts=2:sw=2:sts=2:nowrap

Backbone = require('backbone')
$=require('jquery')
Teacup = require('teacup')
BV = require './button-view.coffee'
saneTimeout = (time,f) ->
  setTimeout f,time

implementing = (mixins..., classReference) ->
  for mixin in mixins
    for key, value of mixin::
      classReference::[key] = value
  classReference

tea = new Teacup.Teacup
{table,tr,th,thead,tbody,td,ul,li,ol,a,render
    ,input,renderable,raw,div,img,h1,h2,h3,h4,h5,label
    ,button,p,text,span,canvas,option,select,form
    ,body,head,doctype,hr,br,password,tag} = tea.tags()

Button = require './button-view.coffee'
Stopwatch = require '../lib/stopwatch.coffee'

#upload view template is now non-functional -- noop for initialize,render
ProtocolReportTemplate = Backbone.View.extend
    el: "#protocol-report"
    initialize: ()->
      # show protocol-report when the start count-down is finished
      @goTime =0
      @stopwatch = new Stopwatch 100,true, (stopwatch)->
        $('#button-go-time').text stopwatch.toString()

      Pylon.on 'systemEvent:goButton:go', =>
        @stopwatch.start()

      Pylon.on 'systemEvent:recordCountDown:over', ()=>
        theTest = Pylon.theProtocol()
        $('#protocol-report').attr( style: 'display:none')
        return unless theTest.get 'showMileStones'
        @$el.addClass 'active'
        @render()
        # start with only the goButton enabled
        @$('button').prop disabled: true
        @$('#goButton').prop disabled: false
        if  timeOut=theTest.get 'autoGoDuration'
          saneTimeout timeOut,()->
            saneTimeout 5000,()->
              Pylon.trigger 'systemEvent:stopCountDown:start',5

      Pylon.on 'systemEvent:goButton:go', (time)=>
        @$('button').prop disabled: false

      Pylon.on 'systemEvent:stopCountDown:start', (time)=>
        @stopwatch.stop()
        @$el.removeClass 'active'
        @$('button').prop disabled: true

    showGo: (showIt)->
      tea.div =>
        if showIt
          tea.button '#goButton.primary',
              {onClick: "Pylon.trigger('systemEvent:goButton:go')"},
            "Go"
        else
          # wait 20ms for mileStones buttons to stabilize in th DOM
          saneTimeout 20,()=>
            @$('button').prop disabled: false
            @stopwatch.start()
        tea.span  "Total Duration"
        tea.span '#button-go-time.right'

    # show panel of action buttons
    render: ()->
      @$el.html render =>
        tea.hr
        theTest = Pylon.theProtocol()
        tag "section", ->
          h3 "#protocol-result", theTest.get('mileStoneText') || "record these events"
        if theTest.get 'showMileStones'
          $('#protocol-report').attr( style: 'display')
          @showGo theTest.get 'showGo'
          mileStones = theTest.get('mileStones')?.split ','
          tea.div =>
            for btn in mileStones
              btnName = btn.replace(/ /g,'-').toLocaleLowerCase()
              tea.button '.primary.round-button',
                {onClick: "Pylon.trigger('systemEvent:mileStone:#{btnName}')"},
                -> tea.span "#{btn}"
      @

exports.ProtocolReportTemplate = new ProtocolReportTemplate
#if window? then window.exports = Pages
#if module?.exports? then module.exports = Pages
