# # stagapp devices
# vim: et:ts=2:sw=2:sts=2:tw=0
# ## device interface handler for clinical recording of SensorTag data
# via TI SensorTag object.

Backbone = require ('backbone')
_ = require('underscore')
require('../libs/dbg/console')
$ = require('jquery')
glib = require('./glib.coffee').glib

# ## Scan request viewer
pView=Backbone.View.extend
  el: '#tagSelect'
  model: Pylon
  initialize: ->
    $('#StatusData').html 'Ready to connect'
    $('#FirmwareData').html '?'
    Pylon.set 'tagScan', false
    @listenTo @model, 'change respondingDevices', (devices)->
      @render()
      return @
  events:
    "click": "changer"
  changer: ->
      console.log "click!"
      Pylon.set 'tagScan', true
      @render()
      setTimeout(
        ()=>
          Pylon.set 'tagScan', false
          @render()
          return 
        ,30000)
      return
  render: ->
      if Pylon.get 'tagScan'
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
        $('#tagScanReport').html p.scanContents(@model)
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
# ### all sensor readings
readingCollection = Backbone.Collection.extend
  model: reading
  initialize: ->

deviceModel = Backbone.Model.extend
  idAttribute: "UUID"
  defaults: 
    UUID: "00000000-0000-0000-0000-000000000000"
  initialize: ()->
      @.set 'nickname', glib(@.get 'UUID' )

deviceCollection = Backbone.Collection.extend
  model: deviceModel
Pylon.set 'devices', new deviceCollection

visualHandler = require('./visual.coffee')

class TiHandler
  evothings = window.evothings
  sensorScanner = evothings.tisensortag.createGenericInstance()
  evothings.tisensortag.ble.addInstanceMethods(sensorScanner) #Add generic BLE instance methods.

# status callbacks for the BLE scan for devices mode -- should activate "status" view
  sensorScanner.statusCallback (s)->
    console.log "Scan status = "+s
    s = "Scan Complete" if s == "SENSORTAG_NOT_FOUND"
    $('#StatusData').css("color", "green").html s
    Pylon.trigger 'sensorScanStatus', s
    return
  sensorScanner.errorCallback (e)->
    console.log "Scan Error = "+e
    # Evothings reports SCAN_FAILED when it detects a tag.  Not cool
    return if e == "SCAN_FAILED" 
    $('#StatusData').css("color", "red").html e
    Pylon.trigger 'sensorScanStatus', e
    return

  Pylon.on "tagScan change",  =>
    if Pylon.get('tagScan')
      sensorScanner.startScanningForDevices (device)->
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
          signalStrength: rssi
          genericName: device.name
          UUID: uuid
          rawDevice: device
          buttonText: 'connect'
          buttonClass: 'button-primary'
        pd.push d
        Pylon.trigger('change respondingDevices')
        return
    else
      sensorScanner.stopScanningForDevices()
      return

  Pylon.on "enableTag", (uuid)->
    Pylon.get 'TiHandler'
      .attachDevice uuid, 'First'

  ###
  Section: Data Structures
   Major data structures and interfaces to them

  systemCommunicator = Backbone.Model.extend
    defaults:
      calibrating: false
      recording: false
      connected: false
      calibrate: false
      loggedIn:  false

  globalState = new systemCommunicator

  reading = Backbone.Model.extend
    defaults:
      sensor: 'gyro'
    initialize: ->
      d = new Date
      @set 'time', d.getTime()
      return @


  rawSession = Backbone.Model.extend()
  sessionInfo = new rawSession
      user: ''
      patient: ''
      testID: ''
      sensorUUID: ''
      platformUUID: ''

  ###

  constructor: (@reading,@sessionInfo) ->

  createVisualChain: (device) ->
    smoother = new visualHandler
    accelerometerHandler = smoother.readingHandler
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
      viewer: smoother.viewSensor 'accel-view-'+device.id, 0.4

    magnetometerHandler = smoother.readingHandler
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
      viewer: smoother.viewSensor 'magnet-view-'+device.id, 0.05

    gyroscopeHandler = smoother.readingHandler
      sensor: 'gyro'
      readings: device.get 'readings'
      debias: 'calibrateGyro'
      calibrator: [
        smoother.calibratorAverage
        smoother.calibratorSmooth
      ]
      source: (data)->
        (device.get 'getGyroscopeValues') data
      viewer: smoother.viewSensor 'gyro-view-'+device.id, 0.005

    return gyro: gyroscopeHandler
      , accel: accelerometerHandler
      , mag: magnetometerHandler

