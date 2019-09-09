# vim: et:ts=2:sw=2:sts=2:nowrap

# global Pylon
#

Backbone = require('backbone')
$=require('jquery')
T = require('teacup')
buglog = require '../lib/buglog.coffee'
logger = (introlog= new buglog "sanitizer").log

implementing = (mixins..., classReference) ->
  for mixin in mixins
    for key, value of mixin::
      classReference::[key] = value
  classReference

sanitizer = Backbone.View.extend
  el: "#sanitizer"
  render: (head,button)->
    @$el.html T.render =>
      T.div 'row',->
        T.h5 ".seven.columns", head+": Contact Retrotope"
        button()
        return

  initialize: ()->
    Pylon.on "sanitizer:close",()=>
      @$el.hide()
      return

    Pylon.on "sanitizer:kill",()=>
      @$el.hide()
      Pylon.trigger "systemEvent:stopCountDown:over"
      Pylon.trigger "systemEvent:rejector:reject"
      return

    Pylon.on "sanitizer:warn",(side)=>
      @$el.show()
      @render "Warning: Data Loss Sensor #{side}",()->T.button ".three.columns.button-primary",onclick:"Pylon.trigger('sanitizer:close');","Close"
      return

    Pylon.on "sanitizer:fail",(side)=>
      @$el.show()
      d=Pylon.get "Left"
      Pylon.trigger "disableDevice",d.cid if d
      d=Pylon.get "Right"
      Pylon.trigger "disableDevice",d.cid if d
      @render "Error: Data Collection Failure sensor #{side}",()->T.button ".three.columns.button-primary",onclick:"Pylon.trigger('sanitizer:kill');","End Session"
      return
    return

exports.sanitizer = new sanitizer
#if window? then window.exports = Pages
#if module?.exports? then module.exports = Pages
