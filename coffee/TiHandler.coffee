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
    $('#scanActiveReport').html Pylon.get('pageGen').scanBody()
    Pylon.set 'scanActive', false
    @listenTo @model, 'add', (device)->
      # what we should lookf is not changes to Pylon, but Pylon's devices (a collection)
      # on devices add, create row #
      ordinal = @model.length
      device.set "rowName", "sensor-#{ordinal}"
      element = (Pylon.get 'pageGen').sensorView device
      return @
  events:
    "click": "changer"
  changer: ->
      TIlogger "Start Scan button activated"
      Pylon.set scanActive: true, sensorsOn: true 
      @render()
      setTimeout(
        ()=>
          Pylon.set scanActive: false, sensorsOn: false
          @render()
          return
        ,20000)
      return
  render: ->
      if Pylon.get 'scanActive'
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
    if d=pd.findWhere(name: name)
      d.set device
      return
    TIlogger "got new device"
    d = new deviceModel device
    pd.push d
    #queryHostDevice(d)
    # attempt autoconnect
    if (d.get 'name').match /SensorTag \([LlRr]\)/
      try
        Pylon.trigger 'enableDevice', d.cid
      catch eeee
        TIlogger "bad juju",eeee
    return
        
  Pylon.on "change:scanActive",  =>
    if Pylon.get('scanActive')
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
    TIlogger "detach #{cid} -- #{name}"
    role = 'Error'
    role= 'Left' if 0< name.search /\(([Ll]).*\)/
    role= 'Right' if 0< name.search /\(([Rr]).*\)/
    if role == 'Error'
      TIlogger "Bad name for sensor: #{name}"
      #return
    d.set 'role','---'
    Pylon.unset role 
    d.set 'buttonText', 'connect'
    d.set 'connected', false
    d.set deviceStatus: 'Disconnected'
    Pylon.trigger('change respondingDevices')
    TIlogger "Device removed from state, attempt dicconnect"
    ble.disconnect (d.get "id"),
      ()=> TIlogger "disconnection of #{name}"
      (e)-> TIlogger "Failure to connect",e
    return

    
# #attachDevice
# when scan is active or completed, the devices can be enabled with only its UUID
# Enables the responding device UUID to send motion information
  attachDevice: (cid) ->
    # reject attachDevice request if we are already recording
    gs = Pylon.get('globalState')
    return if gs.get 'recording'
    
    TIlogger "attach "+ cid
    d = Pylon.get('devices').get  cid
    name = d.get 'name'
    role = 'Error'
    role= 'Left' if 0< name.search /\(([Ll]).*\)/
    role= 'Right' if 0< name.search /\(([Rr]).*\)/
    if role == 'Error'
      TIlogger "Bad name for sensor: #{name}"
      #return
    # reject attachDevice if it connected Github issue #73
    return if d.get 'connected'
    d.set 'buttonText', 'connecting'
    d.set 'role',role
    d.set 'connected', false

    # triggers change:Right or change:Left
    Pylon.set role, d
    Pylon.trigger('change respondingDevices')
    TIlogger "Role of Device set, attempt connect"
    ble.connect (d.get "id"),
      d.subscribe()
      (e)-> TIlogger "Failure to connect",e
    return

   
###
        if statusList.SENSORTAG_ONLINE == s
          sessionInfo = Pylon.get 'sessionInfo'
          sessionInfo.set role+'sensorUUID', d.id
          # add FWLevel to session data per Github issue stagapp 99
          sessionInfo.set "FWLevel#{if role=="Left" then 'L' else 'R'}", d.fwRev
          #why is there no comment on this next line?  Is that what you want to do??
          Pylon.trigger 'connected' unless d.get 'connected'
          d.set {
            connected: true
            buttonText: 'on-line'
            buttonClass: 'button-success'
            deviceStatus: 'Listening'
          }
          newID = sensorInstance.softwareVersion
          $("#LeftSerialNumber").html sensorInstance.serialNumber
          $("#LeftVersion").html sensorInstance.softwareVersion
          d.set 'readings', new EventModel role, d
            
          sessionInfo.set role+'sensorUUID', newID
          d.set 'firmwareVersion', sensorInstance.serialNumber
          if role == "Left"
            sessionInfo.set 'SerialNoL', sensorInstance.serialNumber
            sessionInfo.set 'FWLevelL', sensorInstance.getFirmwareString()
          else
            sessionInfo.set 'SerialNoR', sensorInstance.serialNumber
            sessionInfo.set 'FWLevelR', sensorInstance.getFirmwareString()

          sensorRate = Pylon.get sensorRate
            # default sensorRate is 10ms and may
            # be changed from the log with Pylon.rate(ms)
          askForData sensorInstance, sensorRate
        return
      # error  handler is set -- d.get('sensorInstance').errorCallback (e)-> {something}
      sensorInstance.errorCallback (s)->
        TIlogger "sensor ERROR report: " +s, ' '+d.id
        # evothings status reporting errors often report null, for no reason?
        return if !s
        err=s.split(' ')
        if evothings.easyble.error.CHARACTERISTIC_NOT_FOUND == err[0]
          return
        if evothings.easyble.error.DISCONNECTED == s || s == "No Response"
          d.set 'buttonClass', 'button-warning'
          d.set 'buttonText', 'reconnect'
          d.set 'deviceStatus', 'Disconnected'
          d.unset 'role'
        Pylon.trigger('change respondingDevices')
        return

      TIlogger "Setting Time-out now",Date.now()
      setTimeout ()->
          return if 'Receiving' == d.get 'deviceStatus'
          TIlogger "Device connection 10 second time-out "
          sensorInstance.callErrorCallback "No Response"
          sensorInstance.disconnectDevice()
        ,10000

      # and plug our data handlers into the evothings scheme
      sensorInstance.handlers= @createVisualChain d
      sensorInstance.connectToDevice d.get('rawDevice')
      
      if d.get 'type' == evothings.tisensortag.CC2650_BLUETOOTH_SMART
        sensorInstance.handlers.accel.finalScale = 2
        sensorInstance.handlers.mag.finalScale = 0.15
      askForData sensorInstance, 10
###


if window? then window.exports = TiHandler
if module?.exports? then module.exports = TiHandler
