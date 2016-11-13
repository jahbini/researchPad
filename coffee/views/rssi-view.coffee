# vim: et:ts=2:sw=2:sts=2:nowrap

Backbone = require('backbone')
$=require('jquery')
T = require('teacup')

module.exports = RssiView = Backbone.View.extend
  initialize: (@elementId)->
    @setElement @elementId
    @limit = 8
    $(@elementId).svg initPath: '',settings: {height: '100px',width: '100px'}
    @domElement=$(@elementId).svg('get')
    for t in [0..@limit]
      @domElement.circle(50,100-t*10,t*5,{id: "cir-#{t*5}",fill:"none",stroke:"gray"})
    eventName = (@elementId.match '#?(.*)')[1] #remove leading hash
    Pylon.on "#{eventName}:setRSSI", (t)=>
      for c in [0..@limit]
        @domElement.change(@domElement.getElementById("cir-#{c*5}") ,{stroke: if c<=t then "black" else "none"})
      return null
    clearRssi = ()->
      Pylon.trigger "#{eventName}:setRSSI",0
    rssiTimer = setInterval clearRssi, 1000
