# # stagapp
# ## data handler for clinical recording of SensorTag data
# SensorTag object.

Backbone = require ('backbone')
_ = require('underscore')
require('./libs/console')
$ = require('jquery')
Seen = require('./libs/dbg/seen')

evothings = window.evothings ={}
evothings.util = require('./libs/evothings/util/util')
evothings.easyble =require('./libs/evothings/easyble/easyble').easyble
evothings.tisensortag=require('./libs/evothings/tisensortag/tisensortag').tisensortag
sensortag = evothings.tisensortag.createInstance()

recording = false
connected = false
reading = undefined
readings = undefined
calibrating = false
calibrate = false
console = new Console('console-log')
###*
# Convert byte number to hex string.
###

hx = [
  '0'
  '1'
  '2'
  '3'
  '4'
  '5'
  '6'
  '7'
  '8'
  '9'
  'A'
  'B'
  'C'
  'D'
  'E'
  'F'
]

###
viewGyro(0,10,0);
viewGyro(0,-5,0);
viewGyro(0,0,10);
viewGyro(0,0,-5);
viewGyro(5,5,5);
viewGyro(0,5,5);
viewGyro(5,0,5);
viewGyro(5,5,0);
viewAccel(-0.5,0.6,0.7);

viewMagnet(10.5,0.6,-0.7);
viewMagnet(10.4,0.6,-0.8);
viewMagnet(10.4,2.6,-0.8);
viewMagnet(10.4,5.6,-0.8);
viewMagnet(10.3,0.6,-0.2);

viewGyro(10,0,0);
viewGyro(-5,0,0);
###

# ## Hardware
# external communications to Hardware
#
# set up the sensorTag and configure to recieve
# accelerometer, magnetometer and gyro data
#

initialiseSensorTag = ->
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
  connected = false
  sensortag.statusCallback(statusHandler).errorCallback(errorHandler).keypressCallback(keypressHandler).accelerometerCallback(accelerometerHandler, 100).magnetometerCallback(magnetometerHandler, 100).gyroscopeCallback(gyroscopeHandler, 100, 7).connectToClosestDevice()
  return

# ## section: View
# routines to control or coordinate with user
#

templater = (x, y, z, sensor, unit) ->
  if !unit
    unit = ''
  if !sensor
    sensor = 'raw'
  sensor + ' x=' + (if x >= 0 then '+' else '') + x.toFixed(2) + unit + ' -- ' + 'y=' + (if y >= 0 then '+' else '') + y.toFixed(2) + unit + ' -- ' + 'z=' + (if z >= 0 then '+' else '') + z.toFixed(2) + unit

pointFormat = (p, unit, precision) ->
  if !precision
    precision = 2
  if !unit
    unit = 'v'
  unit + ' x=' + (if p.x >= 0 then '+' else '') + p.x.toFixed(precision) + ' -- ' + 'y=' + (if p.y >= 0 then '+' else '') + p.y.toFixed(precision) + ' -- ' + 'z=' + (if p.z >= 0 then '+' else '') + p.z.toFixed(precision)

clearUserInterface = ->
  # Clear current values.
  blank = '[Waiting for value]'
  $('#StatusData').html 'Ready to connect'
  $('#FirmwareData').html '?'
  $('#KeypressData').html ''
  $('#AccelerometerData').html blank
  $('#MagnetometerData').html blank
  $('#GyroscopeData').html blank
  $('#TotalReadings').html 0
  # Reset screen color.
  setBackgroundColor 'white'
  $(':button').prop 'disabled', true
  $('#stop').click stopRecording
  $('#record').click(enterRecording).fadeTo(0, 1).text 'record'
  $('#reset').prop 'disabled', false
  return

countReadings = ->
  $('#TotalReadings').html readings.length
  return

# ## Section: Data Structures
# Routines to create and handle data structures and interfaces to them
#

initDataStructures = ->
  rtemp = undefined
  reading = Backbone.Model.extend(
    defaults:
      sensor: 'gyro'
      x: 0
      y: 0
      z: 0
    initialize: ->
      d = new Date
      @set 'time', d.getTime()
      return
  )
  rtemp = Backbone.Collection.extend(
    model: 'reading'
    initialize: ->
      @on 'add', countReadings
      @on 'remove', countReadings
      @on 'reset', countReadings
      return
  )
  readings = new rtemp
  return

