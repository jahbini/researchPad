# vim: et:ts=2:sw=2:sts=2:nowrap
#
# global Pylon

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

colorTextBody = Backbone.View.extend
  el: "#protocol-report"
  clear: ()->
    @$el.html('')
    return
  initialize: ()->
    @text = @textColor = null
    Pylon.on "reRender:colorText",()=>
      @$el.fadeOut 100,()=>
        @render()
        @$el.fadeIn 100
        return
      return
    @wanted=null
    @$el.html T.render =>
      T.div ".container",style:"font-size:265%"
    return
  render:()->
    examples= shuffle (@model.get 'currentTest')[..]
    names = shuffle examples[..]
    @$el.html T.render =>
      T.div ".container",style:"font-size:265%", =>
        extraClass = ""
        examples=shuffle (@model.get 'currentTest')[..]
        T.div ".row",style:"text-align:center", =>
          #select ther elements of currentTest
          for example,i in examples
            btn = colorToName example
            #btn = names[i]
            btnName = btn.replace(/ /g,'-').toLocaleLowerCase()
            T.span 
              onClick: "Pylon.trigger('protocol:response','#{btnName}');Pylon.trigger('quickClass',$(this),'reversed');"
              style: "margin-right:0.5em;padding-left:0.5em;border-radius:4px;border:1px solid #bbb;padding-right:0.5em;"
              ,btn
            T.span " "
        T.div ".row",style:"text-align:center;border:black;",->
          T.span "#text-here","Select"
    #make sure that the text and color are never the same
    @textColor = @model.selectFromCurrentTest @textColor
    @text = @model.selectFromCurrentTest @text,@textColor
    @$('#text-here').html  colorToName @text
    @$('#text-here').attr "style", "color:#{colorToHue @textColor}"
    #@$('#text-here').attr "style", "text-shadow:2px 2px 3px #000000; color:#{colorToHue @textColor}"
    @wanted = @text
    return
  
colorToName = (text)-> # also works if there is no : in the string
  c = text.split /\s*:\s*/
  c[0]

colorToHue = (text)-> # also works if there is no : in the string
  c = text.split /\s*:\s*/
  c[c.length-1]

colorTextExample = Backbone.View.extend
  el: "#example"
  clear: ()->
    @$el.html('')
    return
  response: (got,wanted)->
    Pylon.trigger "systemEvent:stroop:got-#{got}/wanted-#{wanted}"
    Pylon.trigger "reRender:colorText"
    return
  initialize: ()->
    @$el.html T.render =>
      T.div ".container", =>
        T.div ".row",style:"text-align:center", =>
          for example in @model.setCurrentTest 5
            T.span ".example",
              {style:"padding-right:1em;"},
              => 
                T.text colorToName example
                T.raw "&nbsp;"
                T.span style: "background-color:#{colorToHue example}", -> T.raw "&nbsp&nbsp;&nbsp&nbsp; "
    Pylon.trigger "systemEvent:stroop:colors-#{(@model.get 'currentTest').join ','}"
    return

exports.colorTextBody = colorTextBody
exports.colorTextExample = colorTextExample
#if window? then window.exports = Pages
#if module?.exports? then module.exports = Pages
