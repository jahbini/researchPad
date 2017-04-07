# # stagapp devices
# vim: et:ts=2:sw=2:sts=2:tw=0
# ### device interface handler for clinical recording of SensorTag data
# ### via TI SensorTag object.

Backbone = require('backbone')
_ = require('underscore')
require('./lib/console')
$ = require('jquery')
{EventModel} = require './models/event-model.coffee'
glib = require('./lib/glib.coffee').glib
Case = require 'Case'
{deviceModel} = require './models/device-model.coffee'

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



class TiHandler

  # send a GET request to the server to sync up this tag
  queryHostDevice = (d)->
    d.fetch
      success: (model,response,options) ->
        name = (d.get 'assignedName' ) || 'no Name'
        console.log "DEVICE FETCH from Host: #{name}"

      error: (model,response,options)->
        console.log (Pylon.get('hostUrl')+'/sensorTag')
        console.log "sensorTag fetch error: #{response.statusText}"

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
    console.log "got new device"
    d = new deviceModel device
    pd.push d
    #queryHostDevice(d)
    return
        
  Pylon.on "change:scanActive",  =>
    if Pylon.get('scanActive')
      #scan 20 seconds for anybody with a movement UUID and show it to Mr. ble_found
      ble.scan(['AA80'], 20, ble_found, (e)->
        alert("scanner error")
        debugger
        );
    return

  Pylon.on "enableDevice", (cid)->
    Pylon.get 'TiHandler'
      .attachDevice cid
    
  initialize: (@sessionInfo) ->

# #attachDevice
# when scan is active or completed, the devices can be enabled with only its UUID
# Enables the responding device UUID to send motion information
  attachDevice: (cid) ->
    # reject attachDevice request if we are already recording
    gs = Pylon.get('globalState')
    return if gs.get 'recording'
    
    console.log "attach "+ cid
    d = Pylon.get('devices').get  cid
    name = d.get 'name'
    role = 'Error'
    role= 'Left' if 0< name.search /\(([Ll]).*\)/
    role= 'Right' if 0< name.search /\(([Rr]).*\)/
    if role == 'Error'
      console.log "Bad name for sensor: #{name}"
      return
    # reject attachDevice if it connected Github issue #73
    return if d.get 'connected'
    d.set 'buttonText', 'connecting'
    d.set 'role',role
    d.set 'connected', false

    # triggers change:Right or change:Left
    Pylon.set role, d
    Pylon.trigger('change respondingDevices')
    console.log "Role of Device set, attempt connect"
    ble.connect (d.get "id"),
      d.subscribe()
      (e)-> console.log "Failure to connect",e
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
        console.log "sensor ERROR report: " +s, ' '+d.id
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

      console.log "Setting Time-out now",Date.now()
      setTimeout ()->
          return if 'Receiving' == d.get 'deviceStatus'
          console.log "Device connection 10 second time-out "
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
