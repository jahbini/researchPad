#
# vim: et:ts=2:sw=2:sts=2

Seen = require '../libs/dbg/seen'
$=require 'jquery'
_=require 'underscore'

###
#Pylon's globalStatus looks like this:
#systemCommunicator = Backbone.Model.extend
#  defaults:
#    calibrating: false
#    recording: false
#    connected: false
#    calibrate: false
#
#  Pylon.set 'globalState',  new systemCommunicator
###

class visual
  constructor: () ->

  calibratorAverage: (dataCondition, calibrate, calibrating) ->
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

  calibratorMid: (dataCondition, calibrate, calibrating) ->
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

  calibratorSmooth: (dataCondition, calibrate, calibrating) ->
    try
      if dataCondition.dataHistory.runniongSum == undefined
        dataCondition.dataHistory.runningSum = dataCondition.cookedValue.copy()
      dataCondition.cookedValue = dataCondition.dataHistory.runningSum.multiply(0.75).add(dataCondition.cookedValue.copy().multiply(0.25)).copy()
    catch e
      #console.log e.message
    return

  #
  # readingHandler()
  # create and return a function to handle a sensor's new data

  readingHandler: (o) ->
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
    (data) =>
      # data points from Evothings library are Seen.Point NOT compatible as sources
      try
        o.device.set 'deviceStatus', 'Receiving'
        theUUID = o.device.id
        $("#status-"+theUUID).text (o.device.get 'deviceStatus')
        r = o.source(data)
        #  $('#' + o.htmlID).html  templater(r.x, r.y, r.z, 'raw')
        p = undefined
        m = undefined
        # get the sensor data and pass to conditioner
        r = Seen.P(r.x, r.y, r.z)
        r.subtract o.bias
        dataCondition.curValue = r.copy()
        dataCondition.cookedValue = r.copy()
        i = 0
        while i < o.calibrator.length
          #o.calibrator[i] dataCondition, @globalState.get('calibrate'), @globalState.get('calibrating')
          # calibration has been deprecated, but if needed would be moved to some newly designed View
          o.calibrator[i] dataCondition, 0,0
          i++
        p = dataCondition.cookedValue.multiply(o.finalScale)
        m = dataCondition.dataHistory
        o.viewer p.x, p.y, p.z

        # record the data from all three channels of old sensor
        # New sensor data is identical for all channels, and only needs one
        if Pylon.get('globalState').get 'recording'
          if o.device.get('type') !=  evothings.tisensortag.CC2650_BLUETOOTH_SMART
            o.readings.push sensor: o.sensor, raw: _.toArray(data)
            o.readings.trigger 'change'
          else if o.sensor == 'gyro'
            o.readings.push sensor: "movement", raw: _.toArray(data)
            o.readings.trigger 'change'

      catch error
        console.log error
        console.log "in readinghandler"
      return

  ###
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


  viewSensor: (viewport, scaleFactor) ->
    height = 200
    width = 200
    model = Seen.Models['default']()
    scene = new (Seen.Scene)(
      model: model
      viewport: Seen.Viewports.center(width, height))
    cubie = Seen.Shapes.cube().scale(0.25)
    sceneUse = 0

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
        pBar = Seen.P(0, 1, 0) # this is a 180 degree rotation, so use y axis as rotation vector
      pBar.normalize()
      q = Seen.Quaternion.pointAngle(pBar, Math.PI)
      m = q.toMatrix()
      spear = spearFromPool(model, x, y, z).transform(m).scale(scaleFactor * leng)
      spear.fill new (Seen.Material)(new (Seen.Color)(255, 80, 255))
      context = Seen.Context(viewport, scene) if !context
      context.render()
      if sceneUse++ >  Math.random(500)+750
        sceneUse = 0
        scene.flushCache()
      return

    spearFromPool = new spearPool Pylon.get('spearCount')
    cubie.fill new (Seen.Material)(new (Seen.Color)(25, 200, 200, 100))
    model.add cubie
    newValue


if window? then window.exports = visual
if module?.exports? then module.exports = visual
