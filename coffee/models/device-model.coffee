Backbone = require 'Backbone'

Pipeline = require('../lib/pipeline.coffee')

      
accelerometer = 
    service: "F000AA80-0451-4000-B000-000000000000"
    data: "F000AA81-0451-4000-B000-000000000000" # read/notify 3 bytes X : Y : Z
    notification:"F0002902-0451-4000-B000-000000000000"
    configuration: "F000AA82-0451-4000-B000-000000000000" # read/write 1 byte
    period: "F000AA83-0451-4000-B000-000000000000" # read/write 1 byte Period = [Input*10]ms
    
exports.deviceModel = Backbone.Model.extend
  defaults:
      buttonText: 'connect'
      buttonClass: 'button-primary'
      deviceStatus: '--'
  urlRoot: ->
    Pylon.get('hostUrl')+'sensor-tag'
  #idAttribute: "name"
  initialize: ->
    @chain = @.createVisualChain @
    @on "change:rawData",@processMovement
    return @
    
  subscribe: ()-> return (device)=>
    console.log "Device info at Subscribe time"
    debugger
    try
    #set some attributes
    
      console.log "Device subscribe attempt #{device.name}"

      ble.startNotification device.id,
        accelerometer.service
        accelerometer.data
        # convert raw iOS data into js and update the device model
        (data)=> @.set rawData: new Int16Array(data);
        (xxx)=>
          debugger
          console.log "can't start movement service for device #{@.cid}"
          return
      # turn accelerometer on
      configData = new Uint16Array(1);
      #Turn on gyro, accel, and mag, 2G range, Disable wake on motion
      configData[0] = 0x007F;
      ble.write device.id,
        accelerometer.service
        accelerometer.configuration
        configData.buffer
        ()=> console.log "Started movement monitor. device #{@.cid}"
        (e)=> console.log "error starting movement device #{@.cid} monitor #{e}"

      periodData = new Uint8Array(1);
      periodData[0] = 0x0A;
      ble.write device.id,
        accelerometer.service
        accelerometer.period
        periodData.buffer
        ()=> console.log "Configured movement period device #{@.cid}."
        (e)=> console.log "error starting movement monitor #{e}"
    catch e
      alert('Error in attachSensor -- check LOG')
      console.log "error in attachSensor"
      console.log e
    return device  
    
  createVisualChain: () ->
    smoother = new Pipeline
    accelerometerHandler = smoother.readingHandler
      device: @
      sensor: 'accel'
      debias: 'calibrateAccel'
      source: (data)=>
        (@.get 'getAccelerometerValues') data
      units: 'G'
      calibrator: [
        smoother.calibratorSmooth
      ]
      viewer: (x,y,z)=>
        v= (smoother.viewSensor "accel-#{@.get 'rowName'}",1.5) unless v
        v x,y,z
        return
      finalScale: 1

    magnetometerHandler = smoother.readingHandler
      device: @
      sensor: 'mag'
      debias: 'calibrateMag'
      calibrator: [
        smoother.calibratorAverage
        smoother.calibratorSmooth
      ]
      source: (data)=>
        (@.get 'getMagnetometerValues') data
      units: '&micro;T'
      viewer: (x,y,z)=>
        v= (smoother.viewSensor "mag-#{@.get 'rowName'}",1.5) unless v
        v x,y,z
        return
      finalScale: 1

    gyroscopeHandler = smoother.readingHandler
      device: @
      sensor: 'gyro'
      debias: 'calibrateGyro'
      calibrator: [
        smoother.calibratorAverage
        smoother.calibratorSmooth
      ]
      source: (data)=>
        (@.get 'getGyroscopeValues') data
      viewer: (x,y,z)=>
        v= (smoother.viewSensor "gyro-#{@.get 'rowName'}",1.5) unless v
        v x,y,z
        return
      finalScale: 1

    return gyro: gyroscopeHandler
      , accel: accelerometerHandler
      , mag: magnetometerHandler
    return
 
   
  sensorMpu9250GyroConvert: (data)->
      return data / (65536/500)

  sensorMpu9250AccConvert: (data)->
      #// Change  /2 to match accel range...i.e. 16 g would be /16
      return data / (32768 / 2)

  #//0 gyro x //1 gyro y //2 gyro z
  #//3 accel x //4 accel y //5 accel z
  #//6 mag x //7 mag y //8 mag z
  processMovement: ()->
    data = @.attributes.rawData
    @set gyro: data[0..2].map @sensorMpu9250GyroConvert 
    @set accel: data[3..5].map @sensorMpu9250AccConvert
    @set mag: data[7..9].map (a)-> return a
    if Pylon.get('globalState').get 'recording'
      @attributes.numReadings += 1
      @attributes.readings.addSample data
    #only display 10 or so readings per second
    if lastDisplay + 90 > Date.now()
          return
    lastDisplay = Date.now()

    # update the device attributes and fire changes for rssi,status
    @set deviceStatus: 'Receiving'
    @chain.gyro @attributes.gyro
    @chain.accel @attributes.accel
    @chain.mag @attributes.mag
    return

deviceCollection = Backbone.Collection.extend
  model: exports.deviceModel
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
