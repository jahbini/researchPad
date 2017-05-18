Backbone = require 'Backbone'
{EventModel} = require './event-model.coffee'

buglog = require '../lib/buglog.coffee'
devicelogger = (devicelog= new buglog "sensor").log

Pipeline = require('../lib/pipeline.coffee')

infoService =       "0000180a-0000-1000-8000-00805f9b34fb"
infoService =       "180a"


boilerplate =
		firmwareVersion:    "2a26"
		modelNumber:        "2a24"
		serialNumber:       "2a25"
		softwareVersion:    "2a28"
accelerometer = 
    service:        "F000AA80-0451-4000-B000-000000000000"
    data:           "F000AA81-0451-4000-B000-000000000000" # read/notify 3 bytes X : Y : Z
    notification:   "F0002902-0451-4000-B000-000000000000"
    configuration:  "F000AA82-0451-4000-B000-000000000000" # read/write 1 byte
    period:         "F000AA83-0451-4000-B000-000000000000" # read/write 1 byte Period = [Input*10]ms

accelerometer.notification =  '00002902-0000-1000-8000-00805f9b34fb'  
accelerometer.notification =  '2902'  
accelerometer.period =   'F000AA83-0451-4000-B000-000000000000'

ab2str = (buf)->
   return String.fromCharCode.apply null, new Uint8Array buf

lastDisplay = 0

str2ab = (str)->
  buf = new ArrayBuffer(str.length*2); # 2 bytes for each char
  bufView = new Uint16Array(buf)
  bufView[i] = str.charCodeAt(i) for i in str
      
  return buf
  
