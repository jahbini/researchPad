# # stagapp devices
# vim: et:ts=2:sw=2:sts=2:tw=0
# ### device interface handler for clinical recording of SensorTag data
# ### via TI SensorTag object.

Backbone = require('backbone')
_ = require('underscore')
require('./lib/console')
$ = require('jquery')
glib = require('./lib/glib.coffee').glib
Case = require 'Case'
{deviceModel} = require './models/device-model.coffee'
buglog = require './lib/buglog.coffee'
TIlogger = (TIlog= new buglog "TIhandler").log
lastDisplay = 0

deviceNameToModel= (name)->
    pd =Pylon.get('devices')
    # have we found this device before?
    return pd.findWhere(name: name)
    
deviceIdToModel= (id)->
    pd =Pylon.get('devices')
    # have we found this device before?
    return pd.get(id)

# ## Sensor Data
# ### a single sensor reading
reading = Backbone.Model.extend
  defaults:
    sensor: 'gyro'
  initialize: ->
    d = new Date
    @set 'time', d.getTime()
# ### sensor readings are grouped into ten-second chunks, other events just have text


# View logic to watch and update the "start scanning" button and enable BLE device scan
pView=Backbone.View.extend
  el: '#scanDevices'
  model: Pylon.get 'devices'
  initialize: ->
    $('#StatusData').html 'Ready to connect'
    $('#FirmwareData').html '?'
    $('#scanningReport').html Pylon.get('pageGen').scanBody()
    Pylon.state.set 'scanning', false
    @listenTo @model, 'add', (device)->
      # what we should lookf is not changes to Pylon, but Pylon's devices (a collection)
      # on devices add, create row #
      ordinal = @model.length
      device.set "rowName", "sensor-#{ordinal}" unless device.get "rowName"
      element = (Pylon.get 'pageGen').sensorView device
      return @
  events:
    "click": "changer"
  changer: ->
      TIlogger "Start Scan button activated"
      Pylon.state.set scanning: true
      @render()
      setTimeout(
        ()=>
          Pylon.state.set scanning: false
          @render()
          return
        ,20000)
      return
  render: ->
      if Pylon.state.get 'scanning'
        @$el.prop "disabled",true
          .removeClass 'button-primary'
          .addClass 'button-success'
          .text 'Scanning'
      else
        @$el.prop("disabled",false)
          .removeClass 'button-success'
          .addClass 'button-primary'
          .text 'Scan Devices'
      return

Pylon.set 'tagViewer', new pView

class TiHandler

  # send a GET request to the server to sync up this tag
  queryHostDevice = (d)->
    d.fetch
      success: (model,response,options) ->
        name = (d.get 'assignedName' ) || 'no Name'
        TIlogger "DEVICE FETCH from Host: #{name}"

      error: (model,response,options)->
        TIlogger (Pylon.get('hostUrl')+'/sensorTag')
        TIlogger "sensorTag fetch error: #{response.statusText}"

  ble_found = (device)->
    # a device may present itself several times as advertising packets
    # are recieved by iOS.  We ignore them until the manufacturer
    # name is present (and matches harry's naming convention)
    return unless device.name
    pd =Pylon.get('devices')
    # have we found this device before?
    if d=pd.findWhere(name: device.name)
      d.set device
      return
    TIlogger "got new device"
    d = new deviceModel device
    pd.push d
    Pylon.trigger "systemEvent:sanity:idle"+ d.get 'role'
    #queryHostDevice(d)
    # attempt autoconnect
    if (d.get 'name').match /SensorTag \([LlRr]\)/
      try
        Pylon.trigger 'enableDevice', d.cid
      catch eeee
        TIlogger "bad juju",eeee
        TIlogger "bad juju on device",d
    return
        
  Pylon.state.on "change:scanning",  =>
    if Pylon.state.get('scanning')
      #scan 20 seconds for anybody with a movement UUID and show it to Mr. ble_found
      ble.scan(['AA80'], 30, ble_found, (e)->
        alert("scanner error")
        );
    return

  Pylon.on "enableDevice", (cid)->
    Pylon.get 'TiHandler'
      .attachDevice cid
    
  Pylon.on "disableDevice", (cid)->
    Pylon.get 'TiHandler'
      .detachDevice cid

  initialize: (@sessionInfo) ->
    
# detachDevice
# if we know anything about it, we erase it from our system
  detachDevice: (cid) ->
    d = Pylon.get('devices').get  cid
    return unless d
    name = d.get 'name'
    role = d.get 'role'
    Pylon.unset role
    TIlogger "detach #{cid} -- #{name}"
    d.disconnect()
    return

    
# #attachDevice
# when scan is active or completed, the devices can be enabled with only its UUID
# Enables the responding device UUID to send motion information
  attachDevice: (cid) ->
    # reject attachDevice request if we are already recording
    return if Pylon.state.get 'recording'
    d = Pylon.get('devices').get  cid
    name = d.get 'name'
    if !name
      name = 'No Name -- HELP'
    TIlogger "attach #{cid} - device name #{name}"
    # reject attachDevice if it connected Github issue #73
    # connected is truthy when it is in state 'connecting'
    return if d.get 'connected'

    # triggers change:Right or change:Left
    Pylon.set d.get('role'), d
    
    TIlogger "Role of Device set, attempt connect"
    Pylon.state.timedState "subscribing#{d.get 'role'}"
    return

if window? then window.exports = TiHandler
if module?.exports? then module.exports = TiHandler