# ## Section State Handlers

initAll = ->
  rtemp = undefined
  clearUserInterface()
  initDataStructures()
  $('#TotalReadings').html '0'
  return

# ### subsection State handlers that depend on the View

keypressHandler = (data) ->
  left = 0
  right = 0
  string = undefined
  switch data[0]
    when 0
      string = '          '
    when 1
      string = '     right'
      right = 1
    when 2
      string = 'left      '
      left = 1
    when 3
      right = 1
      left = 1
      string = '   both   '
  calibrate = left and calibrating
  if recording
    readings.push new reading(
      sensor: 'button'
      left: left
      right: right)
  # Update the value displayed.
  $('KeypressData').html string
  return

enterReset = ->
  # legal to enter Reset from any state
  reading = false
  readings = null
  # sensortag.disconnectDevice();
  #sensortag = evothings.tisensortag.createInstance();
  recording = false
  initDataStructures()
  enterConnected()
  $('#TotalReadings').html '0'
  return

enterConnected = ->
  # enable the recording button
  connected = true
  $('#record').prop('disabled', false).fadeTo(100, 1).text('record').click enterRecording
  $('#stop').prop 'disabled', true
  $('#upload').prop 'disabled', true
  $('#calibrate').prop('disabled', false).click enterCalibrating
  return

enterCalibrating = ->
  $('#record').prop 'disabled', true
  $('#stop').prop 'disabled', true
  $('#upload').prop 'disabled', true
  $('#calibrate').text('button 1 active').click exitCalibrating
  calibrating = true
  return

exitCalibrating = ->
  calibrating = false
  $('#calibrate').text('calibrate').click enterCalibrating
  return

enterRecording = ->
  $('#record').prop('disabled', true).text('recording').fadeTo 200, 0.6
  $('#stop').prop('disabled', false).fadeTo(100, 1).click enterReview
  $('#upload').prop 'disabled', true
  recording = true
  return

enterReview = ->
  $('#stop').prop('disabled', true).fadeTo 100, 0.5
  $('#record').prop('disabled', true).text('recorded').fadeTo 200, 0.3
  $('#upload').prop('disabled', false).click(enterUpload).fadeTo 100, 1
  recording = false
  return

enterUpload = ->
  hopper = undefined
  brainDump = undefined
  #    eliminate empty uploads per : https://github.com/jahbini/stagapp/issues/15 */
  if !readings.length
    return
  hopper = Backbone.Model.extend(url: '/trajectory')
  brainDump = new hopper(readings: readings)
  brainDump.save()
  readings.reset()
  enterConnected()
  return

#
# ### Subsection State Handlers that depend on the Hardware

statusHandler = (status) ->
  if 'Sensors online' == status
    enterConnected()
  if 'Device data available' == status
    $('#FirmwareData').html sensortag.getFirmwareString()
  $('#StatusData').html status
  return

errorHandler = (error) ->
  console.log 'Error: ' + error
  if 'disconnected' == error
    connected = false
    clearUserInterface()
    # If disconneted attempt to connect again.
    setTimeout (->
      sensortag.connectToClosestDevice()
      return
    ), 1000
  return

calibratorAverage = (dataCondition, calibrate, calibrating) ->
  try
    tH = undefined
    if dataCondition.dataHistory.grandTotal == undefined
      dataCondition.dataHistory.grandTotal = seen.P(0, 0, 0)
      dataCondition.dataHistory.grandAverage = seen.P(0, 0, 0)
      dataCondition.dataHistory.totalReadings = 1
    tH = dataCondition.dataHistory
    if tH.totalReadings == 1000
      tH.grandTotal.subtract tH.grandAverage
      tH.totalReadings--
    tH.grandTotal.add dataCondition.curValue
    tH.totalReadings++
    tH.grandAverage = tH.grandTotal.copy().divide(tH.totalReadings)
    dataCondition.cookedValue = dataCondition.curValue.copy().subtract(tH.grandAverage)
  catch e
    console.log e.message
  return

split = (raw, lo, hi) ->
  raw - ((hi + lo) / 2.0)

