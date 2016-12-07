# vim: et:ts=2:sw=2:sts=2:nowrap

Backbone = require('backbone')
$=require('jquery')
T = require('teacup')

module.exports = RssiView = Backbone.View.extend
  initialize: (@device)->
    rowName = @device.get 'rowName'
    @element = $("##{rowName}")
    @setElement @element
    @limit = 8
    svgElement = '#rssi-'+@device.get 'rowName'
    $(svgElement).svg initPath: '',settings: {height: '100',width: '100'}
    domElement=$(svgElement).svg('get')
    for t in [0..@limit]
      domElement.circle(50,100-t*10,t*5,{id: "#{rowName}-cir-#{t*5}",fill:"none",stroke:"gray"})
    @.listenTo @device, "change:signalStrength", (d)=>
      rowName = @device.get 'rowName'
      svgElement = '#rssi-'+rowName
      domElement=$(svgElement).svg('get')
      sig=d.get 'signalStrength'
      v=8
      if sig < -90
        v=0
      else if sig < -75
        v=2
      else if sig < -60
        v=4
      else if sig < -50
        v=6
      else if sig < -40
        v=7
      for c in [0..@limit]
        domElement.change(domElement.getElementById("#{rowName}-cir-#{c*5}") ,{stroke: if c<=v then "black" else "none"})
      return null
    Pylon.on "#{@rowName}:setRSSI", (t)=>
      rowName = @device.get 'rowName'
      svgElement = '#rssi-'+rowName
      domElement=$(svgElement).svg('get')
      for c in [0..@limit]
        domElement.change(domElement.getElementById("#{rowName}-cir-#{c*5}") ,{stroke: if c<=t then "black" else "none"})
      return null
    clearRssi= ()->
      Pylon.trigger "#{@rowName}:setRSSI",0
    rssiTimer = setInterval clearRssi, 1000
