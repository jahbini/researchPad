# # stagapp
# vim: et:ts=2:sw=2:sts=2
# ## data handler for clinical recording of SensorTag data
# SensorTag object.

Backbone = require ('backbone')
_ = require('underscore')
require('./libs/dbg/console')
Backbone.$ = $ = require('jquery')
Seen = require('./libs/dbg/seen')
pages = require './pages.coffee'


evothings = window.evothings ={}
evothings.util = require('./libs/evothings/util/util').util
evothings.easyble =require('./libs/evothings/easyble/easyble').easyble
evothings.tisensortag=require('./libs/evothings/tisensortag/tisensortag').tisensortag
sensortag = evothings.tisensortag.createInstance()

recording = false
connected = false
reading = undefined
readings = undefined
calibrating = false
calibrate = false

temp = Backbone.Model.extend ->
  defaults:
    user: ''
    patient: ''
    testID: ''
    hostUrl: undefined

sessionInfo = new temp


# ## Hardware
# external communications to Hardware
#
# set up the sensorTag and configure to recieve
# accelerometer, magnetometer and gyro data
#

initializeSensorTag = ->
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
  sensortag.statusCallback(statusHandler)
  sensortag.errorCallback(errorHandler)
  sensortag.keypressCallback(keypressHandler)
  sensortag.accelerometerCallback(accelerometerHandler, 100)
  sensortag.magnetometerCallback(magnetometerHandler, 100)
  sensortag.gyroscopeCallback(gyroscopeHandler, 100, 7)
  sensortag.connectToClosestDevice()
  return

# ## section: View
# routines to control or coordinate with user
#

templater = (x, y, z, sensor='unknown', unit='') ->
  sensor + ' x=' + (if x >= 0 then '+' else '') + x.toFixed(2) + unit + ' -- ' + 'y=' + (if y >= 0 then '+' else '') + y.toFixed(2) + unit + ' -- ' + 'z=' + (if z >= 0 then '+' else '') + z.toFixed(2) + unit

pointFormat = (p, unit ='v', precision=2) ->
  unit + ' x=' + (if p.x >= 0 then '+' else '') + p.x.toFixed(precision) + ' -- ' + 'y=' + (if p.y >= 0 then '+' else '') + p.y.toFixed(precision) + ' -- ' + 'z=' + (if p.z >= 0 then '+' else '') + p.z.toFixed(precision)

startRecording= () ->
  enterRecording()
  return false

startStop= () ->
  enterStop()
  return false

startDebug = () ->
  pageGen.activateButtons buttonModelDebugOn
  $('#footer').show()
  return false

stopDebug = () ->
  pageGen.activateButtons buttonModelDebugOff
  $('#footer').hide()
  return false

startReset = () ->
  enterReset()
  return false

startUpload = () ->
  enterUpload()
  return false

startCalibrate = () ->
  enterCalibrate()
  return false

startAdmin = () ->
  enterAdmin()
  return false

enterAdmin = ->
  clearButtons()
  pageGen.activateAdminPage buttonModelDebugOff
  return false

buttonModelDebugOn =
  selector: '#debug'
  text: "Hide Log"
  funct: stopDebug
buttonModelDebugOff =
  selector: '#debug'
  text: "Show Log"
  funct: startDebug
buttonModelActionRecord =
  selector: '#action',
  text: 'Record',
  funct: startRecording

buttonModelActionStop =
  selector: '#action',
  text: 'Stop',
  funct: startStop
    
buttonModelReset =
  selector: '#reset'
  text: 'Clear'
  funct: startReset

buttonModelUpload =
  selector: '#upload'
  text: 'Upload'
  funct: startUpload

buttonModelCalibrate =
  selector: '#calibrate'
  text: 'Calibrate'
  funct: startCalibrate

buttonModelAdmin =
  selector: '#admin'
  text: 'Admin'
  funct: startAdmin

  
clearButtons = ->
  pageGen.deactivateButtons buttonModelAdmin, buttonModelDebugOff,
    buttonModelActionRecord,buttonModelUpload,buttonModelCalibrate,buttonModelReset
  return

clearUserInterface = ->
  # Clear current values.
  blank = 'Waiting...'
  $('#StatusData').html 'Ready to connect'
  $('#FirmwareData').html '?'
  $('#KeypressData').html ''
  $('#AccelerometerData').html blank
  $('#MagnetometerData').html blank
  $('#GyroscopeData').html blank
  $('#TotalReadings').html 0
  # Reset screen color.
  setBackgroundColor 'white'
  pageGen.activateButtons buttonModelAdmin, buttonModelDebugOff
  return

