# vim: et:ts=2:sw=2:sts=2:nowrap

Backbone = require('backbone')
$=require('jquery')
Teacup = require('teacup')
buglog = require '../lib/buglog.coffee'
intrologger = (introlog= new buglog "intro").log

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
      @$el.addClass 'active'
    Pylon.on 'removeRecorderWindow', ()=>
      @$el.removeClass('active')
exports.recorderViewTemplate = new recorderViewTemplate

countDownViewTemplate = Backbone.View.extend
    el: "#count-down"
    initialize: ()->
      Pylon.on 'systemEvent:recordCountDown:start', (time)=>
        @headline = "Test in Progress"
        # this trigger will stamp an event, and enable protocol-report widget
        @response = 'systemEvent:recordCountDown:over'
        @render time
      Pylon.on 'systemEvent:stopCountDown:start', (time)=>
        @headline = "Test Over"
        @$el.addClass 'active'
        @response = 'systemEvent:stopCountDown:over'
        @render time
      Pylon.on 'countDown:continue', (time)=>
        @render time
    render: (t)->
      sessionID=Pylon.get('sessionInfo').get('_id')
      intrologger "show time #{t} with id of #{sessionID}"
      @$el.html render =>
        tag "section", =>
          if t>0
            h3 "#downCount", "count down: "+t
          else
            h3 @headline
          if sessionID
            p "#recorder-active"
          else
            p "Waiting for host credential for protocol..."
      if t==0 
        if sessionID
          Pylon.trigger "systemEvent:#{@response}"
          Pylon.trigger(@response)
        else
          Pylon.trigger('systemEvent:recordCountdown:fail')
        return
      if t>0
        setTimeout ()->
            Pylon.trigger('countDown:continue',t-1)
          ,1000
      return @ 

exports.countDownView = new countDownViewTemplate
#if window? then window.exports = Pages
#if module?.exports? then module.exports = Pages
