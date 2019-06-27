# vim: et:ts=2:sw=2:sts=2:nowrap

Backbone = require('backbone')
$=require('jquery')
T = require('teacup')

# The very model of a button interface
#usage
###
DebugButton = new BV 'debug'
# initialize with legend and enabled boolean
# BV sets Pylon with the attribute 'button-name'
#  NB. BV sets Pylon with event triggers like 'systemEvent:name:legend'
DebugButton.set
  legend: "Show Log"
  enabled: true
# when DebugButton is pressed, the legend above generates this event
Pylon.on "systemEvent:debug:show-log",() ->
  DebugButton.set legend: "Hide Log"
  $('#footer').show()
  return false

# when DebugButton is pressed, the legend 'Hide Log' above generates this event
Pylon.on "systemEvent:debug:hide-log", ()->
  DebugButton.set legend: "Show Log"
  $('#footer').hide()
  return false
$('#footer').hide()
assert DebugButton == Pylon.get 'debug-button'
###

V = Backbone.View.extend
  tagName: "button"
  initialize: (@model,@name,@classes)->
    @model.on 'change:legend',@render,@
    @model.on 'change:enabled',@render,@
    @render()
    return @
  render: ->
    m = @model
    if m.get 'enabled'
      visual = T.render =>
         T.button "##{@name}.#{@classes}.button-primary",@.model.get 'legend'
    else
      visual = T.render =>
         T.button "##{@name}.#{@classes}.disabled",
           disabled: "disabled",
           @.model.get 'legend'
    newVisual = $(visual)
    if (old = @$el)
      @setElement newVisual
      old.replaceWith newVisual
    return this
  events:
    click: ->
      Pylon.trigger "systemEvent:"+@model.get 'trigger' if @model.get 'enabled'
      return false

module.exports = Backbone.Model.extend
  defaults:
    legend: "disabled"
    enabled: false
  setTrigger: ->
    trigger = @get 'legend'
    @set 'trigger', "#{@name}:#{ trigger.replace(/ /g,'-').toLocaleLowerCase() }"
  initialize: (@name,classes="three.columns")->
    Pylon.set "button-#{@name}",@
    @setTrigger()
    @on "change:legend", @setTrigger, @
    @view = new V @, @name, classes
    @view.setElement $ "##{@name}"
    @on "change:enabled", @view.render, @view

    return @