calibratorMid = (dataCondition, calibrate, calibrating) ->
  try
    tH = undefined
    if dataCondition.dataHistory.max == undefined
      dataCondition.dataHistory.max = dataCondition.cookedValue.copy()
      dataCondition.dataHistory.min = dataCondition.cookedValue.copy()
    tH = dataCondition.dataHistory
    if dataCondition.cookedValue.x > tH.max.x
      tH.max.x = dataCondition.cookedValue.x
    if dataCondition.cookedValue.y > tH.max.y
      tH.max.y = dataCondition.cookedValue.y
    if dataCondition.cookedValue.z > tH.max.z
      tH.max.z = dataCondition.cookedValue.z
    if dataCondition.cookedValue.x < tH.min.x
      tH.min.x = dataCondition.cookedValue.x
    if dataCondition.cookedValue.y < tH.min.y
      tH.min.y = dataCondition.cookedValue.y
    if dataCondition.cookedValue.z < tH.min.z
      tH.min.z = dataCondition.cookedValue.z
    dataCondition.cookedValue.x = split(dataCondition.cookedValue.x, tH.min.x, tH.max.x)
    dataCondition.cookedValue.y = split(dataCondition.cookedValue.y, tH.min.y, tH.max.y)
    dataCondition.cookedValue.z = split(dataCondition.cookedValue.z, tH.min.z, tH.max.z)
  catch e
    console.log e.message
  return

calibratorSmooth = (dataCondition, calibrate, calibrating) ->
  try
    if dataCondition.dataHistory.runniongSum == undefined
      dataCondition.dataHistory.runningSum = dataCondition.cookedValue.copy()
    dataCondition.cookedValue = dataCondition.dataHistory.runningSum.multiply(0.75).add(dataCondition.cookedValue.copy().multiply(0.25)).copy()
  catch e
    console.log e.message
  return

#
##  ## readingHandler()
## create and return a function to handle a sensor's new data

readingHandler = (o) ->
  dataCondition =
    curValue: seen.P(0, 0, 0)
    cookedValue: seen.P(0, 0, 0)
    dataHistory: {}
  # if there is no calibration function, just use a null offset
  if !o.calibrator

    o.calibrator = (d) ->
      d.cookedValue = d.curValue
      return

  if !o.units
    o.units = ''
  o.bias = seen.P(0, 0, 0)
  $('#' + o.debias).click ->
    o.bias = o.cookedValue
    console.log o
    return
  (data) ->
    # data points from Evothings library are seen.Point NOT compatible as sources
    r = o.source(data)
    p = undefined
    m = undefined
    # get the sensor data and pass to conditioner
    r = seen.P(r.x, r.y, r.z)
    r.subtract o.bias
    dataCondition.curValue = r.copy()
    dataCondition.cookedValue = r.copy()
    i = 0
    while i < o.calibrator.length
      o.calibrator[i] dataCondition, calibrate, calibrating
      i++
    p = dataCondition.cookedValue
    if recording
      readings.push new reading(
        sensor: o.sensor
        x: p.x
        y: p.y
        z: p.z
        raw: _.toArray(data))
    m = dataCondition.dataHistory
    $('#' + o.htmlID).html templater(p.x, p.y, p.z, o.sensor, o.units) + '<br>' + templater(r.x, r.y, r.z, 'raw') + (if m.min then '<br>' + pointFormat(m.min, 'min') + '<br>' + pointFormat(m.max, 'max') else '') + (if m.grandAverage then '<br>' + pointFormat(m.grandAverage, 'ave') else '') + '<br>' + bufferToHexStr(data)
    o.viewer p.x, p.y, p.z
    return

setBackgroundColor = (color) ->
  document.documentElement.style.background = color
  document.body.style.background = color
  return

###*
# Convert byte buffer to hex string.
# @param buffer - an Uint8Array
# @param offset - byte offset
# @param numBytes - number of bytes to read
# @return string with hex representation of bytes
###

bufferToHexStr = (buffer, offset, numBytes) ->
  hex = ''
  if !numBytes
    numBytes = buffer.length
  if !offset
    offset = 0
  i = 0
  while i < numBytes
    hex += byteToHexStr(buffer[offset + i]) + ' '
    ++i
  hex

byteToHexStr = (d) ->
  lo = hx[d & 0xf]
  hi = hx[(d & 0xf0) >> 4]
  hi + lo

# ## stopRecording
# halt the record session -- no restart allowed
# upload button remains enabled, reset button remains enabled

