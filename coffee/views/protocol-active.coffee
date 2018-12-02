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

Pylon.on "quickClass",(who,domClass)->
  who.addClass domClass
  setTimeout (()->who.removeClass domClass ), 100

#upload view template is now non-functional -- noop for initialize,render
ProtocolReportTemplate = Backbone.View.extend
    el: "#protocol-report"
    initialize: ()->
      # show protocol-report when the start count-down is finished

      Pylon.on 'systemEvent:protocol:active', ()=>
        theTest = Pylon.theProtocol()
        $('#protocol-report').attr( style: 'display:none')
        return unless theTest.get 'showMileStones'
        @$el.fadeIn()
        @$el.addClass 'active'
        @render()
        # start with only the goButton enabled
        @$('button').prop disabled: false

      Pylon.on 'systemEvent:protocol:terminate', (time=1000)=>
        @$('button').prop disabled: true
        @$el.fadeOut(time)

    # show panel of action buttons
    render: ()->
      shuffle = (a) ->
        for i in [a.length-1..1]
          j = Math.floor Math.random() * (i + 1)
          [a[i], a[j]] = [a[j], a[i]]
        a
      @$el.html T.render =>
        T.hr
        theTest = Pylon.theProtocol()
        debugger
        if (theTest.get 'showMileStones') && 'color text' ==theTest.get 'name'
          $('#protocol-report').attr( style: 'display;font-size:265%')
          mileStones = shuffle theTest.get('mileStones')?.split ','
          mileStones = mileStones[0..4]
          colors = mileStones.concat mileStones
          colors = colors[Math.floor(Math.random()*3)+2 ..]

          T.div ".container", =>
            extraClass = ".u-pull-left"
            T.div ".row", =>
              i=0
              for btn in mileStones
                continue if 4< i++
                btnName = btn.replace(/ /g,'-').toLocaleLowerCase()
                T.div "#{extraClass}",
                  {style:"padding-right:0.5em;", onClick: "Pylon.trigger('systemEvent:mileStone:#{btnName}');Pylon.trigger('quickClass',$(this),'reversed');"},
                  -> T.div style: "color:#{colors[i]}", btn
                #extraClass = ".offset-by-one.column"

        else if (theTest.get 'showMileStones') && 'ten icons' ==theTest.get 'name'
          $('#protocol-report').attr( style: 'display;font-size:265%')
          mileStones = shuffle theTest.get('mileStones')?.split ','
          T.div ".container", =>
            extraClass = ".u-pull-left"
            T.div ".row", =>
              i=0
              for btn in mileStones
                continue if 9< i++
                btnName = btn.replace(/ /g,'-').toLocaleLowerCase()
                T.div "#{extraClass}",
                  {style:"padding-right:0.5em;", onClick: "Pylon.trigger('systemEvent:mileStone:#{btnName}');Pylon.trigger('quickClass',$(this),'reversed');"},
                  -> T.pre "#{btn}\n#{i}"
                #extraClass = ".offset-by-one.column"
        else if theTest.get 'showMileStones'
          $('#protocol-report').attr( style: 'display')
          mileStones = theTest.get('mileStones')?.split ','
          T.div ".container", =>
            extraClass = ".u-pull-left"
            T.div ".row", =>
              for btn in mileStones
                btnName = btn.replace(/ /g,'-').toLocaleLowerCase()
                T.button ".primary.round-button#{extraClass}",
                  {onClick: "Pylon.trigger('systemEvent:mileStone:#{btnName}');Pylon.trigger('quickClass',$(this),'reversed')"},
                  -> T.span "#{btn}"
                extraClass = ".offset-by-one.column"
      @

exports.ProtocolReportTemplate = new ProtocolReportTemplate
#if window? then window.exports = Pages
#if module?.exports? then module.exports = Pages
