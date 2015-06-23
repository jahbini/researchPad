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
        nd = new deviceModel
          signalStrength: device.rssi
          genericName: device.name
          UUID: device.address
          rawDevice: device
        pd =Pylon.get('devices')
        pd.push nd
        Pylon.trigger('change respondingDevices')
        return
    else
      sensorScanner.stopScanningForDevices()
      return

  Pylon.on "setPrimary", (uuid)->
    alert("Primary = " +uuid)
    Pylon.get 'TiHandler'
      .attachDevice uuid, 'primary'
  Pylon.on "setSecondary", (uuid)->
    alert("Secondary = " +uuid)
    Pylon.get 'TiHandler'
      .attachDevice uuid, 'secondary'
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

  enterConnected = false # enterconnected is called to enable 'record' button logic
  constructor: (@reading,@sessionInfo,ec) ->
    enterConnected = ec

  ###
  # debuging -- should show up on server
  readings.push new reading
   raw: [ 1,2,3,4,5,6]
   sensor: 'DebugOnly'

  # ## Hardware
  # external communications to Hardware
  #
  # set up the sensorTag and configure to recieve
  # accelerometer, magnetometer and gyro data
  #
  ###

  statusHandler= (status)->
    $('#StatusData').html status
    statusList = evothings.tisensortag.ble.status
    if statusList.SENSORTAG_ONLINE== status
      try
        if ! enterConnected
          console.log "enterConnected does not exist"
        enterConnected()
      catch e
        console.log "error setting connection"
        console.log e
        console.log enterConnected
      status = 'Sensor online'
    if statusList.DEVICE_INFO_AVAILABLE == status
      $('#FirmwareData').html sensortag.getFirmwareString()
      sessionInfo.set 'sensorUUID', sensortag?.device?.address
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

  debugReading = (data)->
    console.log "got reading"
    console.log data

  initializeSensorTag: (accelerometerHandler, magnetometerHandler, gyroscopeHandler) ->
    return
    # Here sensors are set up.
    #
    # If you wish to use only one or a few sensors, just set up
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
      source: ->
        device.get('getAccelerometerValues')
      units: 'G'
      calibrator: [
        smoother.calibratorAverage
        smoother.calibratorSmooth
      ]
      viewer: smoother.viewSensor 'accel-view', 0.4
      htmlID: 'AccelerometerData'+device.get('role') 

    magnetometerHandler = smoother.readingHandler
      sensor: 'mag'
      debias: 'calibrateMag'
      calibrator: [
        smoother.calibratorAverage
        smoother.calibratorSmooth
      ]
      source: ->
        device.get 'getMagnetometerValues'
      units: '&micro;T'
      viewer: smoother.viewSensor 'magnet-view', 0.05
      htmlID: 'MagnetometerData'+device.get('role')

    gyroscopeHandler = smoother.readingHandler
      sensor: 'gyro'
      debias: 'calibrateGyro'
      calibrator: [
        smoother.calibratorAverage
        smoother.calibratorSmooth
      ]
      source: ->
        device.get 'getGyroscopeValues'
      viewer: smoother.viewSensor 'gyro-view', 0.005
      htmlID: 'GyroscopeData'+device.get('role')
    return gyro: gyroscopeHandler
      , accel: accelerometerHandler
      , mag: magnetometerHandler

      

  attachDevice: (uuid, role) ->
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
      @getMagnetometerValues = rawDevice.getMagnetometerValues
      @getAccelerometerValues = rawDevice.getAccelerometerValues
      @getGyroscopeValues = rawDevice.getGyroscopeValues

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
