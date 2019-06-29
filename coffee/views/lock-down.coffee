# vim: et:ts=2:sw=2:sts=2:nowrap

Backbone = require('backbone')
$=require('jquery')
T = require('teacup')
buglog = require '../lib/buglog.coffee'
intrologger = (introlog= new buglog "lockdown").log
pHT = require './patient-modal.coffee'

implementing = (mixins..., classReference) ->
  for mixin in mixins
    for key, value of mixin::
      classReference::[key] = value
  classReference

protocolPhase = Backbone.Model.extend
  defaults:
    protocol: null

  initialize: ->
    intrologger "initialize"
    Pylon.on 'systemEvent:lockdown:lock',=>
      intrologger "locking handheld"
      if localStorage['clientUnlockOK'] == 'true'
        lockDown()
      else
        showCode()
      return

    unlocked= ()=>
      intrologger "unlocking handheld"
      Pylon.trigger "systemEvent:lockdown:unlock"

    showCode= ()=>
      pHT.setEnvironment
        headline: "Write This Unlock Code Down"
        paragraph: "#{localStorage['clientUnlock']} This four digit code is your patient unlock code for this series."
        nextPhase: lockDown
        start: 0
        limit: 0
        buttonSpec:
          phaseButton: "Enter Lock Down Mode"
      return

    lockDown= ()=>  # put up unlock screen
      paragraph = "Press the keys with your unlock code"
      p= Pylon.theProtocol()
      if p.get 'demoOnly'
        paragraph += " DEMO ONLY code = #{localStorage['clientUnlock']}"
      pHT.setEnvironment
        headline: "Enter the Unlock Code"
        paragraph: paragraph
        nextPhase: unlocked
        clientcode: localStorage['clientUnlock']
        start: 0
        limit: 0
        #buttonSpec:
        #  phaseButton: "Hi I am unlock"
      return
lockDown=new protocolPhase
#if window? then window.exports = Pages
#if module?.exports? then module.exports = Pages
