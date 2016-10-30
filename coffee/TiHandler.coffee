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

# View logic to watch and update the "start scanning" button and enable BLE device scan
pView=Backbone.View.extend
  el: '#scanDevices'
  model: Pylon
  initialize: ->
    $('#StatusData').html 'Ready to connect'
    $('#FirmwareData').html '?'
    Pylon.set 'scanActive', false
    @listenTo @model, 'change respondingDevices', ()->
      @render()
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
      if p=Pylon.get('pageGen')
        $('#scanActiveReport').html p.scanContents(@model)
      return
Pylon.set 'tagViewer', new pView

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
  urlRoot: ->
    Pylon.get('hostUrl')+'sensor-tag'
  idAttribute: "UUID"
  defaults:
    UUID: "00000000-0000-0000-0000-000000000000"
  initialize: ()->
      @.set 'nickname', glib(@.get 'UUID' )

deviceCollection = Backbone.Collection.extend
  model: deviceModel
Pylon.set 'devices', new deviceCollection

Pipeline = require('./pipeline.coffee')

class TiHandler
  evothings = window.evothings
  sensorScanner = evothings.tisensortag.createGenericInstance()
  evothings.tisensortag.ble.addInstanceMethods(sensorScanner) #Add generic BLE instance methods.

# status callbacks for the BLE scan for devices mode -- should activate "status" view
  sensorScanner.statusCallback (s)->
    return if s == 'SCANNING'
    console.log "Scan status = "+s
    s = "Scan Complete" if s == "SENSORTAG_NOT_FOUND"
    $('#StatusData').css("color", "green").html s
    Pylon.trigger 'sensorScanStatus', s
    return
  sensorScanner.errorCallback (e)->
    # Evothings reports SCAN_FAILED when it detects a tag.  Not cool
    return if e == "SCAN_FAILED"
    console.log "Scan Error = "+e
    $('#StatusData').css("color", "red").html e
    Pylon.trigger 'sensorScanStatus', e
    return

  # send a GET request to the server to sync up this tag
  queryHostDevice = (d)->
    d.fetch
      success: (model,response,options) ->
        console.log "DEVICE FETCH--"+d.UUID
        name = d.get 'assignedName'
        if name
          $("#assignedName-"+d.id).text name

      error: (model,response,options)->
        console.log (Pylon.get('hostUrl')+'/sensorTag')
        console.log "sensorTag fetch error - response"
        console.log response.statusText
        console.log "sensorTag fetch error - model"
        console.log model

  Pylon.on "scanActive change",  =>
    if Pylon.get('scanActive')
      sensorScanner.startScanningForDevices (device)->
        return unless sensorScanner.deviceIsSensorTag device
        pd =Pylon.get('devices')
        uuid = device.address
        rssi = device.rssi
        if d=pd.get(uuid)
          # just update the signal strength and do not trigger any changes
          d.set 'SignalStrength', rssi
          sig = rssi
          if sig < -90
            color = "#800000"
          else if sig < -75
            color = "#533659"
          else if sig < -60
            color = "#2d63a6"
          else if sig < -50
            color = "#2073Bf"
          else if sig < -40
            color = "#0099ff"
          $('#rssi-'+uuid).css("color",color).html rssi
          return

        console.log "got new device"
        d = new deviceModel
          id: uuid
          signalStrength: rssi
          genericName: device.name
          UUID: uuid
          origUUID: uuid
          rawDevice: device
          buttonText: 'connect'
          buttonClass: 'button-primary'
          deviceStatus: '--'
        pd.push d
        queryHostDevice(d)

        Pylon.trigger('change respondingDevices')
        return
    else
      sensorScanner.stopScanningForDevices()
      return

  Pylon.on "enableRight", (uuid)->
    Pylon.get 'TiHandler'
      .attachDevice uuid, 'Right'

  Pylon.on "enableLeft", (uuid)->
    Pylon.get 'TiHandler'
      .attachDevice uuid, 'Left'


  constructor: (@sessionInfo) ->

  createVisualChain: (device) ->
    smoother = new Pipeline
    accelerometerHandler = smoother.readingHandler
      device: device
      sensor: 'accel'
      readings: device.get 'readings'
      debias: 'calibrateAccel'
      source: (data)->
        (device.get 'getAccelerometerValues') data
      units: 'G'
      calibrator: [
        smoother.calibratorAverage
        smoother.calibratorSmooth
      ]
      viewer: smoother.viewSensor 'accel-view-'+device.attributes.origUUID, 0.4
      finalScale: 1

    magnetometerHandler = smoother.readingHandler
      device: device
      sensor: 'mag'
      readings: device.get 'readings'
      debias: 'calibrateMag'
      calibrator: [
        smoother.calibratorAverage
        smoother.calibratorSmooth
      ]
      source: (data)->
        (device.get 'getMagnetometerValues') data
      units: '&micro;T'
      viewer: smoother.viewSensor 'magnet-view-'+device.attributes.origUUID, 0.05
      finalScale: 1

    gyroscopeHandler = smoother.readingHandler
      device: device
      sensor: 'gyro'
      readings: device.get 'readings'
      debias: 'calibrateGyro'
      calibrator: [
        smoother.calibratorAverage
        smoother.calibratorSmooth
      ]
      source: (data)->
        (device.get 'getGyroscopeValues') data
      viewer: smoother.viewSensor 'gyro-view-'+device.attributes.origUUID, 0.005
      finalScale: 1

    return gyro: gyroscopeHandler
      , accel: accelerometerHandler
      , mag: magnetometerHandler

