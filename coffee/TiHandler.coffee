# # stagapp devices
# vim: et:ts=2:sw=2:sts=2:tw=0
# ## device interface handler for clinical recording of SensorTag data
# via TI SensorTag object.

Backbone = require ('backbone')
_ = require('underscore')
require('../libs/dbg/console')
$ = require('jquery')
glib = require('./glib.coffee').glib

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


reading = Backbone.Model.extend
  defaults:
    sensor: 'gyro'
  initialize: ->
    d = new Date
    @set 'time', d.getTime()

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
          $('#rssi-'+uuid).html rssi
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
      .attachDevice uuid, 'primary'

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
# specific status is used:
# status handler is set -- d.get('rawDevice').statusCallback (s)-> {something}
# error  handler is set -- d.get('rawDevice').errorCallback (e)-> {something}
# not used in this initial release
  attachDevice: (uuid) ->
    role = "Primary"
    d = Pylon.get('devices').get uuid
    other = Pylon.get 'Primary' 
    role = 'Secondary' if other && other != d
    d.set 'role',role
    d.set 'connected', false
    Pylon.set role, d
  #throw away any previous reading
    d.set 'readings', new readingCollection
      
    handlers= @createVisualChain d
    try
      if d.get( 'genericName').search(/BLE/) > -1
        d.set 'type', evothings.tisensortag.CC2541_BLUETOOTH_SMART
      else
        d.set 'type', evothings.tisensortag.CC2650_BLUETOOTH_SMART
      #device.type is set to one of these two constants by the scanner  
      #  evothings.tisensortag.CC2650_BLUETOOTH_SMART = 'CC2650 Bluetooth Smart'
      #  evothings.tisensortag.CC2541_BLUETOOTH_SMART = 'CC2541 Bluetooth Smart'
      rawDevice = evothings.tisensortag.createInstance d.get('type')
      

      # status handler is set -- device.statusCallback (s)-> {something}
      rawDevice.statusCallback (s)->
        statusList = evothings.tisensortag.ble.status
        if statusList.SENSORTAG_ONLINE== s || statusList.DEVICE_INFO_AVAILABLE == s
          $('#FirmwareData').html rawDevice.getFirmwareString()
        sessionInfo = Pylon.get 'sessionInfo'
        sessionInfo.set role+'sensorUUID', d.id
        console.log "sensor status report:" +s + ' '+d.id

        if statusList.SENSORTAG_ONLINE == s
          s='on-line'
          $('#status-'+uuid).html s
          $('#'+role+'Stat').html s
          d.set 'connected', true
          $('#connect-'+uuid)
            .removeClass('button-warning')
            .addClass('button-success')
            .text 'on-line'
          d.set 'buttonClass', 'button-success'
          d.set 'buttonText', 'on-line'
          Pylon.trigger 'connected' unless d.get 'connected'
        return

      rawDevice.errorCallback (s)->
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
        widget = $('#'+role+'Stat')
        widget.html s
        widget = $('#status-'+uuid)
        widget.html s
        return
        
    
      # bring the evothings data converters up to this device
      d.set 'getMagnetometerValues', rawDevice.getMagnetometerValues
      d.set 'getAccelerometerValues', rawDevice.getAccelerometerValues
      d.set 'getGyroscopeValues', rawDevice.getGyroscopeValues

      # and plug our data handlers into the evothings scheme
      rawDevice.accelerometerCallback (data)=> 
          handlers.accel data
        ,100
      rawDevice.magnetometerCallback (data)=>
          handlers.mag data
        ,100
      rawDevice.gyroscopeCallback (data)=>
          handlers.gyro data
        ,100
        ,7
      rawDevice.connectToDevice d.get('rawDevice')
    catch e
      alert('Error in attachSensor -- check LOG')
      console.log "error in attachSensor"
      console.log e
    return d


if window? then window.exports = TiHandler
if module?.exports? then module.exports = TiHandler
