# vim: et:ts=2:sw=2:sts=2:nowrap

$=require('jquery')
Backbone = require('backbone')
Teacup = require('teacup')

CommoState = Backbone.Model.extend
  netState: ()->
    navigator.connection.type
  netAbility: ()->
    return @abiity[@netState()]
    return
  bleState: "Bluetooth OK!"
  bleAbility: true
  initialize: ()->
    try
      Connection= navigator.connection
      @states[Connection.UNKNOWN]  = 'Unknown connection';
      @states[Connection.ETHERNET] = 'Ethernet connection';
      @states[Connection.WIFI]     = 'WiFi connection';
      @states[Connection.CELL_2G]  = 'Cell 2G connection';
      @states[Connection.CELL_3G]  = 'Cell 3G connection';
      @states[Connection.CELL_4G]  = 'Cell 4G connection';
      @states[Connection.CELL]     = 'Cell generic connection';
      @states[Connection.NONE]     = 'No network connection';

      @ability[Connection.UNKNOWN]  = false
      @ability[Connection.ETHERNET] = true
      @ability[Connection.WIFI]     = true
      @ability[Connection.CELL_2G]  = true
      @ability[Connection.CELL_3G]  = true
      @ability[Connection.CELL_4G]  = true
      @ability[Connection.CELL]     = true
      @ability[Connection.NONE]     = false
    catch
      console.log "ERROR IN ONLINE"
commoState = new CommoState

implementing = (mixins..., classReference) ->
  for mixin in mixins
    for key, value of mixin::
      classReference::[key] = value
  classReference

class netView
  tea = new Teacup.Teacup
  {table,tr,th,thead,tbody,td,ul,li,ol,a,render
    ,input,renderable,raw,div,img,h2,h3,h4,h5,label
    ,button,p,text,span,canvas,option,select,form
    ,body,head,doctype,hr,br,password,tag} = tea.tags()

  constructor: () ->

  netViewer: ()->
    netViewTemplate = Backbone.View.extend
      el: '#net-info'
      model: commoState
      initialize: ->
        document.addEventListener("offline", @render, false);
        document.addEventListener("online", @render, false);
        document.addEventListener("offline", @render, false);
        document.addEventListener("offline", @render, false);
      events:
        'change': ->
          render()
      render: ()->
        debugger
        return false



exports.netView = new netView