countReadings = ->
  $('#TotalReadings').html readings.length
  return

# ## Section: Data Structures
# Routines to create and handle data structures and interfaces to them
#

user = Backbone.Model.extend
  defaults:
    name: 'Text'
    password: 'Password'
    patientOnly: 'Boolean'
host = Backbone.Model.extend
  defaults:
    hostUrl: 'Text'
    name: 'Text'
test = Backbone.Model.extend
  defaults:
    name: "test 0"
    Description: "Test 0"

userCollection = Backbone.Collection.extend
  model: user
  url: '/users'

hostCollection = Backbone.Collection.extend
  model: host
  url:"/host_list.json"

testCollection = Backbone.Collection.extend
  model: test
  url: "/tests_list.json"
users = new userCollection
users.push new user(
    name: 'Jim'
    password: 'Y'
    patientOnly: false
  )
users.push new user(
    name: 'Harry'
    password: 'Y'
    patientOnly: false
  )
users.push new user(
    name: 'Sam'
    password: 'Y'
    patientOnly: true
  )
users.push new user(
    name: 'Bob'
    password: 'Y'
    patientOnly: true
  )

hosts = new hostCollection
hosts.push new host(
  name: 'saal'
  url: 'http://www.saal.org:3000'
)
hosts.push new host(
  name: 'local'
  url: 'http://192.168.1.200:3000'
)
hosts.push new host(
  name: 'Cloud 9'
  url: 'https://stagserv-jahbini.c9.io'
)
tests = new testCollection
tests.push new test
  name: 'test1'
  Description: 'Test 1'
  
tests.push new test
  name: 'test2'
  Description: 'Test 2'
  

adminData = Backbone.Model.extend
  defaults:
    host: hosts
    user: users
    testIDs: tests

admin = new adminData