exports.deviceModel = Backbone.Model.extend
  defaults:
    buttonText: 'connect'
    buttonClass: 'button-primary'
    deviceStatus: '--'
    rate: 20
    lastDisplay: Date.now()
  urlRoot: ->
    Pylon.get('hostUrl')+'sensor-tag'
  #idAttribute: "name"
  initialize: ->
    @chain = @.createVisualChain @
    @on "change:role", ()->
      @.set 'readings', new EventModel (@.get 'role'),@ 
    @on "change:rate",@subscribe
    @on "change:serialNumber", ()->
      data = @.get 'serialNumber'
      role = @.get 'role'
      $("##{role}SerialNumber").html @.get 'serialNumber'
      #place serial number in sessionInfo
      session = Pylon.get 'sessionInfo'
      if role == 'Right'
        session.set 'SerialNoR', data
      if role == 'Left'
        session.set 'SerialNoL', data
      return
    @on "change:firmwareVersion",()->
      data = @.get 'firmwareVersion'
      role = @.get 'role'
      $("##{role}Version").html data
      #place firmware app level in sessionInfo
      session = Pylon.get 'sessionInfo'
      if role == 'Right'
        session.set 'FWLevelR', data
      if role == 'Left'
        session.set 'FWLevelL', data
      return


    Pylon.on "speed",(val)->@.set 'rate',val
    return @
    
  getBoilerplate: ()->
    plates = []
    promises = for attribute, uuid of boilerplate
      devicelogger "Device #{@.attributes.name}: getting #{attribute} at #{uuid}"
      plates.push new Promise (resolve,reject)=>
        # capture current value of attribute
        attr = attribute
        ble.read @.id,
          infoService
          uuid
          (data)=>
            val = ab2str data
            devicelogger "Setting attribute for #{attr} to #{val}"
            @.set attr, val
            resolve()
          (err)=>
            devicelogger "unable to obtain #{attr} from #{@.attributes.name}"
            reject()
        devicelogger "Promised attribute for #{attr}"
    return plates
    
  stopNotification: (device)->
    devicelogger "stopNotification entry"
    configData = new Uint16Array 1
      #Turn off gyro, accel, and mag, 2G range, Disable wake on motion
    configData[0] = 0x0000;
    ble.withPromises.stopNotification device.id,
        accelerometer.service
        accelerometer.data
        (whatnot)=> 
          devicelogger "stopNotification Terminated movement monitor. device #{device.name}"
          resolve()
        (e)=>
          devicelogger "stopNotification error terminating movement device #{device.name} monitor #{e}"
          reject()
          
  subscribe: ()-> return (device)=>
    idlePromise= ()->
      return new Promise (resolve,reject)->
        devicelogger "idlePromise entry"
        setTimeout resolve,100
    
    startNotification= ()=>
      devicelogger "startNotification entry"
      new Promise (resolve,reject)=>
        ble.withPromises.startNotification device.id,
          accelerometer.service
          accelerometer.data
          # convert raw iOS data into js and update the device model
          (data)=>
            @processMovement new Int16Array(data)
          (xxx)=>
            devicelogger "startNotification failure for device #{device.name}: #{xxx}"
            reject()
      
    setPeriod= ()=>
      devicelogger "setPeriod entry"
      return new Promise (resolve,reject)=>
        periodData = new Uint8Array(1);
        periodData[0] = @.attributes.rate;
        devicelogger "Timing parameter for sensor rate = #{@.attributes.rate}"
        ble.write @.attributes.id,
          accelerometer.service
          accelerometer.period
          periodData.buffer
          ()=>
            devicelogger "setPeriod Configured movement #{10*@.attributes.rate}ms period device #{@.attributes.name}."
            resolve()
          (e)=>
            devicelogger "setPeriod error starting movement monitor #{e}"
            reject()
      
    activateMovement= ()->    
      devicelogger "activateMovement entry. device #{device.name}"
      configData = new Uint16Array(1);
      configData[0] = 0x017F;
      # turn accelerometer on
      #Turn on gyro, accel, and mag, 2G range, Disable wake on motion
      return ble.withPromises.write device.id,
          accelerometer.service
          accelerometer.configuration
          configData.buffer
          (whatnot)=> 
            devicelogger "activateMovement Started movement monitor. device #{device.name}"
            resolve()
          (e)=>
            devicelogger "activateMovement error starting movement device #{device.name} monitor #{e}"
            reject()
    try
    #set some attributes
      devicelogger "Device subscribe attempt #{device.name}"
  # turn accelerometer off, then set movement  parameters
      thePromise = Promise.all @getBoilerplate()
      resulting = thePromise.then(idlePromise)
      resulting = resulting.then(activateMovement)
      resulting = resulting.then(idlePromise)
      resulting = resulting.then(setPeriod)
      resulting = resulting.then(idlePromise)
      resulting = resulting.then(startNotification)
      devicelogger "the promise has been built"
      devicelogger resulting
      
      ###
      configData = new Uint16Array(1);
      #Turn off gyro, accel, and mag, 2G range, Disable wake on motion
      configData[0] = 0x0000;
      ble.stopNotification device.id,
        accelerometer.service
        accelerometer.data
        (whatnot)=> 
          devicelogger "Terminated movement monitor. device #{device.name}"
        (e)=> devicelogger "error terminating movement device #{device.name} monitor #{e}"
      ble.startNotification device.id,
        accelerometer.service
        accelerometer.data
        # convert raw iOS data into js and update the device model
        (data)=>
          debugger
          @.set rawData: new Int16Array(data);
        (xxx)=>
          devicelogger "can't start movement service for device #{device.name}: #{xxx}"
          return
    
      
      periodData = new Uint8Array(1);
      periodData[0] = @.attributes.rate;
      devicelogger "Timing parameter for sensor rate = #{@.attributes.rate}"
      ble.write @.attributes.id,
        accelerometer.service
        accelerometer.period
        periodData.buffer
        ()=> devicelogger "Configured movement #{10*@.attributes.rate}ms period device #{@.attributes.name}."
        (e)=> devicelogger "error starting movement monitor #{e}"
    
      
      # turn accelerometer on
      #Turn on gyro, accel, and mag, 2G range, Disable wake on motion
      configData[0] = 0x017F;
      ble.write device.id,
        accelerometer.service
        accelerometer.configuration
        configData.buffer
        (whatnot)=> 
          devicelogger "Started movement monitor. device #{device.name}"
        (e)=> devicelogger "error starting movement device #{device.name} monitor #{e}"
      ###
        
    catch e
      alert('Error in attachSensor -- check LOG')
      devicelogger "error in attachSensor"
      devicelogger e
      device.set deviceStatus: 'Failed connection'
    return 
    
  createVisualChain: () ->
    smoother = new Pipeline
    accelerometerHandler = smoother.readingHandler
      debias: 'calibrateAccel'
      units: 'G'
      calibrator: [
        smoother.calibratorSmooth
      ]
      viewer: (x,y,z)=>
        v= (smoother.viewSensor "accel-#{@.get 'rowName'}",1.5) unless v
        v x,y,z
        return
      finalScale: 2

    magnetometerHandler = smoother.readingHandler
      debias: 'calibrateMag'
      calibrator: [
        smoother.calibratorAverage
        smoother.calibratorSmooth
      ]
      units: '&micro;T'
      viewer: (x,y,z)=>
        v= (smoother.viewSensor "mag-#{@.get 'rowName'}",1.5) unless v
        v x,y,z
        return
      finalScale: 0.15

    gyroscopeHandler = smoother.readingHandler
      debias: 'calibrateGyro'
      calibrator: [
        smoother.calibratorAverage
        smoother.calibratorSmooth
      ]
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
  processMovement: (data)->
    if Pylon.get('globalState').get 'recording'
      @attributes.numReadings += 1
      @attributes.readings.addSample data
    #only display 10 or so readings per second
    if @lastDisplay + 120 > Date.now()
          return
    @lastDisplay = Date.now()
    
    @set gyro: data[0..2].map @sensorMpu9250GyroConvert 
    @set accel: data[3..5].map @sensorMpu9250AccConvert
    @set mag: data[7..9].map (a)-> return a

    # update the device attributes and fire changes for rssi,status
    @set deviceStatus: 'Receiving'
    @chain.gyro @attributes.gyro
    @chain.accel @attributes.accel
    @chain.mag @attributes.mag
    return

deviceCollection = Backbone.Collection.extend
  model: exports.deviceModel
Pylon.set 'devices', new deviceCollection