# #attachDevice
# when scan is active or completed, the devices can be enabled with only its UUID
# Enables the responding device UUID to send motion information
  attachDevice: (uuid) ->
    role = "First"
    d = Pylon.get('devices').get uuid
    other = Pylon.get 'First' 
    role = 'Second' if other && other != d
    d.set 'role',role
    d.set 'connected', false
  #throw away any previous reading
    d.set 'readings', new readingCollection
    x = d.get 'readings'
    console.log role+" readings created"
    console.log x
    # triggers change:First or change:Second 
    Pylon.set role, d
      
    handlers= @createVisualChain d
    try
      if d.get( 'genericName').search(/BLE/) > -1
        d.set 'type', evothings.tisensortag.CC2541_BLUETOOTH_SMART
      else
        d.set 'type', evothings.tisensortag.CC2650_BLUETOOTH_SMART
      sensorInstance = evothings.tisensortag.createInstance d.get('type')
      rawDevice = d.get 'rawDevice'
      rawDevice.sensorInstance= sensorInstance
      d.set sensorInstance: sensorInstance

      # status handler is set -- d.get('sensorInstance').statusCallback (s)-> {something}
      sensorInstance.statusCallback (s)->
        statusList = evothings.tisensortag.ble.status
        if statusList.SENSORTAG_ONLINE== s || statusList.DEVICE_INFO_AVAILABLE == s
          $('#version-'+uuid).html 'Ver. '+sensorInstance.getFirmwareString()
        sessionInfo = Pylon.get 'sessionInfo'
        sessionInfo.set role+'sensorUUID', d.id
        console.log "sensor status report:" +s + ' '+d.id

        if statusList.SENSORTAG_ONLINE == s
          Pylon.trigger 'connected' unless d.get 'connected'
          d.set 'connected', true
          s='on-line'
          $('#status-'+uuid).html s
          $('#'+role+'Nick').text d.get("nickname")
          $('#'+role+'uuid').text d.id
          $('#connect-'+uuid)
            .removeClass('button-warning')
            .addClass('button-success')
            .text 'on-line'
          d.set 'buttonClass', 'button-success'
          d.set 'buttonText', 'on-line'
        return

      # error  handler is set -- d.get('sensorInstance').errorCallback (e)-> {something}
      sensorInstance.errorCallback (s)->
        console.log "sensor ERROR report:" +s, ' '+d.id
        # evothings status reporting errors often report null, for no reason?
        return if !s
        err=s.split(' ')
        if evothings.easyble.error.CHARACTERISTIC_NOT_FOUND == err[0]
          return
        if evothings.easyble.error.DISCONNECTED == s
          $('#connect-'+uuid).removeClass('button-success').addClass('button-warning').text 'Reconnect'
          d.set 'buttonClass', 'button-warning'
          d.set 'buttonText', 'Reconnect'
          s='Disconnected'
        widget = $('#status-'+uuid)
        widget.html s
        return
        
    
      # bring the evothings data converters up to this device
      d.set 'getMagnetometerValues', sensorInstance.getMagnetometerValues
      d.set 'getAccelerometerValues', sensorInstance.getAccelerometerValues
      d.set 'getGyroscopeValues', sensorInstance.getGyroscopeValues

      # and plug our data handlers into the evothings scheme
      sensorInstance.accelerometerCallback (data)=> 
          handlers.accel data
        ,100
      sensorInstance.magnetometerCallback (data)=>
          handlers.mag data
        ,100
      sensorInstance.gyroscopeCallback (data)=>
          handlers.gyro data
        ,100
        ,7
      sensorInstance.connectToDevice d.get('rawDevice')
    catch e
      alert('Error in attachSensor -- check LOG')
      console.log "error in attachSensor"
      console.log e
    return d


if window? then window.exports = TiHandler
if module?.exports? then module.exports = TiHandler
