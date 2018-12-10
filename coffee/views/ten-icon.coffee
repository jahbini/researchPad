# vim: et:ts=2:sw=2:sts=2:nowrap

Backbone = require('backbone')
$=require('jquery')
T = require('teacup')

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
#
activeKey = (digit)->
  T.div "#digit-#{digit}.two.columns",
    style: "text-align: center;",
    onclick:"Pylon.trigger('protocol:response',#{digit});Pylon.trigger('quickClass',$(this),'reversed')",
    digit

tenIconBody = Backbone.View.extend
  el: "#protocol-report"
  clear: ()->
    @$el.html('')
    return
  initialize: ()->
    @wanted=null
    @$el.html T.render =>
      T.div ".container",style:"font-size:265%", =>
        T.div ".row", =>
          T.div ".three.columns", =>
            T.div ".row",-> T.raw "&nbsp;"
            T.div ".row",->
          T.div  ".five.columns","keypad",->
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
  render:()->
    icon = @model.selectFromCurrentTest()
    @$('#icon-here').html  icon
    @wanted = @model.order icon
    return

tenIconExample = Backbone.View.extend
  el: "#example"
  clear: ()->
    @$el.html('')
    return
  response: (got,wanted)->
    Pylon.trigger "systemEvent:protocol:got-#{got}/wanted-#{wanted}"
    return
  initialize: ()->
    @$el.html T.render =>
      T.div ".container",style:"width:100%", =>
        extraClass = ".u-pull-left"
        T.div ".row",style:"text-align:center", =>
          i=0
          for example in @model.setCurrentTest 10
            T.div "#example-#{example}.#{extraClass}",
              {style:"padding-right:0.5em;" },
              -> T.pre "#{example}\n#{i++}"
            #extraClass = ".offset-by-one.column"
    return

exports.tenIconBody = tenIconBody
exports.tenIconExample = tenIconExample

#if window? then window.exports = Pages
#if module?.exports? then module.exports = Pages
