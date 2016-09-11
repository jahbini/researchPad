# vim: et:ts=2:sw=2:sts=2:nowrap

Backbone = require('backbone')
$=require('jquery')
Teacup = require('teacup')

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

uploadViewTemplate = Backbone.View.extend
    el: "#upload-report"
    initialize: ()->
      @render()
      Pylon.on 'upload:complete', (a)=>
        @render a
        @$el.addClass 'active'

      Pylon.on 'upload:failure', (a)=>
        @render a
        @$el.addClass 'active'

      Pylon.on 'upload:close', (a)=>
        @$el.removeClass 'active'
    # the upload report success/fail
    render: (a)->
      a={message: '---'} if !a
      @$el.html render =>
        tag "header", ->
          h2 "Upload Status"
        tag "section", ->
          h1 "#upload-result", a.message
        button ".close"
          ,onClick: "Pylon.trigger('upload:close')"
          ,"Close"
      @

exports.uploadView = new uploadViewTemplate

countDownViewTemplate = Backbone.View.extend
    el: "#count-down"
    initialize: ()->
      @render -1
      Pylon.on 'recordCountDown:start', (time)=>
        @response = 'recordCountDown:over'
        @render time
      Pylon.on 'stopCountDown:start', (time)=>
        @response = 'stopCountDown:over'
        @render time
      Pylon.on 'countDown:continue', (time)=>
        @render time
    render: (t)->
      sessionID=Pylon.get('sessionInfo').get('_id')
      @$el.html render =>
        tag "header", ->
          h2 "Time!"
        tag "section", ->
          h1 "#downCount", "count: "+t
          if sessionID
            p "Waiting for host credential for protocol..."
          else
            p "Protocol credential recieved."
      if t<0 && sessionID
        @$el.removeClass('active')
        Pylon.trigger(@response)
      else
        if sessionID
          @$el.addClass('active')
          setTimeout ()->
              Pylon.trigger('countDown:continue',t-1)
            ,1000
        else
          Pylon.trigger('recordCountdown:fail')
      @

exports.countDownView = new countDownViewTemplate
#if window? then window.exports = Pages
#if module?.exports? then module.exports = Pages
