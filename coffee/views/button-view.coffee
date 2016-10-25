# vim: et:ts=2:sw=2:sts=2:nowrap

Backbone = require('backbone')
$=require('jquery')
T = require('teacup')

# The very model of a button interface

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
      if Pylon.get 'debug'
        debugger
      Pylon.trigger "systemEvent:"+@model.get 'trigger' if @model.get 'enabled'

Pylon.on "systemEvent",(ev)->
  if Pylon.get 'debug'
    debugger

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
