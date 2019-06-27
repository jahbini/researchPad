# vim: et:ts=2:sw=2:sts=2:nowrap

Backbone = require('backbone')
$=require('jquery')
_=require 'underscore'
T = require('teacup')
buglog = require '../lib/buglog.coffee'
enginelogger = (introlog= new buglog "engine").log

implementing = (mixins..., classReference) ->
  for mixin in mixins
    for key, value of mixin::
      classReference::[key] = value
  classReference

shuffle = (a) ->
  for i in [a.length-1..1]
    j = Math.floor Math.random() * (i)
    [a[i], a[j]] = [a[j], a[i]]
  a

activeKey = (digit,cls='.two.columns')->
  T.div ".tenicon-#{digit}#{cls}",
    style:"width:1em;padding-right:0.5em;display:inline-block;" ,
    "#{Pylon.onWhat}":"Pylon.trigger('protocol:response',#{digit});Pylon.trigger('quickClass',$(this),'reversed')",
    digit

rowWithIcon= ()->
  T.div ".container",=>
    T.div ".row", style:"text-align:center;", =>
      for i in [1..9]
        activeKey i,''
    T.div ".row", =>
        T.div  "#icon-here.offset-by-five.two.columns","icon"
  return

keyPadWithIcon= ()->
  T.div ".container",style:"font-size:265%", =>
    T.div ".row", =>
      T.div ".three.columns", =>
        T.div ".row",-> T.raw "&nbsp;"
        T.div ".row",->
      T.div  ".nine.columns","keypad",->
        T.div ".row",->
          activeKey k for k in [1..3]
        T.div ".row",->
          activeKey k for k in [4..6]
          T.div  "#icon-here.offset-by-two.two.columns","icon"
        T.div ".row",->
          activeKey k for k in [7..9]
        T.div ".row",->
          T.div ".two.columns",->T.raw "&nbsp;"
          activeKey 0
          T.div ".two.columns",->T.raw "&nbsp;"
  return

tenIconBody = Backbone.View.extend
  el: "#protocol-here"
  clear: ()->
    enginelogger "SDMT clear"
    @$el.html('')
    return
  initialize: ()->
    enginelogger "SDMT initialize"
    @icon=null
    Pylon.on "reRender:tenIcon",()=>
      @$('#icon-here').fadeOut 100,()=>
        @render()
        @$('#icon-here').fadeIn 100
        return
      return
    @wanted=null
    @$el.html T.render =>
      rowWithIcon()
      #keyPadWithIcon()
    return
  render:()->
    enginelogger "SDMT render"
    @icon = @model.selectFromCurrentTest @icon
    @$('#icon-here').html  @icon
    # add oone because patient entries are 1..9
    @wanted = 1+ @model.order @icon
    return
tenIconExample = Backbone.View.extend
  el: "#example"
  clear: ()->
    enginelogger "SDMT example render"
    @$el.html('')
    return
  response: (got,wanted)->
    enginelogger "SDMT example response"
    Pylon.trigger "systemEvent:tenIcon:got-#{got}/wanted-#{wanted}"
    switch @model.get 'entropy'
      when 'high'
        @randomize()

    Pylon.trigger "reRender:tenIcon"
    return
  randomize: ()->
    Pylon.trigger encodeURI "systemEvent:tenIcon:iconOrder-#{( @model.setCurrentTest 9).join ','}"
    @render()

  initialize: ()->
    enginelogger "SDMT example initialize"
    @randomize()
  
  render: ()->
    enginelogger "SDMT example render"
    @$el.html T.render =>
      T.div ".container",style:"width:100%", =>
        extraClass = ""
        T.div ".row",style:"text-align:center", =>
          # patient responds 1 -- 9
          i=1
          tests = @model.get 'currentTest'
          for example in tests
            T.div "#example-#{example}#{extraClass}",
              {style:"padding-right:0.5em;display:inline-block;" },
              -> 
                T.span example
                T.br()
                T.span i++
            #extraClass = ".offset-by-one.column"
    return

exports.tenIconBody = tenIconBody
exports.tenIconExample = tenIconExample

#if window? then window.exports = Pages
#if module?.exports? then module.exports = Pages