initDataStructures = ->
  rtemp = undefined
  reading = Backbone.Model.extend(
    defaults:
      sensor: 'gyro'
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
  readings.push(
    new reading raw: [ 1,2,3,4,5,6], sensor: 'Test'
    )
  return

# ## Section State Handlers

initAll = ->
  rtemp = undefined
  clearButtons()
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
  return false

enterReset = ->
  # Reset only clears the data -- does NOT disconnedt
  reading = false
  readings = null
  recording = false
  initDataStructures()
  $('#TotalReadings').html '0'
  pageGen.deactivateButtons buttonModelReset,buttonModelUpload
  if connected
    pageGen.activateButtons buttonModelActionRecord,buttonModelCalibrate
    pageGen.deactivateButtons buttonModelAdmin
  else
    pageGen.activateButtons buttonModelAdmin
  return false

enterConnected = ->
  # enable the recording button
  connected = true
  pageGen.deactivateButtons buttonModelAdmin
  pageGen.activateButtons buttonModelActionRecord,buttonModelCalibrate
  return false

enterCalibrating = ->
  pageGen.deactivateButtons buttonModelRecord, buttonModelUpload
  pageGen.activateButtons {
    selector: '#calibrate'
    text: 'Exit Calibrate'
    funct: exitCalibrating
  }
  calibrating = true
  return false

exitCalibrating = ->
  calibrating = false
  pageGen.activateButtons buttonModelRecord, buttonModelCalibrate 
  return false

enterRecording = ->
  pageGen.activateButtons buttonModelActionStop
  recording = true
  return

enterStop = ->
  pageGen.deactivateButtons {
    selector: '#action'
    text: 'recorded'
    funct: () ->
  }
  pageGen.activateButtons buttonModelUpload, buttonModelReset
  recording = false
  return

enterUpload = ->
  hopper = undefined
  brainDump = undefined
  #    eliminate empty uploads per : https://github.com/jahbini/stagapp/issues/15 */
  if !readings.length
   return 
  hostUrl= sessionInfo.get 'hostUrl'
  hopper = Backbone.Model.extend {
    url: '/trajectory'
    urlRoot: hostUrl
  }
  brainDump = new hopper 
    readings: readings
    session: sessionInfo

  brainDump.save()
  pageGen.deactivateButtons buttonModelUpload, buttonModelReset
  readings.reset()
  enterConnected()
  return

#
# ### Subsection State Handlers that depend on the Hardware

statusHandler = (status) ->
  console.log status
  if 'Sensors online' == status
    enterConnected()
    sensortag.id? console?.log sensortag.id
  if 'Device data available' == status
    $('#FirmwareData').html sensortag.getFirmwareString()
  $('#StatusData').html status
  return

errorHandler = (error) ->
  console?.log 'Error: ' + error
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
      dataCondition.dataHistory.grandTotal = Seen.P(0, 0, 0)
      dataCondition.dataHistory.grandAverage = Seen.P(0, 0, 0)
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
    #console.log e.message
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
    #console.log e.message
  return

calibratorSmooth = (dataCondition, calibrate, calibrating) ->
  try
    if dataCondition.dataHistory.runniongSum == undefined
      dataCondition.dataHistory.runningSum = dataCondition.cookedValue.copy()
    dataCondition.cookedValue = dataCondition.dataHistory.runningSum.multiply(0.75).add(dataCondition.cookedValue.copy().multiply(0.25)).copy()
  catch e
    #console.log e.message
  return

#
##  ## readingHandler()
## create and return a function to handle a sensor's new data

readingHandler = (o) ->
  dataCondition =
    curValue: Seen.P(0, 0, 0)
    cookedValue: Seen.P(0, 0, 0)
    dataHistory: {}
  # if there is no calibration function, just use a null offset
  if !o.calibrator
    o.calibrator = (d) ->
      d.cookedValue = d.curValue
      return

  if !o.units
    o.units = ''
  o.bias = Seen.P(0, 0, 0)
  $('#' + o.debias).click ->
    o.bias = o.cookedValue
    #console.log o
    return
  (data) ->
    # data points from Evothings library are Seen.Point NOT compatible as sources
    try
      r = o.source(data)
      p = undefined
      m = undefined
      # get the sensor data and pass to conditioner
      r = Seen.P(r.x, r.y, r.z)
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
          raw: _.toArray(data))
      m = dataCondition.dataHistory
      $('#' + o.htmlID).html  templater(r.x, r.y, r.z, 'raw')
      o.viewer p.x, p.y, p.z
      return
    catch error
      console.log error

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
  model = Seen.Models['default']()
  scene = new (Seen.Scene)(
    model: model
    viewport: Seen.Viewports.center(width, height))
  cubie = Seen.Shapes.cube().scale(0.25)

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
      shapes[count] = Seen.Shapes.arrow(1, 18, 0.5, 2, 1).scale(-1, 1, 1).translate(20, 0, 0).scale(height * 0.025)
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
      shapes[i] = Seen.Shapes.arrow(1, 18, 0.5, 2, 1).scale(-1, 1, 1).translate(20, 0, 0).scale(height * 0.025)
      shapes[i].bake()
      colors[i] = new (Seen.Material)(new (Seen.Color)(255, 80, 255, 255 - 250 / many * i))
      i++
    newArrow

  newValue = (x, y, z) ->
    p1 = Seen.P(x, y, z)
    spear = undefined
    pOriginal = p1.copy()
    pBar = Seen.P(1, 0, 0)
    m = undefined
    q = undefined
    cross = undefined
    dot = undefined
    leng = p1.magnitude()
    p1 = p1.normalize()
    pBar.add p1
    if pBar.magnitude() < 0.000001
      pBar = Seen.P(0, 1, 0) # this is a 180 degree rotation, so use y axis as rotation vector ###
    pBar.normalize()
    q = Seen.Quaternion.pointAngle(pBar, Math.PI)
    m = q.toMatrix()
    spear = spearFromPool(model, x, y, z).transform(m).scale(scaleFactor * leng)
    spear.fill new (Seen.Material)(new (Seen.Color)(255, 80, 255))
    context = Seen.Context(viewport, scene) if !context
    context.render()
    return

  spearFromPool = new spearPool(10)
  cubie.fill new (Seen.Material)(new (Seen.Color)(25, 200, 200, 100))
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

deviceIsReady = false
setSensor = ->
  pageGen.activateSensorPage()
  if deviceIsReady
    initializeSensorTag()
  initAll()
  return false

pageGen = new pages.Pages admin, sessionInfo
### this is how seen exports things -- it's clean.  we use it as example
#seen = {}
#if window? then window.seen = seen # for the web
#if module?.exports? then module.exports = seen # for node
###
###  And since we are in a browser ---
###
window.$=$
#---
# generated by js2coffee 2.0.1

pageEmpty=true

$(document).on 'deviceready', ->
  deviceIsReady = true

$ ->
  clearButtons()
  pageGen.renderPage setSensor
  pageEmpty = false
  if $('#console-log')?
    window.console=console = new Console('console-log')
    console.log 'hello'
    stopDebug()
  return false