# #attachDevice
# when scan is active or completed, the devices can be enabled with only its UUID
# Enables the responding device UUID to send motion information
  attachDevice: (uuid,role="Right") ->
    # reject attachDevice request if we are already recording
    gs = Pylon.get('globalState')
    return if gs.get 'recording'
    console.log "attach "+uuid
    d = Pylon.get('devices').get uuid
    # reject attachDevice if it connected Github issue #73
    return if d.get 'connected'
    d.set 'buttonText', 'connecting'
    d.set 'role',role
    d.set 'connected', false

    d.set 'readings', new EventModel role, d
    # triggers change:Right or change:Left
    Pylon.set role, d
    Pylon.trigger('change respondingDevices')
    console.log "Role of Device set, attempt connect"

    askForData= (sensorInstance,delay)->
      sensorInstance.accelerometerCallback (data)=>
          sensorInstance.handlers.accel data
        ,delay  # allow 10 ms response for 100 samples/second
      sensorInstance.magnetometerCallback (data)=>
          sensorInstance.handlers.mag data
        ,delay
      sensorInstance.gyroscopeCallback (data)=>
          sensorInstance.handlers.gyro data
        ,delay
        ,7

    try
      if d.get( 'genericName').search(/BLE/) > -1
        d.set 'type', evothings.tisensortag.CC2541_BLUETOOTH_SMART
      else
        d.set 'type', evothings.tisensortag.CC2650_BLUETOOTH_SMART
      sensorInstance = evothings.tisensortag.createInstance d.get('type')
      rawDevice = d.get 'rawDevice'
      rawDevice.sensorInstance= sensorInstance
      d.set sensorInstance: sensorInstance

      console.log "Device instance attributes set, attempt connect"

      # status handler is set -- d.get('sensorInstance').statusCallback (s)-> {something}
      sensorInstance.statusCallback (s)->
        console.log "StatusCallback -#{s}"
        statusList = evothings.tisensortag.ble.status
        if statusList.SENSORTAG_ONLINE== s || statusList.DEVICE_INFO_AVAILABLE == s
          $('#version-'+uuid).html 'Ver. '+sensorInstance.getFirmwareString()
          d.set fwRev: sensorInstance.getFirmwareString()
        sessionInfo = Pylon.get 'sessionInfo'
        sessionInfo.set role+'sensorUUID', d.id
        queryHostDevice d
        console.log "sensor status report: " +s + ' '+d.id

        if statusList.SENSORTAG_ONLINE == s
          Pylon.trigger 'connected' unless d.get 'connected'
          d.set 'connected', true
          d.set 'buttonText', 'on-line'
          d.set 'buttonClass', 'button-success'
          d.set 'deviceStatus', 'Listening'
          s= d.get 'buttonText'
          $('#status-'+uuid).html s
          newID = sensorInstance.softwareVersion
          if newID != "N.A."  # do we have a new tag
            $('#'+role+'Nick').text newID
            $('#'+role+'uuid').text sensorInstance.serialNumber if sensorInstance.serialNumber
            newID = "#{newID}-#{sensorInstance.serialNumber}"
            sessionInfo.set role+'sensorUUID', newID
            d.set UUID: newID
            queryHostDevice d
            # raise sample data rate to 10ms per sample
            askForData sensorInstance, 10
          else
            $('#'+role+'Nick').text d.get("nickname")
            $('#'+role+'uuid').text (d.get('assignedName') || d.id)
          Pylon.trigger('change respondingDevices')
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
        widget = $('#status-'+uuid)
        widget.html s
        Pylon.trigger('change respondingDevices')
        return
      console.log "Setting Time-out now",Date.now()
      setTimeout ()->
          return if 'Receiving' == d.get 'deviceStatus'
          console.log "Device connection Time-out ", Date.now()
          sensorInstance.callErrorCallback "No Response"
          sensorInstance.disconnectDevice()
        ,5000

      # bring the evothings data converters up to this device
      d.set 'getMagnetometerValues', sensorInstance.getMagnetometerValues
      d.set 'getAccelerometerValues', sensorInstance.getAccelerometerValues
      d.set 'getGyroscopeValues', sensorInstance.getGyroscopeValues

      console.log "evothings sensor callbacks registered, attempt connect"
      # and plug our data handlers into the evothings scheme
      sensorInstance.handlers= @createVisualChain d
      sensorInstance.connectToDevice d.get('rawDevice')
      if d.get 'type' == evothings.tisensortag.CC2650_BLUETOOTH_SMART
        sensorInstance.handlers.accel.finalScale = 2
        sensorInstance.handlers.mag.finalScale = 0.15
      #start off with data rate of 100ms per sample
      askForData sensorInstance, 100

    catch e
      alert('Error in attachSensor -- check LOG')
      console.log "error in attachSensor"
      console.log e
    return d


if window? then window.exports = TiHandler
if module?.exports? then module.exports = TiHandler
