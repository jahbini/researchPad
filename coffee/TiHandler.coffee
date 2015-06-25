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
    @listenTo @model, 'change respondingDevices', (devices)->
      @render()
      return @
  events:
    "click": "changer"
  changer: ->
      console.log "click!"
      Pylon.set('tagScan',true)
      @render()
      return
  render: ->
      if p=Pylon.get('pageGen') 
        $('#tagScanReport').html p.scanContents(@model)
      return
  
Pylon.set 'tagViewer', new pView

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
    Pylon.trigger 'sensorScanStatus', s
  sensorScanner.errorCallback (e)->
    Pylon.trigger 'sensorScanStatus', e

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

  statusHandler= (status)->
    $('#StatusData').html status
    if statusList.SENSORTAG_ONLINE== status || statusList.DEVICE_INFO_AVAILABLE == status
      $('#FirmwareData').html sensortag.getFirmwareString()
      @sessionInfo.set 'sensorUUID', sensortag?.device?.address
      $('#uuid').html(sensortag?.device?.address).css('color','black')
      console?.log sensortag?.device?.address
    $('#StatusData').html status
    return

  errorHandler=  (error,that)->
    $('#StatusData').html "Err: " + error
    if 'disconnected' == error
      if !that.globalState
        console.log("ERROR no globalState")
      else
        that.globalState.set 'connected', false
      $('#uuid').html("Must connect to sensor").css('color',"red")
      # If disconneted attempt to connect again. (but not to same device)
      setTimeout (->
        sensortag.connectToClosestDevice(20000)
        return
      ), 1000
    return

  initializeSensorTag: (accelerometerHandler, magnetometerHandler, gyroscopeHandler) ->
    return
    # the ones you wish to use.
    #
    # First parameter to sensor function is the callback function.
    # Several of the sensors take a millisecond update interval
    # as the second parameter.
    # Gyroscope takes the axes to enable as the third parameter:
    # 1 to enable X axis only, 2 to enable Y axis only, 3 = X and Y,
    # 4 = Z only, 5 = X and Z, 6 = Y and Z, 7 = X, Y and Z.
    #
    repeat = false
    failures =0
    console.log "initialize Sensor Communication"
    try
      @globalState.set 'connected', []
      sensortag.statusCallback(statusHandler)
      sensortag.errorCallback (error)=>
#change this to globalState
        errorHandler error,this
      console.log "Status and error handlers OK"
      sensortag.connectToClosestDevice(20000)
    catch e
      failures++
      console.log "failed to initialize"
      console.log e
      # try again after 1/2 second
      repeat = window.setInterval(initializeSensorTag,500)
      return
    # when the try finishes without a catch, clear the retry timer
    if repeat?
      console.log "sensor came on-line after " + failures + " failures"
      window.clearInterval repeat
    else
      console.log "sensor came on-line immediately"
    return

  createVisualChain: (device) ->
    smoother = new visualHandler
    accelerometerHandler = smoother.readingHandler
      sensor: 'accel'
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
# specific status is NOT used:
# status handler is set -- d.get('rawDevice').statusCallback (s)-> {something}
# error  handler is set -- d.get('rawDevice').errorCallback (e)-> {something}
# not used in this initial release
  attachDevice: (uuid, role="Primary") ->
    connected = false
    d = Pylon.get('devices').get uuid
    d.set 'role',role
    Pylon.set role, d
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
      
      # bring the evothings data converters up to this device
      d.set 'getMagnetometerValues', rawDevice.getMagnetometerValues
      d.set 'getAccelerometerValues', rawDevice.getAccelerometerValues
      d.set 'getGyroscopeValues', rawDevice.getGyroscopeValues

      rawDevice.statusCallback (s) ->
        $('#status'+uuid).text s
        return if connected
        connected = true
        Pylon.trigger 'connected'
      rawDevice.errorCallback (e) ->
        $('#status'+uuid).text e
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
