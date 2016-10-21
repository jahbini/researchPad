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

#upload view template is now non-functional -- noop for initialize,render
uploadViewTemplate = Backbone.View.extend
    el: "#protocol-report"
    initialize: ()->
      Pylon.on 'recordCountDown:over', ()=>
        @$el.addClass 'active'
        @render()

      Pylon.on 'stopCountDown:start', (time)=>
        @$el.removeClass 'active'
    # show panel of action buttons
    render: ()->
      @$el.html render =>
        tag "header", ->
          h2 "Testing In Progress"
        tag "section", ->
          h4 "#protocol-result", "record these activity events"
        tea.hr
        protocol= Pylon.get 'protocols'
        theTest = protocol.findWhere
          name: sessionInfo.get 'testID'
        if theTest
          mileStones = theTest.get('mileStones')?.split ','
          tea.div ".flex", ->
            for btn in mileStones
              tea.button '.primary.mx1',
                {onClick: "Pylon.trigger('systemEvent','#{btn}')"},
                btn
      @

exports.uploadView = new uploadViewTemplate

countDownViewTemplate = Backbone.View.extend
    el: "#count-down"
    initialize: ()->
      @render -1
      Pylon.on 'recordCountDown:start', (time)=>
        @$el.addClass 'active'
        console.log "recordCountDown Start"
        @response = 'recordCountDown:over'
        @render time
      Pylon.on 'stopCountDown:start', (time)=>
        @$el.addClass 'active'
        console.log "stopCountDown Start"
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
            p "Protocol credential recieved: #{sessionID}"
          else
            p "Waiting for host credential for protocol..."
      if t<0 && sessionID
        @$el.removeClass('active')
        Pylon.trigger 'systemEvent', "Timer! "+@response
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
