# vim: et:ts=2:sw=2:sts=2:nowrap

Backbone = require('backbone')
$=require('jquery')
Teacup = require('teacup')
BV = require './button-view.coffee'

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

      Pylon.on 'recordCountDown:over', ()=>
        theTest = Pylon.theProtocol()
        return unless theTest.get 'showMilestones'
        @$el.addClass 'active'
        @render()
        # start with only the goButton enabled
        @$('button').prop disabled: true
        @$('#goButton').prop disabled: false

      Pylon.on 'systemEvent:goButton:go', (time)=>
        @$('button').prop disabled: false

      Pylon.on 'stopCountDown:start', (time)=>
        @stopwatch.stop()
        @$el.removeClass 'active'
        @$('button').prop disabled: true

    # show panel of action buttons
    render: ()->
      @$el.html render =>
        tea.hr
        tag "section", ->
          h3 "#protocol-result", "record these events"
        theTest = Pylon.theProtocol()
        if theTest.get 'showMilestones'
          mileStones = theTest.get('mileStones')?.split ','
          tea.ul =>
            tea.li "#goList", =>
              tea.button '#goButton.primary.my1',
                {onClick: "Pylon.trigger('systemEvent:goButton:go')"},
                "Go"
              tea.span  "Total Duration"
              tea.span '#button-go-time.right'
            for btn in mileStones
              btnName = btn.replace(/ /g,'-').toLocaleLowerCase()
              tea.li ->
                bound = (who)->
                  return ()->
                    $(who).text $('#button-go-time').text()
                # copy current stopwatch readout into text region
                Pylon.on "systemEvent:goList:#{btnName}", bound( "#milestone-#{btnName}")
                tea.button '.primary.mx1',
                  {onClick: "Pylon.trigger('systemEvent:goList:#{btnName}')"},
                  btn
                tea.span "#milestone-#{btnName}.right"
      @

exports.ProtocolReportTemplate = new ProtocolReportTemplate
#if window? then window.exports = Pages
#if module?.exports? then module.exports = Pages
