# vim: et:ts=2:sw=2:sts=2:nowrap

# global Pylon
#

Backbone = require('backbone')
$=require('jquery')
T = require('teacup')
BV = require './button-view.coffee'

implementing = (mixins..., classReference) ->
  for mixin in mixins
    for key, value of mixin::
      classReference::[key] = value
  classReference


tappingBody = Backbone.View.extend
  el: "#protocol-here"
  clear: ()->
    @$el.html('')
    return
  initialize: ()->
    mileStones = @model.get('mileStones')
    @$el.html T.render =>
      T.div ".container",style: "padding-top:25px;padding-bottom:25px", =>
        extraClass = ""
        T.div "row",style:"text-align:center", =>
          for btn in mileStones
            btnName = btn.replace(/ /g,'-').toLocaleLowerCase()
            T.button ".primary.round-button#{extraClass}",
              {style:"font-size:5rem;margin-right:0.7in",onClick: "Pylon.trigger('systemEvent:mileStone:#{btnName}');Pylon.trigger('quickClass',$(this),'reversed')"},
              -> T.span "#{btn}"
    return

tappingExample = Backbone.View.extend
  el: "#example"
  response: (got,wanted)->
    Pylon.trigger "systemEvent:tapping:got-#{got}"
    return
  clear: ()->
    @$el.html('')
    return
  initialize: ()->
    return

exports.tappingBody = tappingBody
exports.tappingExample = tappingExample
#if window? then window.exports = Pages
#if module?.exports? then module.exports = Pages
