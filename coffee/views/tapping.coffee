# vim: et:ts=2:sw=2:sts=2:nowrap

# global Pylon
#

Backbone = require('backbone')
$=require('jquery')
T = require('teacup')
buglog = require '../lib/buglog.coffee'
enginelogger = (introlog= new buglog "engine").log

implementing = (mixins..., classReference) ->
  for mixin in mixins
    for key, value of mixin::
      classReference::[key] = value
  classReference

tappingBody = Backbone.View.extend
  el: "#protocol-here"
  clear: ()->
    enginelogger "tapping clear"
    @$el.html('')
    return
  initialize: ()->
    enginelogger "tapping initialize"
    mileStones = @model.get('mileStones')
    @$el.html T.render =>
      T.div ".container",style: "padding-top:25px;padding-bottom:25px", =>
        extraClass = ""
        T.div "row",style:"text-align:center", =>
          for btn in mileStones
            btnName = btn.replace(/ /g,'-').toLocaleLowerCase()
            T.span ".gesture.round-button#{extraClass}.tapping-#{btnName}",
              {style:"font-size:5rem;margin-right:0.7in","#{Pylon.onWhat}": "Pylon.trigger('systemEvent:mileStone:#{btnName}');Pylon.trigger('quickClass',$(this),'reversed')"},
              -> T.span "#{btn}"
    return

tappingExample = Backbone.View.extend
  el: "#example"
  response: (got,wanted)->
    enginelogger "tapping example response"
    Pylon.trigger "systemEvent:tapping:got-#{got}"
    return
  clear: ()->
    enginelogger "tapping example clear"
    @$el.html('')
    return
  initialize: ()->
    enginelogger "tapping example initialize"
    return

exports.tappingBody = tappingBody
exports.tappingExample = tappingExample
#if window? then window.exports = Pages
#if module?.exports? then module.exports = Pages
