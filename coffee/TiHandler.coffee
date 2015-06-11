# # stagapp devices
# vim: et:ts=2:sw=2:sts=2
# ## device interface handler for clinical recording of SensorTag data
# via TI SensorTag object.

Backbone = require ('backbone')
_ = require('underscore')
require('../libs/dbg/console')
$ = require('jquery')

class TiHandler
  evothings = window.evothings
  sensortag = evothings.tisensortag.createInstance()

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


  rawSession = Backbone.Model.extend()
  sessionInfo = new rawSession
      user: ''
      patient: ''
      testID: ''
      sensorUUID: ''
      platformUUID: ''

  ###

  enterConnected = false
  constructor: (@globalState,@reading,@sessionInfo,ec) ->
    enterConnected = ec
    @getMagnetometerValues = sensortag.getMagnetometerValues
    @getAccelerometerValues = sensortag.getAccelerometerValues
    @getGyroscopeValues = sensortag.getGyroscopeValues

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
    console.log "new Sensor Status"
    console.log status
    if 'Sensors online' == status
      try
        if ! enterConnected
          console.log "enterConnected does not exist"
        enterConnected()
      catch e
        console.log "error setting connection"
        console.log e
        console.log enterConnected
      status = 'Sensor online'
    if 'Device data available' == status
      $('#FirmwareData').html sensortag.getFirmwareString()
      sessionInfo.set 'sensorUUID', sensortag?.device?.address
      $('#uuid').html(sensortag?.device?.address).css('color','black')
      console?.log sensortag?.device?.address
    $('#StatusData').html status
    return

  errorHandler=  (error,that)->
    console.log "Sensor error!"
    console.log 'Error: ' + error
    if 'disconnected' == error
      if !that.globalState
        console.log("ERROR no globalState")
      else
        that.globalState.set 'connected', false
      $('#uuid').html("Must connect to sensor").css('color',"red")
      # If disconneted attempt to connect again. (but not to same device)
      setTimeout (->
        sensortag.connectToClosestDevice()
        return
      ), 1000
    return

  debugReading = (data)->
    console.log "got reading"
    console.log data

  initializeSensorTag: (accelerometerHandler, magnetometerHandler, gyroscopeHandler) ->
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
    console.log accelerometerHandler
    accelerometerHandler [ 24, 50,40,50,60,33]
    try
      @globalState.set 'connected', false
      sensortag.statusCallback(statusHandler)
      sensortag.errorCallback (error)=>
#change this to globalState
        errorHandler error,this
      console.log "Status and error handlers OK"
  #  sensortag.keypressCallback(keypressHandler)
  #    sensortag.accelerometerCallback (data)=> 
  #        accelerometerHandler data
  #      ,100
      sensortag.magnetometerCallback (data)=>
          magnetometerHandler data
        ,100
      sensortag.gyroscopeCallback (data)=>
          gyroscopeHandler data
        ,100
        ,7
      console.log "Device Sensors OK"
      sensortag.connectToClosestDevice()
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


if window? then window.exports = TiHandler
if module?.exports? then module.exports = TiHandler