stopRecording = ->
  if recording
    recording = false
    $('#record').prop('disabled', true).text('finished').fadeTo 200, 0.3
  return

viewSensor = (viewport, scaleFactor) ->
  height = 200
  width = 200
  model = seen.Models['default']()
  scene = new (seen.Scene)(
    model: model
    viewport: seen.Viewports.center(width, height))
  context = seen.Context(viewport, scene)
  cubie = seen.Shapes.cube().scale(0.25)

  spearPool = (many) ->
    i = undefined
    j = undefined
    shapes = new Array(many)
    count = -1
    colors = new Array(many)

    newArrow = (model, x, y, z) ->
      alphaDecay = 255
      count = count + 1
      if count == many
        count = 0
      if shapes[count]
        model.remove shapes[count]
      shapes[count] = seen.Shapes.arrow(1, 18, 0.5, 2, 1).scale(-1, 1, 1).translate(20, 0, 0).scale(height * 0.025)
      model.add(shapes[count])
      shapes[count].bake()
      shapes[count].reset()
      # assign alpha to the arrows color
      j = 0
      i = count
      while i < many
        if shapes[i]
          shapes[i].fill colors[j++]
        i++
      i = 0
      while i < count
        if shapes[i]
          shapes[i].fill colors[j++]
        i++
      shapes[count]

    i = 0
    while i < many
      shapes[i] = seen.Shapes.arrow(1, 18, 0.5, 2, 1).scale(-1, 1, 1).translate(20, 0, 0).scale(height * 0.025)
      shapes[i].bake()
      colors[i] = new (seen.Material)(new (seen.Color)(255, 80, 255, 255 - 250 / many * i))
      i++
    newArrow

  newValue = (x, y, z) ->
    p1 = seen.P(x, y, z)
    spear = undefined
    pOriginal = p1.copy()
    pBar = seen.P(1, 0, 0)
    m = undefined
    q = undefined
    cross = undefined
    dot = undefined
    leng = p1.magnitude()
    p1 = p1.normalize()
    pBar.add p1
    if pBar.magnitude() < 0.000001

      ### this is a 180 degree rotation, so use y axis as rotation vector ###

      pBar = seen.P(0, 1, 0)
    pBar.normalize()
    q = seen.Quaternion.pointAngle(pBar, Math.PI)
    m = q.toMatrix()
    spear = spearFromPool(model, x, y, z).transform(m).scale(scaleFactor * leng)
    spear.fill new (seen.Material)(new (seen.Color)(255, 80, 255))
    context.render()
    return

  spearFromPool = new spearPool(10)
  cubie.fill new (seen.Material)(new (seen.Color)(25, 200, 200, 100))
  model.add cubie
  newValue

# ## subsection State routines that depend on hardware and update the view or data structures
# calculations implemented as based on TI wiki pages
# http://processors.wiki.ti.com/index.php/SensorTag_User_Guide
accelerometerHandler = readingHandler(
  sensor: 'accel'
  debias: 'calibrateAccel'
  source: sensortag.getAccelerometerValues
  units: 'G'
  calibrator: [
    calibratorAverage
    calibratorSmooth
  ]
  viewer: viewSensor('accel-view', 0.4)
  htmlID: 'AccelerometerData')
magnetometerHandler = readingHandler(
  sensor: 'mag'
  debias: 'calibrateMag'
  calibrator: [
    calibratorAverage
    calibratorSmooth
  ]
  source: sensortag.getMagnetometerValues
  units: '&micro;T'
  viewer: viewSensor('magnet-view', 0.05)
  htmlID: 'MagnetometerData')
gyroscopeHandler = readingHandler(
  sensor: 'gyro'
  debias: 'calibrateGyro'
  calibrator: [
    calibratorAverage
    calibratorSmooth
  ]
  source: sensortag.getGyroscopeValues
  viewer: viewSensor('gyro-view', 0.005)
  htmlID: 'GyroscopeData')



$ ->
  console.log 'hello'
  initAll()
  $('.suppress').hide()
  $('#reset').prop('disabled', false).fadeTo(0, 1).click enterReset
  $(document).on 'deviceready', initialiseSensorTag
  initialiseSensorTag()
  return

 #---
exports = initialiseSensorTag
# generated by js2coffee 2.0.1
