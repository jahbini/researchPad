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
# http://processors.wiki.ti.com/index.php/CC2650_SensorTag_User%27s_Guide
accelerometer = 
    service: "F000AA80-0451-4000-B000-000000000000"
    data: "F000AA81-0451-4000-B000-000000000000" # read/notify 3 bytes X : Y : Z
    notification:"F0002902-0451-4000-B000-000000000000"
    configuration: "F000AA82-0451-4000-B000-000000000000" # read/write 1 byte
    period: "F000AA83-0451-4000-B000-000000000000" # read/write 1 byte Period = [Input*10]ms
    
# ## Sensor Data
# ### a single sensor reading
reading = Backbone.Model.extend
  defaults:
    sensor: 'gyro'
  initialize: ->
    d = new Date
    @set 'time', d.getTime()
# ### sensor readings are grouped into ten-second chunks, other events just have text

deviceModel = Backbone.Model.extend
  defaults:
      buttonText: 'connect'
      buttonClass: 'button-primary'
      deviceStatus: '--'
  urlRoot: ->
    Pylon.get('hostUrl')+'sensor-tag'
  #idAttribute: "name"

deviceCollection = Backbone.Collection.extend
  model: deviceModel
Pylon.set 'devices', new deviceCollection

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
      # what we should lookf is not changes to pylon, but pylon's devices (a collection)
      # on devices add, create row #
      ordinal = @model.length
      device.set "rowName", "sensor-#{ordinal}"
      element = (Pylon.get 'pageGen').sensorView device
      return @
  events:
    "click": "changer"
  changer: ->
      console.log "Start Scan button activated"
      Pylon.set 'scanActive', true
      @render()
      setTimeout(
        ()=>
          Pylon.set 'scanActive', false
          @render()
          return
        ,30000)
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

Pipeline = require('./pipeline.coffee')

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
    
  constructor: (@sessionInfo) ->

  createVisualChain: (device) ->
    smoother = new Pipeline
    accelerometerHandler = smoother.readingHandler
      device: device
      sensor: 'accel'
      debias: 'calibrateAccel'
      source: (data)->
        (device.get 'getAccelerometerValues') data
      units: 'G'
      calibrator: [
        smoother.calibratorSmooth
      ]
      viewer: smoother.viewSensor "accel-#{device.get 'rowName'}",1.5
      finalScale: 1

    magnetometerHandler = smoother.readingHandler
      device: device
      sensor: 'mag'
      debias: 'calibrateMag'
      calibrator: [
        smoother.calibratorAverage
        smoother.calibratorSmooth
      ]
      source: (data)->
        (device.get 'getMagnetometerValues') data
      units: '&micro;T'
      viewer: smoother.viewSensor "mag-#{device.get 'rowName'}", 0.05/2
      finalScale: 1

    gyroscopeHandler = smoother.readingHandler
      device: device
      sensor: 'gyro'
      debias: 'calibrateGyro'
      calibrator: [
        smoother.calibratorAverage
        smoother.calibratorSmooth
      ]
      source: (data)->
        (device.get 'getGyroscopeValues') data
      viewer: smoother.viewSensor "gyro-#{device.get 'rowName'}", 0.05/2
      finalScale: 1

    return gyro: gyroscopeHandler
      , accel: accelerometerHandler
      , mag: magnetometerHandler

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
    debugger
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

    try
      #set some attributes 
      console.log "Device instance attributes set, attempt connect"
      deviceId= d.get "id"

      ble.startNotification deviceId,
        accelerometer.service
        accelerometer.data
        (deviceData)->
          console.log deviceData
        (xxx)->
          debugger
          console.log "can't start movement service"
      # turn accelerometer on
      configData = new Uint16Array(1);
      #Turn on gyro, accel, and mag, 2G range, Disable wake on motion
      configData[0] = 0x007F;
      ble.write deviceId,
        accelerometer.service
        accelerometer.configuration
        configData.buffer
        ()-> console.log "Started movement monitor."
        (e)-> console.log "error starting movement monitor #{e}"

      periodData = new Uint8Array(1);
      periodData[0] = 0x0A;
      ble.write deviceId,
        accelerometer.service
        accelerometer.period
        periodData.buffer
        ()-> console.log "Configured movement period."
        (e)-> console.log "error starting movement monitor #{e}"
    catch e
      alert('Error in attachSensor -- check LOG')
      console.log "error in attachSensor"
      console.log e
    return d
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
